/* =========================
   Wallet adjust
   ========================= */
function tbParseLocaleNumber(input) {
  if (window.Core?.transactionRules?.parseLocaleAmount) {
    return window.Core.transactionRules.parseLocaleAmount(input);
  }
  let s = String(input ?? "").trim();
  if (!s) return NaN;
  s = s.replace(/[\s\u00A0]/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(/,/g, ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) s = s.replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function tbIsISODate(value) {
  if (window.Core?.transactionRules?.isISODate) {
    return window.Core.transactionRules.isISODate(value);
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}
async function tbEnsureWalletAdjustmentCategory() {
  const categoryName = (TB_CONST?.CATS?.wallet_adjustment || "Ajustement wallet");
  const existing = (state?.categories || []).some((c) => String(c?.name || "").trim().toLowerCase() === categoryName.toLowerCase());
  if (existing) return categoryName;

  try {
    const { data, error } = await sb
      .from(TB_CONST.TABLES.categories)
      .select("id,name")
      .eq("user_id", (window.sbUser && sbUser.id) ? sbUser.id : undefined)
      .ilike("name", categoryName)
      .limit(1);
    if (!error && Array.isArray(data) && data.length) return categoryName;
  } catch (_) {}

  let sortOrder = 999;
  const rows = (state?.categories || []).map((c) => Number(c?.sortOrder ?? c?.sort_order)).filter(Number.isFinite);
  if (rows.length) sortOrder = Math.max(...rows) + 1;
  const { error } = await sb.from(TB_CONST.TABLES.categories).insert({
    user_id: (window.sbUser && sbUser.id) ? sbUser.id : undefined,
    name: categoryName, color: '#64748b', sort_order: sortOrder,
  });
  if (error && error.code !== '23505' && error.status !== 409) throw error;
  return categoryName;
}
async function adjustWalletBalance(walletId) {
  await safeCall("Ajuster solde", async () => {
    const w = findWallet(walletId);
    if (!w) throw new Error("Wallet introuvable.");
    const effectiveNow = (typeof window.tbGetWalletEffectiveBalance === "function") ? Number(window.tbGetWalletEffectiveBalance(walletId) || 0) : Number(w.balance || 0);
    const raw = prompt(`Nouveau solde RÉEL pour "${w.name}" (${w.currency}) :\n\nUn ajustement historisé sera créé sous forme de transaction.`, String(effectiveNow));
    if (raw === null) return;
    const targetBalance = tbParseLocaleNumber(raw);
    if (!Number.isFinite(targetBalance)) throw new Error("Nombre invalide.");
    const defaultDate = (typeof window.getDisplayDateISO === 'function' && window.getDisplayDateISO()) || (typeof toLocalISODate === 'function' ? toLocalISODate(new Date()) : new Date().toISOString().slice(0, 10));
    const dateRaw = prompt(`Date de l'ajustement pour "${w.name}" (${w.currency}) :\n\nFormat attendu : YYYY-MM-DD`, defaultDate);
    if (dateRaw === null) return;
    const cashDate = String(dateRaw || '').trim();
    if (!tbIsISODate(cashDate)) throw new Error("Date invalide. Utilise le format YYYY-MM-DD.");
    const delta = Number((targetBalance - effectiveNow).toFixed(2));
    if (Math.abs(delta) < 0.000001) return;
    const categoryName = await tbEnsureWalletAdjustmentCategory();
    const amountAbs = Math.abs(delta);
    const txType = delta >= 0 ? 'income' : 'expense';
    const label = `Ajustement wallet — ${w.name} (${fmtMoney(effectiveNow, w.currency)} → ${fmtMoney(targetBalance, w.currency)})`;
    const payload = window._txBuildApplyV2Args({
      walletId, type: txType, label, amount: amountAbs, currency: w.currency,
      cashDate, dateStart: cashDate, dateEnd: cashDate, budgetDateStart: cashDate, budgetDateEnd: cashDate,
      category: categoryName, subcategory: null, payNow: true, outOfBudget: true, nightCovered: false, affectsBudget: false, tripExpenseId: null, tripShareLinkId: null,
    });
    const { error } = await sb.rpc(TB_CONST.RPCS.apply_transaction_v2 || 'apply_transaction_v2', payload);
    if (error) throw error;
    await refreshFromServer();
  });
}
