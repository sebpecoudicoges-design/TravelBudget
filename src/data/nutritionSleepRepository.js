import { isDuplicateNutritionError, loadSleepRows, requireLocalWrite, unwrap, writeJson } from './nutritionRepository.js';

const localSleepReplay = new Map();

export function saveSleepRows({ storage, key, rows }) {
  try { loadSleepRows({ storage, key, strict: true }); } catch (_) { return false; }
  return writeJson(storage, key, rows || {});
}

const sleepDate = /^\d{4}-\d{2}-\d{2}$/;

function sleepTime(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : -Infinity;
}

export function mergeSleepRows({ storage, key, rows }) {
  const current = loadSleepRows({ storage, key, strict: true });
  Object.entries(rows || {}).forEach(([day, row]) => {
    if (!sleepDate.test(day) || !row || current[day]?.pending) return;
    const updatedAt = row.updatedAt || row.updated_at || '';
    if (current[day] && (sleepTime(updatedAt) < sleepTime(current[day].updatedAt)
      || (current[day].deleted && sleepTime(updatedAt) <= sleepTime(current[day].updatedAt)))) return;
    const hours = Number(row.hours);
    current[day] = { hours: Number.isFinite(hours) ? hours : 0, quality: String(row.quality || 'ok'), updatedAt };
  });
  requireLocalWrite(saveSleepRows({ storage, key, rows: current }));
  return current;
}

function sleepLock(key, operation, locks = globalThis.navigator?.locks) {
  return typeof locks?.request === 'function'
    ? locks.request(`travelbudget:sleep-storage:${key}`, operation)
    : operation();
}

export function mergeSleepSnapshot({ storage, key, rows, locks, isCurrent = () => true }) {
  return sleepLock(key, () => isCurrent() ? mergeSleepRows({ storage, key, rows }) : null, locks);
}

export function saveSleepDraft({ storage, key, day, hours, quality, locks, isCurrent = () => true,
  now = () => new Date(), id = () => globalThis.crypto?.randomUUID?.() || `sleep_${Date.now()}_${Math.random()}`,
}) {
  if (!sleepDate.test(day)) throw new TypeError('Invalid sleep date');
  return sleepLock(key, () => {
    if (!isCurrent()) return null;
    const rows = loadSleepRows({ storage, key, strict: true });
    const current = rows[day];
    const base = current?.pending ? current.base :
      current && !current.deleted ? { hours: current.hours, quality: current.quality, updatedAt: current.updatedAt } : null;
    const draft = { hours, quality, updatedAt: now().toISOString(), deleted: hours <= 0, pending: true, writeId: id(), base };
    rows[day] = draft;
    requireLocalWrite(saveSleepRows({ storage, key, rows }));
    return draft;
  }, locks);
}

function sleepConflict() {
  const error = new Error('Sleep was changed on another device. The local edit was retained.');
  error.code = 'NUTRITION_SLEEP_CONFLICT';
  return error;
}

export async function persistSleepDraft({ client, table, userId, day, row, isCurrent = () => true }) {
  if (!isCurrent()) throw new Error("Sleep account changed.");
  const remote = unwrap(await client.from(table).select('hours,quality,updated_at')
    .eq('user_id', userId).eq('sleep_date', day).maybeSingle());
  if (!isCurrent()) throw new Error('Sleep account changed.');
  if (row.deleted && !remote) return row.updatedAt;
  if (remote && !row.deleted && Number(remote.hours) === row.hours && remote.quality === row.quality) return remote.updated_at;
  const base = row.base;
  if (remote && (!base || (remote.updated_at !== base.updatedAt
    && (Number(remote.hours) !== Number(base.hours) || remote.quality !== base.quality)))) throw sleepConflict();
  if (!remote && base) throw sleepConflict();
  if (!remote) {
    const result = await client.from(table).insert({
      user_id: userId, sleep_date: day, hours: row.hours, quality: row.quality, updated_at: row.updatedAt,
    }).select('updated_at').single();
    if (isDuplicateNutritionError(result?.error)) throw sleepConflict();
    return unwrap(result).updated_at;
  }
  const next = client.from(table);
  const change = row.deleted ? next.delete() : next.update({ hours: row.hours, quality: row.quality, updated_at: row.updatedAt });
  const written = unwrap(await change.eq('user_id', userId).eq('sleep_date', day)
    .eq('updated_at', remote.updated_at).select('updated_at').maybeSingle());
  if (!written) throw sleepConflict();
  return row.deleted ? row.updatedAt : written.updated_at;
}

export async function flushSleepDrafts({ storage, key, write, locks = globalThis.navigator?.locks,
  isCurrent = () => true,
}) {
  const flush = async () => {
    if (!isCurrent()) return 0;
    const rows = loadSleepRows({ storage, key, strict: true });
    let written = 0;
    let failure;
    for (const [day, draft] of Object.entries(rows)) {
      if (!isCurrent()) break;
      if (!sleepDate.test(day) || !draft.pending || !draft.writeId) continue;
      const live = loadSleepRows({ storage, key, strict: true })[day];
      if (live?.writeId !== draft.writeId) continue;
      try {
        const timestamp = await write(day, draft);
        await sleepLock(key, () => {
          if (!isCurrent()) return;
          const current = loadSleepRows({ storage, key, strict: true });
          const latest = current[day];
          if (!latest?.pending) return;
          const committed = draft.deleted ? null : { hours: draft.hours, quality: draft.quality, updatedAt: timestamp };
          current[day] = latest.writeId === draft.writeId
            ? (committed || { hours: 0, quality: draft.quality, updatedAt: timestamp, deleted: true })
            : { ...latest, base: committed };
          requireLocalWrite(saveSleepRows({ storage, key, rows: current }));
          written += 1;
        }, locks);
      } catch (error) { failure ??= error; }
    }
    if (failure) throw failure;
    return written;
  };
  if (typeof locks?.request === 'function') return locks.request(`travelbudget:sleep-replay:${key}`, flush);
  const prior = localSleepReplay.get(key) || Promise.resolve();
  const next = prior.catch(() => {}).then(flush);
  localSleepReplay.set(key, next);
  try { return await next; } finally { if (localSleepReplay.get(key) === next) localSleepReplay.delete(key); }
}
