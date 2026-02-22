/* ======================================================
   MEMBERS ADMIN (ADMIN ONLY) — SELF-CONTAINED UI
====================================================== */

let __membersCache = { users: [], loadedAt: 0 };

function _ensureMembersAdminDOM(rootId = "view-members") {
  // rootId doit correspondre au conteneur de la vue "Membres".
  // Si ton app utilise un autre id, ajuste ici.
  let root = document.getElementById(rootId);

  // Fallback: cherche un container générique
  if (!root) root = document.querySelector("[data-view='members']") || document.querySelector("#view") || document.body;

  // Si déjà présent, OK
  if (document.getElementById("admin-users-list")) return;

  const wrap = document.createElement("div");
  wrap.innerHTML = `
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
        <div style="font-weight:700;margin-bottom:8px;">Liste des comptes</div>
        <div id="admin-users-list">Loading...</div>
      </div>
    </div>
  `;

  // Nettoie et injecte
  root.innerHTML = "";
  root.appendChild(wrap);

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
}

async function guard(label, fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(`[MembersAdmin] ${label} failed`, e);
    const msg = e?.message ? String(e.message) : String(e);
    const status = document.getElementById("admin-users-status");
    if (status) status.textContent = `❌ ${label}: ${msg}`;
    alert(`${label} : ${msg}`);
  }
}

/* ======================================================
   DIRECT EDGE CALL (ROBUST)
====================================================== */

async function callEdge(fnName, body) {
  const { data: sess } = await sb.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error("No session token");

  const url = sb.supabaseUrl;
  const key = sb.supabaseKey;

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

  if (!res.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }
  return json;
}

/* ======================================================
   LIST USERS
====================================================== */

async function adminRefreshUsers() {
  await guard("List users", async () => {
    const status = document.getElementById("admin-users-status");
    if (status) status.textContent = "Loading users...";

    const data = await callEdge("admin-list-users", {});
    __membersCache.users = data?.users || [];
    __membersCache.loadedAt = Date.now();

    renderUsers();

    if (status) status.textContent = `✅ Loaded ${__membersCache.users.length} user(s)`;
  });
}

function _escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderUsers() {
  const container = document.getElementById("admin-users-list");
  if (!container) return;

  const users = __membersCache.users;

  if (!users.length) {
    container.innerHTML = `<div style="opacity:.7;">Aucun compte trouvé (ou aucun résultat renvoyé).</div>`;
    return;
  }

  container.innerHTML = users.map(u => `
    <div class="card" style="margin-bottom:8px;">
      <div><b>${_escapeHtml(u.email || "(no email)")}</b></div>
      <div style="font-size:12px;opacity:.6;">ID: ${_escapeHtml(u.id)}</div>
      <div style="font-size:12px;opacity:.6;">Created: ${_escapeHtml(u.created_at || "")}</div>
    </div>
  `).join("");
}

/* ======================================================
   ACTIONS
====================================================== */

async function adminInviteUser(email) {
  await guard("Invite user", async () => {
    const status = document.getElementById("admin-users-status");
    if (status) status.textContent = "Inviting...";

    await callEdge("admin-invite", { email });

    if (status) status.textContent = "✅ Invitation sent";
    await adminRefreshUsers();
  });
}

async function adminGenerateInviteLink(email) {
  await guard("Generate invite link", async () => {
    const data = await callEdge("admin-generate-invite-link", { email });
    alert(data?.link || "No link returned");
  });
}

async function adminGenerateRecoveryLink(email) {
  await guard("Generate recovery link", async () => {
    const data = await callEdge("admin-generate-recovery-link", { email });
    alert(data?.action_link || "No link returned");
  });
}

/* ======================================================
   ENTRY POINT (called by navigation)
====================================================== */

function renderMembersAdmin() {
  // ✅ assure que la vue a du contenu, même si ton HTML est vide
  _ensureMembersAdminDOM("view-members");
  adminRefreshUsers();
}