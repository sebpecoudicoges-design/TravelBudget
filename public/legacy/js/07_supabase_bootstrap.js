/* =========================
   Supabase bootstrap
   ========================= */
async function ensureBootstrap() {
  if (!sbUser) return;

  const today = toLocalISODate(new Date());

  // local defaults
  if (!localStorage.getItem(THEME_KEY)) localStorage.setItem(THEME_KEY, "light");
  if (!localStorage.getItem(PALETTE_KEY)) localStorage.setItem(PALETTE_KEY, JSON.stringify(PALETTES["Ocean"]));
  if (!localStorage.getItem(PRESET_KEY)) localStorage.setItem(PRESET_KEY, "Ocean");

  // 1) Ensure profile row exists (role default: 'user')
  {
    const { data: prof, error: profErr } = await sb
      .from("profiles")
      .select("id, role")
      .eq("id", sbUser.id)
      .maybeSingle();

    if (profErr) throw profErr;

    // expose role globally for navigation/admin UI
    window.sbRole = (prof && prof.role) ? String(prof.role) : (window.sbRole || 'user');

    if (!prof) {
      window.sbRole = 'user';
      const { error: insErr } = await sb.from("profiles").insert([
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
    const { data: s, error: sErr } = await sb.from("settings").select("*").eq("user_id", sbUser.id).maybeSingle();
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

      const { error: insErr } = await sb.from("settings").insert([payload]);
      if (insErr) {
        // schema-cache fallback if palette_preset not deployed yet
        if ((insErr.message || "").includes("palette_preset") && (insErr.message || "").includes("schema cache")) {
          const payloadLite = { ...payload };
          delete payloadLite.palette_preset;
          const { error: ins2 } = await sb.from("settings").insert([payloadLite]);
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
      .from("periods")
      .select("*")
      .eq("user_id", sbUser.id)
      .order("start_date", { ascending: false })
      .limit(1);

    if (pErr) throw pErr;

    if (!periods || periods.length === 0) {
      // Default: 21 days period starting today, base currency THB
      const start = today;
      const end = toLocalISODate(addDays(new Date(), 20));

      const { error: insErr } = await sb.from("periods").insert([
        {
          user_id: sbUser.id,
          start_date: start,
          end_date: end,
          base_currency: "THB",
          eur_base_rate: 36.0,
          daily_budget_base: 900,
        },
      ]);
      if (insErr) throw insErr;
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
    const { data: s, error: sErr } = await sb.from("settings").select("*").eq("user_id", sbUser.id).maybeSingle();
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
    .from("periods")
    .select("*")
    .eq("user_id", sbUser.id)
    .order("start_date", { ascending: false });
  if (pErr) throw pErr;

  const activePeriodId = pickActivePeriod(periods);
  if (!activePeriodId) throw new Error("Aucune période trouvée.");
  localStorage.setItem(ACTIVE_PERIOD_KEY, activePeriodId);

  const p = periods.find((x) => x.id === activePeriodId);
  if (!p) throw new Error("Période active introuvable.");

  const { data: w0, error: wErr } = await sb
    .from("wallets")
    .select("*")
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
    const { error: insWErr } = await sb.from("wallets").insert(initial);
    if (insWErr) throw insWErr;

    const { data: w2, error: w2Err } = await sb
      .from("wallets")
      .select("*")
      .eq("user_id", sbUser.id)
      .eq("period_id", activePeriodId)
      .order("created_at", { ascending: true });
    if (w2Err) throw w2Err;
    w = w2 || [];
  }

  const { data: tx, error: tErr } = await sb
    .from("transactions")
    .select("*")
    .eq("user_id", sbUser.id)
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
    date: x.date_start ? new Date(String(x.date_start) + "T00:00:00").getTime() : new Date(x.created_at).getTime(),
  }));

  state.periods = (periods || []).map((x) => ({
    id: x.id,
    start: x.start_date,
    end: x.end_date,
    baseCurrency: x.base_currency,
  }));

  try {
    if (typeof syncTabsForRole === "function") syncTabsForRole();
  } catch (e) {}

  recomputeAllocations();
}