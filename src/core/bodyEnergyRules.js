function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function bmi({ kg = 70, heightCm = 175 } = {}) {
  const h = Math.max(0.5, num(heightCm, 175) / 100);
  return Math.max(0, num(kg, 70) / (h * h));
}

export function mifflinStJeorBmr({ kg = 70, heightCm = 175, age = 30, sex = 'male' } = {}) {
  const base = (10 * Math.max(1, num(kg, 70))) + (6.25 * Math.max(60, num(heightCm, 175))) - (5 * Math.max(10, num(age, 30)));
  const offset = String(sex || '').toLowerCase().startsWith('f') ? -161 : 5;
  return Math.max(0, base + offset);
}

export function resolveDailyBaselineKcal({ customBmr, kg = 70, heightCm = 175, age = 30, sex = 'male', activityFactor = 1.2 } = {}) {
  const manual = num(customBmr, 0);
  const bmr = manual > 0 ? manual : mifflinStJeorBmr({ kg, heightCm, age, sex });
  return {
    bmr,
    bmi: bmi({ kg, heightCm }),
    maintenanceKcal: bmr * Math.max(1, num(activityFactor, 1.2)),
    source: manual > 0 ? 'manual' : 'estimated',
  };
}
