/* =========================
   Supabase bootstrap
   ========================= */
async function ensureBootstrap() {
  if (!sbUser) return;

  const today = toLocalISODate(new Date());

  // local defaults
  const localPalette = getStoredPalette() || PALETTES["Ocean"];
  const localPreset = getStoredPreset() || findPresetNameForPalette(localPalette);

  // settings legacy NOT NULL + palette defaults
  const legacyDefaults = {
    user_id: sbUser.id,
    period_start: today,
    period_end: today,
    daily_budget_thb: 1000,
    eur_thb_rate: 35,
    theme: localStorage.getItem(THEME_KEY) || "light",
    palette_json: localPalette,
    palette_preset: localPreset,
    updated_at: new Date().toISOString(),
  };
  const { error: setErr } = await sb.from("settings").upsert(legacyDefaults, { onConflict: "user_id" });
  if (setErr) throw setErr;

  // ensure at least one period
  const { data: p0, error: p0Err } = await sb.from("periods").select("id").limit(1);
  if (p0Err) throw p0Err;
  if (!p0 || p0.length === 0) {
    const { error: pInsErr } = await sb.from("periods").insert([{
      user_id: sbUser.id,
      start_date: today,
      end_date: today,
      base_currency: "THB",
      eur_base_rate: 35,
      daily_budget_base: 1000,
    }]);
    if (pInsErr) throw pInsErr;
  }

  // ensure wallets
  const { data: wallets, error: wErr } = await sb.from("wallets").select("id").limit(1);
  if (wErr) throw wErr;
  if (!wallets || wallets.length === 0) {
    const initial = [
      // wallet.type is now used for KPI "Cash cover" and ATM actions
      { user_id: sbUser.id, name: "Cash", currency: "THB", balance: 0, type: "cash" },
      { user_id: sbUser.id, name: "Compte bancaire", currency: "EUR", balance: 0, type: "bank" },
    ];
    const { error: insErr } = await sb.from("wallets").insert(initial);
    if (insErr) throw insErr;
  }
}

function pickActivePeriod(periods) {
  const stored = localStorage.getItem(ACTIVE_PERIOD_KEY);
  if (stored && periods.some((p) => p.id === stored)) return stored;

  const today = toLocalISODate(new Date());
  const inToday = periods.find((p) => today >= p.start_date && today <= p.end_date);
  if (inToday) return inToday.id;

  const sorted = periods.slice().sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
  return sorted[0]?.id || null;
}

async function loadFromSupabase() {
  const { data: s, error: sErr } = await sb.from("settings").select("*").single();
  if (sErr) throw sErr;

  // theme from server
  applyTheme(s.theme || (localStorage.getItem(THEME_KEY) || "light"));

  // ✅ palette/preset from server is source of truth
  const serverPalette = isValidPalette(s.palette_json) ? s.palette_json : null;
  const serverPreset = (s.palette_preset && String(s.palette_preset).trim()) ? String(s.palette_preset).trim() : null;

  if (serverPalette) {
    // apply server palette locally (no remote write)
    await applyPalette(serverPalette, serverPreset || findPresetNameForPalette(serverPalette), { persistLocal: true, persistRemote: false });
  } else {
    // server missing -> push local default to server
    const localPalette = getStoredPalette() || PALETTES["Ocean"];
    const localPreset = getStoredPreset() || findPresetNameForPalette(localPalette);
    await applyPalette(localPalette, localPreset, { persistLocal: true, persistRemote: true });
  }

  
  // ---- categories (server-driven) ----
  try {
    const { data: catRows, error: cErr } = await sb
      .from("categories")
      .select("name,color,sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (!cErr) {
      const rows = catRows || [];
      // bootstrap defaults if empty (first run)
      if (!rows.length) {
        const defaults = (typeof DEFAULT_CATEGORIES !== "undefined" ? DEFAULT_CATEGORIES : ["Repas","Logement","Transport","Sorties","Caution","Autre"])
          .map((name, i) => ({ user_id: sbUser.id, name, color: (DEFAULT_CATEGORY_COLORS && DEFAULT_CATEGORY_COLORS[name]) ? DEFAULT_CATEGORY_COLORS[name] : null, sort_order: i }));
        await sb.from("categories").insert(defaults);
        const { data: catRows2 } = await sb.from("categories").select("name,color,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true });
        state.categories = (catRows2 || []).map(r => r.name);
        state.categoryColors = Object.fromEntries((catRows2 || []).filter(r => r.color).map(r => [r.name, r.color]));
      } else {
        state.categories = rows.map(r => r.name);
        state.categoryColors = Object.fromEntries(rows.filter(r => r.color).map(r => [r.name, r.color]));
      }
    } else {
      // table missing or RLS blocked: fallback to defaults
      state.categories = [];
      state.categoryColors = {};
    }
  } catch (e) {
    state.categories = [];
    state.categoryColors = {};
  }

const { data: periods, error: pErr } = await sb.from("periods").select("*").order("start_date", { ascending: false });
  if (pErr) throw pErr;

  const activePeriodId = pickActivePeriod(periods);
  if (!activePeriodId) throw new Error("Aucune période trouvée.");
  localStorage.setItem(ACTIVE_PERIOD_KEY, activePeriodId);

  const p = periods.find((x) => x.id === activePeriodId);
  if (!p) throw new Error("Période active introuvable.");

  const { data: w, error: wErr } = await sb.from("wallets").select("*").order("created_at", { ascending: true });
  if (wErr) throw wErr;

  const { data: tx, error: tErr } = await sb
    .from("transactions")
    .select("*")
    .eq("period_id", activePeriodId)
    .order("created_at", { ascending: true });
  if (tErr) throw tErr;

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
    // date used by cashflow charts (epoch ms). Prefer date_start if present, else created_at.
    date: x.date_start ? new Date(String(x.date_start) + 'T00:00:00').getTime() : new Date(x.created_at).getTime(),
  }));

  // keep full periods list (needed to map transactions by date)
  state.periods = (periods || []).map((x) => ({ id: x.id, start: x.start_date, end: x.end_date, baseCurrency: x.base_currency }));

  recomputeAllocations();
}

