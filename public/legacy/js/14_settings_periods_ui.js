/* ========================= 
   Settings: periods UI
   ========================= */
async function loadPeriodsListIntoUI() {
  const sel = document.getElementById("s-period");
  if (!sel) return;

  const { data: periods, error } = await sb
    .from(TB_CONST.TABLES.periods)
    .select("id,start_date,end_date,base_currency")
    .order("start_date", { ascending: false });
  if (error) return alert(error.message);

  state.periods = (periods || []).map((p) => ({
    id: p.id,
    start: p.start_date,
    end: p.end_date,
    baseCurrency: p.base_currency,
  }));

  sel.innerHTML = (state.periods || [])
    .map((p) => {
      const label = `Voyage ${p.start} → ${p.end}`;
      const selected = String(p.id) === String(state.period.id) ? "selected" : "";
      return `<option value="${escapeHTML(p.id)}" ${selected}>${escapeHTML(label)}</option>`;
    })
    .join("");

  sel.onchange = async () => {
    const id = sel.value;
    await setActivePeriod(id);
    await refreshFromServer();
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("14_settings_periods_ui.js"); else if (typeof renderAll === "function") renderAll();
};
}

async function setActivePeriod(periodId) {
  if (!periodId) return;
  const p = (state.periods || []).find((x) => String(x.id) === String(periodId));
  if (!p) return;

  state.period = {
    ...state.period,
    id: p.id,
    start: p.start,
    end: p.end,
    baseCurrency: p.baseCurrency,
  };

  try {
    await sb.from(TB_CONST.TABLES.settings).upsert({
      user_id: sbUser.id,
      active_period_id: p.id,
      updated_at: new Date().toISOString(),
    });
  } catch (_) {}
}

function renderSettings() {
  loadPeriodsListIntoUI();

  const p = state.period || {};
  const startEl = document.getElementById("s-start");
  const endEl = document.getElementById("s-end");
  const rateEl = document.getElementById("s-rate");

  // Compute voyage bounds from first/last segment (bi-directional sync)
  let voyageStart = p.start || "";
  let voyageEnd = p.end || "";

  try {
    const pid = String(p.id || "");
    const segs = (state.budgetSegments || [])
      .filter(s => s && String(s.periodId || s.period_id) === pid)
      .slice()
      .sort((a,b) => String(a.start||"").localeCompare(String(b.start||"")));

    if (segs.length) {
      const edits = window.__TB_SEG_EDITS__ || {};
      const first = segs[0];
      const last = segs[segs.length - 1];
      const eFirst = edits[first.id] || {};
      const eLast = edits[last.id] || {};
      voyageStart = (eFirst.start ?? first.start) || voyageStart;
      voyageEnd = (eLast.end ?? last.end) || voyageEnd;

      // Bind once: editing voyage dates updates first/last segment dates
      if (startEl && !startEl.dataset.tbVoyageBound) {
        startEl.dataset.tbVoyageBound = "1";
        startEl.addEventListener("change", () => {
          const v = startEl.value || "";
          state.period.start = v;
          _tbVoyageSyncBoundsToSegments({ start: v, end: null });
        });
      }
      if (endEl && !endEl.dataset.tbVoyageBound) {
        endEl.dataset.tbVoyageBound = "1";
        endEl.addEventListener("change", () => {
          const v = endEl.value || "";
          state.period.end = v;
          _tbVoyageSyncBoundsToSegments({ start: null, end: v });
        });
      }
    }
  } catch (e) {
    console.warn("[settings] voyage bounds compute failed", e);
  }

  if (startEl) startEl.value = voyageStart || "";
  if (endEl) endEl.value = voyageEnd || "";

  // keep rate visible if present (read-only in UI)
  if (rateEl) rateEl.value = String(p.eurBaseRate || "");

  // segments UI
  renderBudgetSegmentsUI();
  try { renderManualFxBox(); } catch (e) { console.warn('[manual fx] render failed', e); }

  // categories UI
  try { renderCategoriesSettingsUI(); } catch (e) { console.warn('[categories] render failed', e); }
}

/** Update first/last segment dates in local UI edits (does NOT write DB). */
function _tbVoyageSyncBoundsToSegments({ start, end }) {
  const p = state.period || {};
  const pid = String(p.id || "");
  const segs = (state.budgetSegments || [])
    .filter(s => s && String(s.periodId || s.period_id) === pid)
    .slice()
    .sort((a,b) => String(a.start||"").localeCompare(String(b.start||"")));

  if (!segs.length) return;

  const first = segs[0];
  const last = segs[segs.length - 1];

  if (start !== null && start !== undefined) _tbSegSet(String(first.id), "start", start);
  if (end !== null && end !== undefined) _tbSegSet(String(last.id), "end", end);
}

/* =========================
   Budget Segments UI (V6.4 minimal)
   ========================= */

function _segRowHTML(seg, idx, total) {
  const id = seg.id;
  const isLast = (idx === (total - 1));
  const splitBtn = isLast ? `<button class="btn" onclick="splitBudgetSegmentPrompt(\'${id}\')">Split</button>` : "";
  const edits = (window.__TB_SEG_EDITS__ && window.__TB_SEG_EDITS__[id]) || {};
  const start = edits.start ?? seg.start;
  const end = edits.end ?? seg.end;
  const baseCurrency = edits.baseCurrency ?? seg.baseCurrency;
  const _autoOk = (typeof tbFxIsAutoAvailable === "function") ? tbFxIsAutoAvailable(baseCurrency) : false;
  const fxModeForced = _autoOk ? "live_ecb" : "fixed";
  const dailyBudgetBase = edits.dailyBudgetBase ?? seg.dailyBudgetBase;
    // FX mode is forced by provider availability (no user selection)
  const fxModeRaw = edits.fxMode ?? seg.fxMode ?? "live_ecb";
  const fxMode = fxModeForced;
  const eurBaseRateFixed = (edits.eurBaseRateFixed ?? seg.eurBaseRateFixed) ?? "";
  const sortOrder = edits.sortOrder ?? seg.sortOrder ?? 0;

  return `
    <div class="card" style="padding:12px; margin:10px 0;">
      <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-end;">
        <div style="min-width:160px;">
          <div class="label">Début période</div>
          <input class="input" value="${escapeHTML(start || "")}" onchange="_tbSegSet('${id}','start',this.value)" />
        </div>
        <div style="min-width:160px;">
          <div class="label">Fin période</div>
          <input class="input" value="${escapeHTML(end || "")}" onchange="_tbSegSet('${id}','end',this.value)" />
        </div>
        <div style="min-width:140px;">
          <div class="label">Devise base ${typeof tbHelp==="function" ? tbHelp("Devise utilisée pour le budget/jour et les courbes sur ce segment.") : ""}</div>
          <input class="input" list="tbCurrencyList" value="${escapeHTML(String(baseCurrency || '').toUpperCase())}"
            oninput="_tbSegSet('${id}','baseCurrency',this.value)"
            onchange="_tbSegSet('${id}','baseCurrency',this.value)" />
          <div class="hint">Tu peux saisir un code ISO3 non listé (ex: IDR, PHP). Si Auto FX ne le supporte pas, ajoute un taux manuel ci-dessous.</div>
        </div>
        <div style="min-width:160px;">
          <div class="label">Budget/jour (base)</div>
          <input class="input" value="${escapeHTML(String(dailyBudgetBase ?? ""))}" onchange="_tbSegSet('${id}','dailyBudgetBase',this.value)" />
        </div>
        <div style="min-width:160px;">
          <div class="label">Taux FX ${typeof tbHelp==="function" ? tbHelp("Auto = utilise le taux FX si disponible. Fixe = tu fournis un taux manuel pour EUR→BASE.") : ""}</div>
          <div class="muted" style="font-size:12px; line-height:1.2;">Auto (FX) si disponible, sinon manuel requis.</div>
        <div style="min-width:160px;">
          <div class="label">EUR→BASE ${typeof tbHelp==="function" ? tbHelp("Taux de conversion EUR→Devise base. En auto, ce champ est verrouillé si FX fournit le taux.") : ""}</div>
          ${(() => {
            const cur = String(baseCurrency||"").toUpperCase();
            const auto = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : {};
            const manual = (typeof tbFxGetManualRates === "function") ? tbFxGetManualRates() : {};
            const live = (cur === "EUR") ? 1 : (auto && auto[cur]);
            const manualRate = (cur === "EUR") ? 1 : (manual && manual[cur]);

            // Auto if available, else require manual. If a manual rate exists, prefill it.
            const needsManual = (!live && cur !== "EUR");
            const v = (live ? live : (eurBaseRateFixed || manualRate || ""));

            // Always editable: if user changes, store fixed and set fxMode=fixed
            const onch = `_tbSegSet('${id}','eurBaseRateFixed',this.value);_tbSegSet('${id}','fxMode','fixed')`;
            const ph = needsManual ? "placeholder=\"ex: 36.57\"" : "";
            const hint = live ? `<div class="muted" style="font-size:12px;margin-top:4px;">Auto FX détecté. Tu peux modifier pour forcer un taux manuel.</div>` : "";
            return `<div><input class="input" value="${escapeHTML(String(v))}" ${ph} onchange="${onch}" />${hint}</div>`;          })()}
        </div>
        <div style="display:flex; gap:8px; align-items:center; margin-left:auto;">
          ${splitBtn}
          <button class="btn" onclick="saveBudgetSegment('${id}')">Enregistrer</button>
        </div>
      </div>
    </div>
  `;
}

function renderBudgetSegmentsUI() {
  // Ensure a shared datalist for currency inputs
  try {
    if (!document.getElementById("tbCurrencyList")) {
      const dl = document.createElement("datalist");
      dl.id = "tbCurrencyList";
      document.body.appendChild(dl);
    }
    const dl = document.getElementById("tbCurrencyList");
    const list = (typeof tbGetAvailableCurrencies === "function") ? tbGetAvailableCurrencies() : ["EUR","USD","THB"];
    dl.innerHTML = list.map(c => `<option value="${String(c||"").toUpperCase()}"></option>`).join("");
  } catch (_) {}

  const host = document.getElementById("seg-list");
  if (!host) return;

  const segs = (state.budgetSegments || []).filter((s) => s && s.periodId === state.period.id);
  if (!segs.length) {
    host.innerHTML = `<div class="muted">Aucun période (il sera auto-créé au refresh si besoin).</div>`;
    return;
  }

  // In-memory edits buffer
  window.__TB_SEG_EDITS__ = window.__TB_SEG_EDITS__ || {};

  host.innerHTML = segs.map((seg, idx) => _segRowHTML(seg, idx, segs.length)).join("");
}

function _tbSegSet(id, key, value) {
  window.__TB_SEG_EDITS__ = window.__TB_SEG_EDITS__ || {};
  window.__TB_SEG_EDITS__[id] = window.__TB_SEG_EDITS__[id] || {};
  window.__TB_SEG_EDITS__[id][key] = value;
}

// Parse numbers from UI inputs (handles comma decimals)
function _tbParseNum(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  if (!s) return NaN;
  // remove spaces (including NBSP) and normalize decimal comma
  s = s.replace(/[\s\u00A0]/g, "").replace(",", ".");
  return Number(s);
}

async function saveBudgetSegment(id) {
  await safeCall("Save période", async () => {
    const seg = (state.budgetSegments || []).find((s) => String(s.id) === String(id));
    if (!seg) throw new Error("Segment introuvable.");

    const edits = (window.__TB_SEG_EDITS__ && window.__TB_SEG_EDITS__[id]) || {};
    const start = (edits.start ?? seg.start) || "";
    const end = (edits.end ?? seg.end) || "";

    // Force last segment end to follow the voyage end (auto-adapt when the voyage end changes)
    let endFixed = end;
    try {
      const segsAll = (state.budgetSegments || []).filter(s => s && String(s.periodId || s.period_id) === String(state.period.id));
      const last = [...segsAll].sort((a,b) => Number(a.sortOrder ?? a.sort_order ?? 0) - Number(b.sortOrder ?? b.sort_order ?? 0)).pop();
      if (last && String(last.id) === String(id)) {
        endFixed = String(state?.period?.end || endFixed || "");
      }
    } catch (_) {}
const baseCurrency = (edits.baseCurrency ?? seg.baseCurrency) || "";
	const dailyBudgetBase = _tbParseNum(edits.dailyBudgetBase ?? seg.dailyBudgetBase);
    let fxMode = "live_ecb";
    // fx_mode is automatic: use "fixed" only when a manual EUR→BASE rate is provided.
    if (eurBaseRateFixed) fxMode = "fixed";

    // NOTE: eurBaseRateFixed is read-only in auto (we display the live value).
    let eurBaseRateFixedRaw = edits.eurBaseRateFixed ?? seg.eurBaseRateFixed;
    let eurBaseRateFixed =
      eurBaseRateFixedRaw === "" || eurBaseRateFixedRaw === null || eurBaseRateFixedRaw === undefined
        ? null
		: _tbParseNum(eurBaseRateFixedRaw);

    const sD = parseISODateOrNull(start);
    const eD = parseISODateOrNull(endFixed);
    if (!sD || !eD) throw new Error("Dates invalides.");
    if (eD < sD) throw new Error("Fin < début.");
    if (!baseCurrency) throw new Error("Devise vide.");
    if (!isFinite(dailyBudgetBase) || dailyBudgetBase <= 0) throw new Error("Budget/jour invalide.");

    if (fxMode === "fixed") {
      const bc = String(baseCurrency || "").toUpperCase();

      // fixed + EUR base => 1
      if (bc === "EUR") eurBaseRateFixed = 1;

      // fixed + non-EUR => require a positive number; try autofill if missing
      if (bc !== "EUR" && (eurBaseRateFixed === null || !isFinite(eurBaseRateFixed) || eurBaseRateFixed <= 0)) {
        let auto = null;

        if (typeof window.fxGetEurRates === "function") {
          const rates = window.fxGetEurRates() || {};
          const v = Number(rates[bc]);
          if (isFinite(v) && v > 0) auto = v;
        }

        if ((auto === null || !isFinite(auto) || auto <= 0) && String(state?.period?.baseCurrency || "").toUpperCase() === bc) {
          const v = Number(state?.period?.eurBaseRate || state?.period?.eur_base_rate);
          if (isFinite(v) && v > 0) auto = v;
        }

        if (auto !== null && isFinite(auto) && auto > 0) {
          eurBaseRateFixed = auto;
        } else {
          throw new Error("Taux EUR→BASE requis en fixed (ou mets FX mode = live).");
        }
      }
    } else {
      // auto => we don't require a fixed rate
      eurBaseRateFixed = null;
    }


    // === Validations (V6.5) ===
    const _norm = (d) => {
      const s = String(d || "").trim();
      if (!s) return "";
      // already YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const dt = new Date(s);
      if (!Number.isFinite(dt.getTime())) throw new Error(`Date invalide: ${s}`);
      return toLocalISODate(dt);
    };

    const startN = _norm(start);
    const endN = _norm(endFixed);

    if (startN && endN && startN > endN) throw new Error("start ≤ end requis.");

    // block overlaps within same period
    const segsSame = (state.budgetSegments || []).filter(s => s && String(s.periodId || s.period_id) === String(state.period.id));
    const edited = segsSame.map(s => {
      if (String(s.id) !== String(id)) return s;
      return { ...s, start: startN, end: endN, start_date: startN, end_date: endN };
    });

    // sort by start date then order
    const ranges = edited
      .map(s => ({
        id: s.id,
        start: String(s.start_date || s.start || ""),
        end: String(s.end_date || s.end || ""),
      }))
      .filter(r => r.start && r.end)
      .sort((a,b) => a.start.localeCompare(b.start));

    for (let i=1;i<ranges.length;i++){
      const prev = ranges[i-1], cur = ranges[i];
      if (cur.start <= prev.end) {
        throw new Error(`Overlap interdit: ${cur.id} (${cur.start}) chevauche ${prev.id} (${prev.end}).`);
      }
    }

    const { error } = await sb
      .from(TB_CONST.TABLES.budget_segments)
      .update({
        start_date: startN,
        end_date: endN,
        base_currency: baseCurrency,
        daily_budget_base: dailyBudgetBase,
        fx_mode: fxMode,
        // V6.5 FX storage
        fx_rate_eur_to_base: (fxMode === "fixed" ? eurBaseRateFixed : null),
        fx_source: (fxMode === "fixed" ? "manual" : "fx"),
        fx_last_updated_at: (fxMode === "fixed" ? new Date().toISOString() : new Date().toISOString()),
        // legacy compat (kept while DB migration is rolling)
        eur_base_rate_fixed: eurBaseRateFixed,
        // sort_order intentionally not updated (order is fixed)
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;

    

    await _syncLastSegmentEndToPeriod(state.period.id, String(state?.period?.end || ""));
if (window.__TB_SEG_EDITS__) delete window.__TB_SEG_EDITS__[id];

    await refreshFromServer();
    renderSettings();
    renderWallets();
  });
}

function _isoDayBeforeUTC(isoDate) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function splitBudgetSegmentPrompt(id) {
  await safeCall("Split période", async () => {
    const seg = (state.budgetSegments || []).find((s) => String(s.id) === String(id));
    if (!seg) throw new Error("Segment introuvable.");

    const defaultSplit = (function () {
      const d = new Date(seg.start + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      const candidate = d.toISOString().slice(0, 10);
      return candidate <= seg.end ? candidate : seg.start;
    })();

    const split = prompt("Date de split (YYYY-MM-DD) :", defaultSplit);
    if (!split) return;

    const splitD = parseISODateOrNull(split);
    const sD = parseISODateOrNull(seg.start);
    const eD = parseISODateOrNull(seg.end);
    if (!splitD || !sD || !eD) throw new Error("Dates invalides.");
    if (split <= seg.start) throw new Error("Split doit être > début.");
    if (split > seg.end) throw new Error("Split doit être dans le période.");
    if (split === seg.end) throw new Error("Split ne peut pas être égal à la fin du période.");

    const leftEndStr = _isoDayBeforeUTC(split);
    const oldEnd = seg.end;

    const upd = await sb
      .from(TB_CONST.TABLES.budget_segments)
      .update({
        end_date: leftEndStr,
        updated_at: new Date().toISOString(),
      })
      .eq("id", seg.id)
      .select("id,start_date,end_date")
      .single();

    if (upd.error) throw upd.error;
    if (!upd.data || upd.data.end_date !== leftEndStr) {
      throw new Error(`Update période échoué (end_date=${upd.data?.end_date ?? "null"} au lieu de ${leftEndStr}).`);
    }

    const ins = await sb
      .from(TB_CONST.TABLES.budget_segments)
      .insert([
        {
          user_id: sbUser.id,
          period_id: seg.periodId,
          start_date: split,
          end_date: oldEnd,
          base_currency: seg.baseCurrency,
          daily_budget_base: seg.dailyBudgetBase,
          fx_mode: seg.fxMode || "fixed",
          eur_base_rate_fixed: seg.eurBaseRateFixed,
          sort_order: (Number(seg.sortOrder) || 0) + 1,
        },
      ])
      .select("id")
      .single();

    if (ins.error) {
      await sb
        .from(TB_CONST.TABLES.budget_segments)
        .update({
          end_date: oldEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("id", seg.id);

      throw ins.error;
    }

    await refreshFromServer();
    renderSettings();
    renderWallets();
  });
}


async function _syncLastSegmentEndToPeriod(periodId, periodEndISO) {
  try {
    const pid = periodId || state?.period?.id;
    const pend = periodEndISO || state?.period?.end;
    if (!pid || !pend) return;

    const segs = (state.budgetSegments || []).filter(s => s && String(s.periodId || s.period_id) === String(pid));
    if (!segs.length) return;

    const last = [...segs].sort((a,b) => {
      const ao = Number(a.sortOrder ?? a.sort_order ?? 0);
      const bo = Number(b.sortOrder ?? b.sort_order ?? 0);
      if (ao !== bo) return ao - bo;
      return String(a.end||a.end_date||"").localeCompare(String(b.end||b.end_date||""));
    }).pop();

    if (!last) return;
    const lastId = last.id;
    const currentEnd = String(last.end || last.end_date || "");
    if (currentEnd === String(pend)) return;

    const { error } = await sb
      .from(TB_CONST.TABLES.budget_segments)
      .update({ end_date: pend, updated_at: new Date().toISOString() })
      .eq("id", lastId);

    if (error) throw error;

    for (const s of (state.budgetSegments || [])) {
      if (String(s.id) === String(lastId)) {
        s.end = pend;
        s.end_date = pend;
      }
    }
  } catch (e) {
    console.warn("[Settings] sync last période end failed", e);
  }
}

async function saveSettings() {
  await safeCall("Enregistrer voyage", async () => {
    const startEl = document.getElementById("s-start");
    const endEl = document.getElementById("s-end");

    const p = state.period || {};
    const pid = p.id;
    if (!pid) throw new Error("UI settings non à jour.");

    const start = (startEl && startEl.value) ? String(startEl.value) : (p.start || "");
    const end = (endEl && endEl.value) ? String(endEl.value) : (p.end || "");

    if (!start || !end) throw new Error("Dates invalides.");

    // Patch voyage dates only (periods) — do NOT touch eur_base_rate/base_currency/etc.
    const patch = { start_date: start, end_date: end };
    const { error } = await sb
      .from(TB_CONST.TABLES.periods)
      .update(patch)
      .eq("id", pid);

    if (error) throw error;

    // Also persist bounds to first/last segment (bi-directional sync contract)
    try {
      const segs = (state.budgetSegments || [])
        .filter(s => s && String(s.periodId || s.period_id) === String(pid))
        .slice()
        .sort((a,b) => String(a.start||"").localeCompare(String(b.start||"")));

      if (segs.length) {
        const first = segs[0];
        const last = segs[segs.length - 1];

        // update first.start_date if needed
        if (String(first.start || "") !== String(start || "")) {
          const { error: e1 } = await sb
            .from(TB_CONST.TABLES.budget_segments)
            .update({ start_date: start })
            .eq("id", first.id)
            ;
          if (e1) throw e1;
        }

        // update last.end_date if needed
        if (String(last.end || "") !== String(end || "")) {
          const { error: e2 } = await sb
            .from(TB_CONST.TABLES.budget_segments)
            .update({ end_date: end })
            .eq("id", last.id)
            ;
          if (e2) throw e2;
        }
      }
    } catch (e) {
      console.warn("[settings] bounds sync segments failed", e);
    }

    // Refresh local state
    await refreshFromServer();
    (function(msg){ if (typeof toastOk === "function") return toastOk(msg); if (typeof toastInfo === "function") return toastInfo(msg); try { alert(msg); } catch(_) { console.log(msg); } })("Voyage enregistré.");
  });
}

async function newPeriod() {
  await safeCall("Nouvelle période", async () => {
    _tbOpenNewSegmentModal();
  });
}

function _tbOpenNewSegmentModal() {
  const pid = String(state?.period?.id || "");
  if (!pid) throw new Error("Voyage introuvable.");
  const segs = (state.budgetSegments || [])
    .filter(s => s && String(s.periodId || s.period_id) === pid)
    .slice()
    .sort((a,b)=>String(a.start||"").localeCompare(String(b.start||"")));

  if (!segs.length) throw new Error("Aucune période/segment existant.");

  // Build modal
  const existing = document.getElementById("tbNewSegModal");
  if (existing) existing.remove();

  const opts = segs.map((s,i)=>{
    const sid = String(s.id);
    const label = `${String(s.start)} → ${String(s.end)} (${String(s.baseCurrency||s.base_currency||"").toUpperCase()})`;
    return `<option value="${escapeHTML(sid)}">${escapeHTML(label)}</option>`;
  }).join("");

  const first = segs[0];
  const html = `
    <div id="tbNewSegModal" style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:16px;">
      <div class="card" style="max-width:720px;width:100%;padding:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <h3 style="margin:0;">Ajouter une période</h3>
          <button class="btn" onclick="_tbCloseNewSegmentModal()">Fermer</button>
        </div>
        <div class="muted" style="margin:8px 0 12px 0;">
          Cette période s'insère dans une période existante (elle la découpe automatiquement).
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <div style="min-width:260px;flex:1;">
            <div class="label">Insérer dans</div>
            <select id="tbNewSegIn" class="input">${opts}</select>
          </div>
          <div style="min-width:160px;">
            <div class="label">Début</div>
            <input id="tbNewSegStart" class="input" type="date" value="${escapeHTML(String(first.start||""))}" />
          </div>
          <div style="min-width:160px;">
            <div class="label">Fin</div>
            <input id="tbNewSegEnd" class="input" type="date" value="${escapeHTML(String(first.end||""))}" />
          </div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:flex-end;">
          <div style="min-width:180px;">
            <div class="label">Devise base</div>
            <input id="tbNewSegCur" class="input" list="tbCurrencyList" placeholder="ex: THB" value="${escapeHTML(String(first.baseCurrency||first.base_currency||"").toUpperCase())}" />
          </div>
          <div style="min-width:200px;">
            <div class="label">Budget/jour (base)</div>
            <input id="tbNewSegDaily" class="input" inputmode="decimal" placeholder="ex: 900" value="${escapeHTML(String(first.dailyBudgetBase||first.daily_budget_base||""))}" />
          </div>
          <div style="min-width:220px;">
            <div class="label">EUR→BASE (manuel si nécessaire)</div>
            <input id="tbNewSegFx" class="input" inputmode="decimal" placeholder="ex: 36.57" />
            <div class="muted" style="font-size:12px;margin-top:4px;">Si Auto FX fournit le taux, laisse vide.</div>
          </div>

          <div style="margin-left:auto;display:flex;gap:8px;">
            <button class="btn" onclick="_tbCreateNewSegmentFromModal()">Créer</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", html);

  // Wire defaults and constraints
  const inEl = document.getElementById("tbNewSegIn");
  const sEl = document.getElementById("tbNewSegStart");
  const eEl = document.getElementById("tbNewSegEnd");
  const curEl = document.getElementById("tbNewSegCur");
  const dailyEl = document.getElementById("tbNewSegDaily");
  const fxEl = document.getElementById("tbNewSegFx");

  function applyBounds() {
    const sid = String(inEl.value||"");
    const seg = segs.find(x=>String(x.id)===sid) || segs[0];
    if (!seg) return;
    // default to full range of chosen segment
    if (!sEl.value) sEl.value = String(seg.start||"");
    if (!eEl.value) eEl.value = String(seg.end||"");
    // clamp if out
    if (sEl.value < String(seg.start)) sEl.value = String(seg.start);
    if (eEl.value > String(seg.end)) eEl.value = String(seg.end);
    // defaults
    if (curEl && !curEl.value) curEl.value = String(seg.baseCurrency||seg.base_currency||"").toUpperCase();
    if (dailyEl && !dailyEl.value) dailyEl.value = String(seg.dailyBudgetBase||seg.daily_budget_base||"");
    // prefill fx from auto if empty
    try {
      const c = String(curEl.value||"").trim().toUpperCase();
      if (fxEl && !fxEl.value && c) {
        const m = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : {};
        const live = (c === "EUR") ? 1 : (m && m[c]);
        if (live && c !== "EUR") fxEl.placeholder = `auto: ${live}`;
      }
    } catch (_) {}
  }
  inEl.addEventListener("change", applyBounds);
  sEl.addEventListener("change", applyBounds);
  eEl.addEventListener("change", applyBounds);
  applyBounds();
}

function _tbCloseNewSegmentModal() {
  const el = document.getElementById("tbNewSegModal");
  if (el) el.remove();
}

async function _tbCreateNewSegmentFromModal() {
  const pid = String(state?.period?.id || "");
  const sb = window.sb;
  if (!sb) throw new Error("Supabase non prêt.");

  const inEl = document.getElementById("tbNewSegIn");
  const sEl = document.getElementById("tbNewSegStart");
  const eEl = document.getElementById("tbNewSegEnd");
  const curEl = document.getElementById("tbNewSegCur");
  const dailyEl = document.getElementById("tbNewSegDaily");
  const fxEl = document.getElementById("tbNewSegFx");

  const segs = (state.budgetSegments || [])
    .filter(s => s && String(s.periodId || s.period_id) === pid)
    .slice()
    .sort((a,b)=>String(a.start||"").localeCompare(String(b.start||"")));

  const sid = String(inEl?.value || "");
  const hostSeg = segs.find(s=>String(s.id)===sid);
  if (!hostSeg) throw new Error("Segment cible introuvable.");

  const start = String(sEl?.value || "").trim();
  const end = String(eEl?.value || "").trim();
  if (!start || !end) throw new Error("Dates requises.");
  if (end < start) throw new Error("Fin < début.");

  const hostStart = String(hostSeg.start);
  const hostEnd = String(hostSeg.end);
  if (start < hostStart || end > hostEnd) {
    throw new Error("La nouvelle période doit être incluse dans la période sélectionnée.");
  }

  const baseCur = String(curEl?.value || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(baseCur)) throw new Error("Devise invalide (ISO3).");

  const daily = _tbParseNum(dailyEl?.value);
  if (!Number.isFinite(daily) || daily <= 0) throw new Error("Budget/jour invalide.");

  // FX auto vs manual
  const m = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : {};
  const live = (baseCur === "EUR") ? 1 : (m && m[baseCur]);
  const eurFixed = _tbParseNum(fxEl?.value);
  const needsManual = (!live && baseCur !== "EUR");
  if (needsManual && !(Number.isFinite(eurFixed) && eurFixed > 0)) {
    // ask once
    const ask = prompt(`Taux EUR→${baseCur} requis (auto indisponible).`, "");
    const v = _tbParseNum(ask);
    if (!(Number.isFinite(v) && v > 0)) throw new Error("Taux FX requis invalide.");
    fxEl.value = String(v);
  }
  const eurFixedFinal = _tbParseNum(fxEl?.value);
  const fxMode = (Number.isFinite(eurFixedFinal) && eurFixedFinal > 0) ? "fixed" : "live_ecb";

  const { data: u } = await sb.auth.getUser();
  const sbUser = u?.user;
  if (!sbUser) throw new Error("Not authenticated");

  // split host segment into before + after
  const beforeEnd = (start > hostStart) ? _tbDateAddDays(start, -1) : null;
  const afterStart = (end < hostEnd) ? _tbDateAddDays(end, 1) : null;

  // update/delete host
  if (beforeEnd && beforeEnd >= hostStart) {
    await sb.from(TB_CONST.TABLES.budget_segments).update({
      start_date: hostStart,
      end_date: beforeEnd,
      updated_at: new Date().toISOString(),
    }).eq("id", hostSeg.id);
  } else {
    await sb.from(TB_CONST.TABLES.budget_segments).delete().eq("id", hostSeg.id);
  }

  // insert new segment
  await sb.from(TB_CONST.TABLES.budget_segments).insert({
    user_id: sbUser.id,
    period_id: pid,
    start_date: start,
    end_date: end,
    base_currency: baseCur,
    daily_budget_base: daily,
    fx_mode: fxMode,
    fx_rate_eur_to_base: (fxMode === "fixed" ? eurFixedFinal : null),
    fx_source: (fxMode === "fixed" ? "manual" : "fx"),
    fx_last_updated_at: new Date().toISOString(),
    sort_order: 0,
  });

  // insert after segment if needed (copy from host)
  if (afterStart && afterStart <= hostEnd) {
    const oCur = String(hostSeg.baseCurrency||hostSeg.base_currency||"").toUpperCase();
    const oDaily = Number(hostSeg.dailyBudgetBase||hostSeg.daily_budget_base||0) || daily;
    const oFxMode = String(hostSeg.fxMode||hostSeg.fx_mode||"live_ecb");
    const oFixed = Number(hostSeg.eurBaseRateFixed||hostSeg.eur_base_rate_fixed||hostSeg.fx_rate_eur_to_base||0) || null;

    await sb.from(TB_CONST.TABLES.budget_segments).insert({
      user_id: sbUser.id,
      period_id: pid,
      start_date: afterStart,
      end_date: hostEnd,
      base_currency: oCur,
      daily_budget_base: oDaily,
      fx_mode: oFxMode,
      fx_rate_eur_to_base: (oFxMode === "fixed" ? oFixed : null),
      fx_source: (oFxMode === "fixed" ? "manual" : "fx"),
      fx_last_updated_at: new Date().toISOString(),
      sort_order: 0,
    });
  }

  _tbCloseNewSegmentModal();
  await refreshFromServer();
  try { if (typeof toastOk==="function") toastOk("Période ajoutée."); } catch (_) {}
}

// helpers
function _tbDateAddDays(iso, deltaDays) {
  try {
    const d = new Date(String(iso) + "T00:00:00");
    d.setDate(d.getDate() + Number(deltaDays||0));
    return d.toISOString().slice(0,10);
  } catch (_) { return iso; }
}

async function deletePeriod() {
  await safeCall("Supprimer période", async () => {
    if (!state.period.id) throw new Error("Aucune période active.");
    if (!confirm("Supprimer cette période ?")) return;

    await sb.from(TB_CONST.TABLES.budget_segments).delete().eq("period_id", state.period.id);

    const { error } = await sb.from(TB_CONST.TABLES.periods).delete().eq("id", state.period.id);
    if (error) throw error;

    await refreshFromServer();
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("14_settings_periods_ui.js"); else if (typeof renderAll === "function") renderAll();
});
}

(function bindSettingsButtons() {
  const btnSave = document.getElementById("btn-save-period");
  const btnNew = document.getElementById("btn-new-period");
  const btnDel = document.getElementById("btn-del-period");

  if (btnSave) btnSave.onclick = saveSettings;
  if (btnNew) btnNew.onclick = newPeriod;
  if (btnDel) btnDel.onclick = deletePeriod;
})();

/* =========================
   Categories UI (Supabase)
   - Source of truth: public.categories
   ========================= */

function renderCategoriesSettingsUI() {
  const host = document.getElementById("cat-list");
  if (!host) return;

  const cats = (typeof getCategories === "function") ? getCategories() : (state.categories || []);
  const colors = (typeof getCategoryColors === "function") ? getCategoryColors() : (state.categoryColors || {});

  host.innerHTML = (cats || []).map((c) => {
    const col = colors[c] || "#94a3b8";
    return `
      <div class="card" style="padding:10px; margin:8px 0; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <div style="min-width:180px; font-weight:700;">${escapeHTML(c)}</div>

        <span title="${escapeHTML(col)}" style="display:inline-block;width:18px;height:18px;border-radius:5px;background:${escapeHTML(col)};border:1px solid rgba(0,0,0,.20);"></span>
        <div class="muted" style="min-width:84px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:12px;">
          ${escapeHTML(col)}
        </div>

        <input type="color"
               value="${escapeHTML(col)}"
               style="width:44px;height:30px;padding:0;border:none;background:transparent;cursor:pointer;"
               onchange="setCategoryColor('${escapeHTML(c)}', this.value)" />

        <button class="btn" onclick="deleteCategory('${escapeHTML(c)}')">Supprimer</button>
      </div>
    `;
  }).join("");

  if (!host.innerHTML) host.innerHTML = `<div class="muted">Aucune catégorie. Ajoute-en une ci-dessus.</div>`;
}

function addCategory() {
  safeCall("Add category", async () => {
    const nameEl = document.getElementById("cat-name");
    const colorEl = document.getElementById("cat-color");
    const name = String(nameEl?.value || "").trim();
    const color = String(colorEl?.value || "#94a3b8");
    if (!name) throw new Error("Nom de catégorie vide.");

    const existing = (state.categories || []).find(c => String(c).toLowerCase() === name.toLowerCase()) || null;
    if (existing) {
      const { error: upErr } = await sb
        .from(TB_CONST.TABLES.categories)
        .update({ color, updated_at: new Date().toISOString() })
        .eq("user_id", sbUser.id)
        .eq("name", existing);
      if (upErr) throw upErr;
    } else {
      const maxSort = (state.categories || []).length;
      const { error: insErr } = await sb
        .from(TB_CONST.TABLES.categories)
        .insert([{ user_id: sbUser.id, name, color, sort_order: maxSort, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
      if (insErr) throw insErr;
    }

    if (nameEl) nameEl.value = "";
    await refreshFromServer();
    renderSettings();
  });
}

function deleteCategory(name) {
  safeCall("Delete category", async () => {
    const n = String(name || "").trim();
    if (!n) return;
    if (!confirm(`Supprimer la catégorie "${n}" ?`)) return;
    const existing = (state.categories || []).find(c => String(c).toLowerCase() === n.toLowerCase()) || n;
    const { error: delErr } = await sb
      .from(TB_CONST.TABLES.categories)
      .delete()
      .eq("user_id", sbUser.id)
      .eq("name", existing);
    if (delErr) throw delErr;

    await refreshFromServer();
    renderSettings();
  });
}

function setCategoryColor(name, color) {
  safeCall("Set category color", async () => {
    const n = String(name || "").trim();
    if (!n) return;
    const existing = (state.categories || []).find(c => String(c).toLowerCase() === n.toLowerCase()) || n;
    const { error: upErr } = await sb
      .from(TB_CONST.TABLES.categories)
      .update({ color: String(color || "#94a3b8"), updated_at: new Date().toISOString() })
      .eq("user_id", sbUser.id)
      .eq("name", existing);
    if (upErr) throw upErr;

    await refreshFromServer();
    renderSettings();
  });
}

window.addCategory = addCategory;
window.deleteCategory = deleteCategory;
window.setCategoryColor = setCategoryColor;

/* =========================
   Manual FX UI (fallback rates EUR->XXX)
   ========================= */

function renderManualFxBox() {
  const host = document.getElementById("manual-fx-box");
  if (!host) return;

  const rates = (typeof tbFxGetManualRates === "function") ? tbFxGetManualRates() : {};
  const entries = Object.entries(rates || {}).sort((a, b) => a[0].localeCompare(b[0]));

  host.innerHTML = `
    <div class="card" style="padding:12px;">
      <h3 style="margin:0 0 8px 0;">Taux manuels (fallback)</h3>
      <div class="muted" style="margin-bottom:10px;">
        Utilisés uniquement si la source Auto FX ne fournit pas EUR→DEV.
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px;">
        <div style="min-width:120px;">
          <div class="label">Devise</div>
          <input id="tbManualFxCur" class="input" placeholder="ex: IDR" maxlength="3" />
        </div>
        <div style="min-width:180px;">
          <div class="label">Taux EUR → Devise</div>
          <input id="tbManualFxRate" class="input" placeholder="ex: 17000" inputmode="decimal" />
        </div>
        <button class="btn" onclick="tbManualFxAdd()">Ajouter</button>
      </div>

      <div id="tbManualFxList">
        ${
          entries.length
            ? entries.map(([c, r]) => `
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--border);">
            <div><b>${escapeHTML(c)}</b> : 1 EUR = ${escapeHTML(String(r))} ${escapeHTML(c)}
              ${(() => { 
                try { 
                  const d = (typeof tbFxManualAsof === "function") ? tbFxManualAsof(c) : null; 
                  return d ? `<span class="muted" style="font-size:12px;">(${escapeHTML(String(d))})</span>` : ""; 
                } catch(_) { return ""; } 
              })()}
            </div>
            <button class="btn" onclick="tbManualFxDel('${escapeHTML(c)}')">Supprimer</button>
          </div>
        `).join("")
            : `<div class="muted">Aucun taux manuel.</div>`
        }
      </div>
    </div>
  `;

  // Prefill rate from Auto FX when user types a currency
  try {
    const curEl = document.getElementById("tbManualFxCur");
    const rateEl = document.getElementById("tbManualFxRate");
    if (curEl && rateEl) {
      curEl.addEventListener("input", () => {
        const c = String(curEl.value || "").trim().toUpperCase();
        if (!c || rateEl.value) return;
        try {
          const m = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : {};
          const live = (c === "EUR") ? 1 : (m && m[c]);
          if (live) rateEl.value = String(live);
        } catch (_) {}
      });
    }
  } catch (_) {}
}
function tbManualFxAdd() {
  try {
    const curEl = document.getElementById("tbManualFxCur");
    const rateEl = document.getElementById("tbManualFxRate");
    const c = String(curEl?.value || "").trim().toUpperCase();
    const r = Number(String(rateEl?.value || "").replace(",", "."));
    if (typeof tbFxSetManualRate !== "function") throw new Error("FX manual not available");
    tbFxSetManualRate(c, r);
    if (typeof renderSettings === "function") renderSettings(); else renderManualFxBox();
  } catch (e) {
    alert(e?.message || e);
  }
}

function tbManualFxDel(c) {
  try {
    if (typeof tbFxDeleteManualRate !== "function") throw new Error("FX manual not available");
    tbFxDeleteManualRate(c);
    if (typeof renderSettings === "function") renderSettings(); else renderManualFxBox();
  } catch (e) {
    alert(e?.message || e);
  }
}
