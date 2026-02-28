/* ========================= 
   Settings: periods UI
   ========================= */

// Ensure window.sb exists when the project exposes only a global `sb`
try {
  if (typeof window !== "undefined" && !window.sb && typeof sb !== "undefined") {
    window.sb = sb;
  }
} catch (_) {}

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

  // Ensure calendars
  try {
    if (startEl) startEl.type = "date";
    if (endEl) endEl.type = "date";
  } catch (_) {}

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
          <input type="date" class="input" value="${escapeHTML(start || "")}" onchange="_tbSegSet('${id}','start',this.value)" />
        </div>
        <div style="min-width:160px;">
          <div class="label">Fin période</div>
          <input type="date" class="input" value="${escapeHTML(end || "")}" onchange="_tbSegSet('${id}','end',this.value)" />
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
        </div>
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
  } catch (_) {}

  try {
    const dl = document.getElementById("tbCurrencyList");
    if (dl) {
      const arr = (typeof tbFxGetKnownCurrencies === "function") ? tbFxGetKnownCurrencies() : [];
      dl.innerHTML = (arr || []).map(c => `<option value="${escapeHTML(String(c||"").toUpperCase())}"></option>`).join("");
    }
  } catch (_) {}

  const host = document.getElementById("seg-list");
  if (!host) return;

  const pid = String((state.period || {}).id || "");
  const segs = (state.budgetSegments || [])
    .filter(s => s && String(s.periodId || s.period_id) === pid)
    .slice()
    .sort((a,b) => String(a.start||"").localeCompare(String(b.start||"")));

  host.innerHTML = segs.map((seg, idx) => _segRowHTML(seg, idx, segs.length)).join("");

  // Buttons (these ids exist in settings HTML)
  const btnAdd = document.getElementById("btn-add-period");
  if (btnAdd && !btnAdd.dataset.tbBound) {
    btnAdd.dataset.tbBound = "1";
    btnAdd.onclick = () => safeCall("Ajouter période", async () => createPeriodPrompt());
  }

  const btnSaveVoyage = document.getElementById("btn-save-settings");
  if (btnSaveVoyage && !btnSaveVoyage.dataset.tbBound) {
    btnSaveVoyage.dataset.tbBound = "1";
    btnSaveVoyage.onclick = () => safeCall("Enregistrer voyage", async () => saveSettings());
  }

  const btnAddVoyage = document.getElementById("btn-add-voyage");
  if (btnAddVoyage && !btnAddVoyage.dataset.tbBound) {
    btnAddVoyage.dataset.tbBound = "1";
    btnAddVoyage.onclick = () => safeCall("Ajouter voyage", async () => createVoyagePrompt());
  }

  const btnDeleteVoyage = document.getElementById("btn-delete-voyage");
  if (btnDeleteVoyage && !btnDeleteVoyage.dataset.tbBound) {
    btnDeleteVoyage.dataset.tbBound = "1";
    btnDeleteVoyage.onclick = () => safeCall("Supprimer voyage", async () => deleteActiveVoyage());
  }
}

/* =========================
   Seg edits cache
   ========================= */
function _tbSegEdits() {
  if (!window.__TB_SEG_EDITS__) window.__TB_SEG_EDITS__ = {};
  return window.__TB_SEG_EDITS__;
}
function _tbSegSet(id, key, val) {
  const e = _tbSegEdits();
  if (!e[id]) e[id] = {};
  e[id][key] = val;
}

/* =========================
   Save / CRUD Segments + Voyage
   ========================= */

function _tbGetSegmentsForActivePeriodSorted() {
  const pid = String((state.period || {}).id || "");
  return (state.budgetSegments || [])
    .filter(s => s && String(s.periodId || s.period_id) === pid)
    .slice()
    .sort((a,b) => String(a.start||"").localeCompare(String(b.start||"")));
}

function _tbParseBudgetNum(v) {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function saveBudgetSegment(segId) {
  await safeCall("Save période", async () => {
    const p = state.period || {};
    if (!p.id) throw new Error("Aucun voyage actif.");

    const seg = (state.budgetSegments || []).find(s => String(s.id) === String(segId));
    if (!seg) throw new Error("Période introuvable.");

    const edits = (_tbSegEdits()[segId]) || {};
    const start = String(edits.start ?? seg.start ?? "").slice(0,10);
    const end = String(edits.end ?? seg.end ?? "").slice(0,10);
    const baseCurrency = String(edits.baseCurrency ?? seg.baseCurrency ?? "").trim().toUpperCase();
    const dailyBudgetBase = _tbParseBudgetNum(edits.dailyBudgetBase ?? seg.dailyBudgetBase);
    const eurBaseRateFixed = _tbParseBudgetNum(edits.eurBaseRateFixed ?? seg.eurBaseRateFixed);
    const fxMode = String(edits.fxMode ?? seg.fxMode ?? "live_ecb");

    if (!start || !end) throw new Error("Dates invalides.");
    if (start > end) throw new Error("Début > fin.");
    if (!baseCurrency || baseCurrency.length < 3) throw new Error("Devise invalide.");
    if (dailyBudgetBase === null || dailyBudgetBase < 0) throw new Error("Budget/jour invalide.");

    // If fixed mode, require rate when base != EUR
    if (String(baseCurrency).toUpperCase() !== "EUR") {
      const autoOk = (typeof tbFxIsAutoAvailable === "function") ? tbFxIsAutoAvailable(baseCurrency) : false;
      const effectiveMode = autoOk ? "live_ecb" : "fixed";
      if (effectiveMode === "fixed") {
        if (!eurBaseRateFixed || eurBaseRateFixed <= 0) throw new Error("Taux EUR→BASE requis (manuel).");
      }
    }

    const patch = {
      start_date: start,
      end_date: end,
      base_currency: baseCurrency,
      daily_budget_base: dailyBudgetBase,
      fx_mode: fxMode,
      eur_base_rate_fixed: eurBaseRateFixed || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb
      .from(TB_CONST.TABLES.budget_segments)
      .update(patch)
      .eq("id", segId);

    if (error) throw error;

    // refresh local
    await refreshFromServer();
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("saveBudgetSegment"); else if (typeof renderAll === "function") renderAll();
  });
}

async function saveSettings() {
  await safeCall("Enregistrer voyage", async () => {
    const p = state.period || {};
    if (!p.id) throw new Error("Aucun voyage actif.");

    const startEl = document.getElementById("s-start");
    const endEl = document.getElementById("s-end");
    const voyageStart = String(startEl?.value || p.start || "").slice(0,10);
    const voyageEnd = String(endEl?.value || p.end || "").slice(0,10);
    if (!voyageStart || !voyageEnd) throw new Error("Dates voyage invalides.");
    if (voyageStart > voyageEnd) throw new Error("Début voyage > fin.");

    // Save only dates (base/budget removed from voyage)
    const { error } = await sb
      .from(TB_CONST.TABLES.periods)
      .update({
        start_date: voyageStart,
        end_date: voyageEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);

    if (error) throw error;

    // Sync first/last segment boundaries to voyage bounds (DB)
    try {
      const segs = _tbGetSegmentsForActivePeriodSorted();
      if (segs.length) {
        const first = segs[0];
        const last = segs[segs.length - 1];
        await sb.from(TB_CONST.TABLES.budget_segments).update({ start_date: voyageStart, updated_at: new Date().toISOString() }).eq("id", first.id);
        await sb.from(TB_CONST.TABLES.budget_segments).update({ end_date: voyageEnd, updated_at: new Date().toISOString() }).eq("id", last.id);
      }
    } catch (e) {
      console.warn("[settings] bounds sync segments failed", e);
    }

    await refreshFromServer();
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("saveSettings"); else if (typeof renderAll === "function") renderAll();
  });
}

async function createPeriodPrompt() {
  await safeCall("Ajouter période", async () => {
    if (!sbUser?.id) throw new Error("Not authenticated.");

    const p = state.period || {};
    if (!p.id) throw new Error("Aucun voyage actif.");

    // Insert inside existing: choose a cut date between first and last
    const segs = _tbGetSegmentsForActivePeriodSorted();
    if (!segs.length) throw new Error("Aucune période à découper.");

    const cur = segs[0];
    const start = String(cur.start || "").slice(0,10);
    const end = String(cur.end || "").slice(0,10);
    if (!start || !end) throw new Error("Segment invalide.");

    const cut = prompt(`Date de début de la nouvelle période (entre ${start} et ${end})`, start);
    const cutDate = String(cut || "").slice(0,10);
    if (!cutDate) return;
    if (cutDate <= start || cutDate > end) throw new Error("Date hors intervalle.");

    // Split: existing becomes [start, day_before_cut], new becomes [cut, end]
    const dayBefore = new Date(cutDate + "T00:00:00Z");
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
    const prevEnd = dayBefore.toISOString().slice(0,10);
    if (prevEnd < start) throw new Error("Découpe invalide.");

    // Update current segment end
    const { error: e1 } = await sb
      .from(TB_CONST.TABLES.budget_segments)
      .update({ end_date: prevEnd, updated_at: new Date().toISOString() })
      .eq("id", cur.id);
    if (e1) throw e1;

    // Insert new segment (same settings by default)
    const newSeg = {
      user_id: sbUser.id,
      period_id: p.id,
      start_date: cutDate,
      end_date: end,
      base_currency: String(cur.baseCurrency || cur.base_currency || p.baseCurrency || "EUR").toUpperCase(),
      daily_budget_base: Number(cur.dailyBudgetBase ?? cur.daily_budget_base ?? 0),
      fx_mode: String(cur.fxMode || cur.fx_mode || "live_ecb"),
      eur_base_rate_fixed: cur.eurBaseRateFixed ?? cur.eur_base_rate_fixed ?? null,
      sort_order: (Number(cur.sortOrder ?? cur.sort_order ?? 0) + 1),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: e2 } = await sb.from(TB_CONST.TABLES.budget_segments).insert(newSeg);
    if (e2) throw e2;

    await refreshFromServer();
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("createPeriodPrompt"); else if (typeof renderAll === "function") renderAll();
  });
}

async function createVoyagePrompt() {
  await safeCall("Ajouter voyage", async () => {
    if (!sbUser?.id) throw new Error("Not authenticated.");

    const start = prompt("Date de début du nouveau voyage (YYYY-MM-DD)", "");
    const end = prompt("Date de fin du nouveau voyage (YYYY-MM-DD)", "");
    const s = String(start || "").slice(0,10);
    const e = String(end || "").slice(0,10);
    if (!s || !e) return;
    if (s > e) throw new Error("Début > fin.");

    // Period base_currency/eur_base_rate are legacy constraints, so we fill with safe defaults
    const payload = {
      user_id: sbUser.id,
      start_date: s,
      end_date: e,
      base_currency: "EUR",
      eur_base_rate: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await sb.from(TB_CONST.TABLES.periods).insert(payload).select("id").single();
    if (error) throw error;

    // Create 1 default segment covering whole voyage
    const seg = {
      user_id: sbUser.id,
      period_id: data.id,
      start_date: s,
      end_date: e,
      base_currency: "EUR",
      daily_budget_base: 0,
      fx_mode: "live_ecb",
      eur_base_rate_fixed: null,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: e2 } = await sb.from(TB_CONST.TABLES.budget_segments).insert(seg);
    if (e2) throw e2;

    await setActivePeriod(data.id);
    await refreshFromServer();
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("createVoyagePrompt"); else if (typeof renderAll === "function") renderAll();
  });
}

async function deleteActiveVoyage() {
  await safeCall("Supprimer période", async () => {
    const p = state.period || {};
    if (!p.id) throw new Error("Aucun voyage actif.");

    const ok = confirm("Supprimer le voyage actif ? (⚠️ supprime aussi ses périodes)");
    if (!ok) return;

    // delete segments then period
    const { error: e1 } = await sb.from(TB_CONST.TABLES.budget_segments).delete().eq("period_id", p.id);
    if (e1) throw e1;

    const { error: e2 } = await sb.from(TB_CONST.TABLES.periods).delete().eq("id", p.id);
    if (e2) throw e2;

    await refreshFromServer();
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("deleteActiveVoyage"); else if (typeof renderAll === "function") renderAll();
  });
}

/* =========================
   Manual FX Box (existing)
   ========================= */

function renderManualFxBox() {
  if (typeof tbFxRenderManualRatesBox === "function") {
    tbFxRenderManualRatesBox("manual-fx-box");
  }
}

/* =========================
   Categories settings UI
   ========================= */

function renderCategoriesSettingsUI() {
  const host = document.getElementById("cat-settings");
  if (!host) return;

  const cats = (state.categories || []).slice().sort((a,b)=> String(a.name||"").localeCompare(String(b.name||"")));
  const rows = cats.map(c => {
    const color = c.color || "#888888";
    const name = c.name || "";
    return `
      <div class="card" style="padding:10px; margin:8px 0; display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
        <div style="display:flex; gap:10px; align-items:center;">
          <input type="color" value="${escapeHTML(color)}" onchange="setCategoryColor('${escapeHTML(c.id)}', this.value)" />
          <div style="font-weight:600;">${escapeHTML(name)}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn" onclick="deleteCategory('${escapeHTML(c.id)}')">Supprimer</button>
        </div>
      </div>
    `;
  }).join("");

  host.innerHTML = `
    <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
      <div style="min-width:220px;">
        <div class="label">Nouvelle catégorie</div>
        <input id="cat-new-name" class="input" placeholder="ex: Transport" />
      </div>
      <div style="min-width:140px;">
        <div class="label">Couleur</div>
        <input id="cat-new-color" class="input" type="color" value="#888888" />
      </div>
      <div>
        <button class="btn" onclick="addCategory()">Ajouter</button>
      </div>
    </div>
    <div style="margin-top:10px;">${rows || `<div class="muted">Aucune catégorie.</div>`}</div>
  `;
}

async function addCategory() {
  safeCall("Add category", async () => {
    if (!sbUser?.id) throw new Error("Not authenticated.");

    const nameEl = document.getElementById("cat-new-name");
    const colorEl = document.getElementById("cat-new-color");
    const name = String(nameEl?.value || "").trim();
    const color = String(colorEl?.value || "#888888").trim();
    if (!name) return;

    const { error } = await sb.from(TB_CONST.TABLES.categories).insert({
      user_id: sbUser.id,
      name,
      color,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    await refreshFromServer();
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("addCategory"); else if (typeof renderAll === "function") renderAll();
  });
}

async function deleteCategory(catId) {
  safeCall("Delete category", async () => {
    const ok = confirm("Supprimer cette catégorie ?");
    if (!ok) return;

    const { error } = await sb.from(TB_CONST.TABLES.categories).delete().eq("id", catId);
    if (error) throw error;

    await refreshFromServer();
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("deleteCategory"); else if (typeof renderAll === "function") renderAll();
  });
}

async function setCategoryColor(catId, color) {
  safeCall("Set category color", async () => {
    const { error } = await sb.from(TB_CONST.TABLES.categories).update({
      color: String(color || "#888888"),
      updated_at: new Date().toISOString(),
    }).eq("id", catId);
    if (error) throw error;

    await refreshFromServer();
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("setCategoryColor"); else if (typeof renderAll === "function") renderAll();
  });
}