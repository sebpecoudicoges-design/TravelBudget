import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const PROTECTED_TRAVEL_ID = "d6c3e70a-d31f-4647-91e8-e12830d0c00d"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || ""

    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: callerAuth, error: callerAuthErr } = await callerClient.auth.getUser()
    if (callerAuthErr) throw callerAuthErr

    const callerUserId = callerAuth?.user?.id
    if (!callerUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: callerProfile, error: profileErr } = await admin
      .from("profiles")
      .select("id,role,email")
      .eq("id", callerUserId)
      .maybeSingle()

    if (profileErr) throw profileErr
    if (!callerProfile || String(callerProfile.role || "").toLowerCase() !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = await req.json()
    const targetUserId = body?.targetUserId || body?.userId
    const mode = body?.mode || "all"

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "targetUserId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: protectedTravelRows, error: protectedTravelErr } = await admin
      .from("travels")
      .select("id,user_id,name")
      .eq("id", PROTECTED_TRAVEL_ID)
      .eq("user_id", targetUserId)

    if (protectedTravelErr) throw protectedTravelErr
    if ((protectedTravelRows || []).length) {
      return new Response(JSON.stringify({
        error: "Protected user/travel cannot be wiped",
        protectedTravelId: PROTECTED_TRAVEL_ID,
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: trips, error: tripsErr } = await admin
      .from("trip_groups")
      .select("id")
      .eq("user_id", targetUserId)
    if (tripsErr) throw tripsErr

    const tripIds = (trips || []).map((t) => t.id)

    if (tripIds.length) {
      const { data: settlementTx, error: settlementTxErr } = await admin
        .from("trip_settlement_events")
        .select("transaction_id")
        .in("trip_id", tripIds)
      if (settlementTxErr) throw settlementTxErr

      const settlementTxIds = (settlementTx || []).map((t) => t.transaction_id).filter(Boolean)
      if (settlementTxIds.length) {
        const { error } = await admin
          .from("transactions")
          .update({ trip_share_link_id: null, trip_expense_id: null })
          .in("id", settlementTxIds)
        if (error) throw error
      }

      const { data: expenseRows, error: expenseRowsErr } = await admin
        .from("trip_expenses")
        .select("id")
        .in("trip_id", tripIds)
      if (expenseRowsErr) throw expenseRowsErr

      const expenseIds = (expenseRows || []).map((e) => e.id)
      if (expenseIds.length) {
        const { error: detachTx } = await admin
          .from("transactions")
          .update({ trip_expense_id: null })
          .in("trip_expense_id", expenseIds)
        if (detachTx) throw detachTx

        const { error: detachExpense } = await admin
          .from("trip_expenses")
          .update({ transaction_id: null })
          .in("id", expenseIds)
        if (detachExpense) throw detachExpense
      }

      const deletions = [
        admin.from("trip_expense_budget_links").delete().in("trip_id", tripIds),
        admin.from("trip_expense_shares").delete().in("trip_id", tripIds),
        admin.from("trip_settlement_events").delete().in("trip_id", tripIds),
        admin.from("trip_settlements").delete().in("trip_id", tripIds),
        admin.from("trip_expenses").delete().in("trip_id", tripIds),
        admin.from("trip_members").delete().in("trip_id", tripIds),
        admin.from("trip_participants").delete().in("trip_id", tripIds),
        admin.from("trip_invites").delete().in("trip_id", tripIds),
        admin.from("trip_groups").delete().in("id", tripIds),
      ]

      for (const q of deletions) {
        const { error } = await q
        if (error) throw error
      }
    }

    for (const step of [
      admin.from("asset_documents").delete().eq("user_id", targetUserId),
      admin.from("transaction_documents").delete().eq("user_id", targetUserId),
      admin.from("trip_expense_documents").delete().eq("user_id", targetUserId),
      admin.from("documents").delete().eq("user_id", targetUserId),
      admin.from("document_folders").delete().eq("user_id", targetUserId),
      admin.from("inbox_items").delete().eq("user_id", targetUserId),
      admin.from("assets").delete().eq("user_id", targetUserId),
      admin.from("transactions").delete().eq("user_id", targetUserId),
      admin.from("recurring_rules").delete().eq("user_id", targetUserId),
      admin.from("wallet_transfers").delete().eq("user_id", targetUserId),
      admin.from("wallets").delete().eq("user_id", targetUserId),
      admin.from("budget_segments").delete().eq("user_id", targetUserId),
      admin.from("periods").delete().eq("user_id", targetUserId),
      admin.from("travels").delete().eq("user_id", targetUserId),
      admin.from("fx_manual_rates").delete().eq("user_id", targetUserId),
    ]) {
      const { error } = await step
      if (error) throw error
    }

    if (mode === "all") {
      const { error: settingsErr } = await admin.from("settings").delete().eq("user_id", targetUserId)
      if (settingsErr) throw settingsErr

      const { error: catErr } = await admin.from("categories").delete().eq("user_id", targetUserId)
      if (catErr) throw catErr

      const { error: mapErr } = await admin.from("analytic_category_mappings").delete().eq("user_id", targetUserId)
      if (mapErr) throw mapErr
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Reset utilisateur terminé avec succès (travels + règles récurrentes inclus).",
      wipedTrips: tripIds.length,
      mode,
      actor: callerUserId,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
