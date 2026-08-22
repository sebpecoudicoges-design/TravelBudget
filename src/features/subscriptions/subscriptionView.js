const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const dateLabel = (value) => {
  const iso = String(value || '').slice(0, 10);
  if (!iso) return '—';
  try { return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)); }
  catch (_) { return iso; }
};

const money = (amount, currency) => {
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 2 }).format(Number(amount || 0)); }
  catch (_) { return `${Number(amount || 0).toFixed(2)} ${currency || ''}`.trim(); }
};

const statusMeta = Object.freeze({
  paid: ['Payé', 'positive'], upcoming: ['À venir', 'info'], overdue: ['En retard', 'danger'],
  modified: ['Modifiée', 'warning'], linked: ['Liée manuellement', 'info'], skipped: ['Ignorée', 'muted'],
});

function stackedTotals(comparison, key) {
  if (!comparison?.length) return '<span>—</span>';
  return comparison.map((row) => `<span>${esc(money(row[key], row.currency))}</span>`).join('');
}

function moneyList(rows) {
  if (!rows?.length) return 'À calculer';
  return rows.map((row) => money(row.amount, row.currency)).join(' · ');
}

function insightCard(insight) {
  const rule = insight.rule || {};
  const flow = String(rule.type || 'expense').toLowerCase() === 'income' ? 'income' : 'expense';
  const isIncome = flow === 'income';
  const mode = insight.trackingOnly ? 'Suivi par transactions' : 'Échéances automatiques';
  const monthlyLabel = insight.monthly?.some((row) => row.source === 'actual-average') ? (isIncome ? 'Moyenne encaissée / mois' : 'Moyenne dépensée / mois') : (isIncome ? 'Entrée prévue / mois' : 'Coût prévu / mois');
  return `<article class="tb-subscription-spotlight tb-subscription-spotlight--${flow}" data-subscription-insight="${esc(rule.id)}">
    <div class="tb-subscription-spotlight__head"><div><span>${esc(isIncome ? 'Entrée' : 'Sortie')} · ${esc(mode)}</span><h2>${esc(rule.label || rule.name || 'Abonnement')}</h2></div><span class="tb-subscription-status tb-subscription-status--${isIncome ? 'positive' : 'warning'}">${insight.paid?.length || 0} ${isIncome ? 'encaissement(s)' : 'paiement(s)'}</span></div>
    <div class="tb-subscription-spotlight__monthly"><small>${esc(monthlyLabel)}</small><strong>${esc(moneyList(insight.monthly))}</strong></div>
    <div class="tb-subscription-spotlight__facts"><div><small>${isIncome ? 'Total encaissé' : 'Total dépensé'}</small><strong>${esc(moneyList(insight.totalSpent))}</strong></div><div><small>Prochaine échéance${insight.nextDueEstimated ? ' estimée' : ''}</small><strong>${esc(insight.nextDueAt ? dateLabel(insight.nextDueAt) : 'À renseigner')}</strong></div></div>
    <button class="btn tb-subscription-spotlight__open" type="button" data-subscription-detail="${esc(rule.id)}">Voir la fiche</button>
  </article>`;
}

function associationRow(item) {
  const tx = item.transaction || {};
  const suggestion = item.suggestion;
  const confidence = suggestion?.confidence || 'none';
  const confidenceLabel = { high: 'Confiance forte', medium: 'Confiance moyenne', low: 'À vérifier', none: 'Aucune suggestion' }[confidence];
  const duplicate = suggestion?.duplicateCandidate;
  return `<article class="tb-subscription-association" data-subscription-association="${esc(tx.id)}">
    <div class="tb-subscription-association__tx"><small>${esc(dateLabel(tx.dateStart || tx.date_start || tx.date))}</small><strong>${esc(tx.label || tx.description || tx.category || 'Transaction')}</strong><span>${esc(money(tx.amount, tx.currency))}</span></div>
    <div class="tb-subscription-association__match"><span class="tb-subscription-status tb-subscription-status--${duplicate ? 'warning' : (confidence === 'high' ? 'positive' : 'info')}">${esc(duplicate ? 'Doublon possible' : confidenceLabel)}</span>${suggestion ? `<strong>${esc(suggestion.rule?.label || suggestion.rule?.name || 'Abonnement')}</strong><p>${suggestion.reasons.map(esc).join(' · ')}</p>` : '<strong>Choix manuel requis</strong><p>Aucun abonnement ne correspond assez précisément.</p>'}</div>
    <div class="tb-subscription-association__actions">${duplicate ? `<button class="btn" type="button" data-subscription-open-transaction="${esc(duplicate.id)}">Voir l’échéance</button>` : (suggestion ? `<button class="btn primary" type="button" data-subscription-link-transaction="${esc(tx.id)}" data-subscription-link-rule="${esc(suggestion.rule?.id)}">Rattacher</button>` : '')}<button class="btn" type="button" data-subscription-open-transaction="${esc(tx.id)}">Choisir</button></div>
  </article>`;
}

function subscriptionDetail(insight) {
  if (!insight) return '';
  const rule = insight.rule || {};
  const linked = (insight.linked || []).slice().sort((a, b) => String(b.occurrenceDate).localeCompare(String(a.occurrenceDate)));
  return `<section class="tb-subscription-detail" data-subscription-detail-panel="${esc(rule.id)}">
    <div class="tb-subscription-section-head"><div><span>Fiche abonnement</span><h2>${esc(rule.label || rule.name || 'Abonnement')}</h2><p>Prévu, réel et origine de chaque liaison restent séparés.</p></div><button class="btn" type="button" data-subscription-detail-close>Fermer</button></div>
    <div class="tb-subscription-detail__metrics"><div><small>Prévu par mois</small><strong>${esc(moneyList(insight.monthly))}</strong></div><div><small>Total réel</small><strong>${esc(moneyList(insight.totalSpent))}</strong></div><div><small>Prochaine échéance</small><strong>${esc(insight.nextDueAt ? dateLabel(insight.nextDueAt) : 'À renseigner')}</strong></div><div><small>Transactions liées</small><strong>${linked.length}</strong></div></div>
    <div class="tb-subscription-detail__actions"><button class="btn primary" type="button" data-rr-act="edit" data-rr-id="${esc(rule.id)}">Modifier la règle</button><button class="btn" type="button" data-subscription-tab="associations">Rattacher une transaction</button></div>
    <div class="tb-subscription-detail__history">${linked.length ? linked.slice(0, 8).map(occurrenceRow).join('') : '<div class="tb-subscription-empty">Aucune transaction liée à cet abonnement.</div>'}</div>
  </section>`;
}

function flowSummary(analysis, flow) {
  const isIncome = flow === 'income';
  const rows = (analysis?.flowComparison || []).filter((row) => row.type === flow);
  if (!rows.length) return '';
  return `<article class="tb-subscription-flow tb-subscription-flow--${flow}">
    <div class="tb-subscription-flow__title"><span>${isIncome ? 'Entrées' : 'Sorties'}</span><small>${isIncome ? 'Encaissements' : 'Paiements'}</small></div>
    <div><small>Prévu</small><strong class="tb-subscription-flow__amounts">${stackedTotals(rows, 'planned')}</strong></div>
    <div><small>${isIncome ? 'Encaissé' : 'Payé'}</small><strong class="tb-subscription-flow__amounts">${stackedTotals(rows, 'actual')}</strong></div>
    <div><small>Différence</small><strong class="tb-subscription-flow__amounts">${stackedTotals(rows, 'delta')}</strong></div>
  </article>`;
}

function actualTotalsSummary(analysis) {
  const rows = analysis?.actualTotals || [];
  if (!rows.length) return '';
  return `<article class="tb-subscription-flow tb-subscription-flow--balance">
    <div class="tb-subscription-flow__title"><span>Bilan réel</span><small>Flux encaissés et débités</small></div>
    <div><small>Total dépenses</small><strong class="tb-subscription-flow__amounts">${stackedTotals(rows, 'expenses')}</strong></div>
    <div><small>Total revenus</small><strong class="tb-subscription-flow__amounts">${stackedTotals(rows, 'income')}</strong></div>
    <div><small>Différence</small><strong class="tb-subscription-flow__amounts">${stackedTotals(rows, 'delta')}</strong></div>
  </article>`;
}

function occurrenceRow(row) {
  const meta = statusMeta[row.status] || [row.status || '—', 'muted'];
  const isIncome = String(row.rule?.type || row.type).toLowerCase() === 'income';
  return `<article class="tb-subscription-occurrence" data-subscription-occurrence="${esc(row.id)}">
    <div class="tb-subscription-occurrence__date"><strong>${esc(dateLabel(row.occurrenceDate))}</strong><span>${row.generated ? 'Créée par la règle' : 'Rattachée depuis Transactions'}</span></div>
    <div class="tb-subscription-occurrence__main"><strong>${esc(row.rule?.label || row.label || 'Échéance')}</strong><span>${esc(row.label || row.category || '')}</span></div>
    <div class="tb-subscription-occurrence__amount"><strong>${esc(money(row.amount, row.currency || row.rule?.currency))}</strong><span>${row.paid ? (isIncome ? 'Réel encaissé' : 'Réel débité') : 'Prévision'}</span></div>
    <span class="tb-subscription-status tb-subscription-status--${esc(meta[1])}">${esc(meta[0])}</span>
    <button class="btn" type="button" data-subscription-open-transaction="${esc(row.id)}">Ouvrir</button>
  </article>`;
}

function ruleRow(rule, helpers = {}) {
  const active = rule?.isActive !== false && rule?.is_active !== false;
  const trackingOnly = !!(rule?.trackingOnly ?? rule?.tracking_only);
  const walletName = helpers.walletName?.(rule) || '—';
  const frequency = helpers.frequencyLabel?.(rule) || '—';
  return `<article class="tb-subscription-rule" data-rr-card="${esc(rule.id)}">
    <div><span class="tb-subscription-rule__eyebrow">${esc(trackingOnly ? 'Suivi manuel' : (active ? 'Active' : 'En pause'))}</span><h3>${esc(rule.label || rule.name || '—')}</h3><p>${trackingOnly ? 'Montants issus des transactions liées' : `${esc(money(rule.amount, rule.currency))} · ${esc(frequency)}`}</p></div>
    <div class="tb-subscription-rule__meta">${trackingOnly ? '<span>Aucune transaction générée</span>' : `<span>Prochaine : <strong>${esc(dateLabel(rule.nextDueAt || rule.next_due_at))}</strong></span>`}<span>Wallet : <strong>${esc(walletName)}</strong></span>${trackingOnly ? '' : `<span>${esc(rule.category || 'Autre')}${rule.subcategory ? ` · ${esc(rule.subcategory)}` : ''}</span>`}</div>
    <div class="tb-subscription-rule__actions"><button class="btn" data-rr-act="edit" data-rr-id="${esc(rule.id)}">Modifier</button>${trackingOnly ? '' : (active ? `<button class="btn" data-rr-act="pause" data-rr-id="${esc(rule.id)}">Mettre en pause</button>` : `<button class="btn" data-rr-act="resume" data-rr-id="${esc(rule.id)}">Reprendre</button>`)}<button class="btn danger" data-rr-act="delete" data-rr-id="${esc(rule.id)}">Archiver</button></div>
  </article>`;
}

export function renderSubscriptionsModule({ analysis, tab = 'overview', detailRuleId = '', startDate = '', endDate = '', type = 'all', rangePreset = 'period', helpers = {} } = {}) {
  const rows = (analysis?.occurrences || []).filter((row) => type === 'all' || String(row.rule?.type || row.type) === type);
  const rules = (analysis?.rules || []).filter((rule) => type === 'all' || String(rule.type) === type);
  const latest = rows.slice().sort((a, b) => String(b.occurrenceDate).localeCompare(String(a.occurrenceDate))).slice(0, 6);
  const detail = subscriptionDetail((analysis?.ruleInsights || []).find((row) => String(row.rule?.id || '') === String(detailRuleId || '')));
  const body = tab === 'rules'
    ? `<section class="tb-subscription-list"><div class="tb-subscription-section-head"><div><span>Automatisation et suivi</span><h2>Abonnements et règles</h2></div><button class="btn primary" id="tb-recurring-add-btn" type="button">+ Ajouter un abonnement</button></div>${rules.length ? rules.map((rule) => ruleRow(rule, helpers)).join('') : '<div class="tb-subscription-empty">Aucun abonnement pour ce filtre.</div>'}</section>`
    : tab === 'occurrences'
      ? `<section class="tb-subscription-list"><div class="tb-subscription-section-head"><div><span>Traçabilité</span><h2>Échéances et paiements</h2></div><strong>${rows.length} ligne(s)</strong></div>${rows.length ? rows.map(occurrenceRow).join('') : '<div class="tb-subscription-empty">Aucune échéance sur cette période.</div>'}</section>`
      : tab === 'associations'
        ? `<section class="tb-subscription-list"><div class="tb-subscription-section-head"><div><span>Validation humaine</span><h2>Transactions sans abonnement</h2><p>Les rapprochements sont proposés mais jamais enregistrés sans ton accord.</p></div><strong>${analysis?.associationQueue?.length || 0} à examiner</strong></div>${analysis?.associationQueue?.length ? analysis.associationQueue.map(associationRow).join('') : '<div class="tb-subscription-empty"><strong>Tout est classé.</strong><span>Aucune transaction compatible ne reste à rattacher.</span></div>'}</section>`
      : `<section class="tb-subscription-overview">
          <section class="tb-subscription-cash-summary"><div class="tb-subscription-cash-summary__head"><div><span>Prévu, réel et bilan</span><h2>Une lecture nette des flux</h2></div><div class="tb-subscription-watch"><strong>${(analysis?.overdue?.length || 0) + (analysis?.modified?.length || 0)}</strong><span>à surveiller · ${analysis?.overdue?.length || 0} en retard · ${analysis?.modified?.length || 0} modifiée(s)</span></div></div><div class="tb-subscription-flows">${flowSummary(analysis, 'expense')}${flowSummary(analysis, 'income')}${actualTotalsSummary(analysis)}</div><small class="tb-subscription-cash-summary__note">Pour chaque flux, la différence correspond au réel moins le prévu. Dans le bilan réel, elle correspond aux revenus moins les dépenses.</small></section>
          <section class="tb-subscription-spotlights"><div class="tb-subscription-section-head"><div><span>Analyse par abonnement</span><h2>Ce que chaque abonnement coûte vraiment</h2></div></div><div class="tb-subscription-spotlights__grid">${analysis?.ruleInsights?.length ? analysis.ruleInsights.map(insightCard).join('') : '<div class="tb-subscription-empty">Ajoute un abonnement puis rattache ses transactions pour commencer l’analyse.</div>'}</div></section>
          <div class="tb-subscription-insight"><div><span>Lecture rapide</span><h2>${analysis?.activeRules?.length || 0} règle(s) active(s)</h2><p>${analysis?.manuallyLinked?.length || 0} transaction(s) rattachée(s) manuellement. Les montants prévus viennent des règles; le réel ne retient que les transactions payées.</p></div><button class="btn primary" type="button" data-subscription-tab="occurrences">Voir toute la traçabilité</button></div>
          <section class="tb-subscription-list"><div class="tb-subscription-section-head"><div><span>Derniers mouvements</span><h2>Échéances récentes</h2></div></div>${latest.length ? latest.map(occurrenceRow).join('') : '<div class="tb-subscription-empty">Aucune échéance sur cette période.</div>'}</section>
        </section>`;

  return `<div class="tb-subscriptions-shell">
    <header class="tb-subscriptions-hero"><div><span class="tb-subscriptions-kicker">Pilotage récurrent</span><h1>Abonnements</h1><p>Compare ce qui était prévu aux paiements réels et garde l’histoire de chaque échéance, même après une modification.</p></div><button class="btn primary" id="tb-recurring-add-btn-hero" type="button">+ Ajouter un abonnement</button></header>
    <div class="tb-subscriptions-toolbar"><nav aria-label="Espaces Abonnements"><button class="${tab === 'overview' ? 'is-active' : ''}" data-subscription-tab="overview">Vue d’ensemble</button><button class="${tab === 'occurrences' ? 'is-active' : ''}" data-subscription-tab="occurrences">Échéances</button><button class="${tab === 'associations' ? 'is-active' : ''}" data-subscription-tab="associations">À associer${analysis?.associationQueue?.length ? ` <span>${analysis.associationQueue.length}</span>` : ''}</button><button class="${tab === 'rules' ? 'is-active' : ''}" data-subscription-tab="rules">Règles</button></nav><div class="tb-subscriptions-filters"><label>Période<select id="subscriptions-range"><option value="period"${rangePreset === 'period' ? ' selected' : ''}>Période du voyage</option><option value="last-month"${rangePreset === 'last-month' ? ' selected' : ''}>Mois dernier</option><option value="last-week"${rangePreset === 'last-week' ? ' selected' : ''}>Semaine dernière</option><option value="custom"${rangePreset === 'custom' ? ' selected' : ''}>Dates personnalisées</option></select></label><label>Du<input id="subscriptions-start" type="date" value="${esc(startDate)}"></label><label>Au<input id="subscriptions-end" type="date" value="${esc(endDate)}"></label><label>Flux<select id="subscriptions-type"><option value="all"${type === 'all' ? ' selected' : ''}>Tous</option><option value="expense"${type === 'expense' ? ' selected' : ''}>Dépenses</option><option value="income"${type === 'income' ? ' selected' : ''}>Entrées</option></select></label></div></div>
    ${detail}${body}
  </div>`;
}
