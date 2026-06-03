/* ======================================================
   MEMBERS ADMIN (ADMIN ONLY) — SELF-CONTAINED UI
====================================================== */

let __membersCache = { users: [], loadedAt: 0 };

/* =========================
   DOM / UI
========================= */

function _ensureMembersAdminDOM() {
  // Essaie plusieurs containers possibles (selon ton app)
  const root =
    document.getElementById("view-members") ||
    document.querySelector("[data-view='members']") ||
    document.getElementById("view") ||
    document.body;

  // Si déjà injecté, ne rien faire
  if (document.getElementById("admin-users-list")) return;

  root.innerHTML = `
    <div class="page">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-size:20px;font-weight:700;">Membres</div>
          <div id="admin-users-status" style="opacity:.7;margin-top:4px;">Ready</div>
        </div>
        <button class="btn" id="admin-users-refresh-btn">Refresh</button>
      </div>

      <div class="card" style="margin-top:12px;">
        <div style="font-weight:700;margin-bottom:8px;">Inviter / liens</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <input id="admin-email" placeholder="email@domaine.com" style="min-width:260px;flex:1;" />
          <button class="btn" id="admin-invite-btn">Inviter (email)</button>
          <button class="btn" id="admin-invite-link-btn">Lien invite</button>
          <button class="btn" id="admin-recovery-link-btn">Lien reset MDP</button>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;margin-bottom:4px;">Notifications mobiles</div>
            <div style="font-size:12px;opacity:.65;">Espace admin pour preparer et tester les push mobiles FCM.</div>
          </div>
          <button class="btn" id="admin-mobile-notifications-refresh-btn">Refresh</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:12px;align-items:center;">
          <input id="admin-mobile-notification-title" placeholder="Titre" />
          <input id="admin-mobile-notification-body" placeholder="Message court" />
          <select id="admin-mobile-notification-target">
            <option value="all">Tous</option>
            <option value="admins">Admins</option>
            <option value="test">Test</option>
          </select>
          <select id="admin-mobile-notification-status">
            <option value="draft">Brouillon</option>
            <option value="ready">Pret</option>
          </select>
          <button class="btn primary" id="admin-mobile-notification-create-btn">Ajouter</button>
          <button class="btn" id="admin-mobile-notification-test-btn">Test push moi</button>
        </div>
        <div id="admin-mobile-notifications-list" style="margin-top:12px;">Chargement...</div>
      </div>

      <div class="card" style="margin-top:12px;">
        <div style="font-weight:700;margin-bottom:8px;">Liste des comptes</div>
        <div id="admin-users-list">Loading...</div>
      </div>
    </div>
  `;

  // Bind events
  document.getElementById("admin-users-refresh-btn")?.addEventListener("click", adminRefreshUsers);

  document.getElementById("admin-invite-btn")?.addEventListener("click", async () => {
    const email = (document.getElementById("admin-email")?.value || "").trim();
    if (!email) return alert("Email manquant");
    await adminInviteUser(email);
  });

  document.getElementById("admin-invite-link-btn")?.addEventListener("click", async () => {
    const email = (document.getElementById("admin-email")?.value || "").trim();
    if (!email) return alert("Email manquant");
    await adminGenerateInviteLink(email);
  });

  document.getElementById("admin-recovery-link-btn")?.addEventListener("click", async () => {
    const email = (document.getElementById("admin-email")?.value || "").trim();
    if (!email) return alert("Email manquant");
    await adminGenerateRecoveryLink(email);
  });

  document.getElementById("admin-mobile-notifications-refresh-btn")?.addEventListener("click", adminRefreshMobileNotifications);
  document.getElementById("admin-mobile-notification-create-btn")?.addEventListener("click", adminCreateMobileNotification);
  document.getElementById("admin-mobile-notification-test-btn")?.addEventListener("click", adminSendMobilePushTest);
}

function _setStatus(txt) {
  const el = document.getElementById("admin-users-status");
  if (el) el.textContent = txt;
}

function _escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   Guard
========================= */

async function guard(label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[MembersAdmin] ${label} failed`, err);
    const msg = err?.message || String(err);
    _setStatus(`❌ ${msg}`);
    alert(`❌ ${label}: ${msg}`);
    throw err;
  }
}

/* =========================
   Edge call
========================= */

async function callEdge(fnName, body) {
  const { data: sess } = await sb.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error("No session token (not logged in?)");

  const url = sb.supabaseUrl;
  const key = sb.supabaseKey;
  if (!url || !key) throw new Error("Supabase client not initialized");

  const res = await fetch(`${url}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": key,
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

/* =========================
   List users
========================= */

async function adminRefreshUsers() {
  await guard("List users", async () => {
    _setStatus("Loading users...");
    const data = await callEdge("admin-list-users", {});
    __membersCache.users = data?.users || [];
    renderUsers();
    _setStatus(`✅ Loaded ${__membersCache.users.length} user(s)`);
  });
}

function renderUsers() {
  const container = document.getElementById("admin-users-list");
  if (!container) return;

  const users = __membersCache.users;

  if (!users.length) {
    container.innerHTML = `<div style="opacity:.7;">Aucun compte renvoyé.</div>`;
    return;
  }

  container.innerHTML = users.map(u => `
    <div class="card" style="margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <div><b>${_escapeHtml(u.email || "(no email)")}</b></div>
          <div style="font-size:12px;opacity:.6;">ID: ${_escapeHtml(u.id)}</div>
          <div style="font-size:12px;opacity:.6;">Created: ${_escapeHtml(u.created_at || "")}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <button class="btn danger" onclick="adminWipeUser('${_escapeHtml(u.id)}','${_escapeHtml(u.email || "")}')">Vider compte</button>
        </div>
      </div>
    </div>
  `).join("");
}

/* =========================
   Actions
========================= */


async function adminWipeUser(userId, email, mode = "all") {
  await guard("Wipe user", async () => {
    console.log("[MembersAdmin] adminWipeUser:start", { userId, email, mode });

    const { data: u } = await sb.auth.getUser();
    const me = u?.user?.id;
    if (me && String(me) === String(userId)) {
      throw new Error("Refusé : tu ne peux pas vider ton compte courant via cette action.");
    }

    const label = (email ? `${email} (${userId})` : userId);
    const isAll = (mode === "all");
    const word = isAll ? "WIPE" : "RESET";

    const explain = isAll
      ? `Supprime : périodes, wallets, transactions, trips, settings, catégories.\nLe login reste.`
      : `Supprime : périodes, wallets, transactions, trips, settings.\nConserve : catégories.\nLe login reste.`;

    const token = prompt(
      `⚠️ Action admin : ${isAll ? "VIDER COMPTE" : "RESET TRAVEL"}
${label}

${explain}

Tape EXACTEMENT ${word} pour confirmer :`
    );

    console.log("[MembersAdmin] adminWipeUser:promptResult", { token });

    if (token !== word) {
      _setStatus("Action annulée.");
      return;
    }

    _setStatus(isAll ? "Wipe en cours..." : "Reset travel en cours...");
    console.log("[MembersAdmin] adminWipeUser:beforeCallEdge");

    const out = await callEdge("admin-wipe-user", {
      targetUserId: userId,
      mode
    });

    console.log("[MembersAdmin] adminWipeUser:callEdgeResult", out);

    const msg = out?.message
      || (out?.success
        ? (isAll ? "✅ Compte vidé avec succès." : "✅ Données Travel réinitialisées avec succès.")
        : "✅ Action terminée.");

    _setStatus(msg);
    alert(msg); // feedback visible immédiat

    console.log("[MembersAdmin] adminWipeUser:beforeRefreshUsers");

    __membersCache.loadedAt = 0;
    await adminRefreshUsers();

    console.log("[MembersAdmin] adminWipeUser:done");
  });
}

async function adminInviteUser(email) {
  await guard("Invite user", async () => {
    _setStatus("Inviting...");
    await callEdge("admin-invite", { email, redirectTo: window.location.origin });
    _setStatus("✅ Invitation sent");
    await adminRefreshUsers();
  });
}

async function adminGenerateInviteLink(email) {
  await guard("Generate invite link", async () => {
    const data = await callEdge("admin-generate-invite-link", {
      email,
      redirectTo: window.location.origin,
    });

    const link = data?.link;
    if (!link) return alert("No link returned");

    try { await navigator.clipboard?.writeText(link); } catch (_) {}
    window.open(link, "_blank");
  });
}

async function adminGenerateRecoveryLink(email) {
  await guard("Generate recovery link", async () => {
    const data = await callEdge("admin-generate-recovery-link", {
      email,
      redirectTo: window.location.origin,
    });

    const link = data?.action_link;
    if (!link) return alert("No link returned");

    try { await navigator.clipboard?.writeText(link); } catch (_) {}
    window.open(link, "_blank");
  });
}

/* =========================
   Mobile notifications admin
========================= */

function adminMobileNotificationsTable() {
  return TB_CONST?.TABLES?.mobile_notification_campaigns || "mobile_notification_campaigns";
}

async function adminRefreshMobileNotifications() {
  await guard("List mobile notifications", async () => {
    const list = document.getElementById("admin-mobile-notifications-list");
    if (list) list.textContent = "Chargement...";
    const { data, error } = await sb
      .from(adminMobileNotificationsTable())
      .select("id,title,body,target,status,created_at,scheduled_at,sent_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    renderMobileNotifications(data || []);
  });
}

function renderMobileNotifications(rows) {
  const list = document.getElementById("admin-mobile-notifications-list");
  if (!list) return;
  if (!rows.length) {
    list.innerHTML = `<div style="opacity:.7;">Aucune notification preparee.</div>`;
    return;
  }
  list.innerHTML = rows.map((row) => `
    <div class="card" style="margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
        <div style="min-width:0;">
          <div><b>${_escapeHtml(row.title)}</b> <span style="font-size:12px;opacity:.65;">${_escapeHtml(row.status)} / ${_escapeHtml(row.target)}</span></div>
          <div style="font-size:13px;opacity:.78;margin-top:4px;">${_escapeHtml(row.body)}</div>
          <div style="font-size:12px;opacity:.55;margin-top:4px;">${_escapeHtml(row.created_at || "")}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          ${row.status !== "archived" ? `<button class="btn" onclick="adminArchiveMobileNotification('${_escapeHtml(row.id)}')">Archiver</button>` : ""}
        </div>
      </div>
    </div>
  `).join("");
}

async function adminCreateMobileNotification() {
  await guard("Create mobile notification", async () => {
    const title = (document.getElementById("admin-mobile-notification-title")?.value || "").trim();
    const body = (document.getElementById("admin-mobile-notification-body")?.value || "").trim();
    const target = (document.getElementById("admin-mobile-notification-target")?.value || "all").trim();
    const status = (document.getElementById("admin-mobile-notification-status")?.value || "draft").trim();
    if (!title || !body) return alert("Titre et message requis.");

    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error("Session admin introuvable.");

    const { error } = await sb.from(adminMobileNotificationsTable()).insert([{
      created_by: userId,
      title,
      body,
      target,
      status,
      payload: { source: "admin-ui", build: window.TB_BUILD_LABEL || "" },
    }]);
    if (error) throw error;

    const titleInput = document.getElementById("admin-mobile-notification-title");
    const bodyInput = document.getElementById("admin-mobile-notification-body");
    if (titleInput) titleInput.value = "";
    if (bodyInput) bodyInput.value = "";
    _setStatus("Notification mobile preparee.");
    await adminRefreshMobileNotifications();
  });
}

async function adminSendMobilePushTest() {
  await guard("Send mobile push test", async () => {
    const { data: userRes } = await sb.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) throw new Error("Session admin introuvable.");
    const morning = (typeof window.tbBuildMorningBudgetPushPayload === "function")
      ? await window.tbBuildMorningBudgetPushPayload()
      : null;
    const title = (document.getElementById("admin-mobile-notification-title")?.value || morning?.title || "Budget du matin").trim();
    const body = (document.getElementById("admin-mobile-notification-body")?.value || morning?.body || "Point budget quotidien.").trim();
    const send = window.tbSendMobilePushNotification || (async (payload) => callEdge("send-mobile-notification", payload));
    const out = await send({
      ...(morning || {}),
      user_id: userId,
      title,
      body,
      source: morning?.source || "daily_budget",
      view: morning?.view || "dashboard",
      force: true,
      notification_key: `admin-test:${Date.now()}`,
    });
    const msg = out?.skipped
      ? `Test ignore: ${out.reason || "préférence désactivée"}`
      : `Test push envoyé: ${out?.sent || 0} OK, ${out?.failed || 0} erreur(s).`;
    _setStatus(msg);
    alert(msg);
  });
}

async function adminArchiveMobileNotification(id) {
  await guard("Archive mobile notification", async () => {
    const { error } = await sb
      .from(adminMobileNotificationsTable())
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await adminRefreshMobileNotifications();
  });
}

/* =========================
   Entry point
========================= */

function renderMembersAdmin() {
  _ensureMembersAdminDOM();
  adminRefreshMobileNotifications();
  adminRefreshUsers();
}
