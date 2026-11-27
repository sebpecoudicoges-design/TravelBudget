// Audit-only protocol. A conflict status alone does not authorize removal.
const syncIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
const idPattern = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const matchesPattern = (pattern, value) => typeof value === 'string' && pattern.test(value);
const revision = value => typeof value === 'string' && value.length > 0;

// Capture the identities and revisions at the moment the caller displays its
// conflict preview. Remote revision must identify the complete meal snapshot
// (header and ordered items), not just the header's updated_at field.
export function prepareMealConflict({ pending, replay, remote }) {
  if (replay?.status !== 'conflict' || replay.disposition !== 'pending'
    || !matchesPattern(idPattern, pending?.userId) || !matchesPattern(syncIdPattern, pending?.syncId)
    || !matchesPattern(idPattern, replay?.mealId) || !revision(pending?.revision)
    || !matchesRemote(remote, pending, replay.mealId) || !revision(remote?.revision)) {
    throw new Error('Nutrition conflict preview could not be confirmed');
  }
  return Object.freeze({
    userId: pending.userId, syncId: pending.syncId, mealId: replay.mealId,
    localRevision: pending.revision, remoteRevision: remote.revision,
  });
}

function matchesRemote(remote, owner, mealId) {
  return remote?.userId === owner.userId && remote.syncId === owner.syncId && remote.mealId === mealId;
}

// contextCurrent is synchronous. removeLocalIfCurrent must check account,
// revision and persisted conflict in the same local transaction as deletion.
// readRemote must return the current complete server snapshot or null if unavailable.
export async function resolveMealConflict({
  preview, choice = 'keep-pending', contextCurrent, readRemote, removeLocalIfCurrent,
}) {
  if (choice === 'keep-pending') return 'pending';
  if (choice !== 'accept-remote') throw new TypeError('Unknown nutrition conflict choice');
  if (!matchesPattern(idPattern, preview?.userId) || !matchesPattern(syncIdPattern, preview?.syncId)
    || !matchesPattern(idPattern, preview?.mealId) || !revision(preview?.localRevision)
    || !revision(preview?.remoteRevision)) throw new Error('Missing reviewed nutrition conflict');
  if ([contextCurrent, readRemote, removeLocalIfCurrent].some(fn => typeof fn !== 'function')) {
    throw new TypeError('Incomplete nutrition conflict adapters');
  }
  const reviewed = Object.freeze({ ...preview });
  if (contextCurrent(reviewed) !== true) return 'stale-local';
  const remote = await readRemote({ userId: reviewed.userId, syncId: reviewed.syncId, mealId: reviewed.mealId });
  if (contextCurrent(reviewed) !== true) return 'stale-local';
  if (!matchesRemote(remote, reviewed, reviewed.mealId) || remote.revision !== reviewed.remoteRevision) {
    return 'refresh-preview';
  }
  return await removeLocalIfCurrent(reviewed) === true ? 'accepted-remote' : 'stale-local';
}
