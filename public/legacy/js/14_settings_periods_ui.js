/* ========================= 
   Settings: periods UI
   ========================= */
async function loadPeriodsListIntoUI() {
  const sel = document.getElementById("s-period");
  if (!sel) return;

  const { data: periods, error } = await sb
    .from("periods")
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
      const label = `${p.start} → ${p.end} (${p.baseCurrency})`;
      const selected = String(p.id) === String(state.period.id) ? "selected" : "";
      return `<option value="${escapeHTML(p.id)}" ${selected}>${escapeHTML(label)}</option>`;
    })
    .join("");

  sel.onchange = async () => {
    const id = sel.value;
    await setActivePeriod(id);
    await refreshFromServer();
    renderAll();
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
    await sb.from("settings").upsert({
      user_id: sbUser.id,
      active_period_id: p.id,
      updated_at: new Date().toISOString(),
    });
  } catch (_) {}
}

function renderSettings() {
  loadPeriodsListIntoUI();

  const p = state.period || {};
  const baseCurEl = document.getElementById("s-basecur");
  const startEl = document.getElementById("s-start");
  const endEl = document.getElementById("s-end");
  const dailyEl = document.getElementById("s-daily");
  const rateEl = document.getElementById("s-rate");

  if (baseCurEl) baseCurEl.value = p.baseCurrency || "EUR";
  if (startEl) startEl.value = p.start || "";
  if (endEl) endEl.value = p.end || "";
  if (dailyEl) dailyEl.value = String(p.dailyBudgetBase || "");
  if (rateEl) rateEl.value = String(p.eurBaseRate || "");

  // segments UI (V6.4)
  renderBudgetSegmentsUI();

  // categories UI
  try { renderCategoriesSettingsUI(); } catch (e) { console.warn('[categories] render failed', e); }
}

/* =========================
   Budget Segments UI (V6.4 minimal)
   ========================= */

function _segRowHTML(seg) {
  const id = seg.id;
  const edits = (window.__TB_SEG_EDITS__ && window.__TB_SEG_EDITS__[id]) || {};
  const start = edits.start ?? seg.start;
  const end = edits.end ?? seg.end;
  const baseCurrency = edits.baseCurrency ?? seg.baseCurrency;
  const dailyBudgetBase = edits.dailyBudgetBase ?? seg.dailyBudgetBase;
  const fxMode = edits.fxMode ?? seg.fxMode ?? "fixed";
  const eurBaseRateFixed = (edits.eurBaseRateFixed ?? seg.eurBaseRateFixed) ?? "";
  const sortOrder = edits.sortOrder ?? seg.sortOrder ?? 0;

  return `
    <div class="card" style="padding:12px; margin:10px 0;">
      <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-end;">
        <div style="min-width:160px;">
          <div class="label">Début segment</div>
          <input class="input" value="${escapeHTML(start || "")}" onchange="_tbSegSet('${id}','start',this.value)" />
        </div>
        <div style="min-width:160px;">
          <div class="label">Fin segment</div>
          <input class="input" value="${escapeHTML(end || "")}" onchange="_tbSegSet('${id}','end',this.value)" />
        </div>
        <div style="min-width:140px;">
          <div class="label">Devise base</div>
          <input class="input" value="${escapeHTML(baseCurrency || "")}" onchange="_tbSegSet('${id}','baseCurrency',this.value)" />
        </div>
        <div style="min-width:160px;">
          <div class="label">Budget/jour (base)</div>
          <input class="input" value="${escapeHTML(String(dailyBudgetBase ?? ""))}" onchange="_tbSegSet('${id}','dailyBudgetBase',this.value)" />
        </div>
        <div style="min-width:160px;">
          <div class="label">FX mode</div>
          <select class="input" onchange="_tbSegSet('${id}','fxMode',this.value)">
            <option value="fixed" ${fxMode === "fixed" ? "selected" : ""}>fixed</option>
            <option value="live_ecb" ${fxMode === "live_ecb" ? "selected" : ""}>live_ecb</option>
          </select>
        </div>
        <div style="min-width:160px;">
          <div class="label">EUR→BASE (fixed)</div>
          ${(() => {
            const cur = String(baseCurrency||"").toUpperCase();
            const m = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : {};
            const live = (cur === "EUR") ? 1 : (m && m[cur]);
            const v = (fxMode === "fixed") ? eurBaseRateFixed : (live || eurBaseRateFixed || "");
            const dis = (fxMode === "fixed") ? "" : "readonly disabled style=\"opacity:0.7; cursor:not-allowed;\"";
            const onch = (fxMode === "fixed") ? `_tbSegSet('${id}','eurBaseRateFixed',this.value)` : "";
            return `<input class="input" value="${escapeHTML(String(v))}" ${dis} onchange="${onch}" />`;
          })()}
        </div>
        <div style="min-width:100px;">
          <div class="label">Ordre</div>
          <input class="input" value="${escapeHTML(String(sortOrder))}" readonly disabled style="opacity:0.7; cursor:not-allowed;" />
        </div>

        <div style="display:flex; gap:8px; align-items:center; margin-left:auto;">
          <button class="btn" onclick="splitBudgetSegmentPrompt('${id}')">Split</button>
          <button class="btn" onclick="saveBudgetSegment('${id}')">Enregistrer</button>
        </div>
      </div>
    </div>
  `;
}

function renderBudgetSegmentsUI() {
  const host = document.getElementById("seg-list");
  if (!host) return;

  const segs = (state.budgetSegments || []).filter((s) => s && s.periodId === state.period.id);
  if (!segs.length) {
    host.innerHTML = `<div class="muted">Aucun segment (il sera auto-créé au refresh si besoin).</div>`;
    return;
  }

  // In-memory edits buffer
  window.__TB_SEG_EDITS__ = window.__TB_SEG_EDITS__ || {};

  host.innerHTML = segs.map(_segRowHTML).join("");
}

function _tbSegSet(id, key, value) {
  window.__TB_SEG_EDITS__ = window.__TB_SEG_EDITS__ || {};
  window.__TB_SEG_EDITS__[id] = window.__TB_SEG_EDITS__[id] || {};
  window.__TB_SEG_EDITS__[id][key] = value;
}

async function saveBudgetSegment(id) {
  await safeCall("Save segment", async () => {
    const seg = (state.budgetSegments || []).find((s) => String(s.id) === String(id));
    if (!seg) throw new Error("Segment introuvable.");

    const edits = (window.__TB_SEG_EDITS__ && window.__TB_SEG_EDITS__[id]) || {};
    const start = (edits.start ?? seg.start) || "";
    const end = (edits.end ?? seg.end) || "";
    const baseCurrency = (edits.baseCurrency ?? seg.baseCurrency) || "";
    const dailyBudgetBase = Number(edits.dailyBudgetBase ?? seg.dailyBudgetBase);
    const fxMode = (edits.fxMode ?? seg.fxMode ?? "fixed") || "fixed";

    // NOTE: eurBaseRateFixed is read-only in live_ecb (we display the live value).
    let eurBaseRateFixedRaw = edits.eurBaseRateFixed ?? seg.eurBaseRateFixed;
    let eurBaseRateFixed =
      eurBaseRateFixedRaw === "" || eurBaseRateFixedRaw === null || eurBaseRateFixedRaw === undefined
        ? null
        : Number(eurBaseRateFixedRaw);

    const sD = parseISODateOrNull(start);
    const eD = parseISODateOrNull(end);
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
      // live_ecb => we don't store a fixed rate
      eurBaseRateFixed = null;
    }

    const { error } = await sb
      .from("budget_segments")
      .update({
        start_date: start,
        end_date: end,
        base_currency: baseCurrency,
        daily_budget_base: dailyBudgetBase,
        fx_mode: fxMode,
        eur_base_rate_fixed: eurBaseRateFixed,
        // sort_order intentionally not updated (order is fixed)
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;

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
  await safeCall("Split segment", async () => {
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
    if (split > seg.end) throw new Error("Split doit être dans le segment.");
    if (split === seg.end) throw new Error("Split ne peut pas être égal à la fin du segment.");

    const leftEndStr = _isoDayBeforeUTC(split);
    const oldEnd = seg.end;

    const upd = await sb
      .from("budget_segments")
      .update({
        end_date: leftEndStr,
        updated_at: new Date().toISOString(),
      })
      .eq("id", seg.id)
      .select("id,start_date,end_date")
      .single();

    if (upd.error) throw upd.error;
    if (!upd.data || upd.data.end_date !== leftEndStr) {
      throw new Error(`Update segment échoué (end_date=${upd.data?.end_date ?? "null"} au lieu de ${leftEndStr}).`);
    }

    const ins = await sb
      .from("budget_segments")
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
        .from("budget_segments")
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

async function saveSettings() {
  await safeCall("Enregistrer période", async () => {
    const baseCur = document.getElementById("s-basecur")?.value;
    const s = document.getElementById("s-start")?.value;
    const e = document.getElementById("s-end")?.value;
    const d = parseFloat(document.getElementById("s-daily")?.value);
    const r = parseFloat(document.getElementById("s-rate")?.value);

    if (!baseCur) throw new Error("UI settings non à jour.");
    if (!s || !e) throw new Error("Dates invalides.");
    if (parseISODateOrNull(e) < parseISODateOrNull(s)) throw new Error("Fin < début.");
    if (!isFinite(d) || d <= 0) throw new Error("Budget/jour invalide.");

    const { error } = await sb
      .from("periods")
      .update({
        start_date: s,
        end_date: e,
        base_currency: baseCur,
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.period.id);

    if (error) throw error;

    const { error: pErr2 } = await sb
      .from("periods")
      .update({
        eur_base_rate: isFinite(r) ? r : null,
        daily_budget_base: d,
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.period.id);
    if (pErr2) throw pErr2;

    await refreshFromServer();
    renderAll();
  });
}

async function newPeriod() {
  await safeCall("Nouvelle période", async () => {
    const start = prompt("Date début (YYYY-MM-DD)", toLocalISODate(new Date()));
    if (!start) return;
    const end = prompt("Date fin (YYYY-MM-DD)", start);
    if (!end) return;
    const baseCur = prompt("Devise base (ex: THB, EUR)", "EUR") || "EUR";
    const daily = Number(prompt("Budget/jour (devise base)", "25") || 25);

    const sD = parseISODateOrNull(start);
    const eD = parseISODateOrNull(end);
    if (!sD || !eD) throw new Error("Dates invalides.");
    if (eD < sD) throw new Error("Fin < début.");
    if (!isFinite(daily) || daily <= 0) throw new Error("Budget/jour invalide.");

    const { data, error } = await sb
      .from("periods")
      .insert([
        {
          user_id: sbUser.id,
          start_date: start,
          end_date: end,
          base_currency: baseCur,
          daily_budget_base: daily,
          eur_base_rate: baseCur === "EUR" ? 1 : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select("id,start_date,end_date,base_currency")
      .single();

    if (error) throw error;

    await sb.from("budget_segments").insert([
      {
        user_id: sbUser.id,
        period_id: data.id,
        start_date: start,
        end_date: end,
        base_currency: baseCur,
        daily_budget_base: daily,
        fx_mode: "fixed",
        eur_base_rate_fixed: baseCur === "EUR" ? 1 : null,
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    await refreshFromServer();
    renderAll();
  });
}

async function deletePeriod() {
  await safeCall("Supprimer période", async () => {
    if (!state.period.id) throw new Error("Aucune période active.");
    if (!confirm("Supprimer cette période ?")) return;

    await sb.from("budget_segments").delete().eq("period_id", state.period.id);

    const { error } = await sb.from("periods").delete().eq("id", state.period.id);
    if (error) throw error;

    await refreshFromServer();
    renderAll();
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
        <input type="color" value="${escapeHTML(col)}" onchange="setCategoryColor('${escapeHTML(c)}', this.value)" />
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
        .from("categories")
        .update({ color, updated_at: new Date().toISOString() })
        .eq("user_id", sbUser.id)
        .eq("name", existing);
      if (upErr) throw upErr;
    } else {
      const maxSort = (state.categories || []).length;
      const { error: insErr } = await sb
        .from("categories")
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
      .from("categories")
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
      .from("categories")
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