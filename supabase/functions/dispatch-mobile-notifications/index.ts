import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Slot = "morning" | "evening";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tb-notification-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function localParts(timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour || 0) };
}

function slotForHour(hour: number): Slot | null {
  if (hour >= 7 && hour <= 10) return "morning";
  if (hour >= 19 && hour <= 22) return "evening";
  return null;
}

function prefEnabled(prefs: Record<string, unknown>, slot: Slot) {
  if (prefs.serverPush === false) return false;
  if (slot === "morning") return prefs.morningBudget === true || prefs.dailyBudget === true;
  return prefs.eveningSummary === true;
}

function money(value: number, currency: string) {
  return `${Math.round(value * 100) / 100} ${currency}`.trim();
}

function dayCountInclusive(start: string, end: string) {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime()) || e < s) return 1;
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
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
      const slot = (requestedSlot === "morning" || requestedSlot === "evening") ? requestedSlot as Slot : slotForHour(parts.hour);
      if (!slot || !prefEnabled(prefs, slot)) continue;

      const notificationKey = `daily-budget:${slot}:${parts.date}`;
      const { data: existing } = await admin.from("mobile_notification_deliveries").select("id").eq("user_id", row.user_id).eq("notification_key", notificationKey).maybeSingle();
      if (existing?.id) {
        results.push({ user_id: row.user_id, slot, skipped: true, reason: "already_sent" });
        continue;
      }

      const budget = await budgetSummary(admin, row.user_id, parts.date);
      const activity = await activitySummary(admin, row.user_id, parts.date);
      const title = slot === "evening" ? "Bilan du soir" : "Budget du matin";
      const body = slot === "evening"
        ? `Budget restant ${money(budget.remaining, budget.base)}. Sport ${Math.round(activity.sportKcal)} kcal, travail ${Math.round(activity.workKcal)} kcal.`
        : `Reste aujourd'hui ${money(budget.remaining, budget.base)}. Depense du jour ${money(budget.spent, budget.base)} / ${money(budget.daily, budget.base)}.`;
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
          sport_kcal: String(Math.round(activity.sportKcal)),
          work_kcal: String(Math.round(activity.workKcal)),
        },
      });
      await admin.from("mobile_notification_deliveries").insert({ user_id: row.user_id, notification_key: notificationKey, slot, sent_for_date: parts.date, status: "sent" });
      results.push({ user_id: row.user_id, slot, sent: send.sent || 0, failed: send.failed || 0 });
    }
    return json({ ok: true, dry_run: dryRun, checked: settingsRows?.length || 0, results });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
