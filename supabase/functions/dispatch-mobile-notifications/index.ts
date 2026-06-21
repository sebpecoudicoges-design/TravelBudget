import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Slot = "morning" | "midday" | "evening" | "health" | "manual" | "custom";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tb-notification-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function localParts(timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hour12: false });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(String(parts.weekday || ""));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour || 0), weekday: dow >= 0 ? dow : new Date().getUTCDay() };
}

function slotForHour(hour: number): Slot | null {
  if (hour >= 7 && hour <= 10) return "morning";
  if (hour >= 11 && hour <= 14) return "midday";
  if (hour >= 19 && hour <= 22) return "evening";
  return null;
}

function prefEnabled(prefs: Record<string, unknown>, slot: Slot) {
  if (prefs.serverPush === false) return false;
  if (slot === "morning") return prefs.morningBudget === true || prefs.dailyBudget === true;
  if (slot === "evening") return prefs.eveningSummary === true;
  if (slot === "health" || slot === "midday") return prefs.healthMealReminders === true || prefs.nutritionReminders === true;
  return true;
}

function money(value: number, currency: string) {
  return `${Math.round(value * 100) / 100} ${currency}`.trim();
}

function prefBool(prefs: Record<string, unknown>, key: string, fallback = true) {
  return prefs[key] === undefined ? fallback : prefs[key] !== false;
}

function withEmoji(text: string, emoji: string, enabled: boolean) {
  return enabled ? `${emoji} ${text}` : text;
}

function signedPctText(value: number) {
  const n = Number(value) || 0;
  return `${n > 0 ? "+" : ""}${Math.round(n)}%`;
}

function signedMoney(value: number, currency: string) {
  const n = Number(value) || 0;
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}${money(Math.abs(n), currency)}`;
}

function dayCountInclusive(start: string, end: string) {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime()) || e < s) return 1;
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

function addDaysISO(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function ageOnDate(birthDate: string, date: string) {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const now = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(birth.getTime()) || !Number.isFinite(now.getTime())) return 30;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return Math.max(12, age);
}

function convertWithSnapshot(tx: Record<string, unknown>, amount: number, targetCurrency: string) {
  const txCurrency = String(tx.currency || "").toUpperCase();
  const snapFrom = String(tx.fx_tx_currency_snapshot || "").toUpperCase();
  const snapTo = String(tx.fx_base_currency_snapshot || "").toUpperCase();
  const rate = Number(tx.fx_rate_snapshot || 0);
  if (txCurrency === targetCurrency) return amount;
  if (rate > 0 && snapFrom === txCurrency && snapTo === targetCurrency) return amount * rate;
  return amount;
}

function budgetTone(remaining: number, spent: number, daily: number) {
  if (remaining < 0) return "over_today";
  if (daily > 0 && spent / daily > 0.85) return "near_limit";
  if (remaining > Math.max(5, daily * 0.35)) return "ahead";
  return "steady";
}

function composeNotification(slot: Slot, budget: { base: string; daily: number; spent: number; remaining: number }, activity: { sportCount: number; sportKcal: number; workCount: number; workKcal: number; workMinutes: number }, prefs: Record<string, unknown>) {
  const emojis = prefBool(prefs, "emojis", true);
  const motivational = prefBool(prefs, "motivationalTone", true);
  const sportReminder = prefBool(prefs, "sportReminder", true);
  const workReminder = prefBool(prefs, "workReminder", true);
  const tone = budgetTone(budget.remaining, budget.spent, budget.daily);
  const evening = slot === "evening";

  let title = evening ? withEmoji("Bilan du soir", "🌙", emojis) : withEmoji("Budget du matin", "🌅", emojis);
  if (!evening && tone === "over_today") title = withEmoji("Budget a surveiller", "⚠️", emojis);
  if (!evening && tone === "near_limit") title = withEmoji("Rythme budget eleve", "🟠", emojis);
  if (!evening && tone === "ahead") title = withEmoji("Budget en avance", "✅", emojis);

  const baseLine = evening
    ? `Budget restant ${money(budget.remaining, budget.base)}.`
    : `Reste ${money(budget.remaining, budget.base)}. Jour ${money(budget.spent, budget.base)} / ${money(budget.daily, budget.base)}.`;

  let nudge = "";
  if (motivational && evening) {
    if (activity.sportKcal > 0 && activity.workKcal > 0) nudge = `Sport ${Math.round(activity.sportKcal)} kcal, travail ${Math.round(activity.workKcal)} kcal.`;
    else if (activity.sportKcal > 0) nudge = `Sport ${Math.round(activity.sportKcal)} kcal.`;
    else if (activity.workKcal > 0) nudge = `Travail ${Math.round(activity.workKcal)} kcal sur ${Math.round(activity.workMinutes / 60 * 10) / 10}h.`;
    else if (workReminder) nudge = "Travail fait ? Ajoute la journee.";
  }
  if (motivational && !evening && sportReminder && activity.sportCount <= 0) {
    nudge = "15 min de marche, corde ou ping-pong ?";
  }

  return { title, body: `${baseLine}${nudge ? ` ${nudge}` : ""}`.trim(), tone };
}

function renderSlashTemplate(template: string, values: Record<string, string>) {
  let out = String(template || "");
  for (const [key, value] of Object.entries(values)) out = out.split(key).join(value);
  return out;
}

function templateDue(template: Record<string, unknown>, slot: Slot, weekday: number) {
  if (template.enabled === false) return false;
  if (String(template.channel || "mobile") !== "mobile") return false;
  const days = Array.isArray(template.days_of_week) ? template.days_of_week.map(Number) : [0, 1, 2, 3, 4, 5, 6];
  if (!days.includes(weekday)) return false;
  const tplSlot = String(template.slot || "custom").toLowerCase();
  if (tplSlot === "custom") return slot === "custom" || slot === "manual";
  if (tplSlot === "health") return slot === "health" || slot === "midday";
  return tplSlot === slot;
}

function composeTemplateNotification(
  template: Record<string, unknown>,
  budget: { base: string; daily: number; spent: number; remaining: number },
  activity: { sportCount: number; sportKcal: number; workCount: number; workKcal: number; workMinutes: number },
  date: string,
  extras: Record<string, string> = {},
) {
  const values: Record<string, string> = {
    "/budgetdujour": money(budget.daily, budget.base),
    "/budgetrestant": money(budget.remaining, budget.base),
    "/depensesjour": money(budget.spent, budget.base),
    "/date": date,
    "/solde": "",
    "/kcalobjectif": extras["/kcalobjectif"] || "",
    "/kcalconsommees": extras["/kcalconsommees"] || "",
    "/sportkcal": `${Math.round(activity.sportKcal)} kcal`,
    "/travailkcal": `${Math.round(activity.workKcal)} kcal`,
    "/eau": extras["/eau"] || "",
    "/proteines": extras["/proteines"] || "",
    "/sommeil": extras["/sommeil"] || "",
    "/scoreSante": extras["/scoreSante"] || "",
    "/seanceprevuejour": extras["/seanceprevuejour"] || "Repos",
    "/kcalrestantesheure": extras["/kcalrestantesheure"] || "",
    "/kcalrestantesjour": extras["/kcalrestantesjour"] || "",
    "/budgetconsommeanalyse": extras["/budgetconsommeanalyse"] || money(0, budget.base),
    "/rythmeapp": extras["/rythmeapp"] || "0%",
    "/rythmerefpays": extras["/rythmerefpays"] || "0%",
    "/ecartapp": extras["/ecartapp"] || money(0, budget.base),
    "/ecartrefpays": extras["/ecartrefpays"] || money(0, budget.base),
    "/sortiesapayerj1": extras["/sortiesapayerj1"] || `${money(0, budget.base)} (0)`,
    "/sortiesapayerj7": extras["/sortiesapayerj7"] || `${money(0, budget.base)} (0)`,
    "/sortiesapayerretard": extras["/sortiesapayerretard"] || `${money(0, budget.base)} (0)`,
    "/moyennebudget": extras["/moyennebudget"] || `${money(0, budget.base)}/j`,
    "/moyennehorsbudget": extras["/moyennehorsbudget"] || `${money(0, budget.base)}/j`,
    "/moyennetotal": extras["/moyennetotal"] || `${money(0, budget.base)}/j`,
  };
  const emoji = String(template.emoji || "").trim();
  const rawTitle = renderSlashTemplate(String(template.title_template || "Notification"), values).trim();
  const title = `${emoji ? `${emoji} ` : ""}${rawTitle}`.trim();
  const body = renderSlashTemplate(String(template.body_template || ""), values).trim();
  return { title, body, values };
}

async function budgetSummary(admin: ReturnType<typeof createClient>, userId: string, date: string) {
  const { data: period } = await admin
    .from("periods")
    .select("id,travel_id,base_currency,daily_budget_base,start_date,end_date")
    .eq("user_id", userId)
    .lte("start_date", date)
    .gte("end_date", date)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: segment } = period?.id
    ? await admin
      .from("budget_segments")
      .select("id,base_currency,daily_budget_base,start_date,end_date,sort_order")
      .eq("user_id", userId)
      .eq("period_id", period.id)
      .lte("start_date", date)
      .gte("end_date", date)
      .order("sort_order", { ascending: true })
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle()
    : { data: null };

  const base = String(segment?.base_currency || period?.base_currency || "EUR").toUpperCase();
  const daily = Number(segment?.daily_budget_base ?? period?.daily_budget_base ?? 0);
  const { data: txRows } = await admin
    .from("transactions")
    .select("amount,currency,type,affects_budget,out_of_budget,budget_date_start,budget_date_end,travel_id,period_id,fx_rate_snapshot,fx_base_currency_snapshot,fx_tx_currency_snapshot")
    .eq("user_id", userId)
    .eq("type", "expense")
    .eq("affects_budget", true)
    .lte("budget_date_start", date)
    .gte("budget_date_end", date);
  const spent = (txRows || [])
    .filter((tx) => tx.out_of_budget !== true)
    .filter((tx) => !period?.travel_id || !tx.travel_id || String(tx.travel_id) === String(period.travel_id))
    .filter((tx) => !period?.id || !tx.period_id || String(tx.period_id) === String(period.id))
    .reduce((sum, tx) => {
      const start = String(tx.budget_date_start || date).slice(0, 10);
      const end = String(tx.budget_date_end || start).slice(0, 10);
      const perDay = Number(tx.amount || 0) / dayCountInclusive(start, end);
      return sum + convertWithSnapshot(tx as Record<string, unknown>, perDay, base);
    }, 0);
  return { base, daily, spent, remaining: daily - spent };
}

async function activitySummary(admin: ReturnType<typeof createClient>, userId: string, date: string) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextDate = next.toISOString().slice(0, 10);
  const [{ data: sportRows }, { data: workRows }] = await Promise.all([
    admin.from("sport_sessions").select("estimated_kcal,started_at").eq("user_id", userId).gte("started_at", `${date}T00:00:00Z`).lt("started_at", `${nextDate}T00:00:00Z`),
    admin.from("work_days").select("estimated_kcal,duration_minutes").eq("user_id", userId).eq("work_date", date),
  ]);
  return {
    sportCount: sportRows?.length || 0,
    sportKcal: (sportRows || []).reduce((sum, row) => sum + Number(row.estimated_kcal || 0), 0),
    workCount: workRows?.length || 0,
    workKcal: (workRows || []).reduce((sum, row) => sum + Number(row.estimated_kcal || 0), 0),
    workMinutes: (workRows || []).reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0),
  };
}

async function healthTemplateValues(admin: ReturnType<typeof createClient>, userId: string, date: string, hour: number, activity: { sportKcal: number; workKcal: number }) {
  const [{ data: meals }, { data: sleep }, { data: settings }] = await Promise.all([
    admin.from("nutrition_meals").select("id,water_ml,nutrition_meal_items(kcal,protein_g)").eq("user_id", userId).eq("meal_date", date),
    admin.from("nutrition_sleep").select("hours,quality").eq("user_id", userId).eq("sleep_date", addDaysISO(date, -1)).maybeSingle(),
    admin.from("settings").select("birth_date,body_weight_kg,body_height_cm").eq("user_id", userId).maybeSingle(),
  ]);
  let kcal = 0;
  let protein = 0;
  let water = 0;
  for (const meal of meals || []) {
    water += Number(meal.water_ml || 0);
    const items = Array.isArray(meal.nutrition_meal_items) ? meal.nutrition_meal_items : [];
    for (const item of items) {
      kcal += Number(item.kcal || 0);
      protein += Number(item.protein_g || 0);
    }
  }
  const weight = Number(settings?.body_weight_kg || 70);
  const height = Number(settings?.body_height_cm || 175);
  const birthDate = String(settings?.birth_date || "").slice(0, 10);
  const age = birthDate ? ageOnDate(birthDate, date) : 30;
  const bmr = Math.max(1200, (10 * weight) + (6.25 * height) - (5 * age) + 5);
  const mode = "maintenance";
  const offset = 0;
  const needs = Math.max(1200, bmr + Number(activity.sportKcal || 0) + Number(activity.workKcal || 0) + offset);
  const proteinTarget = Math.max(70, weight * (mode === "bulk" ? 1.8 : mode === "cut" ? 1.9 : 1.6));
  const hydrationScore = Math.min(24, (water / 2000) * 24);
  const proteinScore = Math.min(18, (protein / proteinTarget) * 18);
  const kcalScore = Math.max(0, 28 - Math.min(28, Math.abs(kcal - needs) / Math.max(1, needs) * 42));
  const sleepHours = Number(sleep?.hours || 0);
  const sleepScore = sleepHours >= 7 && sleepHours <= 9.5 ? 18 : sleepHours > 0 ? 10 : 0;
  const score = Math.max(0, Math.min(100, Math.round(kcalScore + hydrationScore + proteinScore + sleepScore)));
  return {
    "/kcalobjectif": `${Math.round(needs)} kcal`,
    "/kcalconsommees": `${Math.round(kcal)} kcal`,
    "/eau": `${Math.round(water)} ml`,
    "/proteines": `${Math.round(protein)} g`,
    "/sommeil": sleepHours ? `${Math.round(sleepHours * 10) / 10}h` : "non saisi",
    "/scoreSante": `${score}/100`,
    "/kcalrestantesheure": `${Math.max(0, Math.round((needs * Math.min(1, Math.max(0.08, hour / 24))) - kcal))} kcal`,
    "/kcalrestantesjour": `${Math.max(0, Math.round(needs - kcal))} kcal`,
  };
}

async function plannedSessionLabel(admin: ReturnType<typeof createClient>, userId: string, date: string, weekday: number) {
  const dayOfWeek = weekday === 0 ? 7 : weekday;
  const { data: program } = await admin
    .from("sport_programs")
    .select("id,start_date,cycle")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!program?.id) return "Repos";
  const start = String(program.start_date || date).slice(0, 10);
  const diffDays = Math.max(0, Math.floor((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86400000));
  const weekLabel = Math.floor(diffDays / 7) % 2 === 0 ? "A" : "B";
  const { data: session } = await admin
    .from("sport_program_sessions")
    .select("session_key,name,week_label,day_of_week")
    .eq("program_id", program.id)
    .eq("day_of_week", dayOfWeek)
    .eq("week_label", weekLabel)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!session?.name) return "Repos";
  return [session.session_key, session.name].filter(Boolean).join(" - ");
}

async function financeTemplateValues(admin: ReturnType<typeof createClient>, userId: string, date: string, budget: { base: string; daily: number; spent: number; remaining: number }) {
  const { data: period } = await admin
    .from("periods")
    .select("id,travel_id,start_date,end_date,base_currency")
    .eq("user_id", userId)
    .lte("start_date", date)
    .gte("end_date", date)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = String(period?.start_date || date).slice(0, 10);
  const end = String(period?.end_date || date).slice(0, 10);
  const elapsedDays = Math.max(1, dayCountInclusive(start, date));
  const periodDays = Math.max(1, dayCountInclusive(start, end));
  const { data: txRows } = await admin
    .from("transactions")
    .select("amount,currency,type,affects_budget,out_of_budget,budget_date_start,budget_date_end,date,pay_now,paid,travel_id,period_id,fx_rate_snapshot,fx_base_currency_snapshot,fx_tx_currency_snapshot")
    .eq("user_id", userId)
    .eq("type", "expense")
    .lte("budget_date_start", end)
    .gte("budget_date_end", start);
  const scoped = (txRows || [])
    .filter((tx) => !period?.travel_id || !tx.travel_id || String(tx.travel_id) === String(period.travel_id))
    .filter((tx) => !period?.id || !tx.period_id || String(tx.period_id) === String(period.id));
  const isPaid = (tx: Record<string, unknown>) => tx.pay_now === true || tx.paid === true;
  const amountInWindow = (tx: Record<string, unknown>, windowEnd: string) => {
    const txStart = String(tx.budget_date_start || tx.date || date).slice(0, 10);
    const txEnd = String(tx.budget_date_end || txStart).slice(0, 10);
    const visibleStart = txStart > start ? txStart : start;
    const visibleEnd = txEnd < windowEnd ? txEnd : windowEnd;
    if (visibleEnd < visibleStart) return 0;
    const fullDays = dayCountInclusive(txStart, txEnd);
    const visibleDays = dayCountInclusive(visibleStart, visibleEnd);
    const perDay = Number(tx.amount || 0) / fullDays;
    return convertWithSnapshot(tx, perDay * visibleDays, budget.base);
  };
  const budgetRows = scoped.filter((tx) => tx.affects_budget !== false && tx.out_of_budget !== true);
  const outRows = scoped.filter((tx) => tx.out_of_budget === true);
  const spentToToday = budgetRows.reduce((sum, tx) => sum + amountInWindow(tx as Record<string, unknown>, date), 0);
  const outToToday = outRows.reduce((sum, tx) => sum + amountInWindow(tx as Record<string, unknown>, date), 0);
  const targetToToday = budget.daily * elapsedDays;
  const totalBudget = budget.daily * periodDays;
  const pendingRows = budgetRows.filter((tx) => !isPaid(tx as Record<string, unknown>));
  const pendingSum = (mode: "future" | "overdue", until?: string) => pendingRows.reduce((sum, tx) => {
    const due = String(tx.date || tx.budget_date_start || date).slice(0, 10);
    if (mode === "overdue" && due >= date) return sum;
    if (mode === "future" && (due < date || !until || due > until)) return sum;
    return sum + amountInWindow(tx as Record<string, unknown>, due < date ? date : due);
  }, 0);
  const pendingCount = (mode: "future" | "overdue", until?: string) => pendingRows.reduce((count, tx) => {
    const due = String(tx.date || tx.budget_date_start || date).slice(0, 10);
    if (mode === "overdue") return count + (due < date ? 1 : 0);
    return count + (due >= date && until && due <= until ? 1 : 0);
  }, 0);
  return {
    "/budgetconsommeanalyse": money(spentToToday, budget.base),
    "/rythmeapp": signedPctText(targetToToday > 0 ? (spentToToday / targetToToday) * 100 : 0),
    "/rythmerefpays": "0%",
    "/ecartapp": signedMoney(spentToToday - targetToToday, budget.base),
    "/ecartrefpays": "0",
    "/sortiesapayerj1": `${money(pendingSum("future", addDaysISO(date, 1)), budget.base)} (${pendingCount("future", addDaysISO(date, 1))})`,
    "/sortiesapayerj7": `${money(pendingSum("future", addDaysISO(date, 7)), budget.base)} (${pendingCount("future", addDaysISO(date, 7))})`,
    "/sortiesapayerretard": `${money(pendingSum("overdue"), budget.base)} (${pendingCount("overdue")})`,
    "/moyennebudget": `${money(spentToToday / elapsedDays, budget.base)}/j`,
    "/moyennehorsbudget": `${money(outToToday / elapsedDays, budget.base)}/j`,
    "/moyennetotal": `${money((spentToToday + outToToday) / elapsedDays, budget.base)}/j`,
  };
}

async function sendPush(payload: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const secret = Deno.env.get("MOBILE_PUSH_INTERNAL_SECRET") || "";
  const resp = await fetch(`${url}/functions/v1/send-mobile-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey, "x-tb-notification-secret": secret },
    body: JSON.stringify({ ...payload, force: true }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(String(data?.error || `send-mobile-notification HTTP ${resp.status}`));
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const secret = Deno.env.get("MOBILE_PUSH_INTERNAL_SECRET") || "";
    if (!secret || req.headers.get("x-tb-notification-secret") !== secret) return json({ error: "Unauthorized" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase env vars" }, 500);

    const payload = await req.json().catch(() => ({}));
    const requestedSlot = String(payload?.slot || "").toLowerCase();
    const dryRun = payload?.dry_run === true;
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: settingsRows, error } = await admin.from("settings").select("user_id,notification_prefs").not("notification_prefs", "is", null);
    if (error) throw error;

    const results = [];
    for (const row of settingsRows || []) {
      const prefs = row.notification_prefs && typeof row.notification_prefs === "object" ? row.notification_prefs as Record<string, unknown> : {};
      const parts = localParts(String(prefs.timezone || "Australia/Brisbane"));
      const slot = (["morning", "midday", "evening", "health", "manual", "custom"].includes(requestedSlot)) ? requestedSlot as Slot : slotForHour(parts.hour);
      if (!slot || !prefEnabled(prefs, slot)) continue;

      const { data: templates } = await admin
        .from("notification_templates")
        .select("id,name,slot,channel,enabled,send_time,days_of_week,emoji,title_template,body_template,variables")
        .eq("user_id", row.user_id)
        .eq("enabled", true);
      const dueTemplates = (templates || []).filter((tpl) => templateDue(tpl as Record<string, unknown>, slot, parts.weekday));
      if (dueTemplates.length) {
        const budget = await budgetSummary(admin, row.user_id, parts.date);
        const activity = await activitySummary(admin, row.user_id, parts.date);
        const [financeValues, healthValues, plannedLabel] = await Promise.all([
          financeTemplateValues(admin, row.user_id, parts.date, budget),
          healthTemplateValues(admin, row.user_id, parts.date, parts.hour, activity),
          plannedSessionLabel(admin, row.user_id, parts.date, parts.weekday),
        ]);
        const extraValues = { ...financeValues, ...healthValues, "/seanceprevuejour": plannedLabel };
        for (const tpl of dueTemplates) {
          const template = tpl as Record<string, unknown>;
          const notificationKey = `template:${template.id}:${parts.date}:${String(template.send_time || "").slice(0, 5)}`;
          const { data: existing } = await admin.from("mobile_notification_deliveries").select("id").eq("user_id", row.user_id).eq("notification_key", notificationKey).maybeSingle();
          if (existing?.id) {
            results.push({ user_id: row.user_id, template_id: template.id, slot, skipped: true, reason: "already_sent" });
            continue;
          }
          const message = composeTemplateNotification(template, budget, activity, parts.date, extraValues);
          if (dryRun) {
            results.push({ user_id: row.user_id, template_id: template.id, slot, dry_run: true, title: message.title, body: message.body });
            continue;
          }
          const send = await sendPush({
            user_id: row.user_id,
            title: message.title,
            body: message.body,
            source: "template_notification",
            view: "dashboard",
            notification_key: notificationKey,
            data: {
              kind: "template_notification",
              slot,
              today: parts.date,
              template_id: String(template.id || ""),
              template_name: String(template.name || ""),
              variables: message.values,
            },
          });
          await admin.from("mobile_notification_deliveries").insert({
            user_id: row.user_id,
            template_id: template.id,
            notification_key: notificationKey,
            slot,
            sent_for_date: parts.date,
            status: "sent",
            title: message.title,
            body: message.body,
            payload: { source: "template_notification", template_name: template.name, variables: message.values },
          });
          results.push({ user_id: row.user_id, template_id: template.id, slot, sent: send.sent || 0, failed: send.failed || 0 });
        }
        continue;
      }

      if ((templates || []).length) continue;
      if (slot !== "morning" && slot !== "evening") continue;

      const notificationKey = `daily-budget:${slot}:${parts.date}`;
      const { data: existing } = await admin.from("mobile_notification_deliveries").select("id").eq("user_id", row.user_id).eq("notification_key", notificationKey).maybeSingle();
      if (existing?.id) {
        results.push({ user_id: row.user_id, slot, skipped: true, reason: "already_sent" });
        continue;
      }

      const budget = await budgetSummary(admin, row.user_id, parts.date);
      const activity = await activitySummary(admin, row.user_id, parts.date);
      const message = composeNotification(slot, budget, activity, prefs);
      const title = message.title;
      const body = message.body;
      if (dryRun) {
        results.push({ user_id: row.user_id, slot, dry_run: true, title, body });
        continue;
      }
      const send = await sendPush({
        user_id: row.user_id,
        title,
        body,
        source: "daily_budget",
        view: "dashboard",
        notification_key: notificationKey,
        data: {
          kind: "daily_budget",
          slot,
          today: parts.date,
          currency: budget.base,
          remaining_today: String(Math.round(budget.remaining * 100) / 100),
          spent_today: String(Math.round(budget.spent * 100) / 100),
          daily_budget: String(Math.round(budget.daily * 100) / 100),
          tone: message.tone,
          sport_kcal: String(Math.round(activity.sportKcal)),
          work_kcal: String(Math.round(activity.workKcal)),
        },
      });
      await admin.from("mobile_notification_deliveries").insert({ user_id: row.user_id, notification_key: notificationKey, slot, sent_for_date: parts.date, status: "sent", title, body, payload: { source: "daily_budget", tone: message.tone } });
      results.push({ user_id: row.user_id, slot, sent: send.sent || 0, failed: send.failed || 0 });
    }
    return json({ ok: true, dry_run: dryRun, checked: settingsRows?.length || 0, results });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
