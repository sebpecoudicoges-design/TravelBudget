// public/legacy/js/15_recurring_rules_ui.js
(function(){
  let _rrSubmitting = false;

  function rrT(key, vars) {
    try {
      return window.tbT ? window.tbT(key, vars) : key;
    } catch (_) {
      return key;
    }
  }

  function _rrGetSB() {
    if (typeof _tbGetSB === "function") return _tbGetSB();
    return window.supabase || window.sb || null;
  }

  async function _rrLinkTransaction(transactionId, ruleId) {
    const client = _rrGetSB();
    if (!client) throw new Error("Supabase non prêt.");
    const { error } = await client.rpc(TB_CONST.RPCS.link_transaction_to_recurring_rule || "link_transaction_to_recurring_rule", {
      p_transaction_id: transactionId,
      p_recurring_rule_id: ruleId,
    });
    if (error) throw error;
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

  function _rrTextKey(value) {
    return String(value || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  async function _rrFetchDbSubcategories() {
    const s = _rrGetSB();
    if (!s) return [];
    try {
      const uid = await _tbAuthUid();
      if (!uid) return [];
      const { data, error } = await s
        .from(TB_CONST.TABLES.category_subcategories)
        .select("id,category_id,category_name,name,color,sort_order,is_active,created_at,updated_at")
        .eq("user_id", uid)
        .order("category_name", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []).map((row, idx) => ({
        id: row.id || null,
        categoryId: row.category_id || null,
        categoryName: String(row.category_name || "").trim(),
        name: String(row.name || "").trim(),
        color: row.color || null,
        sortOrder: Number(row.sort_order ?? idx),
        isActive: row.is_active !== false,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      })).filter((row) => row.categoryName && row.name);
    } catch (e) {
      console.warn("[RR subcategories] db fetch failed", e?.message || e);
      return [];
    }
  }

  async function _rrEnsureSubcategoriesLoaded() {
    if (Array.isArray(state?.categorySubcategories) && state.categorySubcategories.length) return state.categorySubcategories;
    const rows = await _rrFetchDbSubcategories();
    if (rows.length) {
      state.categorySubcategories = rows;
      try {
        if (typeof window.normalizeAppState === "function") window.normalizeAppState();
        else if (typeof normalizeAppState === "function") normalizeAppState();
      } catch (_) {}
    }
    return Array.isArray(state?.categorySubcategories) ? state.categorySubcategories : [];
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
    const wantedCategory = _rrTextKey(categoryName);
    const rows = [];
    const seen = new Set();
    const push = (row) => {
      const name = String(row?.name || row?.subcategory || "").trim();
      if (!name) return;
      const key = _rrTextKey(name);
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        name,
        sortOrder: Number(row?.sortOrder ?? row?.sort_order ?? 9999),
        isActive: row?.isActive !== false && row?.is_active !== false,
      });
    };
    try {
      if (typeof getCategorySubcategories === 'function') {
        (getCategorySubcategories(categoryName, { activeOnly: true }) || []).forEach(push);
      }
    } catch (_) {}
    (Array.isArray(state?.categorySubcategories) ? state.categorySubcategories : [])
      .filter((row) => _rrTextKey(row?.categoryName || row?.category_name) === wantedCategory)
      .filter((row) => row?.isActive !== false && row?.is_active !== false)
      .forEach(push);
    (Array.isArray(state?.transactions) ? state.transactions : [])
      .filter((row) => _rrTextKey(row?.category) === wantedCategory)
      .forEach((row) => push({ name: row?.subcategory, sortOrder: 9998, isActive: true }));
    (Array.isArray(state?.recurringRules) ? state.recurringRules : [])
      .filter((row) => _rrTextKey(row?.category) === wantedCategory)
      .forEach((row) => push({ name: row?.subcategory, sortOrder: 9998, isActive: true }));
    rows.sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' }));
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

  function _rrComputeFirstDueDate(ruleType, startDate, weekday, monthday, intervalCount = 1) {
    const pure = window.Core?.subscriptionRules?.computeFirstSubscriptionDueDate;
    if (typeof pure === "function") return pure({ ruleType, startDate, weekday, monthday, intervalCount });
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
      if (delta > 0 && Number(intervalCount || 1) > 1) {
        due.setUTCDate(due.getUTCDate() + (7 * Number(intervalCount)));
      }
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

      const next = new Date(Date.UTC(y, (m - 1) + Math.max(1, Number(intervalCount || 1)), 1));
      const ny = next.getUTCFullYear();
      const nm = next.getUTCMonth() + 1;
      const ndim = _rrDaysInMonth(ny, nm);
      return _rrISOFromParts(ny, nm, Math.min(md, ndim));
    }

    if (ruleType === "monthly" || ruleType === "yearly") return startDate;
    return startDate;
  }

  function _rrFreqLabel(rule) {
    const type = String(rule?.ruleType || rule?.rule_type || "").toLowerCase();
    const every = Number(rule?.intervalCount || rule?.interval_count || 1) || 1;
    if (type === "daily") return every === 1 ? rrT("recurring.freq.daily_label") : rrT("recurring.freq.every_days", { count: every });
    if (type === "weekly") return every === 1 ? rrT("recurring.freq.weekly_label") : rrT("recurring.freq.every_weeks", { count: every });
    if (type === "monthly") return every === 1 ? rrT("recurring.freq.monthly_label") : rrT("recurring.freq.every_months", { count: every });
    if (type === "every_x_months") return every === 1 ? rrT("recurring.freq.monthly_label") : rrT("recurring.freq.every_months", { count: every });
    if (type === "yearly") return every === 1 ? rrT("recurring.freq.yearly_label") : rrT("recurring.freq.every_years", { count: every });
    return type || "—";
  }

  function _rrBindAddButton(host) {
    const addBtn = host?.querySelector?.("#tb-recurring-add-btn");
    if (addBtn) {
      addBtn.onclick = () => safeCall(rrT("recurring.title"), async () => {
        window.openRecurringRuleModal();
      });
    }
  }

  function _rrWalletOptions() {
    const tid = String(state?.activeTravelId || "");
    return (state?.wallets || []).filter((w) => String(w?.travelId || w?.travel_id || "") === tid);
  }

  function _rrEnsureSubscriptionsBox() {
    return document.getElementById("subscriptions-root");
  }

  async function _rrCreateRule(payload) {
    const s = _rrGetSB();
    if (!s) throw new Error("Supabase non prêt.");
    const tid = String(state?.activeTravelId || "");
    if (!tid) throw new Error("Voyage actif requis.");
    const rpcName = TB_CONST?.RPCS?.save_subscription_rule_v3 || "save_subscription_rule_v3";
    const { data, error } = await s.rpc(rpcName, {
      p_rule_id: null, p_travel_id: tid, p_wallet_id: payload.wallet_id,
      p_label: payload.label, p_tracking_only: !!payload.tracking_only,
      p_type: payload.type, p_amount: payload.amount, p_currency: payload.currency,
      p_category: payload.category || null, p_subcategory: payload.subcategory || null,
      p_rule_type: payload.rule_type, p_interval_count: payload.interval_count,
      p_weekday: payload.weekday, p_monthday: payload.monthday,
      p_start_date: payload.start_date, p_end_date: payload.end_date || null,
      p_max_occurrences: payload.max_occurrences, p_out_of_budget: !!payload.out_of_budget,
    });
    if (error) throw error;
    return String(data || "");
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
      tracking_only: rule ? !!(r.trackingOnly ?? r.tracking_only) : true,
      type: String(r.type || "expense").trim() || "expense",
      amount: Number(r.amount || 0) || 0,
      currency: String(r.currency || fallbackCurrency || "EUR").trim().toUpperCase(),
      wallet_id: String(r.walletId || r.wallet_id || "").trim(),
      category: String(r.category || "").trim(),
      subcategory: String(r.subcategory || "").trim(),
      rule_type: String(r.ruleType || r.rule_type || (rule ? "every_x_months" : "monthly")).trim() || "monthly",
      interval_count: Math.max(1, Number(r.intervalCount || r.interval_count || 1) || 1),
      weekday: (r.weekday === null || r.weekday === undefined) ? "1" : String(r.weekday),
      monthday: (r.monthday === null || r.monthday === undefined) ? "" : String(r.monthday),
      start_date: String(r.startDate || r.start_date || "").slice(0, 10),
      end_date: String(r.endDate || r.end_date || "").slice(0, 10),
      max_occurrences: (r.maxOccurrences === null || r.maxOccurrences === undefined || r.max_occurrences === null || r.max_occurrences === undefined) ? "" : String(r.maxOccurrences || r.max_occurrences),
      out_of_budget: !!(r.outOfBudget || r.out_of_budget),
    };
  }

  async function _rrUpdateRule(ruleId, payload) {
    const s = _rrGetSB();
    if (!s) throw new Error("Supabase non prêt.");
    const rid = String(ruleId || "").trim();
    if (!_rrIsUuid(rid)) throw new Error("UUID de règle invalide.");

    const tid = String(state?.activeTravelId || "");
    const rpcName = TB_CONST?.RPCS?.save_subscription_rule_v3 || "save_subscription_rule_v3";
    const { error } = await s.rpc(rpcName, {
      p_rule_id: rid, p_travel_id: tid, p_wallet_id: payload.wallet_id,
      p_label: payload.label, p_tracking_only: !!payload.tracking_only,
      p_type: payload.type, p_amount: payload.amount, p_currency: payload.currency,
      p_category: payload.category || null, p_subcategory: payload.subcategory || null,
      p_rule_type: payload.rule_type, p_interval_count: payload.interval_count,
      p_weekday: payload.weekday, p_monthday: payload.monthday,
      p_start_date: payload.start_date, p_end_date: payload.end_date || null,
      p_max_occurrences: payload.max_occurrences, p_out_of_budget: !!payload.out_of_budget,
    });
    if (error) throw error;
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
    const preview = document.getElementById("rr-schedule-preview");
    const startDate = document.getElementById("rr-start-date");
    if (!ruleType || !interval || !weekdayWrap || !monthdayWrap || !help) return;

    const apply = () => {
      const type = String(ruleType.value || "every_x_months");
      weekdayWrap.style.display = (type === "weekly") ? "" : "none";
      monthdayWrap.style.display = (type === "every_x_months") ? "" : "none";

      if (type === "daily") {
        help.textContent = rrT("recurring.help.daily");
      } else if (type === "weekly") {
        help.textContent = rrT("recurring.help.weekly");
      } else if (type === "every_x_months") {
        help.textContent = rrT("recurring.help.monthly");
      } else if (type === "yearly") {
        help.textContent = rrT("recurring.help.yearly");
      } else {
        help.textContent = "";
      }
      if (preview) {
        const first = _rrComputeFirstDueDate(type, startDate?.value || "", document.getElementById("rr-weekday")?.value, document.getElementById("rr-monthday")?.value, interval.value);
        preview.innerHTML = `<strong>Première échéance calculée : ${escapeHTML(first || "—")}</strong><span>La date de début est une borne; le jour choisi détermine la première échéance.</span>`;
      }
    };

    ruleType.addEventListener("change", apply);
    interval.addEventListener("input", apply);
    startDate?.addEventListener("change", apply);
    document.getElementById("rr-weekday")?.addEventListener("change", apply);
    document.getElementById("rr-monthday")?.addEventListener("input", apply);
    apply();
  }

  function _rrBindTrackingModeUi() {
    const mode = document.getElementById("rr-tracking-mode");
    const automaticFields = document.getElementById("rr-automatic-fields");
    const help = document.getElementById("rr-mode-help");
    if (!mode || !automaticFields) return;
    const render = () => {
      const trackingOnly = mode.value === "tracking";
      automaticFields.hidden = trackingOnly;
      if (help) help.textContent = trackingOnly
        ? rrT("recurring.help.tracking")
        : rrT("recurring.help.automatic");
    };
    mode.addEventListener("change", render);
    render();
  }

  function _rrBindBudgetPeriodUi() {
    const start = document.getElementById("rr-start-date");
    const end = document.getElementById("rr-end-date");
    const summary = document.getElementById("rr-budget-period-summary");
    const formatter = window.Core?.recurringRules?.formatRecurringPeriodCoverage;
    if (!start || !end || !summary || typeof formatter !== "function") return;
    const render = () => {
      summary.textContent = formatter({
        periods: state?.periods || [],
        travelId: state?.activeTravelId || "",
        startDate: start.value,
        endDate: end.value || start.value,
      }, typeof window.tbGetLang === "function" ? window.tbGetLang() : "fr");
    };
    start.addEventListener("change", render);
    end.addEventListener("change", render);
    render();
  }

  function _rrEnsureModal() {
    let handle = null;
    let title = "Modal";
    let body = "";
    let actions = [];
    let initialFocus = "input:not([disabled]),select:not([disabled]),textarea:not([disabled])";
    let closingProgrammatically = false;

    return {
      open() {
        if (!window.UI?.createModal) throw new Error("Composant de fenetre indisponible.");
        handle = window.UI.createModal({
          id: "tb-recurring-shared-modal",
          size: "lg",
          panelClass: "tb-settings-shared-modal tb-recurring-shared-modal",
          title,
          contentHTML: `<div class="tb-settings-modal-form">${body}</div>`,
          actionsHTML: actions.map((action, index) => `
            <button class="${escapeHTML(action.className || "btn")}" type="button" data-tb-recurring-modal-action="${index}">${escapeHTML(action.label || "")}</button>
          `).join(""),
          initialFocus,
          closeLabel: "Fermer",
          onClose() {
            handle = null;
            closingProgrammatically = false;
          }
        });
        handle.root.querySelectorAll("[data-tb-recurring-modal-action]").forEach((button) => {
          button.addEventListener("click", async () => {
            const action = actions[Number(button.dataset.tbRecurringModalAction)];
            if (!action) return;
            button.disabled = true;
            try { await action.onClick?.(); }
            catch (err) {
              console.error(err);
              _tbToastOk(err?.message || String(err));
            } finally {
              if (button.isConnected) button.disabled = false;
            }
          });
        });
      },
      close() {
        if (!handle) return;
        closingProgrammatically = true;
        handle.close();
      },
      setTitle(value) { title = String(value || "Modal"); },
      setBody(html) { body = String(html || ""); },
      setActions(buttons) { actions = Array.isArray(buttons) ? buttons : []; },
      setInitialFocus(selector) { initialFocus = selector || initialFocus; }
    };
  }

  window.openRecurringRuleModal = async function openRecurringRuleModal(ruleToEdit) {
    const wallets = _rrWalletOptions();
    if (!wallets.length) throw new Error("Aucun wallet disponible sur le voyage actif.");

    const activeTravel = (state?.travels || []).find((t) => String(t.id) === String(state?.activeTravelId || ""));
    const baseCur = String(activeTravel?.base_currency || state?.period?.baseCurrency || "EUR").toUpperCase();
    const fetchedCats = await _rrCategoryOptions();
    const cats = Array.isArray(fetchedCats) ? fetchedCats.slice() : [];
    if (!cats.length) cats.push(...((state?.categories || []).map((c)=> typeof c === 'string' ? c : (c?.name || c?.label || c?.category || '')).filter(Boolean)));
    await _rrEnsureSubcategoriesLoaded();
    const modal = _rrEnsureModal();
    if (!modal) throw new Error("Modal indisponible.");
    const today = _tbISO(new Date());
    const defaults = _rrRuleToFormDefaults(ruleToEdit || null, String(wallets[0]?.currency || baseCur || "EUR").toUpperCase());
    const isEditing = !!(ruleToEdit && ruleToEdit.id);

    modal.setTitle(isEditing ? rrT("recurring.modal.edit") : rrT("recurring.modal.new"));
    modal.setBody(`
      <div class="tb-modal-grid">
        <div class="tb-modal-section"><div class="tb-modal-section-title">${escapeHTML(rrT("recurring.section.essential"))}</div></div>
        <div class="field field--span-2">
          <label>${escapeHTML(rrT("recurring.label.name"))}</label>
          <input id="rr-label" value="${escapeHTML(defaults.label)}" placeholder="${escapeHTML(rrT("recurring.placeholder.name"))}" />
        </div>
        <div class="field field--span-2">
          <label>${escapeHTML(rrT("recurring.label.mode"))}</label>
          <select id="rr-tracking-mode">
            <option value="tracking" ${defaults.tracking_only ? "selected" : ""}>${escapeHTML(rrT("recurring.mode.tracking"))}</option>
            <option value="automatic" ${defaults.tracking_only ? "" : "selected"}>${escapeHTML(rrT("recurring.mode.automatic"))}</option>
          </select>
          <small class="muted" id="rr-mode-help"></small>
        </div>
        <div id="rr-automatic-fields" style="grid-column:1/-1;">
        <div class="tb-modal-grid">
        <div class="field field--span-2">
          <label>${escapeHTML(rrT("recurring.label.type"))}</label>
          <select id="rr-type">
            <option value="expense" ${defaults.type === "income" ? "" : "selected"}>${escapeHTML(rrT("recurring.type.expense"))}</option>
            <option value="income" ${defaults.type === "income" ? "selected" : ""}>${escapeHTML(rrT("recurring.type.income"))}</option>
          </select>
        </div>
        <div class="tb-modal-section"><div class="tb-modal-section-title">${escapeHTML(rrT("recurring.section.amount"))}</div></div>
        <div class="field field--span-3">
          <label>${escapeHTML(rrT("recurring.label.amount"))}</label>
          <input id="rr-amount" type="number" min="0" step="0.01" value="${escapeHTML(defaults.amount)}" />
        </div>
        <div class="field field--span-3">
          <label>${escapeHTML(rrT("recurring.label.currency"))}</label>
          <input id="rr-currency" value="${escapeHTML(defaults.currency)}" />
        </div>
        <div class="field field--span-3">
          <label>${escapeHTML(rrT("recurring.label.wallet"))}</label>
          <select id="rr-wallet">${wallets.map((w) => `<option value="${escapeHTML(w.id)}" data-cur="${escapeHTML(String(w.currency || '').toUpperCase())}" ${String(w.id) === String(defaults.wallet_id) ? "selected" : ""}>${escapeHTML(w.name || "Wallet")} — ${escapeHTML(String(w.currency || '').toUpperCase())}</option>`).join("")}</select>
        </div>
        <div class="field field--span-3">
          <label>${escapeHTML(rrT("recurring.label.budget_impact"))}</label>
          <select id="rr-budget-mode">
            <option value="budget" ${defaults.out_of_budget ? "" : "selected"}>${escapeHTML(rrT("recurring.budget.in"))}</option>
            <option value="out" ${defaults.out_of_budget ? "selected" : ""}>${escapeHTML(rrT("recurring.budget.out"))}</option>
          </select>
        </div>
        <div class="tb-modal-section"><div class="tb-modal-section-title">${escapeHTML(rrT("recurring.section.classification"))}</div></div>
        <div class="field field--span-2">
          <label>${escapeHTML(rrT("recurring.label.category"))}</label>
          <select id="rr-category">${(cats || []).map((c) => `<option value="${escapeHTML(c)}" ${c === defaults.category ? "selected" : ""}>${escapeHTML(c)}</option>`).join("")}</select>
        </div>
        <div class="field field--span-2">
          <label>${escapeHTML(rrT("recurring.label.subcategory"))}</label>
          <select id="rr-subcategory"></select>
        </div>
        <div class="tb-modal-section"><div class="tb-modal-section-title">${escapeHTML(rrT("recurring.section.rhythm"))}</div></div>
        <div class="field field--span-3">
          <label>${escapeHTML(rrT("recurring.label.frequency"))}</label>
          <select id="rr-rule-type">
            <option value="monthly" ${defaults.rule_type === "monthly" ? "selected" : ""}>${escapeHTML(rrT("recurring.freq.monthly"))}</option>
            <option value="weekly" ${defaults.rule_type === "weekly" ? "selected" : ""}>${escapeHTML(rrT("recurring.freq.weekly"))}</option>
            <option value="every_x_months" ${defaults.rule_type === "every_x_months" ? "selected" : ""}>${escapeHTML(rrT("recurring.freq.every_x_months"))}</option>
            <option value="yearly" ${defaults.rule_type === "yearly" ? "selected" : ""}>${escapeHTML(rrT("recurring.freq.yearly"))}</option>
          </select>
        </div>
        <div class="field field--span-3">
          <label>${escapeHTML(rrT("recurring.label.repeat_every"))}</label>
          <input id="rr-interval-count" type="number" min="1" step="1" value="${escapeHTML(String(defaults.interval_count || 1))}" />
        </div>
        <div class="field field--span-3" id="rr-weekday-wrap" style="display:none;">
          <label>${escapeHTML(rrT("recurring.label.weekday"))}</label>
          <select id="rr-weekday">
            <option value="1" ${String(defaults.weekday || "1") === "1" ? "selected" : ""}>${escapeHTML(rrT("recurring.weekday.mon"))}</option>
            <option value="2" ${String(defaults.weekday || "") === "2" ? "selected" : ""}>${escapeHTML(rrT("recurring.weekday.tue"))}</option>
            <option value="3" ${String(defaults.weekday || "") === "3" ? "selected" : ""}>${escapeHTML(rrT("recurring.weekday.wed"))}</option>
            <option value="4" ${String(defaults.weekday || "") === "4" ? "selected" : ""}>${escapeHTML(rrT("recurring.weekday.thu"))}</option>
            <option value="5" ${String(defaults.weekday || "") === "5" ? "selected" : ""}>${escapeHTML(rrT("recurring.weekday.fri"))}</option>
            <option value="6" ${String(defaults.weekday || "") === "6" ? "selected" : ""}>${escapeHTML(rrT("recurring.weekday.sat"))}</option>
            <option value="0" ${String(defaults.weekday || "") === "0" ? "selected" : ""}>${escapeHTML(rrT("recurring.weekday.sun"))}</option>
          </select>
        </div>
        <div class="field field--span-3" id="rr-monthday-wrap">
          <label>${escapeHTML(rrT("recurring.label.monthday"))}</label>
          <input id="rr-monthday" type="number" min="1" max="31" placeholder="1-31" value="${escapeHTML(defaults.monthday)}" />
        </div>
        <div class="field field--span-2"><div class="muted" id="rr-frequency-help" style="margin-top:-2px;"></div></div>
        <div class="field field--span-2"><div class="tb-recurring-schedule-preview" id="rr-schedule-preview" role="status"></div></div>
        <div class="tb-modal-section"><div class="tb-modal-section-title">${escapeHTML(rrT("recurring.section.dates"))}</div></div>
        <div class="field field--span-3">
          <label>${escapeHTML(rrT("recurring.label.start"))}</label>
          <input id="rr-start-date" type="date" value="${escapeHTML(defaults.start_date || today)}" />
        </div>
        <div class="field field--span-3">
          <label>${escapeHTML(rrT("recurring.label.end"))}</label>
          <input id="rr-end-date" type="date" value="${escapeHTML(defaults.end_date)}" />
        </div>
        <div class="field field--span-3">
          <label>${escapeHTML(rrT("recurring.label.max_occurrences"))}</label>
          <input id="rr-max-occurrences" type="number" min="1" step="1" placeholder="${escapeHTML(rrT("recurring.placeholder.optional"))}" value="${escapeHTML(defaults.max_occurrences)}" />
        </div>
        <div class="field field--span-2">
          <div id="rr-budget-period-summary" class="muted" role="status"></div>
        </div>
        </div>
        </div>
      </div>
    `);

    modal.setActions([
      { label: rrT("recurring.action.cancel"), className: "btn", onClick: () => modal.close() },
      {
        label: isEditing ? rrT("recurring.action.save") : rrT("recurring.action.create"),
        className: "btn primary",
        onClick: async () => {
          if (_rrSubmitting) return;
          _rrSubmitting = true;
          try {
            const label = String(document.getElementById("rr-label")?.value || "").trim();
            const tracking_only = String(document.getElementById("rr-tracking-mode")?.value || "tracking") === "tracking";
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
            if (!tracking_only && !(amount > 0)) throw new Error("Saisis un montant supérieur à 0 pour générer les échéances.");
            if (!currency) throw new Error("Devise requise.");
            if (!wallet_id) throw new Error("Wallet requis.");
            if (!tracking_only && !category) throw new Error("Catégorie requise.");
            if (!tracking_only && !start_date) throw new Error("Date de début requise.");
            if (!tracking_only && end_date && end_date < start_date) throw new Error("La date de fin doit être ≥ à la date de début.");
            const coverage = window.Core?.recurringRules?.recurringPeriodCoverage?.({
              periods: state?.periods || [], travelId: state?.activeTravelId || "", startDate: start_date, endDate: end_date || start_date
            });
            if (!tracking_only && coverage && !coverage.covered) throw new Error("Les dates doivent appartenir aux périodes budget du voyage.");

            const weekday = (rule_type === "weekly") ? Number(weekdayRaw) : null;
            const monthday = (rule_type === "every_x_months") ? Number(monthdayRaw || 0) || null : null;
            const next_due_at = _rrComputeFirstDueDate(rule_type, start_date, weekday, monthday, interval_count);

            const payload = {
              label, tracking_only, type, amount: tracking_only ? 0 : amount, currency, wallet_id,
              category, subcategory: subcategory || null,
              rule_type, interval_count, weekday, monthday,
              start_date: tracking_only ? today : start_date,
              next_due_at: tracking_only ? null : next_due_at,
              end_date: tracking_only ? null : (end_date || null),
              max_occurrences: tracking_only || maxOccRaw === "" ? null : Number(maxOccRaw),
              out_of_budget: tracking_only ? false : out_of_budget
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
            _tbToastOk(isEditing ? rrT("recurring.toast.updated") : rrT("recurring.toast.created"));
          } finally {
            _rrSubmitting = false;
          }
        }
      }
    ]);

    modal.open();
    _rrBindTrackingModeUi();
    _rrBindFrequencyUi();
    _rrBindSubcategoryUi(defaults.subcategory || "");
    _rrBindBudgetPeriodUi();

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
  };

  window.renderRecurringRules = function renderRecurringRules() {
    const host = _rrEnsureSubscriptionsBox();
    const view = window.UI?.subscriptionView;
    const rulesCore = window.Core?.subscriptionRules;
    if (!host || typeof view?.renderSubscriptionsModule !== "function" || typeof rulesCore?.buildSubscriptionAnalysis !== "function") return;
    const tid = String(state?.activeTravelId || "");
    const travel = (state?.travels || []).find((row) => String(row?.id || "") === tid) || state?.period || {};
    const startFallback = String(travel?.start || travel?.start_date || travel?.dateStart || "").slice(0, 10);
    const endFallback = String(travel?.end || travel?.end_date || travel?.dateEnd || "").slice(0, 10);
    window.__tbSubscriptionsFilters = window.__tbSubscriptionsFilters || {};
    const filters = window.__tbSubscriptionsFilters;
    filters.tab = ["overview", "occurrences", "associations", "rules"].includes(filters.tab) ? filters.tab : "overview";
    filters.rangePreset = ["period", "last-month", "last-week", "custom"].includes(filters.rangePreset) ? filters.rangePreset : "period";
    filters.startDate = filters.startDate || startFallback;
    filters.endDate = filters.endDate || endFallback;
    filters.type = ["all", "expense", "income"].includes(filters.type) ? filters.type : "all";
    const analysis = rulesCore.buildSubscriptionAnalysis({
      rules: state?.recurringRules || [],
      transactions: state?.transactions || [],
      travelId: tid,
      startDate: filters.startDate,
      endDate: filters.endDate,
      today: _tbISO(new Date()),
      type: filters.type,
    });
    host.innerHTML = view.renderSubscriptionsModule({
      analysis,
      tab: filters.tab,
      detailRuleId: filters.detailRuleId || "",
      startDate: filters.startDate,
      endDate: filters.endDate,
      type: filters.type,
      rangePreset: filters.rangePreset,
      helpers: {
        frequencyLabel: _rrFreqLabel,
        walletName: (rule) => String((state?.wallets || []).find((wallet) => String(wallet.id || "") === String(rule.walletId || rule.wallet_id || ""))?.name || "—"),
      },
    });
    _rrBindAddButton(host);
    host.querySelector("#tb-recurring-add-btn-hero")?.addEventListener("click", () => safeCall(rrT("recurring.modal.new"), window.openRecurringRuleModal));
    host.querySelectorAll("[data-subscription-tab]").forEach((button) => button.addEventListener("click", () => {
      filters.tab = String(button.dataset.subscriptionTab || "overview");
      filters.detailRuleId = "";
      window.renderRecurringRules();
    }));
    host.querySelectorAll("[data-subscription-detail]").forEach((button) => button.addEventListener("click", () => {
      filters.detailRuleId = String(button.dataset.subscriptionDetail || "");
      window.renderRecurringRules();
      host.querySelector("[data-subscription-detail-panel]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    host.querySelector("[data-subscription-detail-close]")?.addEventListener("click", () => {
      filters.detailRuleId = "";
      window.renderRecurringRules();
    });
    host.querySelectorAll("[data-subscription-link-transaction]").forEach((button) => button.addEventListener("click", (event) => safeCall("Rattacher la transaction", async () => {
      const el = event.currentTarget;
      const transactionId = String(el?.dataset?.subscriptionLinkTransaction || "");
      const ruleId = String(el?.dataset?.subscriptionLinkRule || "");
      const tx = (state?.transactions || []).find((row) => String(row?.id || "") === transactionId);
      const rule = (state?.recurringRules || []).find((row) => String(row?.id || "") === ruleId);
      if (!transactionId || !ruleId || !tx || !rule) throw new Error("Transaction ou abonnement introuvable.");
      if (!confirm(`Rattacher « ${String(tx.label || tx.category || "Transaction")} » à « ${String(rule.label || rule.name || "Abonnement")} » ?\n\nCette validation sera mémorisée pour améliorer les prochaines suggestions.`)) return;
      await _rrLinkTransaction(transactionId, ruleId);
      if (typeof window.refreshFromServer === "function") await window.refreshFromServer();
      else if (typeof refreshFromServer === "function") await refreshFromServer();
      window.renderRecurringRules();
      _tbToastOk("Transaction rattachée. La suggestion a été confirmée.");
    })));
    host.querySelector("#subscriptions-start")?.addEventListener("change", (event) => {
      filters.rangePreset = "custom";
      filters.startDate = event.currentTarget.value;
      window.renderRecurringRules();
    });
    host.querySelector("#subscriptions-end")?.addEventListener("change", (event) => {
      filters.rangePreset = "custom";
      filters.endDate = event.currentTarget.value;
      window.renderRecurringRules();
    });
    host.querySelector("#subscriptions-type")?.addEventListener("change", (event) => {
      filters.type = event.currentTarget.value;
      window.renderRecurringRules();
    });
    host.querySelector("#subscriptions-range")?.addEventListener("change", (event) => {
      filters.rangePreset = event.currentTarget.value;
      const range = rulesCore.subscriptionDateRange({
        preset: filters.rangePreset,
        today: _tbISO(new Date()),
        periodStart: startFallback,
        periodEnd: endFallback,
      });
      filters.startDate = range.startDate;
      filters.endDate = range.endDate;
      window.renderRecurringRules();
    });
    host.querySelectorAll("[data-subscription-open-transaction]").forEach((button) => button.addEventListener("click", () => {
      const txId = String(button.dataset.subscriptionOpenTransaction || "");
      if (typeof window.showView === "function") window.showView("transactions");
      if (typeof window.openTxEditModal === "function") window.openTxEditModal(txId);
      else if (typeof openTxEditModal === "function") openTxEditModal(txId);
    }));
    host.querySelectorAll("[data-rr-act]").forEach((btn) => {
      btn.onclick = (ev) => safeCall(rrT("recurring.title"), async () => {
        const el = ev.currentTarget;
        const id = String(el?.dataset?.rrId || "").trim();
        const act = String(el?.dataset?.rrAct || "").trim();
        if (!act) throw new Error("Action introuvable.");

        if (!id) throw new Error("Règle introuvable.");
        if (act === "edit") {
          const rule = (state?.recurringRules || []).find((r) => String(r?.id || '') === id);
          if (!rule) throw new Error('Règle introuvable.');
          window.openRecurringRuleModal(rule);
          return;
        }
        if (act === "pause") {
          await _rrPauseRule(id);
          _tbToastOk(rrT("recurring.toast.paused"));
          return;
        }
        if (act === "resume") {
          await _rrResumeRule(id);
          _tbToastOk(rrT("recurring.toast.resumed"));
          return;
        }
        if (act === "delete") {
          if (!confirm(rrT("recurring.confirm.delete"))) return;
          await _rrArchive(id);
          _tbToastOk(rrT("recurring.toast.deleted"));
          return;
        }
        throw new Error("Action non reconnue.");
      });
    });
  };

  try {
    window.tbOnLangChange = window.tbOnLangChange || [];
    if (!window.__tbRecurringLangBound) {
      window.__tbRecurringLangBound = true;
      window.tbOnLangChange.push(() => {
        try {
          if (typeof window.renderRecurringRules === "function") window.renderRecurringRules();
        } catch (_) {}
      });
    }
  } catch (_) {}
})();
