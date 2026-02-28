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
    // NOTE: eurBaseRateFixed is read-only in auto (we display the live value).
    let eurBaseRateFixedRaw = edits.eurBaseRateFixed ?? seg.eurBaseRateFixed;
    let eurBaseRateFixed =
      eurBaseRateFixedRaw === "" || eurBaseRateFixedRaw === null || eurBaseRateFixedRaw === undefined
        ? null
		: _tbParseNum(eurBaseRateFixedRaw);

    // fx_mode is automatic: use "fixed" only when a manual EUR→BASE rate is provided.
    let fxMode = (eurBaseRateFixed !== null && isFinite(eurBaseRateFixed) && eurBaseRateFixed > 0) ? "fixed" : "live_ecb";

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
    // === Normalisation & auto-adaptation (no holes) ===
    const _norm = (d) => {
      const s = String(d || "").trim();
      if (!s) return "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const dt = new Date(s);
      if (!Number.isFinite(dt.getTime())) throw new Error(`Date invalide: ${s}`);
      return toLocalISODate(dt);
    };

    let startN = _norm(start);
    let endN = _norm(endFixed);

    if (startN && endN && startN > endN) throw new Error("start ≤ end requis.");

    // Clamp first/last to voyage bounds (prevents holes at edges)
    const voyageStart = String(state?.period?.start || state?.period?.start_date || "").trim();
    const voyageEnd = String(state?.period?.end || state?.period?.end_date || "").trim();

    // Determine neighbors in chronological order
    const segsSame = (state.budgetSegments || [])
      .filter(s => s && String(s.periodId || s.period_id) === String(state.period.id))
      .slice()
      .sort((a,b) => String(a.start_date || a.start || "").localeCompare(String(b.start_date || b.start || "")));

    const idx = segsSame.findIndex(s => String(s.id) === String(id));
    const isFirst = idx === 0;
    const isLast = idx === segsSame.length - 1;

    if (isFirst && voyageStart) startN = voyageStart;
    if (isLast && voyageEnd) endN = voyageEnd;

    // Compute desired neighbor bounds so there are no gaps
    const prev = (idx > 0) ? segsSame[idx - 1] : null;
    const next = (idx >= 0 && idx < segsSame.length - 1) ? segsSame[idx + 1] : null;

    let prevEnd = prev ? _tbDayBefore(startN) : null;
    let nextStart = next ? _tbDayAfter(endN) : null;

    // prevent invalid ranges on neighbors
    if (prev && prevEnd && prevEnd < String(prev.start_date || prev.start || "")) {
      prevEnd = String(prev.start_date || prev.start || "");
    }
    if (next && nextStart && nextStart > String(next.end_date || next.end || "")) {
      nextStart = String(next.end_date || next.end || "");
    }



    // Safe ordering to satisfy budget_segments_no_overlap exclusion constraint
    const curSeg = (idx >= 0) ? segsSame[idx] : null;
    const oldStart = curSeg ? String(curSeg.start_date || curSeg.start || "").slice(0,10) : startN;
    const oldEnd = curSeg ? String(curSeg.end_date || curSeg.end || "").slice(0,10) : endN;

    // If expanding into prev/next, shrink neighbors FIRST
    if (prev && prevEnd && startN < oldStart) {
      const { error: pe0 } = await sb
        .from(TB_CONST.TABLES.budget_segments)
        .update({ end_date: prevEnd, updated_at: new Date().toISOString() })
        .eq("id", prev.id);
      if (pe0) throw pe0;
    }
    if (next && nextStart && endN > oldEnd) {
      const { error: ne0 } = await sb
        .from(TB_CONST.TABLES.budget_segments)
        .update({ start_date: nextStart, updated_at: new Date().toISOString() })
        .eq("id", next.id);
      if (ne0) throw ne0;
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

    // If shrinking, extend neighbors AFTER (fills the gap without overlapping)
    if (prev && prevEnd && startN > oldStart) {
      const { error: pe } = await sb
        .from(TB_CONST.TABLES.budget_segments)
        .update({ end_date: prevEnd, updated_at: new Date().toISOString() })
        .eq("id", prev.id);
      if (pe) throw pe;
    }
    if (next && nextStart && endN < oldEnd) {
      const { error: ne } = await sb
        .from(TB_CONST.TABLES.budget_segments)
        .update({ start_date: nextStart, updated_at: new Date().toISOString() })
        .eq("id", next.id);
      if (ne) throw ne;
    }

    await _tbRecalcSortOrders(state.period.id);


    

    await _syncLastSegmentEndToPeriod(state.period.id);
    await _syncFirstSegmentStartToPeriod(state.period.id);
if (window.__TB_SEG_EDITS__) delete window.__TB_SEG_EDITS__[id];

    await refreshFromServer();
    renderSettings();
    renderWallets();
  });
}




async function _syncFirstSegmentStartToPeriod(periodId) {
  try {
    const sbx = _tbGetSB ? _tbGetSB() : (typeof sb !== "undefined" ? sb : null);
    if (!sbx) return;
    const pid = String(periodId || state?.period?.id || "");
    if (!pid) return;

    const { data, error } = await sbx
      .from(TB_CONST.TABLES.budget_segments)
      .select("start_date")
      .eq("period_id", pid)
      .order("start_date", { ascending: true })
      .limit(1);

    if (error) throw error;
    const first = Array.isArray(data) && data[0] ? String(data[0].start_date || "").slice(0,10) : null;
    if (!first) return;

    await sbx.from(TB_CONST.TABLES.periods).update({ start_date: first, updated_at: new Date().toISOString() }).eq("id", pid);
  } catch (e) {
    console.warn("[settings] bounds sync first segment failed", e);
  }
}

async function _syncLastSegmentEndToPeriod(periodId) {
  try {
    const sbx = _tbGetSB ? _tbGetSB() : (typeof sb !== "undefined" ? sb : null);
    if (!sbx) return;
    const pid = String(periodId || state?.period?.id || "");
    if (!pid) return;

    const { data, error } = await sbx
      .from(TB_CONST.TABLES.budget_segments)
      .select("end_date")
      .eq("period_id", pid)
      .order("end_date", { ascending: false })
      .limit(1);

    if (error) throw error;
    const last = Array.isArray(data) && data[0] ? String(data[0].end_date || "").slice(0,10) : null;
    if (!last) return;

    await sbx.from(TB_CONST.TABLES.periods).update({ end_date: last, updated_at: new Date().toISOString() }).eq("id", pid);
  } catch (e) {
    console.warn("[settings] bounds sync last segment failed", e);
  }
}


// helpers
function _tbDayBefore(iso) { return _tbDateAddDays(iso, -1); }
function _tbDayAfter(iso) { return _tbDateAddDays(iso, 1); }

async function _tbRecalcSortOrders(periodId) {
  try {
    const sb = window.sb;
    const pid = String(periodId || "");
    if (!sb || !pid) return;

    const { data, error } = await sb
      .from(TB_CONST.TABLES.budget_segments)
      .select("id,start_date")
      .eq("period_id", pid)
      .order("start_date", { ascending: true });

    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    for (let i = 0; i < rows.length; i++) {
      const id = rows[i].id;
      await sb
        .from(TB_CONST.TABLES.budget_segments)
        .update({ sort_order: i, updated_at: new Date().toISOString() })
        .eq("id", id);
    }
  } catch (e) {
    console.warn("[segments] recalc sort_order failed", e);
  }
}
function _tbDateAddDays(iso, deltaDays) {
  try {
    const d = new Date(String(iso) + "T00:00:00");
    d.setDate(d.getDate() + Number(deltaDays||0));
    return d.toISOString().slice(0,10);
  } catch (_) { return iso; }
}


/* =========================
   Voyage / Segments actions (V6.6.67c+)
   - saveSettings: voyage dates only (periods table)
   - newPeriod: add/insert segment (budget_segments) inside existing segment (no holes)
   - createVoyagePrompt: add voyage (period) + default first segment
   ========================= */

async function _tbAuthUid() {
  try {
    // Prefer state
    const sid = state?.session?.user?.id || state?.auth?.user?.id || state?.user?.id;
    if (sid) return sid;

    // Supabase client global 'sb' exists in this project
    if (typeof sb !== "undefined" && sb?.auth) {
      // Newer supabase-js
      if (typeof sb.auth.getUser === "function") {
        const { data } = await sb.auth.getUser();
        const uid = data?.user?.id;
        if (uid) return uid;
      }
      // Legacy supabase-js
      if (typeof sb.auth.session === "function") {
        const s = sb.auth.session();
        const uid = s?.user?.id;
        if (uid) return uid;
      }
    }
  } catch (_) {}
  return null;
}

function _tbGetSB() {
  try {
    if (typeof sb !== "undefined" && sb && typeof sb.from === "function") return sb;
  } catch (_) {}
  return (window && window.sb && typeof window.sb.from === "function") ? window.sb : null;
}

// Save only voyage dates; keep DB-required fields untouched (eur_base_rate, base_currency, etc.)
async function saveSettings() {
  await safeCall("Enregistrer voyage", async () => {
    const sbx = _tbGetSB();
    if (!sbx) throw new Error("Supabase non prêt.");
    const pid = state?.period?.id;
    if (!pid) throw new Error("Aucun voyage actif.");

    const startEl = document.getElementById("s-start");
    const endEl = document.getElementById("s-end");
    const voyageStart = String(startEl?.value || state.period.start || state.period.start_date || "").slice(0,10);
    const voyageEnd = String(endEl?.value || state.period.end || state.period.end_date || "").slice(0,10);
    if (!voyageStart || !voyageEnd) throw new Error("Dates voyage invalides.");
    if (voyageEnd < voyageStart) throw new Error("La fin du voyage doit être ≥ début.");

    // Patch voyage dates only
    const { error } = await sbx
      .from(TB_CONST.TABLES.periods)
      .update({ start_date: voyageStart, end_date: voyageEnd, updated_at: new Date().toISOString() })
      .eq("id", pid);
    if (error) throw error;

    // Clamp first/last segments to voyage bounds (no holes at edges)
    await _syncFirstSegmentStartToPeriod(pid);
    await _syncLastSegmentEndToPeriod(pid);

    await refreshFromServer();
    if (typeof renderSettings === "function") renderSettings();
    if (typeof renderWallets === "function") renderWallets();
  });
}

// Insert a new segment inside an existing one (no holes). Requires new range fully inside one existing segment.
async function _tbInsertSegmentInsideExisting(startIso, endIso, baseCurrency, dailyBudgetBase) {
  const sbx = _tbGetSB();
  if (!sbx) throw new Error("Supabase non prêt.");
  const uid = await _tbAuthUid();
  if (!uid) throw new Error("Not authenticated.");
  const pid = state?.period?.id;
  if (!pid) throw new Error("Aucun voyage actif.");

  const startN = String(startIso || "").slice(0,10);
  const endN = String(endIso || "").slice(0,10);
  if (!startN || !endN || endN < startN) throw new Error("Dates invalides.");

  // Find hosting segment (must fully contain)
  const segs = (state.budgetSegments || []).filter(s => String(s.periodId || s.period_id) === String(pid));
  const host = segs.find(s => {
    const s0 = String(s.start_date || s.start || "").slice(0,10);
    const e0 = String(s.end_date || s.end || "").slice(0,10);
    return s0 && e0 && s0 <= startN && endN <= e0;
  });
  if (!host) throw new Error("La nouvelle période doit être incluse dans une période existante.");

  const hostStart = String(host.start_date || host.start || "").slice(0,10);
  const hostEnd = String(host.end_date || host.end || "").slice(0,10);

  // Compute split ranges
  const beforeStart = hostStart;
  const beforeEnd = _tbDayBefore(startN);
  const afterStart = _tbDayAfter(endN);
  const afterEnd = hostEnd;

  // Phase 1: shrink host to 'before' (or delete if empty)
  if (beforeEnd < beforeStart) {
    // no before part
    const { error: delErr } = await sbx.from(TB_CONST.TABLES.budget_segments).delete().eq("id", host.id);
    if (delErr) throw delErr;
  } else {
    const { error: upErr } = await sbx
      .from(TB_CONST.TABLES.budget_segments)
      .update({ start_date: beforeStart, end_date: beforeEnd, updated_at: new Date().toISOString() })
      .eq("id", host.id);
    if (upErr) throw upErr;
  }

  // Phase 2: insert new middle segment (must include user_id for RLS)
  const segPayload = {
    user_id: uid,
    period_id: pid,
    start_date: startN,
    end_date: endN,
    base_currency: String(baseCurrency || host.base_currency || "EUR").toUpperCase(),
    daily_budget_base: Number(dailyBudgetBase || host.daily_budget_base || 0),
    fx_mode: "auto",
    sort_order: 9999,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: insData, error: insErr } = await sbx
    .from(TB_CONST.TABLES.budget_segments)
    .insert([segPayload])
    .select("id");
  if (insErr) throw insErr;

  // Phase 3: create 'after' part if needed (new row) — also needs user_id
  if (afterStart <= afterEnd) {
    const afterPayload = {
      user_id: uid,
      period_id: pid,
      start_date: afterStart,
      end_date: afterEnd,
      base_currency: String(host.base_currency || "EUR").toUpperCase(),
      daily_budget_base: Number(host.daily_budget_base || 0),
      fx_mode: host.fx_mode || "auto",
      sort_order: 9999,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error: aErr } = await sbx.from(TB_CONST.TABLES.budget_segments).insert([afterPayload]);
    if (aErr) throw aErr;
  }

  await _tbRecalcSortOrders(pid);
  await _syncFirstSegmentStartToPeriod(pid);
  await _syncLastSegmentEndToPeriod(pid);
}

async function newPeriod() {
  await safeCall("Ajouter période", async () => {
    // Basic prompt-based modal fallback (keeps dependencies low)
    const start = prompt("Début de la nouvelle période (YYYY-MM-DD) ?");
    if (!start) return;
    const end = prompt("Fin de la nouvelle période (YYYY-MM-DD) ?");
    if (!end) return;

    const base = prompt("Devise de la période (ISO3, ex: EUR, THB, IDR) ?", "EUR");
    if (!base) return;

    const daily = prompt("Budget/jour (dans la devise de la période) ?", "0");
    const dailyN = Number(String(daily||"").replace(",", "."));
    if (!Number.isFinite(dailyN) || dailyN < 0) throw new Error("Budget/jour invalide.");

    await _tbInsertSegmentInsideExisting(start, end, base, dailyN);

    await refreshFromServer();
    if (typeof renderSettings === "function") renderSettings();
  });
}

// Add voyage (period) + one default segment covering whole range.
// Note: periods table has NOT NULL eur_base_rate; we set base_currency='EUR' and eur_base_rate=1 by default.
async function createVoyagePrompt() {
  await safeCall("Ajouter voyage", async () => {
    const sbx = _tbGetSB();
    if (!sbx) throw new Error("Supabase non prêt.");
    const uid = await _tbAuthUid();
    if (!uid) throw new Error("Not authenticated.");

    const start = prompt("Début du voyage (YYYY-MM-DD) ?");
    if (!start) return;
    const end = prompt("Fin du voyage (YYYY-MM-DD) ?");
    if (!end) return;
    const startN = String(start).slice(0,10);
    const endN = String(end).slice(0,10);
    if (!startN || !endN || endN < startN) throw new Error("Dates invalides.");

    // Create period (voyage)
    const periodPayload = {
      user_id: uid,
      start_date: startN,
      end_date: endN,
      base_currency: "EUR",
      daily_budget_base: 0,
      eur_base_rate: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: pData, error: pErr } = await sbx
      .from(TB_CONST.TABLES.periods)
      .insert([periodPayload])
      .select("id")
      .single();

    if (pErr) throw pErr;
    const periodId = pData?.id;
    if (!periodId) throw new Error("Création voyage échouée.");

    // Create a single default segment covering full voyage
    const segPayload = {
      user_id: uid,
      period_id: periodId,
      start_date: startN,
      end_date: endN,
      base_currency: "EUR",
      daily_budget_base: 0,
      fx_mode: "auto",
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: sErr } = await sbx.from(TB_CONST.TABLES.budget_segments).insert([segPayload]);
    if (sErr) throw sErr;

    await refreshFromServer();
    await setActivePeriod(periodId);
    await refreshFromServer();
    if (typeof renderSettings === "function") renderSettings();
    if (typeof renderWallets === "function") renderWallets();
  });
}

// Backward-compat globals used by index.html
window.saveSettings = saveSettings;
window.newPeriod = newPeriod;
window.createPeriodPrompt = newPeriod;
window.createVoyagePrompt = createVoyagePrompt;
window.deleteActivePeriod = deletePeriod;


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
