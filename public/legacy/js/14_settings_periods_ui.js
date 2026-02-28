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
          <input class="input" type="date" value="${escapeHTML(start || "")}" onchange="_tbSegSet('${id}','start',this.value)" />
        </div>
        <div style="min-width:160px;">
          <div class="label">Fin période</div>
          <input class="input" type="date" value="${escapeHTML(end || "")}" onchange="_tbSegSet('${id}','end',this.value)" />
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



    
    // === Write changes without violating the no-overlap constraint ===
    const oldStart = String(seg.start_date || seg.start || "");
    const oldEnd = String(seg.end_date || seg.end || "");

    // Determine interim shrink (never expands beyond old bounds)
    let interimStart = (startN > oldStart) ? startN : oldStart;
    let interimEnd = (endN < oldEnd) ? endN : oldEnd;
    if (interimStart > interimEnd) { interimStart = startN; interimEnd = endN; } // fallback

    // Helper to update current segment (common payload)
    const _updCurrent = async (sISO, eISO) => {
      const { error } = await sb
        .from(TB_CONST.TABLES.budget_segments)
        .update({
          start_date: sISO,
          end_date: eISO,
          base_currency: baseCurrency,
          daily_budget_base: dailyBudgetBase,
          fx_mode: fxMode,
          // V6.5 FX storage
          fx_rate_eur_to_base: (fxMode === "fixed" ? eurBaseRateFixed : null),
          fx_source: (fxMode === "fixed" ? "manual" : "fx"),
          fx_last_updated_at: new Date().toISOString(),
          // legacy compat (kept while DB migration is rolling)
          eur_base_rate_fixed: eurBaseRateFixed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    };

    // Step A: shrink current if needed (safe)
    if (interimStart !== oldStart || interimEnd !== oldEnd) {
      await _updCurrent(interimStart, interimEnd);
    }

    // Step B: shrink neighbors if current expands into them
    if (prev && prevEnd && startN < oldStart) {
      const { error: pe } = await sb
        .from(TB_CONST.TABLES.budget_segments)
        .update({ end_date: prevEnd, updated_at: new Date().toISOString() })
        .eq("id", prev.id);
      if (pe) throw pe;
    }
    if (next && nextStart && endN > oldEnd) {
      const { error: ne } = await sb
        .from(TB_CONST.TABLES.budget_segments)
        .update({ start_date: nextStart, updated_at: new Date().toISOString() })
        .eq("id", next.id);
      if (ne) throw ne;
    }

    // Step C: set current to final bounds
    await _updCurrent(startN, endN);

    // Step D: expand neighbors into gaps if current shrank away from them
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



    

    await _syncLastSegmentEndToPeriod(state.period.id, String(state?.period?.end || ""));
if (window.__TB_SEG_EDITS__) delete window.__TB_SEG_EDITS__[id];

    await refreshFromServer();
    renderSettings();
    renderWallets();
  });
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
    d.setDate(d.getDate() + Number(deltaDays || 0));
    return d.toISOString().slice(0, 10);
  } catch (e) {
    // fallback: return original (best-effort)
    return String(iso || "").slice(0, 10);
  }
}
// === Add segment modal (insert a new period inside an existing segment) ===
function _tbEnsureInsertModal() {
  if (document.getElementById("tbInsertSegModal")) return;
  const wrap = document.createElement("div");
  wrap.id = "tbInsertSegModal";
  wrap.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,.4); display:none; align-items:center; justify-content:center; z-index:9999;";
  wrap.innerHTML = `
    <div style="background:#fff; border-radius:14px; padding:16px; width:min(520px,92vw); box-shadow:0 10px 40px rgba(0,0,0,.25);">
      <div style="font-weight:700; font-size:18px; margin-bottom:10px;">Ajouter une période</div>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:160px;">
          <div class="label">Début</div>
          <input id="tbInsStart" class="input" type="date" />
        </div>
        <div style="flex:1; min-width:160px;">
          <div class="label">Fin</div>
          <input id="tbInsEnd" class="input" type="date" />
        </div>
        <div style="flex:1; min-width:160px;">
          <div class="label">Devise base</div>
          <input id="tbInsCur" class="input" placeholder="ex: THB" />
          <div class="muted" style="margin-top:6px;">Code ISO3 (ex: IDR). Auto FX si dispo, sinon manuel.</div>
        </div>
        <div style="flex:1; min-width:160px;">
          <div class="label">Budget/jour (base)</div>
          <input id="tbInsDaily" class="input" inputmode="decimal" placeholder="ex: 900" />
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
        <button class="btn" id="tbInsCancel">Annuler</button>
        <button class="btn primary" id="tbInsOk">Ajouter</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  document.getElementById("tbInsCancel").onclick = () => { wrap.style.display = "none"; };
  document.getElementById("tbInsOk").onclick = async () => {
    await safeCall("Ajouter période", async () => {
      const start = String(document.getElementById("tbInsStart").value || "").trim();
      const end = String(document.getElementById("tbInsEnd").value || "").trim();
      const cur = String(document.getElementById("tbInsCur").value || "").trim().toUpperCase();
      const daily = _tbParseNum(document.getElementById("tbInsDaily").value);
      if (!start || !end) throw new Error("Dates requises.");
      if (end < start) throw new Error("Fin < début.");
      if (!cur) throw new Error("Devise requise.");
      if (!isFinite(daily) || daily <= 0) throw new Error("Budget/jour invalide.");

      await _tbInsertSegmentInsideExisting(start, end, cur, daily);
      wrap.style.display = "none";
      await refreshFromServer();
      renderSettings();
      renderWallets();
    });
  };
}

async function _tbInsertSegmentInsideExisting(startISO, endISO, baseCur, dailyBudgetBase) {
  const sb = window.sb;
  if (!sb) throw new Error("Supabase non prêt.");
  const pid = String(state?.period?.id || "");
  if (!pid) throw new Error("Aucun voyage actif.");

  const segs = (state.budgetSegments || [])
    .filter(s => String(s.periodId || s.period_id) === pid)
    .slice()
    .sort((a,b) => String(a.start_date||a.start||"").localeCompare(String(b.start_date||b.start||"")));

  // find host segment that fully contains the requested range
  const host = segs.find(s => {
    const s0 = String(s.start_date || s.start || "");
    const e0 = String(s.end_date || s.end || "");
    return s0 <= startISO && endISO <= e0;
  });
  if (!host) throw new Error("La nouvelle période doit être incluse dans une période existante.");

  const hostStart = String(host.start_date || host.start || "");
  const hostEnd = String(host.end_date || host.end || "");

  // Prepare 3 ranges: before / new / after
  const beforeEnd = _tbDayBefore(startISO);
  const afterStart = _tbDayAfter(endISO);

  // Update host to become "before" if there is room, else it will become "after"
  // We'll do it in safe steps to satisfy no-overlap.
  // 1) shrink host to the left part (or right part if no left part)
  if (hostStart <= beforeEnd) {
    const { error: e1 } = await sb.from(TB_CONST.TABLES.budget_segments).update({ end_date: beforeEnd, updated_at: new Date().toISOString() }).eq("id", host.id);
    if (e1) throw e1;
    // Create "after" if needed
    if (afterStart <= hostEnd) {
      const { error: e2 } = await sb.from(TB_CONST.TABLES.budget_segments).insert({
        user_id: host.user_id,
        period_id: pid,
        start_date: afterStart,
        end_date: hostEnd,
        base_currency: String(host.base_currency || host.baseCurrency || baseCur),
        daily_budget_base: Number(host.daily_budget_base || host.dailyBudgetBase || dailyBudgetBase),
        fx_mode: String(host.fx_mode || host.fxMode || "live_ecb"),
        eur_base_rate_fixed: host.eur_base_rate_fixed ?? host.eurBaseRateFixed ?? null,
        updated_at: new Date().toISOString(),
      });
      if (e2) throw e2;
    }
  } else if (afterStart <= hostEnd) {
    // no left part: host becomes the "after" part
    const { error: e1 } = await sb.from(TB_CONST.TABLES.budget_segments).update({ start_date: afterStart, updated_at: new Date().toISOString() }).eq("id", host.id);
    if (e1) throw e1;
  } else {
    throw new Error("Insertion invalide (intervalle couvre toute la période).");
  }

  // 2) insert the new segment
  const { error: e3 } = await sb.from(TB_CONST.TABLES.budget_segments).insert({
    user_id: host.user_id,
    period_id: pid,
    start_date: startISO,
    end_date: endISO,
    base_currency: baseCur,
    daily_budget_base: dailyBudgetBase,
    fx_mode: "live_ecb",
    eur_base_rate_fixed: null,
    updated_at: new Date().toISOString(),
  });
  if (e3) throw e3;

  await _tbRecalcSortOrders(pid);
}

async function newPeriod() {
  _tbEnsureInsertModal();
  const modal = document.getElementById("tbInsertSegModal");
  // prefill with a safe default: inside the last segment by 1 day
  try {
    const segs = (state.budgetSegments || []).filter(s => String(s.periodId || s.period_id) === String(state?.period?.id || "")).slice()
      .sort((a,b)=>String(a.start_date||a.start||"").localeCompare(String(b.start_date||b.start||"")));
    const host = segs[segs.length-1];
    if (host) {
      const hs = String(host.start_date||host.start||"");
      const he = String(host.end_date||host.end||"");
      const start = _tbDayBefore(he);
      const end = he;
      const sEl = document.getElementById("tbInsStart");
      const eEl = document.getElementById("tbInsEnd");
      if (sEl) sEl.value = (start >= hs ? start : hs);
      if (eEl) eEl.value = end;
      const cEl = document.getElementById("tbInsCur");
      if (cEl) cEl.value = String(host.base_currency || host.baseCurrency || state?.period?.baseCurrency || "").toUpperCase();
      const dEl = document.getElementById("tbInsDaily");
      if (dEl) dEl.value = String(host.daily_budget_base || host.dailyBudgetBase || "");
    }
  } catch (_) {}
  if (modal) modal.style.display = "flex";
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

// Legacy global hooks (HTML onclick attributes)
try {
  window.createPeriodPrompt = newPeriod;
  window.deleteActivePeriod = deletePeriod;
  window.saveSettings = saveSettings;
  window.renderSettings = renderSettings;
} catch (_) {}
