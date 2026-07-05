import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { normalizeFrankfurterLatest } from "../../../src/core/frankfurterRules.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // ✅ Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    // Source FX (base EUR)
    const resp = await fetch("https://api.frankfurter.dev/v2/rates?base=EUR", {
      headers: { "accept": "application/json" },
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return json({ error: `FX upstream failed (${resp.status})`, detail: txt.slice(0, 300) }, 502);
    }

    const data = await resp.json().catch(() => null);
    const normalized = normalizeFrankfurterLatest(data, "EUR");

    if (Object.keys(normalized.rates).length <= 1) {
      return json({ error: "Invalid FX payload (missing rates)", raw: data }, 502);
    }

    return json({
      ok: true,
      source: "frankfurter_v2",
      base: normalized.base,
      date: normalized.date,
      rates: normalized.rates,
      rate_dates: normalized.dates,
    }, 200);
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
