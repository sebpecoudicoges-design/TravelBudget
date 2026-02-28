/* =========================
   Supabase bootstrap
   ========================= */

// Date helper (bootstrap local)
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}



// --- First-time onboarding wizard (V6.6.14) ---
function _wizEsc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function getAutoFxEurTo(cur) {
  const c = String(cur || "").trim().toUpperCase();
  if (!c) return null;
  if (c === "EUR") return 1;
  // Single source of truth: Edge Function fx-latest
  const { data, error } = await sb.functions.invoke("fx-latest");
  if (error) throw error;
  const r = Number(data?.rates?.[c]);
  return (Number.isFinite(r) && r > 0) ? r : null;
}

function showFirstTimeWizardModal(defaults) {
  const d = defaults || {};
  return new Promise(function (resolve) {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "999999";
    overlay.style.background = "rgba(0,0,0,.55)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "16px";

    const card = document.createElement("div");
    card.style.width = "min(560px, 100%)";
    card.style.background = "#fff";
    card.style.borderRadius = "14px";
    card.style.boxShadow = "0 10px 30px rgba(0,0,0,.25)";
    card.style.padding = "14px";

    card.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
        '<div style="font-weight:800;font-size:16px;">Créer ton 1er voyage</div>' +
        '<button id="wizClose" style="border:0;background:#eee;border-radius:10px;padding:8px 10px;cursor:pointer;">Annuler</button>' +
      '</div>' +
      '<div style="margin-top:10px;font-size:13px;opacity:.85;">Dates, devise, FX (auto si disponible), puis wallets.</div>' +

      '<div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
        '<label style="display:flex;flex-direction:column;gap:6px;font-size:12px;">Début' +
          '<input id="wizStart" type="date" style="padding:10px;border:1px solid #ddd;border-radius:10px;" value="' + _wizEsc(d.start || "") + '">' +
        '</label>' +
        '<label style="display:flex;flex-direction:column;gap:6px;font-size:12px;">Fin' +
          '<input id="wizEnd" type="date" style="padding:10px;border:1px solid #ddd;border-radius:10px;" value="' + _wizEsc(d.end || "") + '">' +
        '</label>' +
        '<label style="display:flex;flex-direction:column;gap:6px;font-size:12px;">Devise (base)' +
          '<input id="wizCur" placeholder="THB" style="padding:10px;border:1px solid #ddd;border-radius:10px;text-transform:uppercase;" value="' + _wizEsc(d.baseCurrency || "THB") + '">' +
        '</label>' +
        '<label style="display:flex;flex-direction:column;gap:6px;font-size:12px;">Budget / jour (base)' +
          '<input id="wizDaily" type="number" step="0.01" style="padding:10px;border:1px solid #ddd;border-radius:10px;" value="' + _wizEsc(String((d.dailyBudgetBase !== undefined) ? d.dailyBudgetBase : 900)) + '">' +
        '</label>' +
      '</div>' +

      '<div style="margin-top:12px;padding:10px;border:1px solid #eee;border-radius:12px;">' +
        '<div style="font-weight:700;font-size:13px;">FX (1 EUR = X BASE)</div>' +
        '<div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">' +
          '<button id="wizFetchEcb" style="border:0;background:#111;color:#fff;border-radius:10px;padding:10px 12px;cursor:pointer;">Auto (FX)</button>' +
          '<input id="wizRate" type="number" step="0.000001" placeholder="Ex: 36.642" style="flex:1;min-width:180px;padding:10px;border:1px solid #ddd;border-radius:10px;" value="' + _wizEsc(d.eurBaseRate ? String(d.eurBaseRate) : "") + '">' +
        '</div>' +
        '<div id="wizFxHint" style="margin-top:6px;font-size:12px;opacity:.8;"></div>' +
      '</div>' +

      '<div style="margin-top:12px;padding:10px;border:1px solid #eee;border-radius:12px;">' +
        '<div style="font-weight:700;font-size:13px;">Wallets init</div>' +

        '<label style="margin-top:8px;display:flex;align-items:center;gap:8px;font-size:13px;">' +
          '<input id="wizHasCash" type="checkbox" ' + (d.hasCash ? "checked" : "") + '>J’ai du cash' +
        '</label>' +
        '<div id="wizCashRow" style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:10px;opacity:.55;">' +
          '<input id="wizCashAmt" type="number" step="0.01" placeholder="Montant cash" style="padding:10px;border:1px solid #ddd;border-radius:10px;" value="' + _wizEsc(String((d.cashAmount !== undefined) ? d.cashAmount : "")) + '">' +
          '<input id="wizCashCur" placeholder="Devise cash (ex: THB)" style="padding:10px;border:1px solid #ddd;border-radius:10px;text-transform:uppercase;" value="' + _wizEsc(d.cashCurrency || "") + '">' +
        '</div>' +

        '<label style="margin-top:10px;display:flex;align-items:center;gap:8px;font-size:13px;">' +
          '<input id="wizHasBank" type="checkbox" ' + (d.hasBank ? "checked" : "") + '>J’ai un compte bancaire' +
        '</label>' +
        '<div id="wizBankRow" style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:10px;opacity:.55;">' +
          '<input id="wizBankAmt" type="number" step="0.01" placeholder="Solde banque" style="padding:10px;border:1px solid #ddd;border-radius:10px;" value="' + _wizEsc(String((d.bankAmount !== undefined) ? d.bankAmount : "")) + '">' +
          '<input id="wizBankCur" placeholder="Devise banque (ex: EUR)" style="padding:10px;border:1px solid #ddd;border-radius:10px;text-transform:uppercase;" value="' + _wizEsc(d.bankCurrency || "EUR") + '">' +
        '</div>' +
      '</div>' +

      '<div style="margin-top:14px;display:flex;gap:10px;justify-content:flex-end;">' +
        '<button id="wizCreate" style="border:0;background:#0b74ff;color:#fff;border-radius:12px;padding:10px 14px;font-weight:700;cursor:pointer;">Créer</button>' +
      '</div>';

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    function $(sel) { return card.querySelector(sel); }

    function syncWalletRows() {
      const cashOn = !!$("#wizHasCash").checked;
      const bankOn = !!$("#wizHasBank").checked;

      $("#wizCashRow").style.opacity = cashOn ? "1" : ".55";
      $("#wizBankRow").style.opacity = bankOn ? "1" : ".55";
      $("#wizCashAmt").disabled = !cashOn;
      $("#wizCashCur").disabled = !cashOn;
      $("#wizBankAmt").disabled = !bankOn;
      $("#wizBankCur").disabled = !bankOn;
    }
    syncWalletRows();
    $("#wizHasCash").addEventListener("change", syncWalletRows);
    $("#wizHasBank").addEventListener("change", syncWalletRows);

    $("#wizClose").addEventListener("click", function () {
      overlay.remove();
      resolve(null);
    });

    $("#wizFetchEcb").addEventListener("click", async function () {
      const cur = String($("#wizCur").value || "").trim().toUpperCase();
      $("#wizFxHint").textContent = "Recherche FX…";
      try {
        const r = await getAutoFxEurTo(cur);
        if (!r) {
          $("#wizFxHint").textContent = "FX: taux introuvable pour " + cur + " → saisie manuelle.";
          return;
        }
        $("#wizRate").value = String(r);
        $("#wizFxHint").textContent = "FX OK: 1 EUR = " + r + " " + cur;
      } catch (e) {
        console.warn(e);
        $("#wizFxHint").textContent = "FX inaccessible → saisie manuelle.";
      }
    });

    $("#wizCreate").addEventListener("click", function () {
      const start = String($("#wizStart").value || "").trim();
      const end = String($("#wizEnd").value || "").trim();
      const baseCurrency = String($("#wizCur").value || "").trim().toUpperCase();
      const dailyBudgetBase = Number($("#wizDaily").value);
      const eurBaseRate = Number($("#wizRate").value);

      if (!start || !end) return alert("Dates obligatoires.");
      if (end < start) return alert("La date de fin doit être >= début.");
      if (!baseCurrency || baseCurrency.length !== 3) return alert("Devise invalide (3 lettres).");
      if (!(Number.isFinite(dailyBudgetBase) && dailyBudgetBase >= 0)) return alert("Budget/jour invalide.");
      if (baseCurrency !== "EUR" && !(Number.isFinite(eurBaseRate) && eurBaseRate > 0)) {
        return alert("FX requis: 1 EUR = X " + baseCurrency);
      }

      const hasCash = !!$("#wizHasCash").checked;
      const cashAmount = Number($("#wizCashAmt").value);
      const cashCurrency = String($("#wizCashCur").value || "").trim().toUpperCase() || baseCurrency;

      const hasBank = !!$("#wizHasBank").checked;
      const bankAmount = Number($("#wizBankAmt").value);
      const bankCurrency = String($("#wizBankCur").value || "").trim().toUpperCase() || "EUR";

      overlay.remove();
      resolve({
        start: start,
        end: end,
        baseCurrency: baseCurrency,
        eurBaseRate: (baseCurrency === "EUR") ? 1 : eurBaseRate,
        dailyBudgetBase: dailyBudgetBase,
        fxMode: (baseCurrency === "EUR") ? "fixed" : (Number.isFinite(eurBaseRate) ? "live" : "fixed"),
        wallets: {
          cash: hasCash ? { name: "Cash", type: "cash", currency: cashCurrency, balance: Number.isFinite(cashAmount) ? cashAmount : 0 } : null,
          bank: hasBank ? { name: "Compte bancaire", type: "bank", currency: bankCurrency, balance: Number.isFinite(bankAmount) ? bankAmount : 0 } : null
        }
      });
    });
  });
}

async function runFirstTimeWizard() {
  const today = toLocalISODate(new Date());
  const defaults = {
    start: today,
    end: toLocalISODate(addDays(new Date(), 20)),
    baseCurrency: "THB",
    dailyBudgetBase: 900,
    eurBaseRate: "",
    hasCash: true,
    cashAmount: 0,
    cashCurrency: "THB",
    hasBank: true,
    bankAmount: 0,
    bankCurrency: "EUR"
  };
  return await showFirstTimeWizardModal(defaults);
}
// --- end onboarding wizard ---

async function ensureBootstrap() {
  if (!sbUser) return;

  // === Schema version guard (V6.5) ===
  // Prevent silent breakage when UI code and DB migrations are out of sync.
  try {
    const expected = (window.TB_CONST && TB_CONST.EXPECTED_SCHEMA_VERSION) ? TB_CONST.EXPECTED_SCHEMA_VERSION : null;
    if (expected) {
      const { data: sv, error: svErr } = await sb
        .from(TB_CONST.TABLES.schema_version)
        .select("key, version")
        .eq("key", "travelbudget")
        .maybeSingle();
      if (svErr) {
        // table missing / RLS / other
        window.__errorBus && __errorBus.push && __errorBus.push({ type: "schema_version_check", error: __errorBus.toPlain(svErr) });
        // don't hard crash: Doctor will surface it; UI stays usable in degraded mode
      } else if (sv && (sv.version !== null && sv.version !== undefined) && Number(sv.version) !== Number(expected)) {
        throw new Error(`DB schema_version=${sv.version} != UI expected=${expected}. Migration requise.`);
      }
    }
  } catch (e) {
    if (typeof renderErrorBox === "function") renderErrorBox("Schema", e, "view-dashboard");
    throw e;
  }


  const today = toLocalISODate(new Date());

  // local defaults
  if (!localStorage.getItem(THEME_KEY)) localStorage.setItem(THEME_KEY, "light");
  if (!localStorage.getItem(PALETTE_KEY)) localStorage.setItem(PALETTE_KEY, JSON.stringify(PALETTES["Ocean"]));
  if (!localStorage.getItem(PRESET_KEY)) localStorage.setItem(PRESET_KEY, "Ocean");

  // 1) Ensure profile row exists (role default: 'user')
  {
    const { data: prof, error: profErr } = await sb
      .from(TB_CONST.TABLES.profiles)
      .select("id, role")
      .eq("id", sbUser.id)
      .maybeSingle();

    if (profErr) throw profErr;

    // expose role globally for navigation/admin UI
    window.sbRole = (prof && prof.role) ? String(prof.role) : (window.sbRole || 'user');

    if (!prof) {
      window.sbRole = 'user';
      const { error: insErr } = await sb.from(TB_CONST.TABLES.profiles).insert([
        {
          id: sbUser.id,
          email: sbUser.email || null,
          role: "user",
        },
      ]);
      if (insErr) throw insErr;
    }
  }

  // 2) Ensure settings row exists (palette persisted server side)
  {
    const { data: s, error: sErr } = await sb.from(TB_CONST.TABLES.settings).select("theme,palette_json,palette_preset").eq("user_id", sbUser.id).maybeSingle();
    if (sErr) throw sErr;

    if (!s) {
      const p = getStoredPalette() || PALETTES["Ocean"];
      const preset = getStoredPreset() || findPresetNameForPalette(p);

      const payload = {
        user_id: sbUser.id,
        theme: localStorage.getItem(THEME_KEY) || "light",
        palette_json: p,
        palette_preset: preset,
        updated_at: new Date().toISOString(),
      };

      const { error: insErr } = await sb.from(TB_CONST.TABLES.settings).insert([payload]);
      if (insErr) {
        // schema-cache fallback if palette_preset not deployed yet
        if ((insErr.message || "").includes("palette_preset") && (insErr.message || "").includes("schema cache")) {
          const payloadLite = { ...payload };
          delete payloadLite.palette_preset;
          const { error: ins2 } = await sb.from(TB_CONST.TABLES.settings).insert([payloadLite]);
          if (ins2) throw ins2;
        } else {
          throw insErr;
        }
      }
    }
  }

  // 3) Ensure at least one period exists
  {
    const { data: periods, error: pErr } = await sb
      .from(TB_CONST.TABLES.periods)
    .select("id,start_date,end_date,base_currency,eur_base_rate,daily_budget_base,updated_at")
      .eq("user_id", sbUser.id)
      .order("start_date", { ascending: false })
      .limit(1);

    if (pErr) throw pErr;

    if (!periods || periods.length === 0) {
  // First-time onboarding wizard
  let cfg = null;
  try { cfg = await runFirstTimeWizard(); } catch (e) { console.warn(e); }

  // If user cancels: keep minimal defaults
  const start = (cfg && cfg.start) ? cfg.start : today;
  const end = (cfg && cfg.end) ? cfg.end : toLocalISODate(addDays(new Date(), 20));
  const baseCur = String((cfg && cfg.baseCurrency) ? cfg.baseCurrency : "THB").toUpperCase();
  const eurBaseRate = (cfg && Number.isFinite(cfg.eurBaseRate)) ? cfg.eurBaseRate : (baseCur === "EUR" ? 1 : 36.0);
  const daily = (cfg && Number.isFinite(cfg.dailyBudgetBase)) ? cfg.dailyBudgetBase : 900;
  const fxMode = (cfg && cfg.fxMode) ? String(cfg.fxMode) : "fixed";

  const { data: p1, error: insErr } = await sb
    .from(TB_CONST.TABLES.periods)
    .insert([{
      user_id: sbUser.id,
      start_date: start,
      end_date: end,
      base_currency: baseCur,
      eur_base_rate: eurBaseRate,
      daily_budget_base: daily
    }])
    .select("*")
    .single();
  if (insErr) throw insErr;

  // Create first segment aligned with the period (if table exists)
  try {
    const segPayload = {
      user_id: sbUser.id,
      period_id: p1.id,
      start_date: start,
      end_date: end,
      base_currency: baseCur,
      daily_budget_base: daily,
      // Single FX source: auto when possible, with eur_base_rate_fixed kept as fallback
      fx_mode: (baseCur === "EUR") ? "fixed" : "live_ecb",
      eur_base_rate_fixed: eurBaseRate,
      sort_order: 0
    };
    const { error: segErr } = await sb.from(TB_CONST.TABLES.budget_segments).insert([segPayload]);
    if (segErr) throw segErr;
  } catch (e) {
    console.warn("[budget_segments] bootstrap failed (ignored)", e && e.message ? e.message : e);
  }

  // Create wallets from wizard choices
  if (cfg && cfg.wallets) {
    const initial = [];
    if (cfg.wallets.cash) initial.push(Object.assign({ user_id: sbUser.id, period_id: p1.id }, cfg.wallets.cash));
    if (cfg.wallets.bank) initial.push(Object.assign({ user_id: sbUser.id, period_id: p1.id }, cfg.wallets.bank));
    if (initial.length > 0) {
      const { error: wErr2 } = await sb.from(TB_CONST.TABLES.wallets).insert(initial);
      if (wErr2) throw wErr2;
    }
  }
}
  }
}

function pickActivePeriod(periods) {
  if (!Array.isArray(periods) || periods.length === 0) return null;

  const stored = localStorage.getItem(ACTIVE_PERIOD_KEY);
  if (stored && periods.some((p) => p.id === stored)) return stored;

  // Default = most recent
  return periods[0].id;
}

async function loadFromSupabase() {
  if (!sbUser) return;

  // settings
  {
    const { data: s, error: sErr } = await sb.from(TB_CONST.TABLES.settings).select("theme,palette_json,palette_preset").eq("user_id", sbUser.id).maybeSingle();
    if (sErr) throw sErr;

    if (s) {
      // theme
      if (s.theme) applyTheme(String(s.theme));

      // palette server wins after login
      const p = s.palette_json || null;
      const preset = s.palette_preset || null;

      if (p && isValidPalette(p)) {
        await applyPalette(p, preset || findPresetNameForPalette(p), { persistLocal: true, persistRemote: false });
      }
    }
  }

  const { data: periods, error: pErr } = await sb
    .from(TB_CONST.TABLES.periods)
    .select("id,start_date,end_date,base_currency,eur_base_rate,daily_budget_base,updated_at")
    .eq("user_id", sbUser.id)
    .order("start_date", { ascending: false });
  if (pErr) throw pErr;

  const activePeriodId = pickActivePeriod(periods);
  if (!activePeriodId) throw new Error("Aucune période trouvée.");
  localStorage.setItem(ACTIVE_PERIOD_KEY, activePeriodId);

  const p = periods.find((x) => x.id === activePeriodId);
  if (!p) throw new Error("Période active introuvable.");

  const { data: w0, error: wErr } = await sb
    .from(TB_CONST.TABLES.wallets)
    .select("id,period_id,name,currency,balance,type,created_at")
    .eq("user_id", sbUser.id)
    .eq("period_id", activePeriodId)
    .order("created_at", { ascending: true });
  if (wErr) throw wErr;

  let w = w0;

  // Auto-bootstrap wallets for this period if missing
  if (!w || w.length === 0) {
    const initial = [
      { user_id: sbUser.id, period_id: activePeriodId, name: "Cash", currency: p.base_currency || "THB", balance: 0, type: "cash" },
      { user_id: sbUser.id, period_id: activePeriodId, name: "Compte bancaire", currency: "EUR", balance: 0, type: "bank" },
    ];
    const { error: insWErr } = await sb.from(TB_CONST.TABLES.wallets).insert(initial);
    if (insWErr) throw insWErr;

    const { data: w2, error: w2Err } = await sb
      .from(TB_CONST.TABLES.wallets)
    .select("id,period_id,name,currency,balance,type,created_at")
      .eq("user_id", sbUser.id)
      .eq("period_id", activePeriodId)
      .order("created_at", { ascending: true });
    if (w2Err) throw w2Err;
    w = w2 || [];
  }

  const { data: tx, error: tErr } = await sb
    .from(TB_CONST.TABLES.transactions)
    .select("id,wallet_id,type,amount,currency,category,label,trip_expense_id,trip_share_link_id,is_internal,date_start,date_end,pay_now,out_of_budget,night_covered,created_at")
    .eq("user_id", sbUser.id)
    .eq("period_id", activePeriodId)
    .order("created_at", { ascending: true });
  if (tErr) throw tErr;


  // budget segments (V6.4)
  let segRows = [];
  try {
    const { data: segs, error: segErr } = await sb
      .from(TB_CONST.TABLES.budget_segments)
      .select("id,period_id,start_date,end_date,base_currency,daily_budget_base,fx_mode,eur_base_rate_fixed,sort_order")
      .eq("user_id", sbUser.id)
      .eq("period_id", activePeriodId)
      .order("sort_order", { ascending: true })
      .order("start_date", { ascending: true });

    if (segErr) throw segErr;
    segRows = segs || [];

    // Auto-bootstrap a default segment if missing
    if (!segRows.length) {
      const { error: insSegErr } = await sb.from(TB_CONST.TABLES.budget_segments).insert([{
        user_id: sbUser.id,
        period_id: activePeriodId,
        start_date: p.start_date,
        end_date: p.end_date,
        base_currency: p.base_currency || "EUR",
        daily_budget_base: Number(p.daily_budget_base) || 0,
        fx_mode: "fixed",
        eur_base_rate_fixed: Number(p.eur_base_rate) || null,
        sort_order: 0,
      }]);
      if (insSegErr) throw insSegErr;

      const { data: segs2, error: seg2Err } = await sb
        .from(TB_CONST.TABLES.budget_segments)
      .select("id,period_id,start_date,end_date,base_currency,daily_budget_base,fx_mode,eur_base_rate_fixed,sort_order")
        .eq("user_id", sbUser.id)
        .eq("period_id", activePeriodId)
        .order("sort_order", { ascending: true })
        .order("start_date", { ascending: true });
      if (seg2Err) throw seg2Err;
      segRows = segs2 || [];
    }
  } catch (e) {
    // If table not deployed yet, keep empty and let ensureStateIntegrity synthesize a segment.
    console.warn("[budget_segments] load failed (ignored)", e?.message || e);
    segRows = [];
  }

  state.period.id = p.id;
  state.period.start = p.start_date;
  state.period.end = p.end_date;
  state.period.baseCurrency = p.base_currency;
  state.period.eurBaseRate = Number(p.eur_base_rate);
  state.period.dailyBudgetBase = Number(p.daily_budget_base);

  state.exchangeRates["EUR-BASE"] = Number(p.eur_base_rate);
  state.exchangeRates["BASE-EUR"] = 1 / Number(p.eur_base_rate);

  state.wallets = (w || []).map((x) => ({
    id: x.id,
    periodId: x.period_id,
    name: x.name,
    currency: x.currency,
    balance: Number(x.balance),
    type: x.type || "other",
  }));

  state.transactions = (tx || []).map((x) => ({
    id: x.id,
    walletId: x.wallet_id,
    type: x.type,
    amount: Number(x.amount),
    currency: x.currency,
    category: x.category,
    label: x.label || "",
    tripExpenseId: x.trip_expense_id || null,
    tripShareLinkId: x.trip_share_link_id || null,
    isInternal: !!(x.is_internal ?? x.isInternal),
    dateStart: x.date_start,
    dateEnd: x.date_end,
    payNow: !!x.pay_now,
    outOfBudget: !!x.out_of_budget,
    nightCovered: !!x.night_covered,
    createdAt: new Date(x.created_at).getTime(),
    date: x.date_start ? new Date(String(x.date_start) + "T00:00:00").getTime() : new Date(x.created_at).getTime(),
  }));

  state.periods = (periods || []).map((x) => ({
    id: x.id,
    start: x.start_date,
    end: x.end_date,
    baseCurrency: x.base_currency,
  }));

  state.budgetSegments = (segRows || []).map((x) => ({
    id: x.id,
    periodId: x.period_id,
    start: x.start_date,
    end: x.end_date,
    baseCurrency: x.base_currency,
    dailyBudgetBase: Number(x.daily_budget_base),
    fxMode: x.fx_mode || "fixed",
    eurBaseRateFixed: (x.eur_base_rate_fixed === null || x.eur_base_rate_fixed === undefined) ? null : Number(x.eur_base_rate_fixed),
    sortOrder: Number(x.sort_order || 0),
  }));

  try {
    if (typeof syncTabsForRole === "function") syncTabsForRole();
  } catch (e) {}

  // categories (Supabase is source of truth)
  try {
    const { data: catRows, error: catErr } = await sb
      .from(TB_CONST.TABLES.categories)
      .select("id,name,color,sort_order")
      .eq("user_id", sbUser.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (catErr) throw catErr;

    const rows = catRows || [];
    const dbNames = rows.map(r => String(r.name || "").trim()).filter(Boolean);
    const txNames = Array.from(new Set((state.transactions || [])
      .map(t => String(t.category || "").trim())
      .filter(Boolean)));

    const seen = new Set(dbNames.map(n => n.toLowerCase()));
    const merged = [...dbNames];
    for (const n of txNames) {
      const k = n.toLowerCase();
      if (!seen.has(k)) {
        merged.push(n);
        seen.add(k);
      }
    }

    // Ensure default system categories exist (even if no transactions yet)
    const REQUIRED_DEFAULT_CATS = ["Mouvement interne"];
    for (const n of REQUIRED_DEFAULT_CATS) {
      const k = String(n).toLowerCase();
      if (!seen.has(k)) {
        merged.push(n);
        seen.add(k);
      }
    }

    state.categories = merged;

    const m = {};
    for (const r of rows) {
      const name = String(r.name || "").trim();
      if (!name) continue;
      if (r.color) m[name] = String(r.color);
    }
    state.categoryColors = m;

    // Optional: auto-seed categories that exist in transactions but not in DB
    if (merged.length > dbNames.length) {
      const maxSort = rows.reduce((mx, r) => Math.max(mx, Number(r.sort_order ?? 0)), 0);
      const dbLower = new Set(dbNames.map(x => x.toLowerCase()));
      const toInsert = merged
        .filter(n => !dbLower.has(n.toLowerCase()))
        .map((name, idx) => ({
          user_id: sbUser.id,
          name,
          color: null,
          sort_order: maxSort + 1 + idx,
        }));
      if (toInsert.length) {
        const { error: insCErr } = await sb.from(TB_CONST.TABLES.categories).insert(toInsert);
        if (insCErr) console.warn("[categories] auto-seed failed (ignored)", insCErr);
      }
    }
  } catch (e) {
    console.warn("[categories] load failed (fallback to local)", e?.message || e);
  }

  recomputeAllocations();
}