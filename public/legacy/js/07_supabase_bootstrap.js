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

async function ensureBootstrap(opts = {}) {
  if (!sbUser) return;
  const refreshToken = Number(opts?.refreshToken || window.__TB_REFRESH_TOKEN__ || 0);
  const today = toLocalISODate(new Date());

  // local defaults
  if (!localStorage.getItem(THEME_KEY)) localStorage.setItem(THEME_KEY, "light");
  if (!localStorage.getItem(PALETTE_KEY)) localStorage.setItem(PALETTE_KEY, JSON.stringify(PALETTES["Ocean"]));
  if (!localStorage.getItem(PRESET_KEY)) localStorage.setItem(PRESET_KEY, "Ocean");

  // === Fast bootstrap: fetch the few required rows in parallel ===
  // Goal: reduce boot latency without changing any business logic.
  // Schema version is read in soft mode: never block the app, but log mismatches explicitly.
  const schemaP = sb
    .from(TB_CONST.TABLES.schema_version)
    .select('key,version,updated_at')
    .eq('key', 'travelbudget')
    .maybeSingle()
    .then((res) => res)
    .catch((error) => ({ data: null, error }));

  const profP = sb
    .from(TB_CONST.TABLES.profiles)
    .select("id, role")
    .eq("id", sbUser.id)
    .maybeSingle();

  const settingsP = sb
    .from(TB_CONST.TABLES.settings)
    .select("theme,palette_json,palette_preset")
    .eq("user_id", sbUser.id)
    .maybeSingle();

  const periodsP = sb
    .from(TB_CONST.TABLES.periods)
    .select("id,start_date,end_date,base_currency,eur_base_rate,daily_budget_base,updated_at")
    .eq("user_id", sbUser.id)
    .order("start_date", { ascending: false })
    .limit(1);

  const [schemaRes, profRes, settingsRes, periodsRes] = await Promise.all([schemaP, profP, settingsP, periodsP]);

  if (schemaRes?.error) {
    console.warn('[schema_version] read failed (soft mode)', schemaRes.error?.message || schemaRes.error);
  } else {
    const dbVersion = Number(schemaRes?.data?.version || 0);
    const expectedVersion = Number(TB_CONST?.EXPECTED_SCHEMA_VERSION || 0);
    if (dbVersion && expectedVersion && dbVersion !== expectedVersion) {
      console.warn(`[schema_version] mismatch db=${dbVersion} expected=${expectedVersion}`);
    }
  }

  if (profRes && profRes.error) throw profRes.error;
  if (settingsRes && settingsRes.error) throw settingsRes.error;
  if (periodsRes && periodsRes.error) throw periodsRes.error;

  const prof = profRes ? profRes.data : null;
  const s = settingsRes ? settingsRes.data : null;
  const periods = periodsRes ? periodsRes.data : null;

  // 1) Ensure profile row exists (role default: 'user')
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

  // 2) Ensure settings row exists (palette persisted server side)
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

  // 3) Ensure at least one period exists
  {
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

// Create travel first
const { data: travelRow, error: travelErr } = await sb
  .from(TB_CONST.TABLES.travels)
  .insert([{
    user_id: sbUser.id,
    name: "Mon voyage",
    start_date: start,
    end_date: end,
    base_currency: baseCur
  }])
  .select("*")
  .single();

if (travelErr) throw travelErr;

// Create first period linked to travel
const { data: p1, error: insErr } = await sb
  .from(TB_CONST.TABLES.periods)
  .insert([{
    user_id: sbUser.id,
    travel_id: travelRow.id,
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

  if (cfg.wallets.cash) {
    initial.push(
      Object.assign(
        {
          user_id: sbUser.id,
          travel_id: travelRow.id,
        },
        cfg.wallets.cash
      )
    );
  }

  if (cfg.wallets.bank) {
    initial.push(
      Object.assign(
        {
          user_id: sbUser.id,
          travel_id: travelRow.id,
        },
        cfg.wallets.bank
      )
    );
  }

  if (initial.length > 0) {
    const { error: wErr2 } = await sb
      .from(TB_CONST.TABLES.wallets)
      .insert(initial);

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

function pickActiveTravel(travels) {
  if (!Array.isArray(travels) || travels.length === 0) return null;

  const key = "travelbudget_active_travel_id_v1";
  const stored = localStorage.getItem(key);
  if (stored && travels.some((t) => t.id === stored)) return stored;

  // Default = most recent
  return travels[0].id;
}

async function loadFromSupabase(opts = {}) {
  if (!sbUser) return;
  const refreshToken = Number(opts?.refreshToken || window.__TB_REFRESH_TOKEN__ || 0);

  // V8.9.4: parallelize the 3 independent bootstrap reads
const settingsPromise = sb
  .from(TB_CONST.TABLES.settings)
  .select("theme,palette_json,palette_preset,base_currency")
  .eq("user_id", sbUser.id)
  .maybeSingle();

const fxManualPromise = sb
  .from(TB_CONST.TABLES.fx_manual_rates)
  .select("currency,rate_to_eur,as_of")
  .eq("user_id", sbUser.id);

const travelsPromise = sb
  .from(TB_CONST.TABLES.travels)
  .select("id,name,start_date,end_date,base_currency,created_at")
  .eq("user_id", sbUser.id)
  .order("start_date", { ascending: false });

const periodsPromise = sb
  .from(TB_CONST.TABLES.periods)
  .select("id,travel_id,start_date,end_date,base_currency,eur_base_rate,daily_budget_base,updated_at")
  .eq("user_id", sbUser.id)
  .order("start_date", { ascending: false });

const [
  { data: s, error: sErr },
  { data: fxm, error: fxmErr },
  { data: travels, error: trErr },
  { data: periods, error: pErr }
] = await Promise.all([
  settingsPromise,
  fxManualPromise,
  travelsPromise,
  periodsPromise
]);

if (sErr) throw sErr;
if (pErr) throw pErr;
if (trErr) throw trErr;

// settings
if (s) {
  if (s.theme) applyTheme(String(s.theme));

  const p = s.palette_json || null;
  const preset = s.palette_preset || null;

  if (p && isValidPalette(p)) {
    await applyPalette(p, preset || findPresetNameForPalette(p), { persistLocal: true, persistRemote: false });
  }

  try {
    const bc = String(s.base_currency || "").trim().toUpperCase();
    if (bc && /^[A-Z]{3}$/.test(bc)) {
      if (!state.user) state.user = {};
      state.user.baseCurrency = bc;
    }
  } catch (_) {}
}

// FX manual fallback (DB-backed)
try {
  if (fxmErr) throw fxmErr;
  const out = {};
  for (const r of (fxm || [])) {
    const c = String(r.currency || "").trim().toUpperCase();
    const rate = Number(r.rate_to_eur);
    const asOf = r.as_of ? String(r.as_of).slice(0, 10) : null;
    if (c && c !== "EUR" && /^[A-Z]{3}$/.test(c) && Number.isFinite(rate) && rate > 0) {
      out[c] = { rate, asOf };
    }
  }
  if (!state.fx) state.fx = {};
  state.fx.manualRates = out;
} catch (e) {
  // Non-blocking (table may not exist yet in some environments)
  console.warn("[fx_manual_rates] load failed (ignored)", e?.message || e);
}

const activeTravelKey = "travelbudget_active_travel_id_v1";
const activeTravelId = pickActiveTravel(travels);
if (!activeTravelId) throw new Error("Aucun voyage trouvé.");
localStorage.setItem(activeTravelKey, activeTravelId);

state.travels = (travels || []).map((x) => ({
  id: x.id,
  name: x.name || "",
  start: x.start_date,
  end: x.end_date,
  baseCurrency: x.base_currency,
}));

state.activeTravelId = activeTravelId;

const periodsForTravel = (periods || []).filter((x) => x.travel_id === activeTravelId);
const activePeriodId = pickActivePeriod(periodsForTravel);
if (!activePeriodId) throw new Error("Aucune période trouvée pour le voyage actif.");
localStorage.setItem(ACTIVE_PERIOD_KEY, activePeriodId);

const p = periodsForTravel.find((x) => x.id === activePeriodId);
if (!p) throw new Error("Période active introuvable.");

  // Perf (A3): fetch independent tables in parallel.
  // - wallets may auto-bootstrap (insert) if missing.
  // - transactions / segments / categories do not depend on wallets.

const walletsPromise = (async () => {
  const { data: w0, error: wErr } = await sb
    .from(TB_CONST.TABLES.wallets)
    .select("id,travel_id,name,currency,balance,type,created_at,balance_snapshot_at")
    .eq("user_id", sbUser.id)
    .eq("travel_id", activeTravelId)
    .order("created_at", { ascending: true });
  if (wErr) throw wErr;

  let w = w0;

  // Auto-bootstrap wallets for this travel if missing
  if (!w || w.length === 0) {
    const initial = [
      { user_id: sbUser.id, travel_id: activeTravelId, period_id: activePeriodId, name: "Cash", currency: p.base_currency || "THB", balance: 0, type: "cash" },
      { user_id: sbUser.id, travel_id: activeTravelId, period_id: activePeriodId, name: "Compte bancaire", currency: "EUR", balance: 0, type: "bank" },
    ];
    const { error: insWErr } = await sb.from(TB_CONST.TABLES.wallets).insert(initial);
    if (insWErr) throw insWErr;

    const { data: w2, error: w2Err } = await sb
      .from(TB_CONST.TABLES.wallets)
      .select("id,travel_id,name,currency,balance,type,created_at,balance_snapshot_at")
      .eq("user_id", sbUser.id)
      .eq("travel_id", activeTravelId)
      .order("created_at", { ascending: true });
    if (w2Err) throw w2Err;
    w = w2 || [];
  }
  return w || [];
})();

  const walletBalancesPromise = (async () => {
    try {
      const { data: rows, error } = await sb
        .from(TB_CONST.TABLES.v_wallet_balances)
        .select("wallet_id,period_id,wallet_currency,baseline_balance,balance_snapshot_at,transactions_delta,effective_balance,included_tx_count,excluded_internal_count,excluded_unpaid_count,excluded_pre_snapshot_count,last_tx_created_at")
        .eq("period_id", activePeriodId)
        .order("wallet_id", { ascending: true });
      if (error) throw error;
      return rows || [];
    } catch (e) {
      console.warn("[v_wallet_balances] load failed (fallback to JS)", e?.message || e);
      return [];
    }
  })();

const txPromise = sb
  .from(TB_CONST.TABLES.transactions)
  .select("id,travel_id,period_id,wallet_id,type,amount,currency,category,subcategory,label,trip_expense_id,trip_share_link_id,is_internal,date_start,date_end,pay_now,out_of_budget,night_covered,created_at,recurring_rule_id,occurrence_date,generated_by_rule,recurring_instance_status")
  .eq("user_id", sbUser.id)
  .eq("travel_id", activeTravelId)
  .order("created_at", { ascending: true });

  const recurringRulesPromise = (async () => {
  try {
    const { data: rows, error } = await sb
      .from(TB_CONST.TABLES.recurring_rules)
      .select("*")
      .eq("user_id", sbUser.id)
      .eq("travel_id", activeTravelId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return rows || [];
  } catch (e) {
    console.warn("[recurring_rules] load failed (ignored)", e?.message || e);
    return [];
  }
})();

  const segPromise = (async () => {
    // budget segments (V6.4)
    let segRows = [];
    try {
      const { data: segs, error: segErr } = await sb
        .from(TB_CONST.TABLES.budget_segments)
        .select("id,period_id,start_date,end_date,base_currency,daily_budget_base,transport_night_budget,fx_mode,eur_base_rate_fixed,sort_order")
        .eq("user_id", sbUser.id)
        .in("period_id", periodsForTravel.map((row) => row.id).filter(Boolean))
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
          transport_night_budget: 400,
          fx_mode: "fixed",
          eur_base_rate_fixed: Number(p.eur_base_rate) || null,
          sort_order: 0,
        }]);
        if (insSegErr) throw insSegErr;

        const { data: segs2, error: seg2Err } = await sb
          .from(TB_CONST.TABLES.budget_segments)
          .select("id,period_id,start_date,end_date,base_currency,daily_budget_base,transport_night_budget,fx_mode,eur_base_rate_fixed,sort_order")
          .eq("user_id", sbUser.id)
          .in("period_id", periodsForTravel.map((row) => row.id).filter(Boolean))
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
    return segRows || [];
  })();

  const catPromise = (async () => {
    try {
      let { data: catRows, error: catErr } = await sb
        .from(TB_CONST.TABLES.categories)
        .select("id,name,color,sort_order")
        .eq("user_id", sbUser.id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (catErr) throw catErr;

      if (!Array.isArray(catRows) || catRows.length === 0) {
        try {
          const seedRpc = TB_CONST?.RPCS?.seed_default_categories_for_user || 'seed_default_categories_for_user';
          const { error: seedCatErr } = await sb.rpc(seedRpc);
          if (seedCatErr) throw seedCatErr;
          const seedMapRpc = TB_CONST?.RPCS?.seed_default_analytic_category_mappings || 'seed_default_analytic_category_mappings';
          await sb.rpc(seedMapRpc);
          const reload = await sb
            .from(TB_CONST.TABLES.categories)
            .select("id,name,color,sort_order")
            .eq("user_id", sbUser.id)
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true });
          if (reload.error) throw reload.error;
          catRows = reload.data || [];
        } catch (seedErr) {
          console.warn('[categories] seed default categories failed', seedErr?.message || seedErr);
        }
      }

      return { rows: (catRows || []), error: null };
    } catch (e) {
      return { rows: [], error: e };
    }
  })();

  const analysisMappingPromise = (async () => {
    try {
      const { data: rows, error } = await sb
        .from(TB_CONST.TABLES.v_transaction_analytic_mapping)
        .select("transaction_id,mapping_id,mapping_status,analytic_family,mapping_source,category,subcategory")
        .eq("user_id", sbUser.id)
        .eq("travel_id", activeTravelId);
      if (error) throw error;
      return { rows: rows || [], available: true };
    } catch (e) {
      console.warn("[v_transaction_analytic_mapping] load failed (fallback to JS)", e?.message || e);
      return { rows: [], available: false };
    }
  })();

  const analysisAuditPromise = (async () => {
    try {
      const { data: rows, error } = await sb
        .from(TB_CONST.TABLES.v_analytic_mapping_audit)
        .select("user_id,category,subcategory,mapping_status,analytic_family,mapping_source,tx_count,expense_count,income_count,expense_amount_sum,income_amount_sum,first_seen_date,last_seen_date")
        .eq("user_id", sbUser.id)
        .order("tx_count", { ascending: false })
        .order("category", { ascending: true });
      if (error) throw error;
      return { rows: rows || [], available: true };
    } catch (e) {
      console.warn("[v_analytic_mapping_audit] load failed (fallback to JS)", e?.message || e);
      return { rows: [], available: false };
    }
  })();

  const analyticMappingRulesPromise = (async () => {
    try {
      const { data: rows, error } = await sb
        .from(TB_CONST.TABLES.analytic_category_mappings)
        .select("id,user_id,category_name,subcategory_name,mapping_status,analytic_family,notes,created_at,updated_at")
        .eq("user_id", sbUser.id)
        .order("category_name", { ascending: true })
        .order("subcategory_name", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return { rows: rows || [], available: true };
    } catch (e) {
      console.warn("[analytic_category_mappings] load failed (settings governance limited)", e?.message || e);
      return { rows: [], available: false };
    }
  })();

  const subcatPromise = (async () => {
    try {
      const { data: rows, error } = await sb
        .from(TB_CONST.TABLES.category_subcategories)
        .select("id,category_id,category_name,name,color,sort_order,is_active,created_at,updated_at")
        .eq("user_id", sbUser.id)
        .order("category_name", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return rows || [];
    } catch (e) {
      console.warn("[category_subcategories] load failed (ignored)", e?.message || e);
      return [];
    }
  })();

const [
  w,
  walletBalanceRows,
  txRes,
  segRows,
  recurringRuleRows,
  categorySubcategoryRows,
  analysisMappingRes,
  analysisAuditRes,
  analyticMappingRulesRes,
  catRes
] = await Promise.all([
  walletsPromise,
  walletBalancesPromise,
  txPromise,
  segPromise,
  recurringRulesPromise,
  subcatPromise,
  analysisMappingPromise,
  analysisAuditPromise,
  analyticMappingRulesPromise,
  catPromise
]);

const { data: tx, error: tErr } = txRes || {};
if (tErr) throw tErr;
const { rows: analysisMappingRows, available: analysisMappingAvailable } = analysisMappingRes || { rows: [], available: false };
const { rows: analysisAuditRows, available: analysisAuditAvailable } = analysisAuditRes || { rows: [], available: false };
const { rows: analyticMappingRuleRows, available: analyticMappingRulesAvailable } = analyticMappingRulesRes || { rows: [], available: false };
const { rows: catRowsDb, error: catLoadErrDb } = catRes || { rows: [], error: null };
if (catLoadErrDb) throw catLoadErrDb;
if (refreshToken !== Number(window.__TB_REFRESH_TOKEN__ || 0)) return;

  state.period.id = p.id;
  state.period.start = p.start_date;
  state.period.end = p.end_date;
  state.period.baseCurrency = p.base_currency;
  state.period.eurBaseRate = Number(p.eur_base_rate);
  state.period.dailyBudgetBase = Number(p.daily_budget_base);

  state.exchangeRates["EUR-BASE"] = Number(p.eur_base_rate);
  state.exchangeRates["BASE-EUR"] = 1 / Number(p.eur_base_rate);

  state.walletBalances = (walletBalanceRows || []).map((x) => ({
    walletId: x.wallet_id,
    periodId: x.period_id,
    walletCurrency: x.wallet_currency,
    baselineBalance: Number(x.baseline_balance || 0),
    balanceSnapshotAt: x.balance_snapshot_at || null,
    transactionsDelta: Number(x.transactions_delta || 0),
    effectiveBalance: Number(x.effective_balance || 0),
    includedTxCount: Number(x.included_tx_count || 0),
    excludedInternalCount: Number(x.excluded_internal_count || 0),
    excludedUnpaidCount: Number(x.excluded_unpaid_count || 0),
    excludedPreSnapshotCount: Number(x.excluded_pre_snapshot_count || 0),
    lastTxCreatedAt: x.last_tx_created_at || null,
  }));
  state.walletBalanceMap = Object.fromEntries((state.walletBalances || []).map((x) => [String(x.walletId || ""), x]));

  state.analysisMappingAvailable = !!analysisMappingAvailable;
  state.analysisAuditAvailable = !!analysisAuditAvailable;
  state.analysisMappingRulesAvailable = !!analyticMappingRulesAvailable;
  state.analysisAuditRows = Array.isArray(analysisAuditRows) ? analysisAuditRows : [];
  state.analyticCategoryMappings = (Array.isArray(analyticMappingRuleRows) ? analyticMappingRuleRows : []).map((x) => ({
    id: x.id,
    userId: x.user_id || null,
    categoryName: x.category_name || null,
    subcategoryName: x.subcategory_name || null,
    mappingStatus: x.mapping_status || 'unmapped',
    analyticFamily: x.analytic_family || null,
    notes: x.notes || null,
    createdAt: x.created_at || null,
    updatedAt: x.updated_at || null,
  }));
  state.analysisMappingByTxId = Object.fromEntries(
    (Array.isArray(analysisMappingRows) ? analysisMappingRows : [])
      .filter((x) => x && x.transaction_id)
      .map((x) => [String(x.transaction_id), {
        transactionId: x.transaction_id,
        mappingId: x.mapping_id || null,
        mappingStatus: x.mapping_status || 'unmapped',
        analyticFamily: x.analytic_family || null,
        mappingSource: x.mapping_source || 'fallback_unmapped',
        category: x.category || null,
        subcategory: x.subcategory || null,
      }])
  );

state.wallets = (w || []).map((x) => ({
  id: x.id,
  travelId: x.travel_id || null,
  name: x.name,
  currency: x.currency,
  balance: Number(x.balance),
  type: x.type || "other",
  balance_snapshot_at: x.balance_snapshot_at || null,
  balanceSnapshotAt: x.balance_snapshot_at || null,
}));

  state.transactions = (tx || []).map((x) => ({
  id: x.id,
  travelId: x.travel_id || null,
  periodId: x.period_id || null,
  walletId: x.wallet_id,
  type: x.type,
  amount: Number(x.amount),
  currency: x.currency,
  category: x.category,
  subcategory: x.subcategory || null,
  label: x.label || "",
  tripExpenseId: x.trip_expense_id || null,
  tripShareLinkId: x.trip_share_link_id || null,
  isInternal: !!(x.is_internal ?? x.isInternal),
  dateStart: x.date_start,
  dateEnd: x.date_end,
  payNow: !!x.pay_now,
  outOfBudget: !!x.out_of_budget,
  nightCovered: !!x.night_covered,

  recurringRuleId: x.recurring_rule_id || null,
  occurrenceDate: x.occurrence_date || null,
  generatedByRule: !!x.generated_by_rule,
  recurringInstanceStatus: x.recurring_instance_status || null,

  analyticMapping: state.analysisMappingByTxId[String(x.id)] || null,

  createdAt: new Date(x.created_at).getTime(),
  date: x.date_start ? new Date(String(x.date_start) + "T00:00:00").getTime() : new Date(x.created_at).getTime(),
}));

  state.periods = (periods || []).map((x) => ({
  id: x.id,
  travelId: x.travel_id || null,
  start: x.start_date,
  end: x.end_date,
  baseCurrency: x.base_currency,
}));

  const periodTravelMap = Object.fromEntries((periods || []).map((row) => [String(row.id), row.travel_id || null]));

  state.budgetSegments = (segRows || []).map((x) => ({
    id: x.id,
    periodId: x.period_id,
    travelId: periodTravelMap[String(x.period_id)] || null,
    start: x.start_date,
    end: x.end_date,
    baseCurrency: x.base_currency,
    dailyBudgetBase: Number(x.daily_budget_base),
    transportNightBudget: (x.transport_night_budget === null || x.transport_night_budget === undefined) ? null : Number(x.transport_night_budget),
    transport_night_budget: (x.transport_night_budget === null || x.transport_night_budget === undefined) ? null : Number(x.transport_night_budget),
    fxMode: x.fx_mode || "fixed",
    eurBaseRateFixed: (x.eur_base_rate_fixed === null || x.eur_base_rate_fixed === undefined) ? null : Number(x.eur_base_rate_fixed),
    sortOrder: Number(x.sort_order || 0),
  }));

  state.recurringRules = (recurringRuleRows || []).map((x) => ({
  id: x.id,
  travelId: x.travel_id || null,
  walletId: x.wallet_id || null,
  periodId: x.period_id || null,

  name: x.name || x.label || "",
  label: x.label || x.name || "",

  type: x.type || null,
  amount: (x.amount === null || x.amount === undefined) ? null : Number(x.amount),
  currency: x.currency || null,
  category: x.category || null,
  subcategory: x.subcategory || null,

  startDate: x.start_date || null,
  endDate: x.end_date || null,
  nextDueAt: x.next_due_at || null,

  isActive: !!x.is_active,
  archived: !!x.archived,
  archivedAt: x.archived_at || null,

  frequency: x.frequency || null,
  intervalCount: x.interval_count || x.interval || null,
  weekday: x.weekday || null,
  monthday: x.monthday || null,

  payNow: !!x.pay_now,
  outOfBudget: !!x.out_of_budget,
  nightCovered: !!x.night_covered,
}));

  state.categorySubcategories = (categorySubcategoryRows || []).map((x) => ({
    id: x.id,
    categoryId: x.category_id || null,
    categoryName: x.category_name || '',
    name: x.name || '',
    color: x.color || null,
    sortOrder: Number(x.sort_order || 0),
    isActive: x.is_active !== false,
    createdAt: x.created_at || null,
    updatedAt: x.updated_at || null,
  }));

  try {
    if (typeof syncTabsForRole === "function") syncTabsForRole();
  } catch (e) {}

  state.categoriesRows = (catRowsDb || []).map((x) => ({ id: x.id, name: x.name, color: x.color || null, sortOrder: Number(x.sort_order || 0) }));

  // categories — DB first, then in-memory transaction fallback, no generic localStorage restore
  try {
    const rows = catRowsDb || [];
    const merged = [];
    const seen = new Set();
    const isTripLike = (name) => /^\s*\[\s*trip\s*\]/i.test(String(name || ""));
    const isPlaceholder = (name) => /^(cat[ée]gorie|category|choisir une cat[ée]gorie)$/i.test(String(name || "").trim());
    const push = (raw) => {
      const name = String(raw || "").trim();
      if (!name) return;
      if (isTripLike(name)) return;
      if (isPlaceholder(name)) return;
      const k = name.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      merged.push(name);
    };

    rows.map((r) => String(r.name || "").trim()).filter(Boolean).forEach(push);

    (state.transactions || []).forEach((t) => {
      const cat = String(t?.category || "").trim();
      if (!cat) return;
      if (t?.tripExpenseId || t?.trip_expense_id) return;
      if (t?.tripShareLinkId || t?.trip_share_link_id) return;
      push(cat);
    });

    push("Mouvement interne");

    state.categories = merged;

    const m = {};
    for (const r of rows) {
      const name = String(r.name || "").trim();
      if (!name) continue;
      if (r.color) m[name] = String(r.color);
    }
    state.categoryColors = m;

    try {
      if (typeof persistCategoriesToLocalStorage === "function") persistCategoriesToLocalStorage();
    } catch (_) {}

    try {
      if (window.tbBus && typeof window.tbBus.emit === "function") {
        window.tbBus.emit("categories:updated", { source: "loadFromSupabase" });
      }
    } catch (_) {}
  } catch (e) {
    console.warn("[categories] merge failed", e?.message || e);
  }

  recomputeAllocations();
}