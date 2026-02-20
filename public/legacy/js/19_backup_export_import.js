/* =========================
   Backup export/import
   ========================= */
const BACKUP_SCHEMA_VERSION = 2;
function walletKey(w) { return `${w.name}__${w.currency}`; }

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportBackup() {
  if (!sbUser) return alert("Non connecté.");
  if (!state.period?.id) return alert("Aucune période active.");

  const palette = getStoredPalette() || PALETTES["Ocean"];
  const preset = getStoredPreset() || findPresetNameForPalette(palette);

  const payload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    period: {
      id: state.period.id,
      start_date: state.period.start,
      end_date: state.period.end,
      base_currency: state.period.baseCurrency,
      eur_base_rate: state.exchangeRates["EUR-BASE"],
      daily_budget_base: state.period.dailyBudgetBase,
    },
    theme: localStorage.getItem(THEME_KEY) || "light",
    palette,
    palettePreset: preset,
    wallets: state.wallets.map((w) => ({ name: w.name, currency: w.currency, balance: Number(w.balance) })),
    transactions: state.transactions.map((tx) => {
      const w = findWallet(tx.walletId);
      return {
        type: tx.type,
        amount: Number(tx.amount),
        currency: tx.currency,
        category: tx.category,
        label: tx.label || "",
        date_start: tx.dateStart,
        date_end: tx.dateEnd,
        pay_now: !!tx.payNow,
        out_of_budget: !!tx.outOfBudget,
        night_covered: !!tx.nightCovered,
        wallet_key: w ? walletKey(w) : null,
      };
    }),
  };

  const json = JSON.stringify(payload);
  try { await navigator.clipboard.writeText(json); } catch {}

  downloadText(`travelbudget-backup-${toLocalISODate(new Date())}.json`, json);
  alert("Backup exporté ✅ (fichier téléchargé + clipboard si possible)");
}

async function importBackup() {
  if (!sbUser) return alert("Non connecté.");
  if (!state.period?.id) return alert("Aucune période active.");

  const raw = prompt("Colle ici le JSON du backup :");
  if (!raw) return;

  let payload;
  try { payload = JSON.parse(raw); }
  catch { return alert("JSON invalide."); }

  // restore palette (and sync to server)
  if (isValidPalette(payload.palette)) {
    const preset = payload.palettePreset || findPresetNameForPalette(payload.palette);
    await applyPalette(payload.palette, preset, { persistLocal: true, persistRemote: true });
  }

  let normalized = { schemaVersion: 2, theme: "light", period: null, wallets: [], transactions: [] };

  if (payload.schemaVersion === 1) {
    const s = payload.settings || {};
    normalized.theme = s.theme || "light";
    normalized.period = {
      start_date: s.period_start,
      end_date: s.period_end,
      base_currency: "THB",
      eur_base_rate: Number(s.eur_thb_rate || 35),
      daily_budget_base: Number(s.daily_budget_thb || 1000),
    };
    normalized.wallets = payload.wallets || [];
    normalized.transactions = payload.transactions || [];
  } else if (payload.schemaVersion >= 2) {
    normalized.theme = payload.theme || "light";
    const p = payload.period || {};
    normalized.period = {
      start_date: p.start_date,
      end_date: p.end_date,
      base_currency: p.base_currency || state.period.baseCurrency,
      eur_base_rate: Number(p.eur_base_rate || state.exchangeRates["EUR-BASE"]),
      daily_budget_base: Number(p.daily_budget_base || state.period.dailyBudgetBase),
    };
    normalized.wallets = payload.wallets || [];
    normalized.transactions = payload.transactions || [];
  } else {
    return alert("Backup incompatible (schemaVersion).");
  }

  if (!normalized.period?.start_date || !normalized.period?.end_date) {
    return alert("Backup invalide : dates de période manquantes.");
  }

  const ok = confirm(
    "⚠️ Import = écrase la période active :\n" +
    "- met à jour dates/devise/taux/budget de la période active\n" +
    "- remplace toutes les transactions de la période active\n" +
    "- met à jour les soldes des wallets (par name+currency)\n\n" +
    "Continuer ?"
  );
  if (!ok) return;

  await safeCall("Import backup", async () => {
    const theme = normalized.theme || localStorage.getItem(THEME_KEY) || "light";
    localStorage.setItem(THEME_KEY, theme);

    const { error: setErr } = await sb.from("settings").upsert({
      user_id: sbUser.id,
      period_start: normalized.period.start_date,
      period_end: normalized.period.end_date,
      daily_budget_thb: 1000,
      eur_thb_rate: 35,
      theme,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (setErr) throw setErr;

    const { error: pErr } = await sb.from("periods").update({
      start_date: normalized.period.start_date,
      end_date: normalized.period.end_date,
      base_currency: normalized.period.base_currency,
      eur_base_rate: Number(normalized.period.eur_base_rate),
      daily_budget_base: Number(normalized.period.daily_budget_base),
      updated_at: new Date().toISOString(),
    }).eq("id", state.period.id);
    if (pErr) throw pErr;

    const { data: srvWallets, error: wErr } = await sb.from("wallets").select("*").order("created_at", { ascending: true });
    if (wErr) throw wErr;

    const keyToId = new Map();
    for (const w of srvWallets || []) keyToId.set(`${w.name}__${w.currency}`, w.id);

    const toCreate = [];
    for (const bw of normalized.wallets || []) {
      const key = `${bw.name}__${bw.currency}`;
      if (!keyToId.has(key)) toCreate.push({ user_id: sbUser.id, name: bw.name, currency: bw.currency, balance: 0 });
    }
    if (toCreate.length) {
      const { error: cErr } = await sb.from("wallets").insert(toCreate);
      if (cErr) throw cErr;

      const { data: srvWallets2, error: wErr2 } = await sb.from("wallets").select("*").order("created_at", { ascending: true });
      if (wErr2) throw wErr2;

      keyToId.clear();
      for (const w of srvWallets2 || []) keyToId.set(`${w.name}__${w.currency}`, w.id);
    }

    for (const bw of normalized.wallets || []) {
      const id = keyToId.get(`${bw.name}__${bw.currency}`);
      if (!id) continue;
      const { error } = await sb.from("wallets").update({ balance: Number(bw.balance) }).eq("id", id);
      if (error) throw error;
    }

    const { error: delErr } = await sb.from("transactions").delete().eq("period_id", state.period.id);
    if (delErr) throw delErr;

    const txs = (normalized.transactions || []).map((t) => {
      const wallet_id = t.wallet_key ? keyToId.get(t.wallet_key) : null;
      if (!wallet_id) return null;
      return {
        user_id: sbUser.id,
        period_id: state.period.id,
        wallet_id,
        type: t.type,
        amount: Number(t.amount),
        currency: t.currency,
        category: t.category,
        label: t.label || "",
        date_start: t.date_start,
        date_end: t.date_end,
        pay_now: !!t.pay_now,
        out_of_budget: !!t.out_of_budget,
        night_covered: !!t.night_covered,
      };
    }).filter(Boolean);

    if (txs.length) {
      const chunkSize = 200;
      for (let i = 0; i < txs.length; i += chunkSize) {
        const chunk = txs.slice(i, i + chunkSize);
        const { error: insErr } = await sb.from("transactions").insert(chunk);
        if (insErr) throw insErr;
      }
    }

    await refreshFromServer();
    alert("Import terminé ✅");
  });
}

