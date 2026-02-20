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

  sel.innerHTML = periods.map((p) => {
    const label = `${p.start_date} → ${p.end_date} (${p.base_currency})`;
    return `<option value="${p.id}">${label}</option>`;
  }).join("");

  sel.value = state.period.id;

  if (!sel._bound) {
    sel._bound = true;
    sel.addEventListener("change", async () => {
      localStorage.setItem(ACTIVE_PERIOD_KEY, sel.value);
      await refreshFromServer();
      showView("dashboard");
    });
  }
}

function renderSettings() {
  const elBase = document.getElementById("s-basecur");
  const elStart = document.getElementById("s-start");
  const elEnd = document.getElementById("s-end");
  const elDaily = document.getElementById("s-daily");
  const elRate = document.getElementById("s-rate");

  if (elBase) elBase.value = state.period.baseCurrency;
  if (elStart) elStart.value = state.period.start;
  if (elEnd) elEnd.value = state.period.end;
  if (elDaily) elDaily.value = state.period.dailyBudgetBase;
  if (elRate) elRate.value = state.exchangeRates["EUR-BASE"];

  loadPeriodsListIntoUI().catch(() => {});
  initPaletteUI();
  syncPaletteUI();
  renderCategories().catch((e) => {
    console.error("[Categories] render failed", e);
    const host = document.getElementById("cat-list");
    if (host) host.innerHTML = `<div class="muted">Erreur affichage catégories : ${escapeHTML(e && e.message ? e.message : e)}</div>`;
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
    if (!isFinite(r) || r <= 0) throw new Error("Taux invalide.");
    if (!state.period.id) throw new Error("Aucune période active.");

    const { error: pErr } = await sb.from("periods").update({
      start_date: s,
      end_date: e,
      base_currency: baseCur,
      eur_base_rate: r,
      daily_budget_base: d,
      updated_at: new Date().toISOString(),
    }).eq("id", state.period.id);
    if (pErr) throw pErr;

    const { error: sErr } = await sb.from("settings").update({
      period_start: s,
      period_end: e,
      theme: localStorage.getItem(THEME_KEY) || "light",
      updated_at: new Date().toISOString(),
    }).eq("user_id", sbUser.id);
    if (sErr) throw sErr;

    alert("Période enregistrée ✅");
    await refreshFromServer();
  });
}

async function createPeriodPrompt() {
  await safeCall("Créer période", async () => {
    const start = prompt("Début (YYYY-MM-DD) :", toLocalISODate(new Date()));
    if (!start) return;

    const end = prompt("Fin (YYYY-MM-DD) :", start);
    if (!end) return;

    if (!parseISODateOrNull(start) || !parseISODateOrNull(end)) throw new Error("Format date invalide.");
    if (parseISODateOrNull(end) < parseISODateOrNull(start)) throw new Error("Fin < début.");

    const defaultBase = state.period.baseCurrency || "THB";
    const base = (prompt("Devise période (THB/EUR/VND/USD/JPY/AUD) :", defaultBase) || defaultBase).toUpperCase();

    const defaultRate = Number(state.exchangeRates["EUR-BASE"]) || 35;
    const rateRaw = prompt(`Taux 1 EUR → ${base} :`, String(defaultRate));
    if (rateRaw === null) return;
    const rate = Number(String(rateRaw).replace(",", "."));
    if (!isFinite(rate) || rate <= 0) throw new Error("Taux invalide.");

    const defaultDaily = Number(state.period.dailyBudgetBase) || 1000;
    const dailyRaw = prompt(`Budget/jour en ${base} :`, String(defaultDaily));
    if (dailyRaw === null) return;
    const daily = Number(String(dailyRaw).replace(",", "."));
    if (!isFinite(daily) || daily <= 0) throw new Error("Budget/jour invalide.");

    const { data, error } = await sb
      .from("periods")
      .insert([{
        user_id: sbUser.id,
        start_date: start,
        end_date: end,
        base_currency: base,
        eur_base_rate: rate,
        daily_budget_base: daily
      }])
      .select("id")
      .single();

    if (error) throw error;

    localStorage.setItem(ACTIVE_PERIOD_KEY, data.id);
    await refreshFromServer();
    showView("dashboard");
  });
}

async function deleteActivePeriod() {
  await safeCall("Supprimer période", async () => {
    if (!state.period.id) throw new Error("Aucune période active.");

    const ok = confirm(`Supprimer la période ${state.period.start} → ${state.period.end} ?`);
    if (!ok) return;

    const { error } = await sb.from("periods").delete().eq("id", state.period.id);
    if (error) throw error;

    localStorage.removeItem(ACTIVE_PERIOD_KEY);
    await refreshFromServer();
    showView("dashboard");
  });
}



/* =========================
   Settings: categories UI
   ========================= */
async function renderCategories() {
  const host = document.getElementById("cat-list");
  if (!host) return;

  const { data, error } = await sb
    .from("categories")
    .select("id,name,color,sort_order,created_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    host.innerHTML = `<div class="muted">Erreur chargement catégories : ${escapeHTML(error.message)}</div>`;
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    host.innerHTML = `<div class="muted">Aucune catégorie (tu peux en ajouter ci-dessus).</div>`;
    return;
  }

  host.innerHTML = rows.map((c) => {
    const swatch = c.color ? `<span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${escapeHTML(c.color)};border:1px solid rgba(255,255,255,.2);margin-right:8px;vertical-align:middle;"></span>` : "";
    return `
      <div class="row" style="justify-content:space-between;gap:10px;align-items:center;margin:6px 0;">
        <div style="display:flex;align-items:center;gap:8px;min-width:220px;">
          ${swatch}
          <strong>${escapeHTML(c.name)}</strong>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="color" value="${escapeHTML(c.color || "#94a3b8")}" onchange="updateCategoryColor('${c.id}', this.value)" />
          <button class="btn" onclick="renameCategoryPrompt('${c.id}', '${escapeHTML(c.name)}')">Renommer</button>
          <button class="btn danger" onclick="deleteCategoryPrompt('${c.id}', '${escapeHTML(c.name)}')">Supprimer</button>
        </div>
      </div>
    `;
  }).join("");

  // keep state in sync (so other views instantly see it)
  state.categories = rows.map(r => r.name);
  state.categoryColors = Object.fromEntries(rows.filter(r => r.color).map(r => [r.name, r.color]));
}

async function addCategory() {
  await safeCall("Ajouter catégorie", async () => {
    const nameRaw = document.getElementById("cat-name")?.value || "";
    const name = nameRaw.trim();
    const color = document.getElementById("cat-color")?.value || null;
    if (!name) throw new Error("Nom de catégorie requis.");
    if (name.length > 40) throw new Error("Nom trop long (max ~40).");

    // insert with next sort_order
    const { data: maxRows, error: maxErr } = await sb
      .from("categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    if (maxErr) throw maxErr;
    const next = (maxRows?.[0]?.sort_order ?? -1) + 1;

    const { error } = await sb.from("categories").insert([{ name, color, sort_order: next }]);
    if (error) throw error;

    document.getElementById("cat-name").value = "";
    emitDataUpdated("categories:add");
    await refreshFromServer();
    showView("settings");
  });
}

async function renameCategoryPrompt(id, currentName) {
  const next = prompt("Nouveau nom :", currentName || "");
  if (next === null) return;
  const name = String(next).trim();
  if (!name) return alert("Nom invalide.");
  await safeCall("Renommer catégorie", async () => {
    const { error } = await sb.from("categories").update({ name }).eq("id", id);
    if (error) throw error;
    emitDataUpdated("categories:rename");
    await refreshFromServer();
    showView("settings");
  });
}

async function updateCategoryColor(id, color) {
  await safeCall("Couleur catégorie", async () => {
    const c = String(color || "").trim();
    if (!/^#([0-9a-fA-F]{6})$/.test(c)) throw new Error("Couleur invalide.");
    const { error } = await sb.from("categories").update({ color: c }).eq("id", id);
    if (error) throw error;
    emitDataUpdated("categories:color");
    await refreshFromServer();
    showView("settings");
  });
}

async function deleteCategoryPrompt(id, name) {
  const ok = confirm(`Supprimer la catégorie "${name}" ?\n\nNote: les transactions existantes garderont le texte "${name}".`);
  if (!ok) return;
  await safeCall("Supprimer catégorie", async () => {
    const { error } = await sb.from("categories").delete().eq("id", id);
    if (error) throw error;
    emitDataUpdated("categories:delete");
    await refreshFromServer();
    showView("settings");
  });
}

