import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { authenticatedUser, corsHeaders } from "../_shared/account-data.ts";

const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const filename = /^[a-zA-Z0-9._-]{1,120}$/;
const headers = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": corsHeaders["Access-Control-Allow-Headers"] + ", x-document-id, x-document-filename",
};
function send(body: unknown, status: number) {
  return Response.json(body, { status, headers });
}

// A client cannot choose the owner, bucket or any additional path segments.
export async function writePersonalDocument(req: Request, getAdmin: () => SupabaseClient) {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return send({ error: "Method not allowed" }, 405);

  let admin: SupabaseClient;
  let userId: string;
  try {
    admin = getAdmin();
    userId = (await authenticatedUser(req, admin)).id;
  } catch {
    return send({ error: "Authentication required" }, 401);
  }

  const documentId = req.headers.get("x-document-id") ?? "";
  const fileName = req.headers.get("x-document-filename") ?? "";
  if (!uuid.test(userId) || !uuid.test(documentId) || !filename.test(fileName) || fileName === "." || fileName === "..") {
    return send({ error: "Invalid document metadata" }, 400);
  }
  const declaredSize = req.headers.get("content-length");
  if (declaredSize !== null && (!/^\d+$/.test(declaredSize) || Number(declaredSize) > MAX_DOCUMENT_BYTES)) {
    return send({ error: "Document exceeds the size limit" }, 413);
  }
  const contentType = req.headers.get("content-type") || "application/octet-stream";
  const reader = req.body?.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  if (reader) {
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > MAX_DOCUMENT_BYTES) {
          await reader.cancel();
          return send({ error: "Document exceeds the size limit" }, 413);
        }
        chunks.push(new Uint8Array(chunk.value));
      }
    } catch {
      return send({ error: "Document could not be read" }, 400);
    } finally {
      reader.releaseLock();
    }
  }
  const body = new Blob(chunks, { type: contentType });
  chunks.length = 0;
  const path = `${userId}/${documentId}/${fileName}`;
  let ticket: string | undefined;
  try {
    const { data, error } = await admin.rpc("begin_account_file_write", { p_user_id: userId });
    if (error) return send({ error: "Document admission unavailable" }, 503);
    if (typeof data !== "string") return send({ error: "Account closed for new documents" }, 409);
    ticket = data;
    const uploaded = await admin.storage.from("personal-documents").upload(path, body, { contentType, upsert: false });
    if (uploaded.error) {
      // Do not infer that a missing or uncertain response means no object exists.
      return send({ error: "Document upload not confirmed" }, 502);
    }
    // Storage acknowledged this object. Return its path even when the
    // subsequent release needs reconciliation, so its document can be recorded.
    try {
      const release = await admin.rpc("finish_account_file_write", { p_user_id: userId, p_ticket: ticket });
      if (release.error || release.data !== true) console.error("[write-personal-document] admission release not acknowledged");
    } catch {
      console.error("[write-personal-document] admission release not acknowledged");
    }
    return send({ path }, 201);
  } catch {
    if (ticket) console.error("[write-personal-document] document admission needs reconciliation");
    return send({ error: "Document operation not confirmed" }, 502);
  }
}
