(function () {
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function tr(t, key) {
    return typeof t === 'function' ? t(key) : key;
  }
  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  function renderCategoryFilterOptions({ categories = [], t, normalizeKey } = {}) {
    const norm = typeof normalizeKey === 'function' ? normalizeKey : (value) => String(value || '').trim().toLowerCase();
    const rows = (Array.isArray(categories) ? categories : [])
      .filter((cat) => norm(cat) !== 'revenu')
      .map((cat) => `<option value="${esc(cat)}">${esc(cat)}</option>`)
      .join('');
    return `<option value="all">${esc(tr(t, 'common.all'))}</option><option value="__income">${esc(tr(t, 'analysis.filter.income'))}</option>${rows}`;
  }
  function renderSubcategoryFilterOptions({ subcategories = [], t } = {}) {
    const rows = (Array.isArray(subcategories) ? subcategories : [])
      .map((sub) => `<option value="${esc(sub)}">${esc(sub)}</option>`)
      .join('');
    return `<option value="all">${esc(tr(t, 'common.all'))}</option><option value="__none__">${esc(tr(t, 'analysis.filter.no_subcategory'))}</option>${rows}`;
  }
  function renderPeriodFilterOptions({ periods = [], activeLabel = 'Période active' } = {}) {
    const rows = (Array.isArray(periods) ? periods : []).map((period, idx) => {
      const id = String(period?.id ?? '');
      const start = String(period?.start ?? '');
      const end = String(period?.end ?? '');
      const base = String(period?.base ?? '').trim().toUpperCase();
      const label = `Période ${idx + 1} • ${start} → ${end}${base ? ' • ' + base : ''}`;
      return `<option value="${esc(id)}">${esc(label)}</option>`;
    }).join('');
    return `<option value="active">${esc(activeLabel)}</option><option value="all">Tout le voyage</option>${rows}<option value="range">Date à date</option>`;
  }
  function buildCategoryExcludeSummary({ total = 0, count = 0 } = {}) {
    const safeTotal = Math.max(0, Math.round(num(total)));
    const safeCount = Math.max(0, Math.round(num(count)));
    if (!safeCount) return safeTotal ? `Aucune catégorie exclue • ${safeTotal} catégories disponibles` : 'Aucune catégorie';
    const included = Math.max(safeTotal - safeCount, 0);
    return `${safeCount} catégorie${safeCount > 1 ? 's' : ''} exclue${safeCount > 1 ? 's' : ''} • ${included} incluse${included > 1 ? 's' : ''}`;
  }
  function renderCategoryExcludeChips({ categories = [], excluded = [] } = {}) {
    const excludedSet = new Set((Array.isArray(excluded) ? excluded : []).map((value) => String(value || '').trim()).filter(Boolean));
    return (Array.isArray(categories) ? categories : []).map((cat) => {
      const name = String(cat || '').trim();
      if (!name) return '';
      const isExcluded = excludedSet.has(name);
      return `<button type="button" class="analysis-chip${isExcluded ? ' is-excluded' : ''}" data-cat="${esc(name)}"><span class="analysis-chip-dot"></span>${esc(name)}</button>`;
    }).join('');
  }
  const escapeHTML = window.escapeHTML || function(value){
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  function safeNum(value){
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function formatMoney(formatCurrency, value, currency){
    if (typeof formatCurrency === "function") return formatCurrency(value, currency);
    return `${safeNum(value).toFixed(2)} ${String(currency || "").trim()}`.trim();
  }

  function renderCashflowBlock({ model = {}, formatCurrency, isEn = false } = {}){
    const tr = (fr, en) => isEn ? en : fr;
    const money = (value) => formatMoney(formatCurrency, value, model.base);
    const projectedTone = safeNum(model.deltaProjected) >= 0 ? "#22c55e" : "#fb7185";
    const projectedWithBudgetTone = safeNum(model.deltaProjectedWithBudget) >= 0 ? "#22c55e" : "#fb7185";

    return `
  <div class="analysis-stat analysis-stat--cashflow"
    style="
      grid-column:1 / -1;
      padding:20px;
      border-radius:28px;
      border:1px solid rgba(255,255,255,.9);
      background:
        radial-gradient(circle at 18% 12%, rgba(255,255,255,.95), transparent 34%),
        radial-gradient(circle at 82% 18%, rgba(148,163,184,.20), transparent 42%),
        linear-gradient(135deg, rgba(255,255,255,.96), rgba(226,232,240,.78));
      box-shadow:
        0 20px 45px rgba(148,163,184,.25),
        inset 0 1px 0 rgba(255,255,255,.95),
        inset 0 -1px 0 rgba(148,163,184,.20);
      color:#0f172a;
      overflow:hidden;
      position:relative;
      transition:all .25s ease;
    "
    onmouseenter="this.style.transform='translateY(-3px)'"
    onmouseleave="this.style.transform='translateY(0)'"
  >
    <div style="position:absolute;inset:0;border-radius:28px;background:linear-gradient(120deg, transparent 38%, rgba(255,255,255,.38), transparent 62%);opacity:.55;pointer-events:none;"></div>
    <div style="position:absolute;inset:auto -80px -120px auto;width:260px;height:260px;border-radius:999px;background:rgba(99,102,241,.10);filter:blur(18px);"></div>
    <div style="position:absolute;inset:-100px auto auto -90px;width:240px;height:240px;border-radius:999px;background:rgba(148,163,184,.12);filter:blur(18px);"></div>

    <div style="position:relative;z-index:1;display:flex;flex-direction:column;gap:18px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <div>
          <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(15,23,42,.52);">${escapeHTML(tr("Cashflow estimé", "Estimated cashflow"))}</div>
          <div style="margin-top:6px;font-size:34px;line-height:1;font-weight:950;color:${escapeHTML(projectedTone)};">${escapeHTML(money(model.deltaProjected))}</div>
          <div style="margin-top:8px;font-size:12px;color:rgba(15,23,42,.60);">${escapeHTML(tr("Solde cash estimé, hors budget restant théorique.", "Estimated cash balance, excluding theoretical remaining budget."))}</div>
        </div>
        <div style="padding:10px 12px;border-radius:999px;background:rgba(255,255,255,.58);border:1px solid rgba(148,163,184,.22);font-size:12px;font-weight:800;color:rgba(15,23,42,.72);box-shadow:inset 0 1px 0 rgba(255,255,255,.75);">${escapeHTML(model.base)}</div>
      </div>

      <div>
        <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(15,23,42,.48);margin-bottom:8px;">${escapeHTML(tr("Aujourd'hui", "Today"))}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
          <div style="padding:13px 14px;border-radius:18px;background:rgba(16,185,129,.10);border:1px solid rgba(16,185,129,.20);"><div style="font-size:12px;color:rgba(15,23,42,.60);">${escapeHTML(tr("Encaissé à date", "Received to date"))}</div><div style="margin-top:4px;font-size:20px;font-weight:900;color:#10b981;">${escapeHTML(money(model.incomeToDate || model.incomeReal))}</div></div>
          <div style="padding:13px 14px;border-radius:18px;background:rgba(59,130,246,.10);border:1px solid rgba(59,130,246,.20);"><div style="font-size:12px;color:rgba(15,23,42,.60);">${escapeHTML(tr("Dépensé à date", "Spent to date"))}</div><div style="margin-top:4px;font-size:20px;font-weight:900;color:#3b82f6;">${escapeHTML(money(model.expenseToDate))}</div></div>
          <div style="padding:13px 14px;border-radius:18px;background:rgba(239,68,68,.10);border:1px solid rgba(239,68,68,.20);"><div style="font-size:12px;color:rgba(15,23,42,.60);">${escapeHTML(tr("Déjà payé", "Already paid"))}</div><div style="margin-top:4px;font-size:20px;font-weight:900;color:#fb7185;">${escapeHTML(money(model.expenseReal))}</div></div>
        </div>
      </div>

      <div>
        <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(15,23,42,.48);margin-bottom:8px;">${escapeHTML(tr("À venir", "Upcoming"))}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
          <div style="padding:13px 14px;border-radius:18px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.16);"><div style="font-size:12px;color:rgba(15,23,42,.60);">${escapeHTML(tr("Entrées prévues", "Expected income"))}</div><div style="margin-top:4px;font-size:19px;font-weight:850;color:#10b981;">${escapeHTML(money(model.incomePlanned))}</div></div>
          <div style="padding:13px 14px;border-radius:18px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.16);"><div style="font-size:12px;color:rgba(15,23,42,.60);">${escapeHTML(tr("Sorties à payer", "Expenses to pay"))}</div><div style="margin-top:4px;font-size:19px;font-weight:850;color:#f59e0b;">${escapeHTML(money(model.expensePlanned))}</div></div>
          <div style="padding:13px 14px;border-radius:18px;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.16);"><div style="font-size:12px;color:rgba(15,23,42,.60);">${escapeHTML(tr("Budget restant", "Remaining budget"))}</div><div style="margin-top:4px;font-size:19px;font-weight:850;color:#6366f1;">${escapeHTML(money(model.budgetRemaining))}</div><div style="margin-top:3px;font-size:11px;color:rgba(15,23,42,.48);">${escapeHTML(tr("Indicatif, non inclus dans le solde final", "Indicative, not included in the final balance"))}</div></div>
        </div>
      </div>

      <div style="padding:14px 16px;border-radius:20px;background:rgba(255,255,255,.46);border:1px solid rgba(148,163,184,.18);display:flex;flex-direction:column;gap:9px;box-shadow:inset 0 1px 0 rgba(255,255,255,.72);">
        <div style="display:flex;justify-content:space-between;gap:12px;"><span style="font-size:13px;color:rgba(15,23,42,.60);">${escapeHTML(tr("Solde actuel", "Current balance"))}</span><strong>${escapeHTML(money(model.deltaReal))}</strong></div>
        <div style="display:flex;justify-content:space-between;gap:12px;"><span style="font-size:13px;color:rgba(15,23,42,.60);">${escapeHTML(tr("Entrées prévues", "Expected income"))}</span><strong>${escapeHTML(money(model.incomePlanned))}</strong></div>
        <div style="display:flex;justify-content:space-between;gap:12px;"><span style="font-size:13px;color:rgba(15,23,42,.60);">${escapeHTML(tr("Sorties à payer", "Expenses to pay"))}</span><strong>-${escapeHTML(money(model.expensePlanned))}</strong></div>
        <div style="display:flex;justify-content:space-between;gap:12px;"><span style="font-size:13px;color:rgba(15,23,42,.60);">${escapeHTML(tr("Budget restant", "Remaining budget"))}</span><strong style="color:#6366f1;">-${escapeHTML(money(model.budgetRemaining))}</strong></div>
        <div style="display:flex;justify-content:space-between;gap:12px;padding-top:9px;border-top:1px solid rgba(15,23,42,.10);"><span style="font-size:14px;font-weight:800;color:rgba(15,23,42,.82);">${escapeHTML(tr("Solde fin période cash", "End-of-period cash balance"))}</span><strong style="font-size:20px;font-weight:950;color:${escapeHTML(projectedTone)};">${escapeHTML(money(model.deltaProjected))}</strong></div>
        <div style="display:flex;justify-content:space-between;gap:12px;"><span style="font-size:13px;color:rgba(15,23,42,.60);">${escapeHTML(tr("Solde fin période projeté", "Projected end-of-period balance"))}</span><strong style="font-size:18px;font-weight:900;color:${escapeHTML(projectedWithBudgetTone)};">${escapeHTML(money(model.deltaProjectedWithBudget))}</strong></div>
      </div>
    </div>
  </div>`;
  }

  function renderCashRows(rows, tone, { formatCurrency, currency, emptyLabel }){
    return (Array.isArray(rows) && rows.length)
      ? rows.map(([name, value]) => `<div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;"><span>${escapeHTML(name || "Autre")}</span><strong style="color:${tone};">${escapeHTML(formatMoney(formatCurrency, value, currency))}</strong></div>`).join("")
      : `<div style="font-size:12px;color:rgba(15,23,42,.52);">${escapeHTML(emptyLabel)}</div>`;
  }

  function renderCashOnlyBlock({ model = {}, formatCurrency, isEn = false } = {}){
    const tr = (fr, en) => isEn ? en : fr;
    const money = (value) => formatMoney(formatCurrency, value, model.base);
    const cashIn = safeNum(model.incomeReal);
    const cashOut = safeNum(model.expenseReal);
    const cashNet = cashIn - cashOut;
    const cashMax = Math.max(1, Math.abs(cashIn), Math.abs(cashOut));
    const cashInPct = Math.max(4, Math.min(100, (Math.abs(cashIn) / cashMax) * 100));
    const cashOutPct = Math.max(4, Math.min(100, (Math.abs(cashOut) / cashMax) * 100));
    const cashCoverage = cashOut > 0 ? (cashIn / cashOut) * 100 : (cashIn > 0 ? 100 : 0);

    return `
      <div class="analysis-stat analysis-stat--cash-only"
        style="grid-column:1 / -1; padding:20px; border-radius:28px; border:1px solid rgba(148,163,184,.22); background:linear-gradient(135deg, rgba(255,255,255,.96), rgba(248,250,252,.88)); box-shadow:0 16px 38px rgba(148,163,184,.16);">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <div style="font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:rgba(15,23,42,.52);">${escapeHTML(tr("Tresorerie pure", "Cash-only analysis"))}</div>
            <h3 style="margin:6px 0 4px;font-size:28px;line-height:1.1;">${escapeHTML(tr("Entrees vs sorties", "Income vs outflows"))}</h3>
            <div style="font-size:13px;color:rgba(15,23,42,.62);">${escapeHTML(tr("Uniquement les mouvements cash deja encaisses ou payes dans le filtre courant.", "Only cash movements already received or paid within the current filter."))}</div>
          </div>
          <div style="padding:10px 14px;border-radius:18px;background:${cashNet >= 0 ? "rgba(16,185,129,.10)" : "rgba(244,63,94,.10)"};border:1px solid ${cashNet >= 0 ? "rgba(16,185,129,.22)" : "rgba(244,63,94,.22)"};">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:rgba(15,23,42,.52);">${escapeHTML(tr("Net cash", "Net cash"))}</div>
            <div style="margin-top:4px;font-size:24px;font-weight:950;color:${cashNet >= 0 ? "#10b981" : "#f43f5e"};">${escapeHTML(money(cashNet))}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(180px,.6fr);gap:12px;margin-top:16px;">
          <div style="padding:14px;border-radius:18px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.16);"><div style="display:flex;justify-content:space-between;gap:10px;font-weight:850;"><span>${escapeHTML(tr("Entrees encaissees", "Received income"))}</span><span style="color:#10b981;">${escapeHTML(money(cashIn))}</span></div><div class="bar" style="height:9px;margin-top:12px;background:rgba(15,23,42,.08);border-radius:999px;overflow:hidden;"><i style="display:block;height:100%;width:${cashInPct.toFixed(0)}%;background:linear-gradient(90deg,#10b981,#22d3ee);border-radius:inherit;"></i></div></div>
          <div style="padding:14px;border-radius:18px;background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.16);"><div style="display:flex;justify-content:space-between;gap:10px;font-weight:850;"><span>${escapeHTML(tr("Sorties payees", "Paid outflows"))}</span><span style="color:#f43f5e;">${escapeHTML(money(cashOut))}</span></div><div class="bar" style="height:9px;margin-top:12px;background:rgba(15,23,42,.08);border-radius:999px;overflow:hidden;"><i style="display:block;height:100%;width:${cashOutPct.toFixed(0)}%;background:linear-gradient(90deg,#fb7185,#f59e0b);border-radius:inherit;"></i></div></div>
          <div style="padding:14px;border-radius:18px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.16);"><div style="font-size:12px;color:rgba(15,23,42,.58);">${escapeHTML(tr("Couverture entrees/sorties", "Income/outflow coverage"))}</div><div style="margin-top:6px;font-size:23px;font-weight:950;color:#2563eb;">${Number.isFinite(cashCoverage) ? cashCoverage.toFixed(0) : "0"}%</div><div style="margin-top:4px;font-size:12px;color:rgba(15,23,42,.52);">${escapeHTML(model.start)} - ${escapeHTML(model.end)}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px;">
          <div style="padding:14px;border-radius:18px;background:rgba(255,255,255,.58);border:1px solid rgba(16,185,129,.14);"><div style="font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:rgba(15,23,42,.52);margin-bottom:8px;">${escapeHTML(tr("Entrées par catégorie", "Income by category"))}</div><div style="display:flex;flex-direction:column;gap:6px;">${renderCashRows(model.cashIncomeCategories, "#10b981", { formatCurrency, currency: model.base, emptyLabel: tr("Aucune donnée", "No data") })}</div></div>
          <div style="padding:14px;border-radius:18px;background:rgba(255,255,255,.58);border:1px solid rgba(244,63,94,.14);"><div style="font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:rgba(15,23,42,.52);margin-bottom:8px;">${escapeHTML(tr("Sorties par catégorie", "Outflows by category"))}</div><div style="display:flex;flex-direction:column;gap:6px;">${renderCashRows(model.cashExpenseCategories, "#f43f5e", { formatCurrency, currency: model.base, emptyLabel: tr("Aucune donnée", "No data") })}</div></div>
        </div>
      </div>`;
  }

  window.TBAnalysisView = {
    ...(window.TBAnalysisView || {}),
    renderAnalysisCashflowBlock: renderCashflowBlock,
    renderAnalysisCashOnlyBlock: renderCashOnlyBlock,
  };

  window.TBAnalysisFilterView = {
    ...(window.TBAnalysisFilterView || {}),
    buildCategoryExcludeSummary,
    renderCategoryExcludeChips,
    renderCategoryFilterOptions,
    renderPeriodFilterOptions,
    renderSubcategoryFilterOptions,
  };
})();
