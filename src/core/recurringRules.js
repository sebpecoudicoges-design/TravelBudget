function isoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').slice(0, 10));
  return match ? match[0] : '';
}

export function findPeriodForDate(periods, travelId, date) {
  const target = isoDate(date);
  const tid = String(travelId || '');
  if (!target || !tid) return null;
  return (Array.isArray(periods) ? periods : [])
    .filter((period) => String(period?.travelId || period?.travel_id || '') === tid)
    .filter((period) => {
      const start = isoDate(period?.start || period?.start_date);
      const end = isoDate(period?.end || period?.end_date);
      return start && end && target >= start && target <= end;
    })
    .sort((a, b) => isoDate(b?.start || b?.start_date).localeCompare(isoDate(a?.start || a?.start_date)))[0] || null;
}

export function recurringPeriodCoverage({ periods, travelId, startDate, endDate } = {}) {
  const start = isoDate(startDate);
  const end = isoDate(endDate) || start;
  const startPeriod = findPeriodForDate(periods, travelId, start);
  const endPeriod = findPeriodForDate(periods, travelId, end);
  return {
    start,
    end,
    startPeriod,
    endPeriod,
    covered: !!startPeriod && !!endPeriod,
    crossesPeriods: !!startPeriod && !!endPeriod && String(startPeriod.id) !== String(endPeriod.id),
  };
}

export function formatRecurringPeriodCoverage(input = {}, language = 'fr') {
  const coverage = recurringPeriodCoverage(input);
  const english = String(language || '').toLowerCase().startsWith('en');
  if (!coverage.start) return english ? 'Choose a start date.' : 'Choisis une date de debut.';
  if (!coverage.covered) {
    return english
      ? 'At least one date is outside the budget periods. The rule cannot generate that occurrence.'
      : 'Au moins une date est hors des periodes budget. La regle ne pourra pas generer cette occurrence.';
  }
  if (coverage.crossesPeriods) {
    return english
      ? 'Automatic: each occurrence will use the budget period covering its own date.'
      : 'Automatique : chaque occurrence utilisera la periode budget couvrant sa propre date.';
  }
  const period = coverage.startPeriod;
  const start = isoDate(period?.start || period?.start_date);
  const end = isoDate(period?.end || period?.end_date);
  return english
    ? `Automatic budget period: ${start} to ${end}.`
    : `Periode budget automatique : ${start} au ${end}.`;
}
