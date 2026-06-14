/* =========================
   Work module
   - Physical work days, separate from sport
   ========================= */
(function () {
  const CACHE = { loaded: false, loading: false, rows: [], error: "", editId: "" };

  function txt(fr, en) {
    try { return String(window.TB_LANG || "fr").toLowerCase() === "en" ? en : fr; } catch (_) { return fr; }
  }
  function esc(s) {
    if (typeof window.escapeHTML === "function") return window.escapeHTML(s);
    return String(s || "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }
  function todayISO() {
    try { if (typeof window.toLocalISODate === "function") return window.toLocalISODate(new Date()); } catch (_) {}
    return new Date().toISOString().slice(0, 10);
  }
  function table(name) { return window.TB_CONST?.TABLES?.[name] || name; }
  function client() { return window.sb || null; }
  function uid() { return window.sbUser?.id || null; }
  function activeTravelId() { return window.state?.activeTravelId || null; }
  function isOfflineSkipError(err) {
    return /offline mode|supabase request skipped|failed to fetch|network/i.test(String(err?.message || err || ""));
  }
  function bodyWeight() {
    try { return Number(localStorage.getItem(window.TB_CONST?.LS_KEYS?.sport_body_weight || "travelbudget_sport_body_weight_v1")) || 70; } catch (_) { return 70; }
  }
  function bodyHeight() {
    try { return Number(localStorage.getItem(window.TB_CONST?.LS_KEYS?.sport_body_height || "travelbudget_sport_body_height_v1")) || 175; } catch (_) { return 175; }
  }
  function bodyBirthDate() {
    try { return localStorage.getItem(window.TB_CONST?.LS_KEYS?.body_birthdate || "travelbudget_body_birthdate_v1") || ""; } catch (_) { return ""; }
  }
  function ageFromBirthDate(v) {
    if (window.Core?.bodyEnergyRules?.ageFromBirthDate) return window.Core.bodyEnergyRules.ageFromBirthDate(v);
    const raw = String(v || "").trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return 0;
    const now = new Date();
    let age = now.getFullYear() - Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const currentMonth = now.getMonth() + 1;
    if (currentMonth < month || (currentMonth === month && now.getDate() < day)) age -= 1;
    return age > 0 && age < 130 ? age : 0;
  }
  function bodyAge() {
    const fromBirthDate = ageFromBirthDate(bodyBirthDate());
    if (fromBirthDate) return fromBirthDate;
    try { return Number(localStorage.getItem(window.TB_CONST?.LS_KEYS?.body_age || "travelbudget_body_age_v1")) || 30; } catch (_) { return 30; }
  }
  function bodySex() {
    try { return localStorage.getItem(window.TB_CONST?.LS_KEYS?.body_sex || "travelbudget_body_sex_v1") || "male"; } catch (_) { return "male"; }
  }
  function bodyBmr() {
    try { return Number(localStorage.getItem(window.TB_CONST?.LS_KEYS?.body_bmr || "travelbudget_body_bmr_v1")) || 0; } catch (_) { return 0; }
  }
  function presets() {
    return window.Core?.workRules?.WORK_ACTIVITY_PRESETS || [
      { key: "fruit_picking_vigorous", labelFr: "Fruit picking physique", labelEn: "Fruit picking vigorous", met: 4.5 },
      { key: "farm_harvest_moderate", labelFr: "Travail agricole modere", labelEn: "Farm harvest moderate", met: 4.8 },
    ];
  }
  function labelPreset(row) {
    return txt(row.labelFr || row.label || row.key, row.labelEn || row.label || row.key);
  }
  function calcKcal(hours, breaks, met) {
    if (window.Core?.workRules?.estimateWorkDayKcal) {
      return window.Core.workRules.estimateWorkDayKcal({ hours, breakMinutes: breaks, met, kg: bodyWeight() });
    }
    const netHours = Math.max(0, Number(hours || 0) - (Number(breaks || 0) / 60));
    return Math.max(0, (Number(met || 4.8) - 1) * bodyWeight() * netHours);
  }
  function baseline() {
    if (window.Core?.bodyEnergyRules?.resolveDailyBaselineKcal) {
      return window.Core.bodyEnergyRules.resolveDailyBaselineKcal({
        customBmr: bodyBmr(),
        kg: bodyWeight(),
        heightCm: bodyHeight(),
        birthDate: bodyBirthDate(),
        age: bodyAge(),
        sex: bodySex(),
      });
    }
    return { bmr: 0, bmi: 0, maintenanceKcal: 0, source: "estimated" };
  }
  function ensureWorkShell() {
    const tabs = document.querySelector(".tabs") || document.querySelector(".app-tabs");
    if (tabs && !document.getElementById("tab-work")) {
      const tab = document.createElement("div");
      tab.id = "tab-work";
      tab.className = "tab";
      tab.textContent = txt("Travail", "Work");
      tab.onclick = () => window.showView ? window.showView("work") : renderWork("tab");
      const ref = document.getElementById("tab-sport") || tabs.lastElementChild;
      if (ref?.parentNode === tabs) tabs.insertBefore(tab, ref.nextSibling);
      else tabs.appendChild(tab);
    }
    const wrap = document.querySelector(".wrap") || document.body;
    if (!document.getElementById("view-work")) {
      const view = document.createElement("div");
      view.id = "view-work";
      view.className = "hidden";
      view.innerHTML = '<div id="work-root" class="card"></div>';
      const ref = document.getElementById("view-sport") || wrap.lastElementChild;
      if (ref?.parentNode === wrap) wrap.insertBefore(view, ref.nextSibling);
      else wrap.appendChild(view);
    }
  }
  function publishWorkDays(reason) {
    if (!window.state) window.state = {};
    window.state.workDays = CACHE.rows.slice();
    try { if (typeof window.tbSaveOfflineSnapshot === "function") window.tbSaveOfflineSnapshot(`work:${reason || "load"}`); } catch (_) {}
    try { if (typeof window.renderKPI === "function") window.renderKPI(); } catch (_) {}
  }
  async function loadWorkDays(options = {}) {
    const force = !!options.force;
    if (CACHE.loading || (CACHE.loaded && !force)) return false;
    CACHE.loading = true;
    CACHE.error = "";
    const c = client();
    let changed = false;
    try {
      if (c && uid()) {
        const q = c.from(table("work_days"))
          .select("id,user_id,travel_id,work_date,activity_key,label,duration_minutes,break_minutes,met_value,body_weight_kg,estimated_kcal,perceived_effort,notes,created_at,updated_at")
          .eq("user_id", uid())
          .order("work_date", { ascending: false })
          .limit(120);
        const { data, error } = await q;
        if (error) throw error;
        CACHE.rows = data || [];
      } else {
        CACHE.rows = CACHE.rows || [];
      }
      CACHE.loaded = true;
      changed = true;
    } catch (e) {
      CACHE.error = e?.message || String(e);
      CACHE.loaded = true;
      if (!isOfflineSkipError(e)) console.warn("[work] load failed", CACHE.error);
    } finally {
      CACHE.loading = false;
      publishWorkDays("load");
    }
    return changed;
  }
  function renderWork(reason) {
    ensureWorkShell();
    const root = document.getElementById("work-root");
    if (!root) return;
    if (!CACHE.loaded && !CACHE.loading) {
      loadWorkDays().then((changed) => {
        if (changed && (window.activeView || "") === "work") renderWork("loaded");
      }).catch(() => {});
    }
    const p = presets();
    const b = baseline();
    const recent = CACHE.rows.slice(0, 12);
    const editing = CACHE.editId ? CACHE.rows.find(row => String(row.id || "") === String(CACHE.editId)) : null;
    const initialPresetKey = editing?.activity_key || p[0]?.key || "farm_harvest_moderate";
    const initialHours = editing ? (Number(editing.duration_minutes || 0) / 60) : 8;
    const initialBreaks = editing ? Number(editing.break_minutes || 0) : 0;
    const initialMet = editing ? Number(editing.met_value || 4.8) : 4.8;
    const initialRpe = editing ? Number(editing.perceived_effort || 7) : 7;
    const initialDate = String(editing?.work_date || todayISO()).slice(0, 10);
    const initialLabel = editing ? String(editing.label || "") : "Avocado picking";
    const today = todayISO();
    root.innerHTML = `
      <section class="tb-work-shell">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <h2 style="margin:0;">${esc(txt("Travail physique", "Physical work"))}</h2>
            <div class="muted" style="margin-top:4px;">${esc(txt("Journées de travail séparées du sport, avec estimation MET.", "Work days kept separate from sport, estimated with MET."))}</div>
          </div>
          <div class="pill">${Math.round(b.bmr || 0)} kcal BMR · IMC ${Math.round((b.bmi || 0) * 10) / 10}</div>
        </div>
        <div class="tb-work-grid" style="display:grid;grid-template-columns:minmax(280px,380px) 1fr;gap:14px;margin-top:14px;">
          <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);">
            <div class="field"><label>${esc(txt("Date", "Date"))}</label><input id="work-date" type="date" value="${esc(initialDate)}"></div>
            <div class="field"><label>${esc(txt("Type", "Type"))}</label><select id="work-type">${p.map(x => `<option value="${esc(x.key)}" data-met="${esc(String(x.met))}" ${String(x.key) === String(initialPresetKey) ? "selected" : ""}>${esc(labelPreset(x))} - MET ${esc(String(x.met))}</option>`).join("")}</select></div>
            <div class="row" style="gap:10px;">
              <div class="field" style="flex:1;"><label>${esc(txt("Duree h", "Hours"))}</label><input id="work-hours" type="number" min="0" step="0.25" value="${esc(String(Math.round(initialHours * 100) / 100))}"></div>
              <div class="field" style="flex:1;"><label>${esc(txt("Pause min", "Break min"))}</label><input id="work-breaks" type="number" min="0" step="5" value="${esc(String(initialBreaks))}"></div>
            </div>
            <div class="row" style="gap:10px;">
              <div class="field" style="flex:1;"><label>MET</label><input id="work-met" type="number" min="1" step="0.1" value="${esc(String(initialMet))}"></div>
              <div class="field" style="flex:1;"><label>RPE</label><input id="work-rpe" type="number" min="1" max="10" step="1" value="${esc(String(initialRpe))}"></div>
            </div>
            <div class="field"><label>${esc(txt("BMR connu", "Known BMR"))}</label><input id="work-bmr" type="number" min="0" step="1" value="${esc(String(bodyBmr() || ""))}" placeholder="${esc(txt("Optionnel", "Optional"))}"></div>
            <div class="muted" style="font-size:12px;line-height:1.45;margin:-2px 0 8px;">
              <div><b>MET</b> : ${esc(txt("intensite metabolique de l'activite. Plus il est haut, plus les kcal montent.", "activity intensity. Higher means more kcal."))}</div>
              <div><b>RPE</b> : ${esc(txt("effort ressenti de 1 a 10, utile pour relire la journee.", "perceived effort from 1 to 10, useful for review."))}</div>
              <div><b>BMR</b> : ${esc(txt("metabolisme basal connu. Optionnel, il remplace l'estimation par poids/taille/age.", "known basal metabolic rate. Optional; replaces the weight/height/age estimate."))}</div>
            </div>
            <div class="field"><label>${esc(txt("Notes", "Notes"))}</label><input id="work-notes" value="${esc(initialLabel)}"></div>
            <div class="pill" id="work-kcal-preview" style="margin-top:8px;">0 kcal</div>
            <div style="display:flex;gap:8px;margin-top:10px;">
              <button class="btn primary" id="work-save" type="button" style="flex:1;">${esc(editing ? txt("Mettre a jour", "Update") : txt("Ajouter la journee", "Add work day"))}</button>
              ${editing ? `<button class="btn" id="work-cancel-edit" type="button">${esc(txt("Annuler", "Cancel"))}</button>` : ""}
            </div>
          </div>
          <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);">
            <h3 style="margin:0 0 10px;">${esc(txt("Historique travail", "Work history"))}</h3>
            ${CACHE.loading ? `<div class="muted">${esc(txt("Chargement...", "Loading..."))}</div>` : ""}
            ${CACHE.error ? `<div class="muted">${esc(CACHE.error)}</div>` : ""}
            ${recent.length ? recent.map(row => `
              <div style="display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--border);padding:9px 0;align-items:flex-start;">
                <div><strong>${esc(row.label || "Travail")}</strong><div class="muted">${esc(String(row.work_date || "").slice(0,10))} · ${Math.round(Number(row.duration_minutes || 0) / 60 * 10) / 10}h · MET ${Number(row.met_value || 0)}</div></div>
                <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
                  <strong>${Math.round(Number(row.estimated_kcal || 0))} kcal</strong>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
                    <button class="btn small" type="button" data-work-edit="${esc(String(row.id || ""))}">${esc(txt("Modifier", "Edit"))}</button>
                    <button class="btn small" type="button" data-work-delete="${esc(String(row.id || ""))}">${esc(txt("Supprimer", "Delete"))}</button>
                  </div>
                </div>
              </div>`).join("") : `<div class="muted">${esc(txt("Aucune journée enregistrée.", "No work day saved."))}</div>`}
          </div>
        </div>
      </section>`;
    bindWork(root);
    updatePreview(root);
  }
  function bindWork(root) {
    const type = root.querySelector("#work-type");
    const met = root.querySelector("#work-met");
    if (type && met) type.onchange = () => { met.value = type.selectedOptions?.[0]?.dataset?.met || "4.8"; updatePreview(root); };
    ["#work-hours", "#work-breaks", "#work-met", "#work-bmr"].forEach(sel => {
      const el = root.querySelector(sel);
      if (el) el.oninput = () => updatePreview(root);
    });
    const save = root.querySelector("#work-save");
    if (save) save.onclick = () => saveWorkDay(root);
    const cancel = root.querySelector("#work-cancel-edit");
    if (cancel) cancel.onclick = () => { CACHE.editId = ""; renderWork("cancel-edit"); };
    root.querySelectorAll("[data-work-edit]").forEach((btn) => {
      btn.onclick = () => {
        CACHE.editId = String(btn.getAttribute("data-work-edit") || "");
        renderWork("edit");
      };
    });
    root.querySelectorAll("[data-work-delete]").forEach((btn) => {
      btn.onclick = () => deleteWorkDay(String(btn.getAttribute("data-work-delete") || ""));
    });
  }
  function updatePreview(root) {
    const kcal = calcKcal(Number(root.querySelector("#work-hours")?.value || 0), Number(root.querySelector("#work-breaks")?.value || 0), Number(root.querySelector("#work-met")?.value || 4.8));
    const out = root.querySelector("#work-kcal-preview");
    if (out) out.textContent = `${Math.round(kcal)} kcal`;
  }
  async function saveWorkDay(root) {
    const type = root.querySelector("#work-type");
    const preset = presets().find(x => x.key === type?.value) || presets()[0];
    const hours = Number(root.querySelector("#work-hours")?.value || 0);
    const breakMinutes = Number(root.querySelector("#work-breaks")?.value || 0);
    const met = Number(root.querySelector("#work-met")?.value || preset?.met || 4.8);
    const bmrValue = Number(root.querySelector("#work-bmr")?.value || 0);
    try {
      if (bmrValue > 0) localStorage.setItem(window.TB_CONST?.LS_KEYS?.body_bmr || "travelbudget_body_bmr_v1", String(Math.round(bmrValue)));
    } catch (_) {}
    const row = {
      user_id: uid(),
      travel_id: activeTravelId(),
      work_date: String(root.querySelector("#work-date")?.value || todayISO()).slice(0, 10),
      activity_key: preset?.key || "farm_harvest_moderate",
      label: String(root.querySelector("#work-notes")?.value || labelPreset(preset) || "Travail").trim() || "Travail",
      duration_minutes: Math.max(0, Math.round(hours * 60)),
      break_minutes: Math.max(0, Math.round(breakMinutes)),
      met_value: met,
      body_weight_kg: bodyWeight(),
      estimated_kcal: Math.round(calcKcal(hours, breakMinutes, met) * 100) / 100,
      perceived_effort: Number(root.querySelector("#work-rpe")?.value || 0) || null,
      notes: "",
    };
    const c = client();
    const editId = String(CACHE.editId || "");
    try {
      if (c && uid()) {
        const query = editId
          ? c.from(table("work_days")).update(row).eq("id", editId).eq("user_id", uid())
          : c.from(table("work_days")).insert(row);
        const { error } = await query;
        if (error) throw error;
      } else if (editId) {
        CACHE.rows = CACHE.rows.map(existing => String(existing.id || "") === editId ? { ...existing, ...row, id: existing.id } : existing);
      } else {
        row.id = `local_work_${Date.now()}`;
        CACHE.rows.unshift(row);
      }
      CACHE.editId = "";
      await loadWorkDays({ force: true });
      if (typeof window.tbRequestRenderAll === "function") window.tbRequestRenderAll("work:save");
      renderWork("save");
    } catch (e) {
      CACHE.error = e?.message || String(e);
      renderWork("save-error");
    }
  }

  async function deleteWorkDay(id) {
    const workId = String(id || "");
    if (!workId) return;
    const ok = confirm(txt("Supprimer cette journee de travail ?", "Delete this work day?"));
    if (!ok) return;
    const c = client();
    try {
      if (c && uid() && !workId.startsWith("local_work_")) {
        const { error } = await c.from(table("work_days")).delete().eq("id", workId).eq("user_id", uid());
        if (error) throw error;
      }
      CACHE.rows = CACHE.rows.filter(row => String(row.id || "") !== workId);
      if (String(CACHE.editId || "") === workId) CACHE.editId = "";
      publishWorkDays("delete");
      await loadWorkDays({ force: true });
      if (typeof window.tbRequestRenderAll === "function") window.tbRequestRenderAll("work:delete");
      renderWork("delete");
    } catch (e) {
      CACHE.error = e?.message || String(e);
      renderWork("delete-error");
    }
  }

  window.renderWork = renderWork;
  window.tbLoadWorkDays = loadWorkDays;
  window.tbReloadWorkDays = async function tbReloadWorkDays() {
    await loadWorkDays({ force: true });
    return CACHE.rows.slice();
  };
  window.addEventListener("tb:auth_scope_changed", () => { CACHE.loaded = false; CACHE.rows = []; });
  try { document.addEventListener("tb:refresh:data_loaded", () => { try { window.tbReloadWorkDays(); } catch (_) {} }); } catch (_) {}
  setTimeout(() => { try { if (uid()) loadWorkDays().catch(() => {}); } catch (_) {} }, 300);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureWorkShell);
  else ensureWorkShell();
})();
