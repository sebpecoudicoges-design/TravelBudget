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
  for (const row of occurrences) {
    if (row.generated && row.status !== 'skipped') {
      addTotal(plannedByCurrency, row.rule?.currency || row.currency, row.rule?.amount ?? row.amount);
    }
    if (row.paid && row.status !== 'skipped') addTotal(actualByCurrency, row.currency || row.rule?.currency, row.amount);
  }
  const currencies = [...new Set([...Object.keys(plannedByCurrency), ...Object.keys(actualByCurrency)])].sort();
  const comparison = currencies.map((currency) => {
    const planned = number(plannedByCurrency[currency]);
    const actual = number(actualByCurrency[currency]);
    return { currency, planned, actual, delta: actual - planned };
  });

  return {
    rules: scopedRules,
    activeRules: scopedRules.filter((rule) => rule?.isActive !== false && rule?.is_active !== false),
    pausedRules: scopedRules.filter((rule) => rule?.isActive === false || rule?.is_active === false),
    occurrences,
    comparison,
    paid: occurrences.filter((row) => row.status === 'paid'),
    upcoming: occurrences.filter((row) => row.status === 'upcoming' || row.status === 'linked'),
    overdue: occurrences.filter((row) => row.status === 'overdue'),
    modified: occurrences.filter((row) => row.status === 'modified'),
    manuallyLinked: occurrences.filter((row) => !row.generated),
    ruleInsights: buildRuleInsights(scopedRules, allOccurrences, day),
  };
}

export function subscriptionRulesForTransaction(rules = [], transaction = {}, travelId = '') {
  const wantedTravel = text(travelId || transaction?.travelId || transaction?.travel_id);
  const type = text(transaction?.type).toLowerCase();
  const currency = text(transaction?.currency).toUpperCase();
  return rules.filter((rule) => {
    if (rule?.archived) return false;
    if (wantedTravel && text(rule?.travelId || rule?.travel_id) !== wantedTravel) return false;
    if (!isTrackingOnlySubscription(rule) && type && text(rule?.type).toLowerCase() !== type) return false;
    if (!isTrackingOnlySubscription(rule) && currency && text(rule?.currency).toUpperCase() !== currency) return false;
    return true;
  });
}
