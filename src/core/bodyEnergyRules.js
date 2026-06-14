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

export function ageFromBirthDate(birthDate, today = new Date()) {
  const raw = String(birthDate || '').trim();
  if (!raw) return 0;
  let year = 0;
  let month = 0;
  let day = 0;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const fr = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (fr) {
    day = Number(fr[1]);
    month = Number(fr[2]);
    year = Number(fr[3]);
  }
  if (!year || !month || !day) return 0;
  const now = today instanceof Date ? today : new Date(today);
  if (Number.isNaN(now.getTime())) return 0;
  let age = now.getFullYear() - year;
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  return age > 0 && age < 130 ? age : 0;
}

export function resolveDailyBaselineKcal({ customBmr, kg = 70, heightCm = 175, age = 30, birthDate = '', sex = 'male', activityFactor = 1.2, today } = {}) {
  const manual = num(customBmr, 0);
  const resolvedAge = ageFromBirthDate(birthDate, today || new Date()) || age;
  const bmr = manual > 0 ? manual : mifflinStJeorBmr({ kg, heightCm, age: resolvedAge, sex });
  return {
    bmr,
    bmi: bmi({ kg, heightCm }),
    maintenanceKcal: bmr * Math.max(1, num(activityFactor, 1.2)),
    source: manual > 0 ? 'manual' : 'estimated',
    age: resolvedAge,
  };
}
