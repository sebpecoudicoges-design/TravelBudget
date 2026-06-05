import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const textResponse = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

const normalizePhone = (value: string) =>
  String(value || "")
    .replace(/^whatsapp:/i, "")
    .replace(/\s+/g, "")
    .replace(/[().-]/g, "")
    .trim();

const shortId = (value: string) => {
  const v = String(value || "");
  return v.length > 8 ? `...${v.slice(-8)}` : v;
};

function webhookUrl(req: Request) {
  return Deno.env.get("TWILIO_WEBHOOK_URL") || req.url;
}

function timingSafeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function twilioSignature(req: Request, form: FormData, authToken: string) {
  const pairs = Array.from(form.entries())
    .map(([key, value]) => [key, typeof value === "string" ? value : value.name] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const signed = pairs.reduce((acc, [key, value]) => `${acc}${key}${value}`, webhookUrl(req));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function validateTwilioRequest(req: Request, form: FormData, authToken: string) {
  const received = req.headers.get("x-twilio-signature") || req.headers.get("X-Twilio-Signature") || "";
  if (!authToken || !received) return false;
  const expected = await twilioSignature(req, form, authToken);
  return timingSafeEqual(expected, received);
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return textResponse("OK");
    if (req.method !== "POST") return textResponse("Method not allowed", 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[whatsapp-inbox] missing Supabase env", {
        hasUrl: !!supabaseUrl,
        hasServiceRole: !!serviceRoleKey,
      });
      return textResponse("Missing Supabase configuration", 500);
    }

    const form = await req.formData();
    const signatureValid = await validateTwilioRequest(req, form, twilioToken || "");
    if (!signatureValid) {
      console.warn("[whatsapp-inbox] invalid Twilio signature", {
        hasToken: !!twilioToken,
        hasSignature: !!(req.headers.get("x-twilio-signature") || req.headers.get("X-Twilio-Signature")),
      });
      return textResponse("Forbidden", 403);
    }

    const fromRaw = String(form.get("From") || "");
    const from = normalizePhone(fromRaw);

    const toRaw = String(form.get("To") || "");
    const body = String(form.get("Body") || "").trim();

    const numMedia = Number(form.get("NumMedia") || 0);
    const messageSid = String(form.get("MessageSid") || "");
    if (!messageSid) {
      console.error("[whatsapp-inbox] missing MessageSid", {
        hasFrom: !!fromRaw,
        hasTo: !!toRaw,
      });
      return textResponse("Missing MessageSid", 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Find user by WhatsApp phone
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("whatsapp_phone_e164", from)
      .single();

    if (profileError || !profile) {
      console.log("[whatsapp-inbox] unknown phone", {
        phoneSuffix: shortId(from),
      });

      return textResponse("Unknown phone", 200);
    }

    const { data: existingItem, error: existingError } = await supabase
      .from("inbox_items")
      .select("id,status")
      .eq("source_message_id", messageSid)
      .maybeSingle();

    if (existingError) {
      console.error("[whatsapp-inbox] existing lookup error", existingError);
      return textResponse("Lookup error", 500);
    }

    if (existingItem?.id) {
      console.log("[whatsapp-inbox] duplicate ignored", {
        id: existingItem.id,
        status: existingItem.status,
        messageSid: shortId(messageSid),
      });
      return textResponse("OK");
    }

    const media = [];
    let storagePath: string | null = null;

    // Download + upload first media
    if (numMedia > 0) {
      const mediaUrl = String(form.get("MediaUrl0") || "");
      const mediaContentType = String(form.get("MediaContentType0") || "");

      media.push({
        index: 0,
        url: mediaUrl,
        contentType: mediaContentType,
      });

      if (!twilioSid || !twilioToken) {
        console.error("[whatsapp-inbox] missing Twilio env", {
          hasSid: !!twilioSid,
          hasToken: !!twilioToken,
        });
      }

      // Twilio media download
      const mediaResp = await fetch(mediaUrl, {
        headers: twilioSid && twilioToken
          ? { Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`) }
          : {},
      });

      console.log("[whatsapp-inbox] media download", {
  mediaContentType,
  status: mediaResp.status,
  ok: mediaResp.ok,
  hasSid: !!twilioSid,
  hasToken: !!twilioToken,
});

if (mediaResp.ok) {
  const blob = await mediaResp.blob();

        const ext =
          mediaContentType === "image/png"
            ? "png"
            : mediaContentType === "application/pdf"
            ? "pdf"
            : "jpg";

        storagePath = `whatsapp/${profile.id}/${messageSid}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("inbox-documents")
          .upload(storagePath, blob, {
            contentType: mediaContentType,
            upsert: true,
          });
        console.log("[whatsapp-inbox] storage upload", {
  storagePath: storagePath ? `whatsapp/.../${shortId(messageSid)}` : null,
  ok: !uploadError,
});

        if (uploadError) {
          console.error("[whatsapp-inbox] upload error", uploadError);
        }
      }
    }

    // Insert inbox item
    const { error: insertError } = await supabase
      .from("inbox_items")
      .insert({
        user_id: profile.id,

        source: "whatsapp",
        source_from: fromRaw,
        source_to: toRaw,
        source_message_id: messageSid,

        raw_text: body,

        media_count: numMedia,
        media_url: media[0]?.url || null,
        media_content_type: media[0]?.contentType || null,
        media,

        storage_path: storagePath,

        status: "pending",
      });

    if (insertError) {
      console.error("[whatsapp-inbox] insert error", insertError);

      return textResponse("Insert error", 500);
    }

    console.log("[whatsapp-inbox] stored", {
      user_id: profile.id,
      bodyLength: body.length,
      hasStorage: !!storagePath,
      messageSid: shortId(messageSid),
    });

    return textResponse("OK");
  } catch (e) {
    console.error("[whatsapp-inbox] fatal", e);

    return textResponse("Fatal error", 500);
  }
});
