// public/legacy/js/15_recurring_rules_ui.js
(function(){
  let _rrSubmitting = false;

  function _rrGetSB() {
    if (typeof _tbGetSB === "function") return _tbGetSB();
    return window.supabase || window.sb || null;
  }

  function _rrFmtDate(v) {
    if (!v) return "—";
    try { return String(v).slice(0, 10); } catch (_) { return "—"; }
  }

  function _rrParseISODate(iso) {
    const s = String(iso || "");
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  }

  function _rrDaysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  function _rrISOFromParts(y, m, d) {
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  function _rrDateToUTCDate(iso) {
    const p = _rrParseISODate(iso);
    if (!p) return null;
    return new Date(Date.UTC(p.y, p.m - 1, p.d));
  }

  function _rrIsUuid(v) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || "").trim());
  }

  function _rrReadLocalCategories() {
    try {
      if (typeof loadCategoriesFromLocalStorage === "function") {
        const arr = loadCategoriesFromLocalStorage();
        if (Array.isArray(arr)) return arr;
      }
    } catch (_) {}

    const keys = [
      "travelbudget_categories_v1",
      "travelbudget_categories_v2",
      "travelbudget_categories",
      "tb_categories",
      "categories"
    ];

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;
        return parsed.map((x) => {
          if (typeof x === "string") return x;
          return x?.name || x?.label || x?.category || "";
        }).filter(Boolean);
      } catch (_) {}
    }

    return [];
  }

  function _rrNormalizeCategoryName(v) {
    return String(v || "").trim();
  }

  function _rrIsTripLikeCategory(name) {
    return /^\s*\[\s*trip\s*\]/i.test(String(name || ""));
  }

  function _rrIsPlaceholderCategory(name) {
    return /^(cat[ée]gorie|category|choisir une cat[ée]gorie)$/i.test(String(name || "").trim());
  }


  async function _rrFetchDbCategories() {
    const s = _rrGetSB();
    if (!s) return [];
    try {
      const uid = await _tbAuthUid();
      if (!uid) return [];
      const { data, error } = await s
        .from(TB_CONST.TABLES.categories)
        .select('name')
        .eq('user_id', uid)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []).map((r) => String(r?.name || '').trim()).filter(Boolean);
    } catch (e) {
      console.warn('[RR categories] db fetch failed', e);
      return [];
    }
  }

  function _rrShouldKeepTxCategory(tx) {
    if (!tx) return false;
    if (tx.tripExpenseId || tx.trip_expense_id) return false;
    if (tx.tripShareLinkId || tx.trip_share_link_id) return false;
    const cat = _rrNormalizeCategoryName(tx.category);
    if (!cat) return false;
    if (_rrIsTripLikeCategory(cat)) return false;
    if (_rrIsPlaceholderCategory(cat)) return false;
    return true;
  }

  async function _rrCategoryOptions() {
    const out = [];
    const seen = new Set();
    const push = (raw) => {
      const name = _rrNormalizeCategoryName(raw);
      if (!name) return;
      if (_rrIsTripLikeCategory(name)) return;
      if (_rrIsPlaceholderCategory(name)) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(name);
    };

    (await _rrFetchDbCategories()).forEach(push);

    try {
      if (typeof getCategories === "function") {
        (getCategories() || []).forEach(push);
      }
    } catch (_) {}

    _rrReadLocalCategories().forEach(push);

    (state?.categories || []).forEach((c) => {
      if (typeof c === "string") return push(c);
      push(c?.name);
      push(c?.label);
      push(c?.category);
    });

    (state?.transactions || []).forEach((tx) => {
      if (!_rrShouldKeepTxCategory(tx)) return;
      push(tx.category);
    });

    try {
      if (typeof getCategories === "function") {
        const ordered = getCategories();
        const pos = Object.fromEntries(ordered.map((name, idx) => [String(name || '').toLowerCase(), idx]));
        return out.sort((a, b) => {
          const ai = Object.prototype.hasOwnProperty.call(pos, String(a || '').toLowerCase()) ? pos[String(a || '').toLowerCase()] : 999;
          const bi = Object.prototype.hasOwnProperty.call(pos, String(b || '').toLowerCase()) ? pos[String(b || '').toLowerCase()] : 999;
          return (ai - bi) || a.localeCompare(b, "fr", { sensitivity: "base" });
        });
      }
    } catch (_) {}
    return out.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }

  function _rrSubcategoryOptions(categoryName, selectedValue) {
    const rows = (typeof getCategorySubcategories === 'function') ? getCategorySubcategories(categoryName) : [];
    const selected = String(selectedValue || '').trim();
    const options = ['<option value="">Aucune</option>'];
    for (const row of rows) {
      const name = String(row?.name || '').trim();
      if (!name) continue;
      options.push(`<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`);
    }
    if (selected && !rows.some((row) => String(row?.name || '').trim().toLowerCase() === selected.toLowerCase())) {
      options.push(`<option value="${escapeHTML(selected)}">${escapeHTML(selected)}</option>`);
    }
    return options.join('');
  }

  function _rrBindSubcategoryUi(initialValue) {
    const categoryEl = document.getElementById('rr-category');
    const subcategoryEl = document.getElementById('rr-subcategory');
    if (!categoryEl || !subcategoryEl) return;
    const render = (selectedValue) => {
      subcategoryEl.innerHTML = _rrSubcategoryOptions(categoryEl.value, selectedValue);
      subcategoryEl.value = selectedValue || '';
    };
    render(initialValue || '');
    categoryEl.addEventListener('change', () => render(''));
  }

  function _rrComputeFirstDueDate(ruleType, startDate, weekday, monthday) {
    const start = _rrDateToUTCDate(startDate);
    if (!start) return startDate;

    if (ruleType === "daily") return startDate;

    if (ruleType === "weekly") {
      if (weekday === null || weekday === undefined || weekday === "") return startDate;
      const target = Number(weekday);
      const cur = start.getUTCDay();
      const delta = (target - cur + 7) % 7;
      const due = new Date(start.getTime());
      due.setUTCDate(due.getUTCDate() + delta);
      return _rrISOFromParts(due.getUTCFullYear(), due.getUTCMonth() + 1, due.getUTCDate());
    }

    if (ruleType === "every_x_months") {
      const md = Number(monthday || 0);
      if (!(md >= 1 && md <= 31)) return startDate;

      const y = start.getUTCFullYear();
      const m = start.getUTCMonth() + 1;
      const d = start.getUTCDate();
      const dim = _rrDaysInMonth(y, m);
      const candidateDay = Math.min(md, dim);

      if (candidateDay >= d) return _rrISOFromParts(y, m, candidateDay);

      const next = new Date(Date.UTC(y, m, 1));
      const ny = next.getUTCFullYear();
      const nm = next.getUTCMonth() + 1;
      const ndim = _rrDaysInMonth(ny, nm);
      return _rrISOFromParts(ny, nm, Math.min(md, ndim));
    }

    if (ruleType === "yearly") return startDate;
    return startDate;
  }

  function _rrFreqLabel(rule) {
    const type = String(rule?.ruleType || rule?.rule_type || "").toLowerCase();
    const every = Number(rule?.intervalCount || rule?.interval_count || 1) || 1;
    if (type === "daily") return every === 1 ? "Quotidien" : `Tous les ${every} jours`;
    if (type === "weekly") return every === 1 ? "Hebdomadaire" : `Toutes les ${every} semaines`;
    if (type === "monthly") return every === 1 ? "Mensuel" : `Tous les ${every} mois`;
    if (type === "every_x_months") return every === 1 ? "Mensuel" : `Tous les ${every} mois`;
    if (type === "yearly") return every === 1 ? "Annuel" : `Tous les ${every} ans`;
    return type || "—";
  }

  function _rrStatus(rule) {
    if (rule?.archived) return "archivée";
    if (rule?.isActive === false || rule?.is_active === false) return "pause";
    return "active";
  }

  function _rrWalletOptions() {
    const tid = String(state?.activeTravelId || "");
    return (state?.wallets || []).filter((w) => String(w?.travelId || w?.travel_id || "") === tid);
  }

  function _rrEnsureSettingsBox() {
    const view = document.getElementById("view-settings");
    if (!view) return null;

    let box = document.getElementById("tb-recurring-card");
    if (box) return box.querySelector("#tb-recurring-box");

    const card = document.createElement("div");
    card.className = "card tb-settings-card tb-settings-card--recurring";
    card.id = "tb-recurring-card";
    card.style.marginBottom = "12px";
    card.innerHTML = `
      <h2>Échéances périodiques</h2>
      <div class="muted" style="margin-bottom:10px;">
        Retrouve ici les échéances à venir et les actions utiles.
      </div>
      <div class="row" style="justify-content:flex-end; margin-bottom:10px;">
        <button class="btn primary" id="tb-recurring-add-btn">+ Nouvelle échéance</button>
      </div>
      <div id="tb-recurring-box"></div>
    `;

    const paletteCard = document.getElementById("tb-account-card")?.nextElementSibling?.nextElementSibling;
    if (paletteCard && paletteCard.parentNode === view) view.insertBefore(card, paletteCard);
    else view.appendChild(card);

    const btn = card.querySelector("#tb-recurring-add-btn");
    if (btn) btn.onclick = () => safeCall("Nouvelle échéance", window.openRecurringRuleModal);
    return card.querySelector("#tb-recurring-box");
  }

  async function _rrCreateRule(payload) {
    const s = _rrGetSB();
    if (!s) throw new Error("Supabase non prêt.");
    const uid = await _tbAuthUid();
    const tid = String(state?.activeTravelId || "");
    if (!tid) throw new Error("Voyage actif requis.");

    const insertPayload = {
      user_id: uid,
      travel_id: tid,
      wallet_id: payload.wallet_id,
      label: payload.label,
      amount: payload.amount,
      currency: payload.currency,
      type: payload.type,
      rule_type: payload.rule_type,
      category: payload.category || null,
      subcategory: payload.subcategory || null,
      interval_count: payload.interval_count,
      weekday: payload.weekday,
      monthday: payload.monthday,
      week_of_month: null,
      start_date: payload.start_date,
      next_due_at: payload.next_due_at || payload.start_date,
      end_date: payload.end_date || null,
      max_occurrences: payload.max_occurrences,
      is_active: true,
      archived: false,
      out_of_budget: !!payload.out_of_budget
    };

    const { data, error } = await s.from(TB_CONST.TABLES.recurring_rules).insert(insertPayload).select("id").single();
    if (error) throw error;

    const newRuleId = String(data?.id || "");
    if (!newRuleId) throw new Error("Règle créée sans id.");

    const rpcName = TB_CONST?.RPCS?.recurring_generate_for_rule || "recurring_generate_for_rule";
    const { error: genErr } = await s.rpc(rpcName, { p_rule_id: newRuleId });
    if (genErr) throw genErr;
    return newRuleId;
  }

  async function _rrPauseRule(ruleId) {
    const s = _rrGetSB();
    if (!s) throw new Error("Supabase non prêt.");
    const rid = String(ruleId || "").trim();
    if (!_rrIsUuid(rid)) throw new Error("UUID de règle invalide.");
    console.log("[RR pause]", { ruleId: rid, typeofRuleId: typeof rid });
    const rpcName = TB_CONST?.RPCS?.recurring_pause_rule || "recurring_pause_rule";
    const { error } = await s.rpc(rpcName, { p_rule_id: rid });
    if (error) throw error;
    if (typeof window.refreshFromServer === "function") await window.refreshFromServer();
    else if (typeof refreshFromServer === "function") await refreshFromServer();
    window.renderRecurringRules();
  }

  async function _rrResumeRule(ruleId) {
    const s = _rrGetSB();
    if (!s) throw new Error("Supabase non prêt.");
    const rid = String(ruleId || "").trim();
    if (!_rrIsUuid(rid)) throw new Error("UUID de règle invalide.");
    console.log("[RR resume]", { ruleId: rid, typeofRuleId: typeof rid });
    const rpcName = TB_CONST?.RPCS?.recurring_resume_rule || "recurring_resume_rule";
    const { error } = await s.rpc(rpcName, { p_rule_id: rid });
    if (error) throw error;
    const genName = TB_CONST?.RPCS?.recurring_generate_for_rule || "recurring_generate_for_rule";
    const { error: genErr } = await s.rpc(genName, { p_rule_id: rid });
    if (genErr) throw genErr;
    if (typeof window.refreshFromServer === "function") await window.refreshFromServer();
    else if (typeof refreshFromServer === "function") await refreshFromServer();
    window.renderRecurringRules();
  }

  function _rrRuleToFormDefaults(rule, fallbackCurrency) {
    const r = rule || {};
    return {
      label: String(r.label || r.name || "").trim(),
      type: String(r.type || "expense").trim() || "expense",
      amount: Number(r.amount || 0) || 0,
      currency: String(r.currency || fallbackCurrency || "EUR").trim().toUpperCase(),
      wallet_id: String(r.walletId || r.wallet_id || "").trim(),
      category: String(r.category || "").trim(),
      subcategory: String(r.subcategory || "").trim(),
      rule_type: String(r.ruleType || r.rule_type || "every_x_months").trim() || "every_x_months",
      interval_count: Math.max(1, Number(r.intervalCount || r.interval_count || 1) || 1),
      weekday: (r.weekday === null || r.weekday === undefined) ? "1" : String(r.weekday),
      monthday: (r.monthday === null || r.monthday === undefined) ? "" : String(r.monthday),
      start_date: String(r.startDate || r.start_date || "").slice(0, 10),
      end_date: String(r.endDate || r.end_date || "").slice(0, 10),
      max_occurrences: (r.maxOccurrences === null || r.maxOccurrences === undefined || r.max_occurrences === null || r.max_occurrences === undefined) ? "" : String(r.maxOccurrences || r.max_occurrences),
      out_of_budget: !!(r.outOfBudget || r.out_of_budget),
    };
  }

  async function _rrSyncGeneratedTransactions(ruleId, payload) {
    const s = _rrGetSB();
    if (!s) throw new Error("Supabase non prêt.");
    const rid = String(ruleId || "").trim();
    if (!_rrIsUuid(rid)) throw new Error("UUID de règle invalide.");

    const { data: rows, error: selErr } = await s
      .from(TB_CONST.TABLES.transactions)
      .select('id, recurring_instance_status, generated_by_rule')
      .eq('recurring_rule_id', rid)
      .eq('generated_by_rule', true);
    if (selErr) throw selErr;

    const ids = (Array.isArray(rows) ? rows : [])
      .filter((row) => String(row?.recurring_instance_status || '').toLowerCase() !== 'confirmed')
      .map((row) => row.id)
      .filter(Boolean);
    if (!ids.length) return 0;

    const updatePayload = {
      wallet_id: payload.wallet_id,
      label: payload.label,
      amount: payload.amount,
      currency: payload.currency,
      type: payload.type,
      category: payload.category || null,
      subcategory: payload.subcategory || null,
      out_of_budget: !!payload.out_of_budget,
      updated_at: new Date().toISOString(),
    };

    const { error: updErr } = await s
      .from(TB_CONST.TABLES.transactions)
      .update(updatePayload)
      .in('id', ids);
    if (updErr) throw updErr;
    return ids.length;
  }

  async function _rrUpdateRule(ruleId, payload) {
    const s = _rrGetSB();
    if (!s) throw new Error("Supabase non prêt.");
    const rid = String(ruleId || "").trim();
    if (!_rrIsUuid(rid)) throw new Error("UUID de règle invalide.");

    const updatePayload = {
      wallet_id: payload.wallet_id,
      label: payload.label,
      amount: payload.amount,
      currency: payload.currency,
      type: payload.type,
      category: payload.category || null,
      subcategory: payload.subcategory || null,
      rule_type: payload.rule_type,
      interval_count: payload.interval_count,
      weekday: payload.weekday,
      monthday: payload.monthday,
      start_date: payload.start_date,
      next_due_at: payload.next_due_at || payload.start_date,
      end_date: payload.end_date || null,
      max_occurrences: payload.max_occurrences,
      out_of_budget: !!payload.out_of_budget,
      updated_at: new Date().toISOString(),
    };

    const { error } = await s
      .from(TB_CONST.TABLES.recurring_rules)
      .update(updatePayload)
      .eq('id', rid);
    if (error) throw error;

    await _rrSyncGeneratedTransactions(rid, payload);

    const genName = TB_CONST?.RPCS?.recurring_generate_for_rule || "recurring_generate_for_rule";
    const { error: genErr } = await s.rpc(genName, { p_rule_id: rid });
    if (genErr) throw genErr;
    return rid;
  }

  async function _rrArchive(ruleId) {
    const s = _rrGetSB();
    if (!s) throw new Error("Supabase non prêt.");
    const rid = String(ruleId || "").trim();
    if (!_rrIsUuid(rid)) throw new Error("UUID de règle invalide.");
    const rpcName = TB_CONST?.RPCS?.recurring_delete_rule || "recurring_delete_rule";
    const { error } = await s.rpc(rpcName, {
      p_rule_id: rid,
      p_mode: "rule_and_future_and_unconfirmed_past"
    });
    if (error) throw error;
    if (typeof window.refreshFromServer === "function") await window.refreshFromServer();
    else if (typeof refreshFromServer === "function") await refreshFromServer();
    window.renderRecurringRules();
  }

  function _rrBindFrequencyUi() {
    const ruleType = document.getElementById("rr-rule-type");
    const interval = document.getElementById("rr-interval-count");
    const weekdayWrap = document.getElementById("rr-weekday-wrap");
    const monthdayWrap = document.getElementById("rr-monthday-wrap");
    const help = document.getElementById("rr-frequency-help");
    if (!ruleType || !interval || !weekdayWrap || !monthdayWrap || !help) return;

    const apply = () => {
      const type = String(ruleType.value || "every_x_months");
      weekdayWrap.style.display = (type === "weekly") ? "" : "none";
      monthdayWrap.style.display = (type === "every_x_months") ? "" : "none";

      if (type === "daily") {
        help.textContent = "Tous les X jours.";
      } else if (type === "weekly") {
        help.textContent = "Toutes les X semaines, le jour choisi.";
      } else if (type === "every_x_months") {
        help.textContent = "Tous les X mois, au jour du mois choisi.";
      } else if (type === "yearly") {
        help.textContent = "Tous les X ans, à partir de la date de début.";
      } else {
        help.textContent = "";
      }
    };

    ruleType.addEventListener("change", apply);
    interval.addEventListener("input", apply);
    apply();
  }

  window.openRecurringRuleModal = async function openRecurringRuleModal(ruleToEdit) {
    const wallets = _rrWalletOptions();
    if (!wallets.length) throw new Error("Aucun wallet disponible sur le voyage actif.");

    const activeTravel = (state?.travels || []).find((t) => String(t.id) === String(state?.activeTravelId || ""));
    const baseCur = String(activeTravel?.base_currency || state?.period?.baseCurrency || "EUR").toUpperCase();
    const cats = await _rrCategoryOptions();
    const modal = (typeof _tbEnsureModal === "function") ? _tbEnsureModal() : null;
    if (!modal) throw new Error("Modal indisponible.");
    const today = _tbISO(new Date());
    const defaults = _rrRuleToFormDefaults(ruleToEdit || null, String(wallets[0]?.currency || baseCur || "EUR").toUpperCase());
    const isEditing = !!(ruleToEdit && ruleToEdit.id);

    modal.setTitle(isEditing ? "Modifier échéance périodique" : "Nouvelle échéance périodique");
    modal.setBody(`
      <div class="row">
        <div class="field" style="min-width:220px;">
          <label>Nom</label>
          <input id="rr-label" type="text" placeholder="Ex: Loyer, Assurance, Netflix" value="${escapeHTML(defaults.label)}" />
        </div>
        <div class="field" style="min-width:140px;">
          <label>Type</label>
          <select id="rr-type">
            <option value="expense" ${defaults.type === "expense" ? "selected" : ""}>Dépense</option>
            <option value="income" ${defaults.type === "income" ? "selected" : ""}>Entrée</option>
          </select>
        </div>
        <div class="field" style="min-width:140px;">
          <label>Montant</label>
          <input id="rr-amount" type="number" step="0.01" min="0" value="${defaults.amount > 0 ? escapeHTML(String(defaults.amount)) : ""}" />
        </div>
      </div>

      <div class="row">
        <div class="field" style="min-width:220px;">
          <label>Wallet</label>
          <select id="rr-wallet">
            ${wallets.map((w) => `<option value="${escapeHTML(w.id)}" data-cur="${escapeHTML(String(w.currency || "").toUpperCase())}" ${String(w.id) === String(defaults.wallet_id || wallets[0]?.id || "") ? "selected" : ""}>${escapeHTML(w.name)} — ${escapeHTML(w.currency)}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="min-width:120px;">
          <label>Devise</label>
          <input id="rr-currency" type="text" value="${escapeHTML(defaults.currency)}" />
        </div>
        <div class="field" style="min-width:180px;">
          <label>Catégorie</label>
          <select id="rr-category">
            <option value="" ${defaults.category ? "" : "selected"} disabled hidden>Choisir une catégorie</option>
            ${cats.map((cat) => `<option value="${escapeHTML(cat)}" ${String(cat) === String(defaults.category) ? "selected" : ""}>${escapeHTML(cat)}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="min-width:180px;">
          <label>Sous-catégorie</label>
          <select id="rr-subcategory"></select>
        </div>
      </div>

      <div class="row" style="align-items:flex-end;">
        <div class="field" style="min-width:180px;">
          <label>Fréquence</label>
          <select id="rr-rule-type">
            <option value="daily" ${defaults.rule_type === "daily" ? "selected" : ""}>Jour</option>
            <option value="weekly" ${defaults.rule_type === "weekly" ? "selected" : ""}>Semaine</option>
            <option value="every_x_months" ${defaults.rule_type === "every_x_months" ? "selected" : ""}>Mois</option>
            <option value="yearly" ${defaults.rule_type === "yearly" ? "selected" : ""}>Année</option>
          </select>
        </div>
        <div class="field" style="min-width:140px;">
          <label>Répéter tous les</label>
          <input id="rr-interval-count" type="number" min="1" step="1" value="${escapeHTML(String(defaults.interval_count || 1))}" />
        </div>
        <div class="field" id="rr-weekday-wrap" style="min-width:180px; display:none;">
          <label>Jour de la semaine</label>
          <select id="rr-weekday">
            <option value="1" ${String(defaults.weekday || "1") === "1" ? "selected" : ""}>Lundi</option>
            <option value="2" ${String(defaults.weekday || "") === "2" ? "selected" : ""}>Mardi</option>
            <option value="3" ${String(defaults.weekday || "") === "3" ? "selected" : ""}>Mercredi</option>
            <option value="4" ${String(defaults.weekday || "") === "4" ? "selected" : ""}>Jeudi</option>
            <option value="5" ${String(defaults.weekday || "") === "5" ? "selected" : ""}>Vendredi</option>
            <option value="6" ${String(defaults.weekday || "") === "6" ? "selected" : ""}>Samedi</option>
            <option value="0" ${String(defaults.weekday || "") === "0" ? "selected" : ""}>Dimanche</option>
          </select>
        </div>
        <div class="field" id="rr-monthday-wrap" style="min-width:180px;">
          <label>Jour du mois</label>
          <input id="rr-monthday" type="number" min="1" max="31" placeholder="1-31" value="${escapeHTML(defaults.monthday)}" />
        </div>
      </div>
      <div class="muted" id="rr-frequency-help" style="margin:-4px 0 8px 0;"></div>

      <div class="row">
        <div class="field">
          <label>Début</label>
          <input id="rr-start-date" type="date" value="${escapeHTML(defaults.start_date || today)}" />
        </div>
        <div class="field">
          <label>Fin</label>
          <input id="rr-end-date" type="date" value="${escapeHTML(defaults.end_date)}" />
        </div>
        <div class="field">
          <label>Occurrences max</label>
          <input id="rr-max-occurrences" type="number" min="1" step="1" placeholder="Optionnel" value="${escapeHTML(defaults.max_occurrences)}" />
        </div>
      </div>

      <div class="row">
        <div class="field" style="min-width:220px;">
          <label>Impact budget</label>
          <select id="rr-budget-mode">
            <option value="budget" ${defaults.out_of_budget ? "" : "selected"}>Dans le budget</option>
            <option value="out" ${defaults.out_of_budget ? "selected" : ""}>Hors budget</option>
          </select>
        </div>
      </div>
    `);

    _rrBindFrequencyUi();
    _rrBindSubcategoryUi(defaults.subcategory || "");

    const walletSel = document.getElementById("rr-wallet");
    const curInp = document.getElementById("rr-currency");
    let currencyManuallyEdited = false;
    if (curInp) curInp.addEventListener("input", () => { currencyManuallyEdited = true; });
    if (walletSel && curInp) {
      walletSel.addEventListener("change", () => {
        if (currencyManuallyEdited) return;
        const opt = walletSel.options[walletSel.selectedIndex];
        const cur = String(opt?.dataset?.cur || "").trim().toUpperCase();
        if (cur) curInp.value = cur;
      });
    }

    modal.setActions([
      { label: "Annuler", className: "btn", onClick: () => modal.close() },
      {
        label: isEditing ? "Enregistrer" : "Créer",
        className: "btn primary",
        onClick: async () => {
          if (_rrSubmitting) return;
          _rrSubmitting = true;
          try {
            const label = String(document.getElementById("rr-label")?.value || "").trim();
            const type = String(document.getElementById("rr-type")?.value || "expense");
            const amount = Number(document.getElementById("rr-amount")?.value || 0);
            const currency = String(document.getElementById("rr-currency")?.value || "").trim().toUpperCase();
            const wallet_id = String(document.getElementById("rr-wallet")?.value || "");
            const category = String(document.getElementById("rr-category")?.value || "").trim();
            const subcategory = String(document.getElementById("rr-subcategory")?.value || "").trim();
            const rule_type = String(document.getElementById("rr-rule-type")?.value || "").trim();
            const interval_count = Math.max(1, Number(document.getElementById("rr-interval-count")?.value || 1));
            const weekdayRaw = document.getElementById("rr-weekday")?.value;
            const monthdayRaw = document.getElementById("rr-monthday")?.value;
            const start_date = String(document.getElementById("rr-start-date")?.value || "");
            const end_date = String(document.getElementById("rr-end-date")?.value || "");
            const maxOccRaw = document.getElementById("rr-max-occurrences")?.value;
            const budget_mode = String(document.getElementById("rr-budget-mode")?.value || "budget").trim();
            const out_of_budget = (budget_mode === "out");

            if (!label) throw new Error("Nom requis.");
            if (!(amount > 0)) throw new Error("Montant invalide.");
            if (!currency) throw new Error("Devise requise.");
            if (!wallet_id) throw new Error("Wallet requis.");
            if (!category) throw new Error("Catégorie requise.");
            if (!start_date) throw new Error("Date de début requise.");
            if (end_date && end_date < start_date) throw new Error("La date de fin doit être ≥ à la date de début.");

            const weekday = (rule_type === "weekly") ? Number(weekdayRaw) : null;
            const monthday = (rule_type === "every_x_months") ? Number(monthdayRaw || 0) || null : null;
            const next_due_at = _rrComputeFirstDueDate(rule_type, start_date, weekday, monthday);

            const payload = {
              label, type, amount, currency, wallet_id,
              category, subcategory: subcategory || null,
              rule_type, interval_count, weekday, monthday,
              start_date, next_due_at,
              end_date: end_date || null,
              max_occurrences: maxOccRaw === "" ? null : Number(maxOccRaw),
              out_of_budget
            };

            if (isEditing) {
              await _rrUpdateRule(ruleToEdit.id, payload);
            } else {
              await _rrCreateRule(payload);
            }
            modal.close();
            if (typeof window.refreshFromServer === "function") await window.refreshFromServer();
            else if (typeof refreshFromServer === "function") await refreshFromServer();
            window.renderRecurringRules();
            _tbToastOk(isEditing ? "Échéance mise à jour." : "Échéance créée.");
          } finally {
            _rrSubmitting = false;
          }
        }
      }
    ]);

    modal.open();
  };

  window.renderRecurringRules = function renderRecurringRules() {
    const host = _rrEnsureSettingsBox();
    if (!host) return;
    const tid = String(state?.activeTravelId || "");
    const rows = (state?.recurringRules || [])
      .filter((r) => String(r?.travelId || r?.travel_id || "") === tid)
      .filter((r) => !r?.archived)
      .slice()
      .sort((a, b) => String(a?.nextDueAt || a?.next_due_at || "").localeCompare(String(b?.nextDueAt || b?.next_due_at || "")));

    if (!rows.length) {
      host.innerHTML = `<div class="muted">Aucune échéance périodique sur ce voyage.</div>`;
      return;
    }

    host.innerHTML = `
      <div class="tb-recurring-stack">
        ${rows.map((r) => {
          const walletName = String((state?.wallets || []).find(w=>String(w.id||'')===String(r.walletId||r.wallet_id||''))?.name || '—');
          return `
          <div class="tb-recurring-item">
            <div class="tb-recurring-main">
              <div class="tb-recurring-title-row">
                <div>
                  <div class="tb-recurring-title">${escapeHTML(r.label || r.name || "—")}</div>
                  <div class="tb-recurring-subtitle">${escapeHTML(fmtMoney(Number(r.amount || 0), r.currency || ""))} · ${escapeHTML(String(r.type || '').replace('expense','dépense').replace('income','revenu') || '—')}</div>
                </div>
                <div class="tb-recurring-chips">
                  ${r.outOfBudget || r.out_of_budget ? `<span class="tb-settings-pill">Hors budget</span>` : ``}
                  <span class="tb-settings-pill">${escapeHTML(_rrStatus(r))}</span>
                </div>
              </div>
              <div class="tb-recurring-meta">
                <span class="tb-recurring-meta-item"><span class="tb-recurring-meta-label">Fréquence</span><strong>${escapeHTML(_rrFreqLabel(r))}</strong></span>
                <span class="tb-recurring-meta-item"><span class="tb-recurring-meta-label">Prochaine</span><strong>${escapeHTML(_rrFmtDate(r.nextDueAt || r.next_due_at))}</strong></span>
                <span class="tb-recurring-meta-item"><span class="tb-recurring-meta-label">Wallet</span><strong>${escapeHTML(walletName)}</strong></span>
              </div>
            </div>
            <div class="tb-recurring-actions">
              <button class="btn" data-rr-act="edit" data-rr-id="${escapeHTML(r.id)}">Modifier</button>
              ${_rrStatus(r) === "active"
                ? `<button class="btn" data-rr-act="pause" data-rr-id="${escapeHTML(r.id)}">Pause</button>`
                : `<button class="btn" data-rr-act="resume" data-rr-id="${escapeHTML(r.id)}">Reprendre</button>`}
              <button class="btn danger" data-rr-act="delete" data-rr-id="${escapeHTML(r.id)}">Supprimer</button>
            </div>
          </div>`;
        }).join("")}
      </div>
    `;

    host.querySelectorAll("[data-rr-act]").forEach((btn) => {
      btn.onclick = (ev) => safeCall("Échéances périodiques", async () => {
        const el = ev.currentTarget;
        const id = String(el?.dataset?.rrId || "").trim();
        const act = String(el?.dataset?.rrAct || "").trim();
        if (!id) throw new Error("Règle introuvable.");
        if (!act) throw new Error("Action introuvable.");

        if (act === "edit") {
          const rule = (state?.recurringRules || []).find((r) => String(r?.id || '') === id);
          if (!rule) throw new Error('Règle introuvable.');
          window.openRecurringRuleModal(rule);
          return;
        }
        if (act === "pause") {
          await _rrPauseRule(id);
          _tbToastOk("Échéance mise en pause.");
          return;
        }
        if (act === "resume") {
          await _rrResumeRule(id);
          _tbToastOk("Échéance reprise.");
          return;
        }
        if (act === "delete") {
          if (!confirm("Supprimer cette échéance périodique ?\n\nLes occurrences non payées seront supprimées, y compris celles passées non confirmées. Les occurrences payées resteront conservées.")) return;
          await _rrArchive(id);
          _tbToastOk("Échéance supprimée.");
          return;
        }
        throw new Error("Action non reconnue.");
      });
    });
  };
})();
