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
  } catch (e) {
    console.error(`[MembersAdmin] ${label} failed`, e);
    const msg = e?.message ? String(e.message) : String(e);
    _setStatus(`❌ ${label}: ${msg}`);
    alert(`${label} : ${msg}`);
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
    const { data: u } = await sb.auth.getUser();
    const me = u?.user?.id;
    if (me && String(me) === String(userId)) {
      throw new Error("Refusé : tu ne peux pas vider ton compte courant via cette action.");
    }

    const label = (email ? `${email} (${userId})` : userId);
    const isAll = (mode === "all");
    const word = isAll ? "WIPE" : "RESET";

    const explain = isAll
      ? "Supprime : périodes, wallets, transactions, trips, settings, catégories.
Le login reste."
      : "Supprime : périodes, wallets, transactions, trips, settings.
Conserve : catégories.
Le login reste.";

    const token = prompt(
      `⚠️ Action admin : ${isAll ? "VIDER COMPTE" : "RESET TRAVEL"}
${label}

${explain}

Tape EXACTEMENT ${word} pour confirmer :`
    );
    if (token !== word) throw new Error("Annulé (confirmation incorrecte).");

    _setStatus(isAll ? "Wiping user data..." : "Resetting travel data...");

    const out = await callEdge("admin-wipe-user", { userId, mode });

    const msg = out?.ok
      ? (isAll ? "Compte vidé." : "Données Travel reset (catégories conservées).")
      : "Action terminée.";
    _setStatus(msg);

    // refresh list
    __membersCache.loadedAt = 0;
    await adminRefreshUsers();
  });
}

async function adminInviteUser(email) {
  await guard("Invite user", async () => {
    _setStatus("Inviting...");
    await callEdge("admin-invite", { email });
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
   Entry point
========================= */

function renderMembersAdmin() {
  _ensureMembersAdminDOM();
  adminRefreshUsers();
}