export function mean(values) {
  const nums = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

export function standardDeviation(values) {
  const nums = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
  if (nums.length < 2) return 0;
  const avg = mean(nums);
  const variance = mean(nums.map((value) => Math.pow(value - avg, 2)));
  return Math.sqrt(variance || 0);
}

export function linearSlope(values) {
  const nums = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
  const n = nums.length;
  if (n < 2) return 0;
  const avgX = (n - 1) / 2;
  const avgY = mean(nums);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    numerator += (i - avgX) * (nums[i] - avgY);
    denominator += Math.pow(i - avgX, 2);
  }
  return denominator ? numerator / denominator : 0;
}

export function computeFxDecision(input = {}) {
  const weeklyIncomeAud = Number(input.weeklyIncomeAud ?? 1200);
  const eurNeedRatio = Math.max(0, Math.min(1, Number(input.eurNeedRatio ?? 0.5)));
  const localAudSafetyRatio = Math.max(0, Math.min(1, Number(input.localAudSafetyRatio ?? 0.35)));
  const rawHorizonDays = Number(input.horizonDays ?? 90);
  const horizonDays = [30, 60, 90, 180].includes(rawHorizonDays) ? rawHorizonDays : 90;
  const rates = (Array.isArray(input.rates) ? input.rates : [])
    .map((row) => ({
      date: row?.date || null,
      rate: Number(row?.rate),
    }))
    .filter((row) => Number.isFinite(row.rate) && row.rate > 0);

  if (!rates.length) {
    return {
      status: 'missing',
      action: 'hold',
      convertPercent: 0,
      score: 0,
      weeklyIncomeAud,
      currentRate: null,
      currentEur: null,
      reason: 'missing_rates',
      metrics: {},
    };
  }

  const values = rates.map((row) => row.rate);
  const currentRate = Number(input.currentRate) > 0 ? Number(input.currentRate) : values[values.length - 1];
  const horizonValues = values.slice(-horizonDays);
  const trendWindow = values.slice(-Math.min(30, horizonDays));
  const avg30 = mean(values.slice(-30)) ?? currentRate;
  const avg90 = mean(values.slice(-90)) ?? avg30;
  const avg180 = mean(values.slice(-180)) ?? avg90;
  const avgHorizon = mean(horizonValues) ?? currentRate;
  const slope30 = linearSlope(trendWindow);
  const volatilityHorizon = (standardDeviation(horizonValues) || 0) / (avgHorizon || currentRate || 1);
  const volatility90 = (standardDeviation(values.slice(-90)) || 0) / (avg90 || currentRate || 1);

  const positionHorizon = avgHorizon ? (currentRate - avgHorizon) / avgHorizon : 0;
  const position90 = avg90 ? (currentRate - avg90) / avg90 : 0;
  const position180 = avg180 ? (currentRate - avg180) / avg180 : 0;
  const trendRatio = avgHorizon ? slope30 / avgHorizon : 0;
  const dataPointsHorizon = horizonValues.length;
  const dataPoints90 = values.slice(-90).length;

  let score = 50;
  score += Math.max(-20, Math.min(20, positionHorizon * 850));
  score += Math.max(-10, Math.min(10, position180 * 450));
  score += Math.max(-16, Math.min(16, trendRatio * 8000));
  score += (eurNeedRatio - 0.5) * 24;
  score -= localAudSafetyRatio * 18;

  if (volatilityHorizon > 0.03) score += 6;
  if (volatilityHorizon > 0.055) score -= 8;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let convertPercent = 0;
  let action = 'hold';
  if (score >= 75) {
    convertPercent = 75;
    action = 'convert';
  } else if (score >= 60) {
    convertPercent = 50;
    action = 'convert_partial';
  } else if (score >= 45) {
    convertPercent = 25;
    action = 'convert_small';
  }

  const weeklyIncomeEur = weeklyIncomeAud * currentRate;
  let convertAud = weeklyIncomeAud * (convertPercent / 100);
  let holdAud = weeklyIncomeAud - convertAud;
  const targetHoldAud = Number(input.targetHoldAud);
  const hasTargetHoldAud = Number.isFinite(targetHoldAud) && targetHoldAud >= 0;
  if (hasTargetHoldAud) {
    holdAud = Math.max(0, Math.min(weeklyIncomeAud, targetHoldAud));
    convertAud = Math.max(0, weeklyIncomeAud - holdAud);
    convertPercent = weeklyIncomeAud > 0 ? Math.round((convertAud / weeklyIncomeAud) * 100) : 0;
    if (convertPercent >= 65) action = 'convert';
    else if (convertPercent >= 40) action = 'convert_partial';
    else if (convertPercent > 0) action = 'convert_small';
    else action = 'hold';
  }
  const signalStrength = Math.abs(positionHorizon) + Math.abs(position180) + Math.min(Math.abs(trendRatio) * 18, 0.05);
  let confidenceLevel = 'medium';
  let confidenceScore = 55;
  if (dataPointsHorizon < Math.min(60, horizonDays * 0.65) || volatilityHorizon > 0.055 || signalStrength < 0.012) {
    confidenceLevel = 'low';
    confidenceScore = 35;
  } else if (dataPointsHorizon >= Math.min(85, horizonDays * 0.85) && volatilityHorizon < 0.03 && signalStrength >= 0.025) {
    confidenceLevel = 'high';
    confidenceScore = 75;
  }

  return {
    status: 'ok',
    action,
    convertPercent,
    score,
    horizonDays,
    weeklyIncomeAud,
    currentRate,
    currentEur: weeklyIncomeEur,
    convertAud,
    convertEur: convertAud * currentRate,
    holdAud,
    holdEur: holdAud * currentRate,
    targetHoldAud: hasTargetHoldAud ? holdAud : null,
    scenarios: {
      keepAllAud: {
        aud: weeklyIncomeAud,
        eurNow: weeklyIncomeEur,
      },
      convertNow: {
        aud: convertAud,
        eur: convertAud * currentRate,
      },
      keepAfterConversion: {
        aud: holdAud,
        eurNow: holdAud * currentRate,
      },
    },
    confidence: {
      level: confidenceLevel,
      score: confidenceScore,
    },
    metrics: {
      avg30,
      avg90,
      avg180,
      avgHorizon,
      positionHorizon,
      position90,
      trendRatio,
      volatilityHorizon,
      volatility90,
      dataPointsHorizon,
      dataPoints90,
    },
  };
}
