/* =========================
   Notifications module
   - User templates, slash variables, upcoming previews, delivery history
   ========================= */
(function () {
  const CACHE = { loaded: false, loading: false, templates: [], deliveries: [], selectedId: "", error: "", focusField: "body" };
  const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const VARIABLES = [
    { key: "/budgetdujour", label: "Budget du jour" },
    { key: "/budgetrestant", label: "Budget restant" },
    { key: "/depensesjour", label: "Depenses du jour" },
    { key: "/date", label: "Date" },
    { key: "/solde", label: "Solde" },
    { key: "/kcalobjectif", label: "Objectif kcal" },
    { key: "/kcalconsommees", label: "Kcal consommees" },
    { key: "/sportkcal", label: "Sport kcal" },
    { key: "/travailkcal", label: "Travail kcal" },
    { key: "/eau", label: "Eau bue" },
    { key: "/proteines", label: "Proteines" },
    { key: "/sommeil", label: "Sommeil" },
    { key: "/scoreSante", label: "Score sante" },
  ];
  const DEFAULT_TEMPLATES = [
    {
      name: "Budget du matin",
      slot: "morning",
      channel: "mobile",
      enabled: true,
      send_time: "08:30",
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      emoji: "🌅",
      title_template: "Budget du jour",
      body_template: "Il te reste /budgetrestant sur /budgetdujour. Deja utilise : /depensesjour.",
    },
    {
      name: "Bilan du soir",
      slot: "evening",
      channel: "mobile",
      enabled: true,
      send_time: "20:30",
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      emoji: "🌙",
      title_template: "Bilan du soir",
      body_template: "Budget restant : /budgetrestant. Sport : /sportkcal, travail : /travailkcal.",
    },
  ];

  function txt(fr, en) { try { return String(window.TB_LANG || "fr").toLowerCase() === "en" ? en : fr; } catch (_) { return fr; } }
  function esc(s) {
    if (typeof window.escapeHTML === "function") return window.escapeHTML(s);
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }
  function table(name) { return window.TB_CONST?.TABLES?.[name] || name; }
  function lsKey() { return window.TB_CONST?.LS_KEYS?.notification_templates || "travelbudget_notification_templates_v1"; }
  function client() { return window.sb || window.__TB_SB__ || null; }
  function uid() { return window.sbUser?.id || window.state?.profile?.id || window.state?.user?.id || ""; }
  function todayISO() { try { return window.toLocalISODate(new Date()); } catch (_) { return new Date().toISOString().slice(0, 10); } }
  function money(value, currency) {
    const n = Number(value) || 0;
    const rounded = Math.round(n * 100) / 100;
    try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: String(currency || "EUR").toUpperCase(), maximumFractionDigits: Math.abs(rounded) >= 10 ? 0 : 2 }).format(rounded); }
    catch (_) { return `${rounded} ${String(currency || "EUR").toUpperCase()}`; }
  }
  function n(v, fallback) { const x = Number(v); return Number.isFinite(x) ? x : (fallback || 0); }
  function localRead() {
    try {
      const rows = JSON.parse(localStorage.getItem(lsKey()) || "[]");
      return Array.isArray(rows) && rows.length ? rows : DEFAULT_TEMPLATES.map((row, i) => ({ ...row, id: `local_tpl_${i + 1}` }));
    } catch (_) {
      return DEFAULT_TEMPLATES.map((row, i) => ({ ...row, id: `local_tpl_${i + 1}` }));
    }
  }
  function localWrite(rows) {
    try { localStorage.setItem(lsKey(), JSON.stringify(rows || [])); } catch (_) {}
  }
  function normalizeTemplate(row) {
    const time = String(row?.send_time || row?.sendTime || "08:30").slice(0, 5);
    const days = Array.isArray(row?.days_of_week) ? row.days_of_week.map(Number).filter(d => d >= 0 && d <= 6) : [0, 1, 2, 3, 4, 5, 6];
    return {
      id: String(row?.id || `local_tpl_${Date.now()}`),
      user_id: row?.user_id || uid() || null,
      name: String(row?.name || "Notification").trim(),
      slot: String(row?.slot || "custom"),
      channel: String(row?.channel || "mobile"),
      enabled: row?.enabled !== false,
      send_time: /^\d{2}:\d{2}$/.test(time) ? time : "08:30",
      days_of_week: days.length ? Array.from(new Set(days)) : [0, 1, 2, 3, 4, 5, 6],
      emoji: String(row?.emoji || "").trim().slice(0, 12),
      title_template: String(row?.title_template || row?.titleTemplate || "Notification").trim(),
      body_template: String(row?.body_template || row?.bodyTemplate || "").trim(),
      variables: Array.isArray(row?.variables) ? row.variables : [],
      created_at: row?.created_at || new Date().toISOString(),
      updated_at: row?.updated_at || new Date().toISOString(),
    };
  }
  function activePeriodFor(day) {
    const periods = Array.isArray(window.state?.periods) ? window.state.periods : [];
    return periods.find(p => String(p.startDate || p.start_date || "").slice(0, 10) <= day && String(p.endDate || p.end_date || "").slice(0, 10) >= day)
      || periods[0] || {};
  }
  function dailyBudget(day) {
    const p = activePeriodFor(day);
    const segs = Array.isArray(window.state?.budgetSegments) ? window.state.budgetSegments : [];
    const seg = segs.find(s => String(s.periodId || s.period_id || "") === String(p.id || "") && String(s.startDate || s.start_date || "").slice(0, 10) <= day && String(s.endDate || s.end_date || "").slice(0, 10) >= day);
    return {
      value: n(seg?.dailyBudgetBase ?? seg?.daily_budget_base ?? p.dailyBudgetBase ?? p.daily_budget_base, 0),
      currency: String(seg?.baseCurrency || seg?.base_currency || p.baseCurrency || p.base_currency || window.state?.user?.baseCurrency || "EUR").toUpperCase(),
    };
  }
  function spentToday(day, currency) {
    const txs = Array.isArray(window.state?.transactions) ? window.state.transactions : [];
    return txs.filter(tx => String(tx.type || "").toLowerCase() === "expense")
      .filter(tx => tx.affectsBudget !== false && tx.affects_budget !== false && tx.outOfBudget !== true && tx.out_of_budget !== true)
      .filter(tx => {
        const start = String(tx.budgetDateStart || tx.budget_date_start || tx.date || tx.created_at || "").slice(0, 10);
        const end = String(tx.budgetDateEnd || tx.budget_date_end || start).slice(0, 10);
        return (!start || start <= day) && (!end || end >= day);
      })
      .reduce((sum, tx) => {
        const amount = n(tx.amount, 0);
        const cur = String(tx.currency || currency || "EUR").toUpperCase();
        if (cur === currency) return sum + amount;
        try {
          if (typeof window.safeFxConvert === "function") {
            const converted = window.safeFxConvert(amount, cur, currency, null);
            if (Number.isFinite(converted)) return sum + converted;
          }
          if (typeof window.fxConvert === "function") {
            const converted = window.fxConvert(amount, cur, currency);
            if (Number.isFinite(converted)) return sum + converted;
          }
        } catch (_) {}
        return sum + amount;
      }, 0);
  }
  function dayNutrition(day) {
    try {
      if (typeof window.tbHealthTodaySummary === "function") return window.tbHealthTodaySummary(day) || {};
    } catch (_) {}
    return window.state?.nutritionSummary || {};
  }
  function resolveValues(day) {
    const budget = dailyBudget(day);
    const spent = spentToday(day, budget.currency);
    const remaining = budget.value - spent;
    const health = dayNutrition(day);
    const sportKcal = n(health.sportKcal ?? window.state?.health?.sportKcal, 0);
    const workKcal = n(health.workKcal ?? window.state?.health?.workKcal, 0);
    const kcalNeed = n(health.needsKcal ?? health.kcalNeed ?? window.state?.health?.needsKcal, 0);
    const kcalIn = n(health.consumedKcal ?? health.kcalConsumed ?? window.state?.health?.consumedKcal, 0);
    const protein = n(health.protein ?? health.proteinG ?? window.state?.health?.protein, 0);
    const water = n(health.drinkWaterMl ?? health.waterMl ?? window.state?.health?.drinkWaterMl, 0);
    const sleep = n(health.sleepHours ?? window.state?.health?.sleepHours, 0);
    const score = n(health.score ?? window.state?.health?.score, 0);
    const walletBalance = Array.isArray(window.state?.wallets)
      ? window.state.wallets.reduce((sum, w) => sum + n(w.balanceBase ?? w.balance_base ?? w.balance, 0), 0)
      : 0;
    return {
      "/budgetdujour": money(budget.value, budget.currency),
      "/budgetrestant": money(remaining, budget.currency),
      "/depensesjour": money(spent, budget.currency),
      "/date": day,
      "/solde": money(walletBalance, budget.currency),
      "/kcalobjectif": kcalNeed ? `${Math.round(kcalNeed)} kcal` : "objectif a calculer",
      "/kcalconsommees": `${Math.round(kcalIn)} kcal`,
      "/sportkcal": `${Math.round(sportKcal)} kcal`,
      "/travailkcal": `${Math.round(workKcal)} kcal`,
      "/eau": `${Math.round(water)} ml`,
      "/proteines": `${Math.round(protein)} g`,
      "/sommeil": sleep ? `${Math.round(sleep * 10) / 10}h` : "non saisi",
      "/scoreSante": score ? `${Math.round(score)}/100` : "a calculer",
    };
  }
  function renderText(template, values) {
    let out = String(template || "");
    Object.entries(values || {}).forEach(([key, value]) => {
      out = out.split(key).join(String(value));
    });
    return out;
  }
  function preview(tpl, day) {
    const values = resolveValues(day || todayISO());
    const emoji = String(tpl.emoji || "").trim();
    const title = `${emoji ? `${emoji} ` : ""}${renderText(tpl.title_template, values)}`.trim();
    return { title, body: renderText(tpl.body_template, values), values };
  }
  function nextOccurrence(tpl, fromDate) {
    const start = fromDate ? new Date(fromDate) : new Date();
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dow = d.getDay();
      if (!tpl.days_of_week.includes(dow)) continue;
      const [hh, mm] = String(tpl.send_time || "08:30").split(":").map(Number);
      d.setHours(hh || 8, mm || 0, 0, 0);
      if (d.getTime() > start.getTime() || i > 0) return d;
    }
    return start;
  }
  function formatDateTime(d) {
    try { return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d); }
    catch (_) { return d.toISOString().slice(0, 16).replace("T", " "); }
  }
  function selectedTemplate() {
    return CACHE.templates.find(t => String(t.id) === String(CACHE.selectedId)) || CACHE.templates[0] || normalizeTemplate(DEFAULT_TEMPLATES[0]);
  }
  async function loadNotifications(opts) {
    if (CACHE.loading) return;
    if (CACHE.loaded && !opts?.force) return;
    CACHE.loading = true;
    CACHE.error = "";
    try {
      const c = client();
      const userId = uid();
      if (c && userId) {
        const [{ data: templates, error: tplError }, { data: deliveries, error: delError }] = await Promise.all([
          c.from(table("notification_templates")).select("*").eq("user_id", userId).order("send_time", { ascending: true }),
          c.from(table("mobile_notification_deliveries")).select("id,template_id,notification_key,slot,sent_for_date,status,sent_at,title,body,payload").eq("user_id", userId).order("sent_at", { ascending: false }).limit(40),
        ]);
        if (tplError) throw tplError;
        if (delError) throw delError;
        CACHE.templates = (templates || []).map(normalizeTemplate);
        CACHE.deliveries = deliveries || [];
        if (!CACHE.templates.length) {
          CACHE.templates = localRead().map(normalizeTemplate);
        }
      } else {
        CACHE.templates = localRead().map(normalizeTemplate);
        CACHE.deliveries = [];
      }
      if (!CACHE.selectedId || !CACHE.templates.some(t => String(t.id) === String(CACHE.selectedId))) CACHE.selectedId = CACHE.templates[0]?.id || "";
      CACHE.loaded = true;
    } catch (e) {
      CACHE.error = e?.message || String(e);
      CACHE.templates = localRead().map(normalizeTemplate);
      CACHE.deliveries = [];
      CACHE.loaded = true;
    } finally {
      CACHE.loading = false;
    }
  }
  async function saveTemplate(tpl) {
    const clean = normalizeTemplate(tpl);
    clean.variables = VARIABLES.filter(v => `${clean.title_template} ${clean.body_template}`.includes(v.key)).map(v => v.key);
    const c = client();
    const userId = uid();
    if (c && userId && !String(clean.id).startsWith("local_")) {
      const { error } = await c.from(table("notification_templates")).update({
        name: clean.name,
        slot: clean.slot,
        channel: clean.channel,
        enabled: clean.enabled,
        send_time: clean.send_time,
        days_of_week: clean.days_of_week,
        emoji: clean.emoji || null,
        title_template: clean.title_template,
        body_template: clean.body_template,
        variables: clean.variables,
        last_preview: preview(clean, todayISO()),
        updated_at: new Date().toISOString(),
      }).eq("id", clean.id).eq("user_id", userId);
      if (error) throw error;
    } else if (c && userId) {
      const { data, error } = await c.from(table("notification_templates")).insert({
        user_id: userId,
        name: clean.name,
        slot: clean.slot,
        channel: clean.channel,
        enabled: clean.enabled,
        send_time: clean.send_time,
        days_of_week: clean.days_of_week,
        emoji: clean.emoji || null,
        title_template: clean.title_template,
        body_template: clean.body_template,
        variables: clean.variables,
        last_preview: preview(clean, todayISO()),
      }).select("*").single();
      if (error) throw error;
      clean.id = data?.id || clean.id;
    } else {
      const rows = CACHE.templates.filter(t => String(t.id) !== String(clean.id));
      rows.push(clean);
      localWrite(rows);
    }
    await loadNotifications({ force: true });
    CACHE.selectedId = clean.id;
  }
  async function deleteTemplate(id) {
    const key = String(id || "");
    if (!key) return;
    const c = client();
    const userId = uid();
    if (c && userId && !key.startsWith("local_")) {
      const { error } = await c.from(table("notification_templates")).delete().eq("id", key).eq("user_id", userId);
      if (error) throw error;
    } else {
      localWrite(CACHE.templates.filter(t => String(t.id) !== key));
    }
    CACHE.selectedId = "";
    await loadNotifications({ force: true });
  }
  function readForm(root) {
    const days = Array.from(root.querySelectorAll("[data-notif-day]:checked")).map(el => Number(el.value)).filter(d => d >= 0 && d <= 6);
    return normalizeTemplate({
      id: root.querySelector("[data-notif-id]")?.value || "",
      name: root.querySelector("[data-notif-name]")?.value || "",
      slot: root.querySelector("[data-notif-slot]")?.value || "custom",
      enabled: root.querySelector("[data-notif-enabled]")?.checked !== false,
      send_time: root.querySelector("[data-notif-time]")?.value || "08:30",
      days_of_week: days,
      emoji: root.querySelector("[data-notif-emoji]")?.value || "",
      title_template: root.querySelector("[data-notif-title]")?.value || "",
      body_template: root.querySelector("[data-notif-body]")?.value || "",
    });
  }
  function templateListHtml() {
    return CACHE.templates.map(t => {
      const p = preview(t, todayISO());
      const active = String(t.id) === String(CACHE.selectedId);
      return `<button class="tb-notif-template ${active ? "is-active" : ""}" data-notif-select="${esc(t.id)}" type="button">
        <span><strong>${esc(t.name)}</strong><small>${esc(t.enabled ? "Actif" : "Pause")} · ${esc(t.send_time)} · ${esc(t.slot)}</small></span>
        <em>${esc(p.title)}</em>
      </button>`;
    }).join("");
  }
  function upcomingHtml() {
    return CACHE.templates.filter(t => t.enabled).slice(0, 8).map(t => {
      const when = nextOccurrence(t);
      const p = preview(t, todayISO());
      return `<div class="tb-notif-feed-card">
        <div><strong>${esc(formatDateTime(when))}</strong><button class="btn" data-notif-select="${esc(t.id)}" type="button">Modifier</button></div>
        <h4>${esc(p.title)}</h4>
        <p>${esc(p.body)}</p>
      </div>`;
    }).join("") || `<div class="muted">Aucune notification active.</div>`;
  }
  function deliveriesHtml() {
    return (CACHE.deliveries || []).slice(0, 12).map(row => {
      const title = row.title || row.payload?.title || row.notification_key || "Notification";
      const body = row.body || row.payload?.body || "";
      return `<div class="tb-notif-history-row">
        <span><strong>${esc(title)}</strong><small>${esc(String(row.sent_at || row.sent_for_date || "").slice(0, 16).replace("T", " "))} · ${esc(row.status || "sent")}</small></span>
        <em>${esc(body)}</em>
      </div>`;
    }).join("") || `<div class="muted">Aucun envoi journalise pour l'instant.</div>`;
  }
  function ensureNotificationsShell() {
    const nav = document.querySelector(".tabs") || document.querySelector("nav") || document.querySelector(".app-tabs");
    if (nav && !document.getElementById("tab-notifications")) {
      const btn = document.createElement("button");
      btn.id = "tab-notifications";
      btn.className = "tab";
      btn.type = "button";
      btn.textContent = "Notifications";
      btn.onclick = () => { if (typeof window.showView === "function") window.showView("notifications"); };
      const health = document.getElementById("tab-health");
      if (health?.parentNode) health.parentNode.insertBefore(btn, health.nextSibling);
      else nav.appendChild(btn);
    }
    const app = document.querySelector("main") || document.getElementById("app") || document.body;
    if (app && !document.getElementById("view-notifications")) {
      const view = document.createElement("section");
      view.id = "view-notifications";
      view.className = "view hidden";
      view.innerHTML = `<div id="notifications-root"></div>`;
      app.appendChild(view);
    }
    if (!document.getElementById("tb-notifications-style")) {
      const style = document.createElement("style");
      style.id = "tb-notifications-style";
      style.textContent = `
        .tb-notif-shell{display:grid;gap:14px;padding:4px 0 24px}
        .tb-notif-hero{display:grid;grid-template-columns:1.3fr repeat(3,minmax(120px,.35fr));gap:12px;align-items:stretch}
        .tb-notif-hero-main,.tb-notif-card{border:1px solid var(--border);background:linear-gradient(135deg,rgba(14,165,233,.13),rgba(34,197,94,.08));border-radius:18px;padding:16px;box-shadow:0 12px 34px rgba(15,23,42,.08)}
        .tb-notif-hero-main h2{margin:2px 0 6px;font-size:26px;line-height:1.05}
        .tb-notif-kpi{border:1px solid var(--border);border-radius:16px;padding:14px;background:var(--panel);display:grid;gap:4px}
        .tb-notif-kpi strong{font-size:22px}
        .tb-notif-grid{display:grid;grid-template-columns:minmax(230px,.8fr) minmax(320px,1.05fr) minmax(280px,.95fr);gap:14px}
        .tb-notif-list{display:grid;gap:8px}
        .tb-notif-template{width:100%;text-align:left;border:1px solid var(--border);border-radius:14px;background:var(--panel);padding:11px;display:grid;gap:5px;color:var(--text);cursor:pointer}
        .tb-notif-template.is-active{border-color:#0ea5e9;box-shadow:0 0 0 3px rgba(14,165,233,.16)}
        .tb-notif-template span{display:flex;justify-content:space-between;gap:8px;align-items:center}
        .tb-notif-template small,.tb-notif-template em,.tb-notif-history-row small{display:block;color:var(--muted);font-style:normal;font-size:12px;line-height:1.25}
        .tb-notif-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .tb-notif-form .span-2{grid-column:1/-1}
        .tb-notif-days,.tb-notif-vars{display:flex;gap:6px;flex-wrap:wrap}
        .tb-notif-days label,.tb-notif-var{border:1px solid var(--border);background:var(--panel);border-radius:999px;padding:6px 9px;font-weight:800;font-size:12px}
        .tb-notif-var{cursor:pointer}
        .tb-notif-preview{border:1px solid rgba(14,165,233,.28);background:linear-gradient(135deg,rgba(14,165,233,.12),rgba(99,102,241,.08));border-radius:16px;padding:13px;display:grid;gap:6px}
        .tb-notif-preview h4{margin:0;font-size:16px}
        .tb-notif-preview p{margin:0;color:var(--text);line-height:1.35}
        .tb-notif-feed-card,.tb-notif-history-row{border:1px solid var(--border);border-radius:14px;background:var(--panel);padding:11px;display:grid;gap:7px}
        .tb-notif-feed-card>div{display:flex;justify-content:space-between;gap:8px;align-items:center}
        .tb-notif-feed-card h4{margin:0;font-size:14px}.tb-notif-feed-card p{margin:0;color:var(--muted);font-size:13px;line-height:1.35}
        .tb-notif-history-row em{font-style:normal;color:var(--muted);font-size:12px;line-height:1.3}
        @media(max-width:980px){.tb-notif-hero,.tb-notif-grid{grid-template-columns:1fr}.tb-notif-form{grid-template-columns:1fr}.tb-notif-form .span-2{grid-column:auto}}
      `;
      document.head.appendChild(style);
    }
  }
  function renderNotifications(reason) {
    ensureNotificationsShell();
    const root = document.getElementById("notifications-root");
    if (!root) return;
    if (!CACHE.loaded && !CACHE.loading) {
      root.innerHTML = `<div class="card"><div class="muted">Chargement des notifications...</div></div>`;
      loadNotifications().then(() => renderNotifications("loaded")).catch(() => renderNotifications("error"));
      return;
    }
    const tpl = selectedTemplate();
    const p = preview(tpl, todayISO());
    const activeCount = CACHE.templates.filter(t => t.enabled).length;
    root.innerHTML = `<div class="tb-notif-shell">
      <div class="tb-notif-hero">
        <div class="tb-notif-hero-main">
          <div class="muted">Centre notifications</div>
          <h2>Messages utiles, au bon moment.</h2>
          <div class="muted">Tu pilotes le contenu, l'heure, les jours, les variables et l'historique des push envoyes.</div>
        </div>
        <div class="tb-notif-kpi"><span class="muted">Modeles</span><strong>${CACHE.templates.length}</strong><small class="muted">modifiables</small></div>
        <div class="tb-notif-kpi"><span class="muted">Actives</span><strong>${activeCount}</strong><small class="muted">vont partir</small></div>
        <div class="tb-notif-kpi"><span class="muted">Envoyees</span><strong>${CACHE.deliveries.length}</strong><small class="muted">journalisees</small></div>
      </div>
      ${CACHE.error ? `<div class="notice warn">${esc(CACHE.error)}</div>` : ""}
      <div class="tb-notif-grid">
        <section class="tb-notif-card">
          <div class="row" style="justify-content:space-between;gap:8px;margin-bottom:10px;"><h3 style="margin:0;">Modeles</h3><button class="btn primary" data-notif-new type="button">Ajouter</button></div>
          <div class="tb-notif-list">${templateListHtml()}</div>
        </section>
        <section class="tb-notif-card">
          <div class="row" style="justify-content:space-between;gap:8px;margin-bottom:10px;"><h3 style="margin:0;">Modifier</h3><button class="btn danger" data-notif-delete type="button">Supprimer</button></div>
          <input data-notif-id type="hidden" value="${esc(tpl.id)}" />
          <div class="tb-notif-form">
            <div class="field"><label>Nom</label><input data-notif-name value="${esc(tpl.name)}" /></div>
            <div class="field"><label>Smileys / symbole</label><input data-notif-emoji value="${esc(tpl.emoji)}" placeholder="🌅" /></div>
            <div class="field"><label>Moment</label><select data-notif-slot>
              ${["morning","midday","evening","health","manual","custom"].map(v => `<option value="${v}" ${tpl.slot === v ? "selected" : ""}>${esc(v)}</option>`).join("")}
            </select></div>
            <div class="field"><label>Heure</label><input data-notif-time type="time" value="${esc(tpl.send_time)}" /></div>
            <label class="pill span-2" style="width:max-content;max-width:100%;"><input data-notif-enabled type="checkbox" ${tpl.enabled ? "checked" : ""} /> Active</label>
            <div class="field span-2"><label>Jours</label><div class="tb-notif-days">${DAY_LABELS.map((d, i) => `<label><input data-notif-day type="checkbox" value="${i}" ${tpl.days_of_week.includes(i) ? "checked" : ""}/> ${esc(d)}</label>`).join("")}</div></div>
            <div class="field span-2"><label>Titre</label><input data-notif-title value="${esc(tpl.title_template)}" /></div>
            <div class="field span-2"><label>Contenu</label><textarea data-notif-body rows="5">${esc(tpl.body_template)}</textarea></div>
            <div class="field span-2"><label>Valeurs disponibles</label><div class="tb-notif-vars">${VARIABLES.map(v => `<button class="tb-notif-var" data-notif-var="${esc(v.key)}" type="button">${esc(v.key)}</button>`).join("")}</div></div>
            <div class="span-2 tb-notif-preview"><span class="muted">Aperçu avec les valeurs actuelles</span><h4>${esc(p.title)}</h4><p>${esc(p.body)}</p></div>
            <div class="row span-2" style="justify-content:flex-end;gap:8px;"><button class="btn" data-notif-refresh type="button">Rafraichir</button><button class="btn primary" data-notif-save type="button">Enregistrer</button></div>
          </div>
        </section>
        <section class="tb-notif-card">
          <h3 style="margin:0 0 10px;">Prochaines</h3>
          <div class="tb-notif-list">${upcomingHtml()}</div>
          <h3 style="margin:16px 0 10px;">Envoyees</h3>
          <div class="tb-notif-list">${deliveriesHtml()}</div>
        </section>
      </div>
    </div>`;
    bind(root);
  }
  function bind(root) {
    const updateDraftPreview = () => {
      const draft = readForm(root);
      const idx = CACHE.templates.findIndex(t => String(t.id) === String(draft.id));
      if (idx >= 0) CACHE.templates[idx] = draft;
      const p = preview(draft, todayISO());
      const previewBox = root.querySelector(".tb-notif-preview");
      if (previewBox) {
        const h = previewBox.querySelector("h4");
        const body = previewBox.querySelector("p");
        if (h) h.textContent = p.title;
        if (body) body.textContent = p.body;
      }
    };
    root.querySelectorAll("[data-notif-select]").forEach(btn => {
      btn.onclick = () => { CACHE.selectedId = btn.getAttribute("data-notif-select") || ""; renderNotifications("select"); };
    });
    root.querySelectorAll("input,textarea,select").forEach(el => {
      el.onfocus = () => { if (el.matches("[data-notif-title]")) CACHE.focusField = "title"; if (el.matches("[data-notif-body]")) CACHE.focusField = "body"; };
      el.oninput = updateDraftPreview;
      el.onchange = el.oninput;
    });
    root.querySelectorAll("[data-notif-var]").forEach(btn => {
      btn.onclick = () => {
        const key = btn.getAttribute("data-notif-var") || "";
        const field = CACHE.focusField === "title" ? root.querySelector("[data-notif-title]") : root.querySelector("[data-notif-body]");
        if (!field) return;
        const start = field.selectionStart ?? field.value.length;
        const end = field.selectionEnd ?? field.value.length;
        field.value = `${field.value.slice(0, start)}${key}${field.value.slice(end)}`;
        field.focus();
        field.selectionStart = field.selectionEnd = start + key.length;
        field.dispatchEvent(new Event("input", { bubbles: true }));
      };
    });
    const newBtn = root.querySelector("[data-notif-new]");
    if (newBtn) newBtn.onclick = () => {
      const fresh = normalizeTemplate({ ...DEFAULT_TEMPLATES[0], id: `local_tpl_${Date.now()}`, name: "Nouvelle notification", title_template: "Notification", body_template: "Texte + /budgetrestant" });
      CACHE.templates.unshift(fresh);
      CACHE.selectedId = fresh.id;
      renderNotifications("new");
    };
    const refreshBtn = root.querySelector("[data-notif-refresh]");
    if (refreshBtn) refreshBtn.onclick = () => loadNotifications({ force: true }).then(() => renderNotifications("refresh")).catch(() => renderNotifications("refresh-error"));
    const saveBtn = root.querySelector("[data-notif-save]");
    if (saveBtn) saveBtn.onclick = () => safeCall("Enregistrer notification", async () => {
      await saveTemplate(readForm(root));
      renderNotifications("saved");
    });
    const deleteBtn = root.querySelector("[data-notif-delete]");
    if (deleteBtn) deleteBtn.onclick = () => safeCall("Supprimer notification", async () => {
      const tpl = selectedTemplate();
      if (!tpl?.id) return;
      if (!confirm(`Supprimer "${tpl.name}" ?`)) return;
      await deleteTemplate(tpl.id);
      renderNotifications("deleted");
    });
  }

  window.renderNotifications = renderNotifications;
  window.tbLoadNotificationTemplates = loadNotifications;
  window.tbRenderNotificationTemplatePreview = preview;
  window.tbNotificationTemplateVariables = VARIABLES.slice();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureNotificationsShell);
  else ensureNotificationsShell();
})();
