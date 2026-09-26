const round = n => Math.round(n * 100) / 100;
const sum = rows => rows.every(e => Number.isFinite(e.amount)) ? rows.reduce((n, e) => n + Math.round(e.amount * 100), 0) / 100 : null;
const sub = (a, b) => Number.isFinite(a) && Number.isFinite(b) ? round(a - b) : null;
const ratio = (a, b, factor = 100) => Number.isFinite(a) && b > 0 ? round(a / b * factor) : null;
export function financialIndicators(r) {
  const classified = r.entries.filter(e => !['658900', '758900'].includes(e.account) && e.origin !== 'review');
  const financialIncome = sum(r.entries.filter(e => e.kind === 'income' && e.account.startsWith('76')));
  const financialExpense = sum(r.entries.filter(e => e.kind === 'expense' && e.account.startsWith('66')));
  const exceptionalExpense = sum(r.entries.filter(e => e.kind === 'expense' && e.account.startsWith('67')));
  const financialResult = sub(financialIncome, financialExpense);
  const operatingResult = sub(sub(r.result, financialResult), exceptionalExpense === null ? null : -exceptionalExpense);
  const selfFinancing = Number.isFinite(r.result) && Number.isFinite(r.depreciation) ? round(r.result + r.depreciation) : null;
  return { financialIncome, financialExpense, financialResult, exceptionalExpense, operatingResult, selfFinancing,
    netMargin: ratio(r.result, r.income), operatingMargin: ratio(operatingResult, sub(r.income, financialIncome)),
    equityRatio: ratio(r.confirmedEquity, r.totalAssets), debtRatio: ratio(r.liabilities, r.totalAssets),
    cashDebtCoverage: ratio(r.availableCash, r.liabilities, 1), netDebt: sub(r.liabilities, r.cash),
    fixedAssetWeight: ratio(r.netAssets, r.totalAssets), interestCoverage: ratio(operatingResult, financialExpense, 1),
    classificationRate: r.entries.length ? round(classified.length / r.entries.length * 100) : 100
  };
}
