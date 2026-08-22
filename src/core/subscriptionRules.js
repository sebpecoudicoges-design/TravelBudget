// Pure rules for the Abonnements module. No DOM, Supabase or global state.

function text(value) {
  return String(value ?? '').trim();
}

function dateOnly(value) {
  return text(value).slice(0, 10);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedWords(value) {
  return text(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ')
    .split(' ').filter((word) => word.length > 1);
}

function dayDistance(a, b) {
  const left = Date.parse(`${dateOnly(a)}T00:00:00Z`);
  const right = Date.parse(`${dateOnly(b)}T00:00:00Z`);
  return Number.isFinite(left) && Number.isFinite(right) ? Math.abs(left - right) / 86400000 : Infinity;
}

function transactionDate(row) {
  return dateOnly(row?.occurrenceDate || row?.occurrence_date || row?.dateStart || row?.date_start || row?.date);
}

function sameTransactionTravel(row, travelId) {
  return !travelId || text(row?.travelId || row?.travel_id) === text(travelId);
}

function isInternalTransaction(row) {
  return bool(row, 'isInternal', 'is_internal') || !!(row?.internalTransferId || row?.internal_transfer_id);
}

function labelAffinity(left, right) {
  const a = normalizedWords(left);
  const b = normalizedWords(right);
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  const common = [...sa].filter((word) => sb.has(word)).length;
  const union = new Set([...sa, ...sb]).size;
  const joinedA = a.join(' ');
  const joinedB = b.join(' ');
  if (joinedA === joinedB) return 1;
  if (joinedA.includes(joinedB) || joinedB.includes(joinedA)) return Math.max(0.8, common / union);
  return common / union;
}

function bool(row, camel, snake) {
  if (row?.[camel] !== undefined) return !!row[camel];
  return !!row?.[snake];
}

export function recurringRuleId(transaction) {
  return text(transaction?.recurringRuleId || transaction?.recurring_rule_id) || null;
}

export function isTrackingOnlySubscription(rule) {
  return bool(rule, 'trackingOnly', 'tracking_only');
}

export function subscriptionOccurrenceStatus(transaction, today = new Date().toISOString().slice(0, 10)) {
  const status = text(transaction?.recurringInstanceStatus || transaction?.recurring_instance_status).toLowerCase();
  const paid = bool(transaction, 'payNow', 'pay_now');
  const generated = bool(transaction, 'generatedByRule', 'generated_by_rule');
  const date = dateOnly(transaction?.occurrenceDate || transaction?.occurrence_date || transaction?.dateStart || transaction?.date_start);
  if (status === 'skipped') return 'skipped';
  if (paid) return 'paid';
  if (!generated) return 'linked';
  if (status === 'detached') return 'modified';
  if (date && today && date < today) return 'overdue';
  return 'upcoming';
}

function inRange(date, startDate, endDate) {
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function addTotal(map, currency, amount) {
  const key = text(currency).toUpperCase() || '—';
  map[key] = number(map[key]) + number(amount);
}

function addMonths(iso, count) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly(iso));
  if (!match) return '';
  const wantedDay = Number(match[3]);
  const target = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + count, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(wantedDay, lastDay));
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(target.getUTCDate()).padStart(2, '0')}`;
}

export function subscriptionDateRange({ preset = 'period', today = '', periodStart = '', periodEnd = '' } = {}) {
  const selected = text(preset).toLowerCase();
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (selected === 'custom' || !match) return { startDate: dateOnly(periodStart), endDate: dateOnly(periodEnd) };
  const current = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const format = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  if (selected === 'last-month') {
    const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 0));
    return { startDate: format(start), endDate: format(end) };
  }
  if (selected === 'last-week') {
    const daysSinceMonday = (current.getUTCDay() + 6) % 7;
    const start = new Date(current);
    start.setUTCDate(start.getUTCDate() - daysSinceMonday - 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return { startDate: format(start), endDate: format(end) };
  }
  return { startDate: dateOnly(periodStart), endDate: dateOnly(periodEnd) };
}

function plannedMonthlyAmount(rule) {
  const amount = number(rule?.amount);
  const every = Math.max(1, number(rule?.intervalCount ?? rule?.interval_count) || 1);
  const cadence = text(rule?.ruleType || rule?.rule_type).toLowerCase();
  if (!amount || isTrackingOnlySubscription(rule)) return 0;
  if (cadence === 'daily') return amount * (365.25 / 12) / every;
  if (cadence === 'weekly') return amount * (52 / 12) / every;
  if (cadence === 'yearly') return amount / (12 * every);
  return amount / every;
}

function buildRuleInsights(rules, occurrences, today) {
  return rules.map((rule) => {
    const linked = occurrences.filter((row) => row.ruleId === text(rule.id));
    const paid = linked.filter((row) => row.paid && row.status !== 'skipped');
    const totals = {};
    paid.forEach((row) => addTotal(totals, row.currency || rule.currency, row.amount));
    const totalSpent = Object.entries(totals).sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount }));
    const trackingOnly = isTrackingOnlySubscription(rule);
    let monthly = [];
    const planned = plannedMonthlyAmount(rule);
    if (planned > 0) monthly = [{ currency: text(rule.currency).toUpperCase() || '—', amount: planned, source: 'planned' }];
    else {
      const byCurrencyMonth = new Map();
      for (const row of paid) {
        const currency = text(row.currency || rule.currency).toUpperCase() || '—';
        const month = dateOnly(row.occurrenceDate).slice(0, 7) || 'unknown';
        const key = `${currency}:${month}`;
        byCurrencyMonth.set(key, number(byCurrencyMonth.get(key)) + number(row.amount));
      }
      const monthlyTotals = {};
      const monthlyCounts = {};
      for (const [key, amount] of byCurrencyMonth) {
        const currency = key.split(':')[0];
        monthlyTotals[currency] = number(monthlyTotals[currency]) + amount;
        monthlyCounts[currency] = number(monthlyCounts[currency]) + 1;
      }
      monthly = Object.keys(monthlyTotals).sort().map((currency) => ({
        currency,
        amount: monthlyTotals[currency] / Math.max(1, monthlyCounts[currency]),
        source: 'actual-average',
      }));
    }
    const future = linked.filter((row) => row.occurrenceDate >= today && ['upcoming', 'linked'].includes(row.status));
    let nextDueAt = future[0]?.occurrenceDate || (!trackingOnly && dateOnly(rule?.nextDueAt || rule?.next_due_at) >= today ? dateOnly(rule?.nextDueAt || rule?.next_due_at) : '');
    let nextDueEstimated = false;
    if (!nextDueAt && trackingOnly && paid.length) {
      const latestPaid = paid.slice().sort((a, b) => b.occurrenceDate.localeCompare(a.occurrenceDate))[0];
      nextDueAt = addMonths(latestPaid.occurrenceDate, 1);
      nextDueEstimated = !!nextDueAt;
    }
    return { rule, trackingOnly, linked, paid, monthly, totalSpent, nextDueAt, nextDueEstimated };
  });
}

export function buildSubscriptionAssociationQueue({ rules = [], transactions = [], travelId = '', type = 'all' } = {}) {
  const wantedTravel = text(travelId);
  const scopedRules = rules
    .filter((rule) => !rule?.archived)
    .filter((rule) => !wantedTravel || text(rule?.travelId || rule?.travel_id) === wantedTravel)
    .filter((rule) => type === 'all' || text(rule?.type).toLowerCase() === text(type).toLowerCase());
  const linkedByRule = new Map(scopedRules.map((rule) => [text(rule.id), []]));
  for (const row of transactions) {
    const ruleId = recurringRuleId(row);
    if (linkedByRule.has(ruleId)) linkedByRule.get(ruleId).push(row);
  }
  const confirmedByRule = new Map([...linkedByRule].map(([ruleId, rows]) => [ruleId, rows.filter((row) => !bool(row, 'generatedByRule', 'generated_by_rule'))]));
  const generatedByRule = new Map([...linkedByRule].map(([ruleId, rows]) => [ruleId, rows.filter((row) => bool(row, 'generatedByRule', 'generated_by_rule'))]));
  const candidates = transactions
    .filter((row) => sameTransactionTravel(row, wantedTravel))
    .filter((row) => !recurringRuleId(row) && !isInternalTransaction(row))
    .filter((row) => type === 'all' || text(row?.type).toLowerCase() === text(type).toLowerCase())
    .filter((row) => text(row?.id));

  return candidates.map((transaction) => {
    const txType = text(transaction?.type).toLowerCase();
    const txCurrency = text(transaction?.currency).toUpperCase();
    const txAmount = Math.abs(number(transaction?.amount));
    const txDate = transactionDate(transaction);
    const txLabel = text(transaction?.label || transaction?.description || transaction?.category);
    const ranked = scopedRules
      .filter((rule) => !txType || text(rule?.type).toLowerCase() === txType)
      .map((rule) => {
        let score = 0;
        const reasons = [];
        const ruleCurrency = text(rule?.currency).toUpperCase();
        if (txCurrency && ruleCurrency === txCurrency) { score += 15; reasons.push('Même devise'); }
        const directAffinity = labelAffinity(txLabel, rule?.label || rule?.name);
        const learnedAffinity = Math.max(0, ...(confirmedByRule.get(text(rule.id)) || []).map((row) => labelAffinity(txLabel, row?.label || row?.description || row?.category)));
        const affinity = Math.max(directAffinity, learnedAffinity);
        if (affinity >= 0.8) { score += 38; reasons.push(learnedAffinity > directAffinity ? 'Libellé déjà confirmé' : 'Libellé très proche'); }
        else if (affinity >= 0.4) { score += 24; reasons.push(learnedAffinity > directAffinity ? 'Libellé déjà confirmé' : 'Libellé proche'); }
        else if (affinity > 0) { score += 10; reasons.push('Mot commun'); }
        const planned = Math.abs(number(rule?.amount));
        if (planned > 0 && txAmount > 0) {
          const gap = Math.abs(txAmount - planned) / planned;
          if (gap <= 0.03) { score += 27; reasons.push('Montant quasi identique'); }
          else if (gap <= 0.1) { score += 19; reasons.push('Montant proche'); }
          else if (gap <= 0.25) { score += 8; reasons.push('Montant compatible'); }
        }
        const nearGenerated = (generatedByRule.get(text(rule.id)) || [])
          .filter((row) => transactionDate(row) && dayDistance(txDate, transactionDate(row)) <= 5)
          .filter((row) => {
            const generatedAmount = Math.abs(number(row?.amount || rule?.amount));
            return !generatedAmount || !txAmount || Math.abs(generatedAmount - txAmount) / generatedAmount <= 0.1;
          })
          .sort((a, b) => dayDistance(txDate, transactionDate(a)) - dayDistance(txDate, transactionDate(b)))[0] || null;
        if (nearGenerated) { score += 25; reasons.push('Échéance générée proche'); }
        else if (dayDistance(txDate, rule?.nextDueAt || rule?.next_due_at) <= 5) { score += 10; reasons.push('Date proche de l’échéance'); }
        return { rule, score, reasons, duplicateCandidate: nearGenerated };
      })
      .filter((row) => row.score >= 25)
      .sort((a, b) => b.score - a.score || text(a.rule?.label).localeCompare(text(b.rule?.label)));
    const best = ranked[0] || null;
    return {
      transaction,
      suggestion: best ? {
        rule: best.rule,
        score: Math.min(100, best.score),
        confidence: best.score >= 75 ? 'high' : best.score >= 50 ? 'medium' : 'low',
        reasons: best.reasons,
        duplicateCandidate: best.duplicateCandidate,
      } : null,
    };
  }).sort((a, b) => transactionDate(b.transaction).localeCompare(transactionDate(a.transaction)) || text(a.transaction?.label).localeCompare(text(b.transaction?.label)));
}

export function computeFirstSubscriptionDueDate({ ruleType = '', startDate = '', weekday = null, monthday = null, intervalCount = 1 } = {}) {
  const iso = dateOnly(startDate);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const every = Math.max(1, Number(intervalCount) || 1);
  const start = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const format = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  if (ruleType === 'weekly') {
    if (weekday === null || weekday === undefined || weekday === '') return iso;
    const delta = (Number(weekday) - start.getUTCDay() + 7) % 7;
    start.setUTCDate(start.getUTCDate() + delta + (delta > 0 && every > 1 ? 7 * every : 0));
    return format(start);
  }
  if (ruleType === 'every_x_months') {
    const wantedDay = Number(monthday);
    if (!(wantedDay >= 1 && wantedDay <= 31)) return iso;
    const currentDay = start.getUTCDate();
    const monthOffset = wantedDay >= currentDay ? 0 : every;
    const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthOffset, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(wantedDay, lastDay));
    return format(target);
  }
  return iso;
}

export function buildSubscriptionAnalysis({ rules = [], transactions = [], travelId = '', startDate = '', endDate = '', today = '', type = 'all' } = {}) {
  const wantedTravel = text(travelId);
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const scopedRules = rules
    .filter((rule) => !wantedTravel || text(rule?.travelId || rule?.travel_id) === wantedTravel)
    .filter((rule) => type === 'all' || text(rule?.type).toLowerCase() === text(type).toLowerCase())
    .filter((rule) => !rule?.archived);
  const ruleById = new Map(scopedRules.map((rule) => [text(rule.id), rule]));
  const allOccurrences = transactions
    .filter((tx) => ruleById.has(recurringRuleId(tx)))
    .map((tx) => {
      const rule = ruleById.get(recurringRuleId(tx));
      const occurrenceDate = dateOnly(tx?.occurrenceDate || tx?.occurrence_date || tx?.dateStart || tx?.date_start);
      return {
        ...tx,
        rule,
        ruleId: text(rule?.id),
        occurrenceDate,
        status: subscriptionOccurrenceStatus(tx, day),
        paid: bool(tx, 'payNow', 'pay_now'),
        generated: bool(tx, 'generatedByRule', 'generated_by_rule'),
      };
    })
    .sort((a, b) => String(a.occurrenceDate).localeCompare(String(b.occurrenceDate)) || text(a.label).localeCompare(text(b.label)));
  const occurrences = allOccurrences.filter((row) => inRange(row.occurrenceDate, dateOnly(startDate), dateOnly(endDate)));

  const plannedByCurrency = {};
  const actualByCurrency = {};
  const plannedByFlowCurrency = {};
  const actualByFlowCurrency = {};
  for (const row of occurrences) {
    if (row.generated && row.status !== 'skipped') {
      addTotal(plannedByCurrency, row.rule?.currency || row.currency, row.rule?.amount ?? row.amount);
      const plannedFlow = text(row.rule?.type || row.type).toLowerCase() === 'income' ? 'income' : 'expense';
      const plannedCurrency = text(row.rule?.currency || row.currency).toUpperCase() || '—';
      const plannedKey = `${plannedFlow}:${plannedCurrency}`;
      plannedByFlowCurrency[plannedKey] = number(plannedByFlowCurrency[plannedKey]) + number(row.rule?.amount ?? row.amount);
    }
    if (row.paid && row.status !== 'skipped') {
      addTotal(actualByCurrency, row.currency || row.rule?.currency, row.amount);
      const actualFlow = text(row.type || row.rule?.type).toLowerCase() === 'income' ? 'income' : 'expense';
      const actualCurrency = text(row.currency || row.rule?.currency).toUpperCase() || '—';
      const actualKey = `${actualFlow}:${actualCurrency}`;
      actualByFlowCurrency[actualKey] = number(actualByFlowCurrency[actualKey]) + number(row.amount);
    }
  }
  const currencies = [...new Set([...Object.keys(plannedByCurrency), ...Object.keys(actualByCurrency)])].sort();
  const comparison = currencies.map((currency) => {
    const planned = number(plannedByCurrency[currency]);
    const actual = number(actualByCurrency[currency]);
    return { currency, planned, actual, delta: actual - planned };
  });
  const flowComparison = [...new Set([...Object.keys(plannedByFlowCurrency), ...Object.keys(actualByFlowCurrency)])]
    .sort()
    .map((key) => {
      const [flow, currency] = key.split(':');
      const planned = number(plannedByFlowCurrency[key]);
      const actual = number(actualByFlowCurrency[key]);
      return { type: flow, currency, planned, actual, delta: actual - planned };
    });
  const actualCurrencies = [...new Set(Object.keys(actualByFlowCurrency).map((key) => key.split(':')[1]))].sort();
  const actualTotals = actualCurrencies.map((currency) => {
    const expenses = number(actualByFlowCurrency[`expense:${currency}`]);
    const income = number(actualByFlowCurrency[`income:${currency}`]);
    return { currency, expenses, income, delta: income - expenses };
  });

  return {
    rules: scopedRules,
    activeRules: scopedRules.filter((rule) => rule?.isActive !== false && rule?.is_active !== false),
    pausedRules: scopedRules.filter((rule) => rule?.isActive === false || rule?.is_active === false),
    occurrences,
    comparison,
    flowComparison,
    actualTotals,
    paid: occurrences.filter((row) => row.status === 'paid'),
    upcoming: occurrences.filter((row) => row.status === 'upcoming' || row.status === 'linked'),
    overdue: occurrences.filter((row) => row.status === 'overdue'),
    modified: occurrences.filter((row) => row.status === 'modified'),
    manuallyLinked: occurrences.filter((row) => !row.generated),
    ruleInsights: buildRuleInsights(scopedRules, allOccurrences, day),
    associationQueue: buildSubscriptionAssociationQueue({ rules: scopedRules, transactions, travelId: wantedTravel, type }),
  };
}

export function subscriptionRulesForTransaction(rules = [], transaction = {}, travelId = '') {
  const wantedTravel = text(travelId || transaction?.travelId || transaction?.travel_id);
  return rules.filter((rule) => {
    if (rule?.archived) return false;
    if (wantedTravel && text(rule?.travelId || rule?.travel_id) !== wantedTravel) return false;
    return true;
  });
}
