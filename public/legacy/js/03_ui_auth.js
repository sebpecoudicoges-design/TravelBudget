/* =========================
   UI: Auth
   ========================= */
function showAuth(show, msg = "") {
  const overlay = document.getElementById("auth-overlay");
  const app = document.getElementById("app-root");
  const elMsg = document.getElementById("auth-msg");
  if (elMsg) elMsg.textContent = msg;
  overlay.style.display = show ? "block" : "none";
  app.style.display = show ? "none" : "block";
}

async function signIn() {
  const email = document.getElementById("auth-email").value.trim();
  const pass = document.getElementById("auth-pass").value;
  if (!email || !pass) return showAuth(true, "Email/mot de passe requis.");

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) return showAuth(true, error.message);

  sbUser = data.user;

  try {
    await ensureBootstrap();
    await refreshFromServer();
    showAuth(false);
    showView("dashboard");
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("03_ui_auth.js"); else if (typeof renderAll === "function") renderAll();
} catch (e) {
    showAuth(true, `Erreur init: ${e?.message || e}`);
  }
}

async function signUp() {
  const email = document.getElementById("auth-email").value.trim();
  const pass = document.getElementById("auth-pass").value;
  if (!email || !pass) return showAuth(true, "Email/mot de passe requis.");

  const { error } = await sb.auth.signUp({ email, password: pass });
  if (error) return showAuth(true, error.message);

  showAuth(true, "Compte créé. Si confirmation email activée, confirme puis connecte-toi.");
}

async function signOut() {
  await sb.auth.signOut();
  sbUser = null;
  showAuth(true, "Déconnecté.");
}

