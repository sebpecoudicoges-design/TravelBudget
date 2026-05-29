/* =========================
   UI: Auth
   ========================= */
let tbAuthMode = "signin";

function tbAuthText(fr, en) {
  try { return (typeof window.tbGetLang === "function" && window.tbGetLang() === "en") ? en : fr; }
  catch (_) { return fr; }
}

function tbAuthMessageKind(message) {
  const msg = String(message || "").toLowerCase();
  if (!msg) return "";
  if (/compte|cree|created|envoye|sent|verifie|verify|reinitialisation|reset/.test(msg)) return "success";
  if (/erreur|error|invalid|incorrect|requis|required|failed|expire|expired|provider|configure|disabled|rate|too many/.test(msg)) return "error";
  return "";
}

function tbFriendlyAuthError(error) {
  const raw = String(error?.message || error || "").trim();
  const msg = raw.toLowerCase();
  if (!raw) return tbAuthText("Une erreur est survenue.", "Something went wrong.");
  if (/invalid login credentials|invalid credentials|invalid email or password/.test(msg)) {
    return tbAuthText("Email ou mot de passe incorrect.", "Incorrect email or password.");
  }
  if (/email not confirmed|not confirmed/.test(msg)) {
    return tbAuthText("Ton email n'est pas encore confirme. Verifie ta boite mail.", "Your email is not confirmed yet. Check your inbox.");
  }
  if (/user already registered|already registered|already exists/.test(msg)) {
    return tbAuthText("Un compte existe deja avec cet email. Essaie de te connecter.", "An account already exists with this email. Try signing in.");
  }
  if (/password should be|weak password|at least/.test(msg)) {
    return tbAuthText("Mot de passe trop court ou trop faible. Utilise au moins 8 caracteres.", "Password is too short or weak. Use at least 8 characters.");
  }
  if (/provider|oauth|unsupported|disabled/.test(msg)) {
    return tbAuthText("Ce moyen de connexion n'est pas encore active cote Supabase Auth.", "This sign-in provider is not enabled in Supabase Auth yet.");
  }
  if (/rate limit|too many/.test(msg)) {
    return tbAuthText("Trop de tentatives. Attends un peu avant de recommencer.", "Too many attempts. Please wait before trying again.");
  }
  return raw;
}

function tbSetAuthMessage(message, kind) {
  const elMsg = document.getElementById("auth-msg");
  if (!elMsg) return;
  elMsg.textContent = message || "";
  elMsg.classList.remove("error", "success");
  const resolved = kind || tbAuthMessageKind(message);
  if (resolved) elMsg.classList.add(resolved);
}

function tbEnsureAuthMarkup() {
  const box = document.querySelector("#auth-overlay .auth-box");
  if (!box || box.dataset.tbAuthEnhanced === "1") return;
  box.dataset.tbAuthEnhanced = "1";
  box.innerHTML = `
    <div class="auth-shell">
      <section class="auth-hero">
        <div>
          <h2 id="auth-title">${tbAuthText("Ton budget, synchronise.", "Your budget, synced.")}</h2>
          <p id="auth-subtitle">${tbAuthText("Connecte-toi pour retrouver tes voyages, wallets, documents, partages et analyses.", "Sign in to access your trips, wallets, documents, shared expenses and analysis.")}</p>
          <ul>
            <li>${tbAuthText("Donnees protegees par Supabase Auth et RLS.", "Data protected by Supabase Auth and RLS.")}</li>
            <li>${tbAuthText("Lecture hors ligne apres premiere synchronisation.", "Offline reading after first sync.")}</li>
            <li>${tbAuthText("Invitations Trip et validations visibles dans les notifications.", "Trip invites and approvals visible in notifications.")}</li>
          </ul>
        </div>
        <p class="auth-muted" style="color:rgba(255,255,255,.70);">BudgetPacker · ${window.TB_BUILD_LABEL || "V10"}</p>
      </section>
      <section class="auth-panel">
        <div class="auth-tabs" role="tablist">
          <button id="auth-tab-signin" class="auth-tab" type="button" onclick="setAuthMode('signin')">${tbAuthText("Connexion", "Sign in")}</button>
          <button id="auth-tab-signup" class="auth-tab" type="button" onclick="setAuthMode('signup')">${tbAuthText("Creer compte", "Create account")}</button>
          <button id="auth-tab-recovery" class="auth-tab" type="button" onclick="setAuthMode('recovery')">${tbAuthText("Mot de passe", "Password")}</button>
        </div>
        <div id="auth-msg" class="auth-msg"></div>
        <form class="auth-form" onsubmit="return submitAuthForm(event)">
          <div class="auth-field">
            <label for="auth-email">Email</label>
            <input id="auth-email" type="email" autocomplete="email" placeholder="you@email.com" required />
          </div>
          <div id="auth-password-row" class="auth-field">
            <label for="auth-pass">${tbAuthText("Mot de passe", "Password")}</label>
            <input id="auth-pass" type="password" autocomplete="current-password" />
          </div>
          <div id="auth-confirm-row" class="auth-field" style="display:none;">
            <label for="auth-pass-confirm">${tbAuthText("Confirmer le mot de passe", "Confirm password")}</label>
            <input id="auth-pass-confirm" type="password" autocomplete="new-password" />
          </div>
          <p id="auth-helper" class="auth-muted"></p>
          <div class="auth-actions">
            <button id="auth-submit" class="btn primary" type="submit">${tbAuthText("Se connecter", "Sign in")}</button>
            <button id="auth-secondary" class="btn" type="button" onclick="setAuthMode('recovery')">${tbAuthText("Mot de passe oublie", "Forgot password")}</button>
          </div>
        </form>
        <div class="auth-provider-row">
          <button class="btn" type="button" onclick="signInWithProvider('google')">${tbAuthText("Continuer avec Google", "Continue with Google")}</button>
        </div>
        <p class="auth-muted">${tbAuthText("Les providers externes necessitent d'etre actives cote Supabase Auth.", "External providers need to be enabled in Supabase Auth.")}</p>
      </section>
    </div>`;
  setAuthMode(tbAuthMode);
}

function setAuthMode(mode, msg) {
  tbAuthMode = ["signin", "signup", "recovery"].includes(mode) ? mode : "signin";
  tbEnsureAuthMarkup();
  const copy = {
    signin: {
      title: tbAuthText("Connexion", "Sign in"),
      helper: tbAuthText("Entre ton email et ton mot de passe pour synchroniser tes donnees.", "Enter your email and password to sync your data."),
      submit: tbAuthText("Se connecter", "Sign in"),
      secondary: tbAuthText("Mot de passe oublie", "Forgot password"),
      secondaryMode: "recovery",
      passAuto: "current-password",
    },
    signup: {
      title: tbAuthText("Creer ton compte", "Create your account"),
      helper: tbAuthText("Utilise un mot de passe d'au moins 8 caracteres. Selon la config Supabase, un email de confirmation peut etre envoye.", "Use a password with at least 8 characters. Depending on Supabase settings, a confirmation email may be sent."),
      submit: tbAuthText("Creer compte", "Create account"),
      secondary: tbAuthText("J'ai deja un compte", "I already have an account"),
      secondaryMode: "signin",
      passAuto: "new-password",
    },
    recovery: {
      title: tbAuthText("Reinitialiser le mot de passe", "Reset password"),
      helper: tbAuthText("Entre ton email, on t'envoie un lien de reinitialisation.", "Enter your email and we'll send a reset link."),
      submit: tbAuthText("Envoyer le lien", "Send reset link"),
      secondary: tbAuthText("Retour connexion", "Back to sign in"),
      secondaryMode: "signin",
      passAuto: "current-password",
    },
  }[tbAuthMode];

  document.querySelectorAll(".auth-tab").forEach((tab) => tab.classList.remove("active"));
  const activeTab = document.getElementById(`auth-tab-${tbAuthMode}`);
  if (activeTab) activeTab.classList.add("active");
  const title = document.getElementById("auth-title");
  const helper = document.getElementById("auth-helper");
  const submit = document.getElementById("auth-submit");
  const secondary = document.getElementById("auth-secondary");
  const passRow = document.getElementById("auth-password-row");
  const confirmRow = document.getElementById("auth-confirm-row");
  const pass = document.getElementById("auth-pass");
  const passConfirm = document.getElementById("auth-pass-confirm");

  if (title) title.textContent = copy.title;
  if (helper) helper.textContent = copy.helper;
  if (submit) submit.textContent = copy.submit;
  if (secondary) {
    secondary.textContent = copy.secondary;
    secondary.onclick = () => setAuthMode(copy.secondaryMode);
  }
  if (passRow) passRow.style.display = tbAuthMode === "recovery" ? "none" : "flex";
  if (confirmRow) confirmRow.style.display = tbAuthMode === "signup" ? "flex" : "none";
  if (pass) {
    pass.autocomplete = copy.passAuto;
    pass.required = tbAuthMode !== "recovery";
  }
  if (passConfirm) passConfirm.required = tbAuthMode === "signup";
  tbSetAuthMessage(msg || (
    tbAuthMode === "signin"
      ? tbAuthText("Connecte-toi pour synchroniser.", "Sign in to sync.")
      : tbAuthMode === "signup"
        ? tbAuthText("Cree ton compte pour demarrer.", "Create your account to get started.")
        : tbAuthText("On t'enverra un email de reinitialisation.", "We'll send you a password reset email.")
  ));
}

function showAuth(show, msg = "") {
  tbEnsureAuthMarkup();
  const overlay = document.getElementById("auth-overlay");
  const app = document.getElementById("app-root");
  if (msg) tbSetAuthMessage(msg);
  if (overlay) overlay.style.display = show ? "block" : "none";
  if (app) app.style.display = show ? "none" : "block";
}

function tbAuthValues() {
  return {
    email: document.getElementById("auth-email")?.value.trim() || "",
    pass: document.getElementById("auth-pass")?.value || "",
    confirm: document.getElementById("auth-pass-confirm")?.value || "",
  };
}

async function submitAuthForm(ev) {
  if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
  if (tbAuthMode === "signup") await signUp();
  else if (tbAuthMode === "recovery") await resetPassword();
  else await signIn();
  return false;
}

async function signIn() {
  const { email, pass } = tbAuthValues();
  if (!email || !pass) return showAuth(true, tbAuthText("Email et mot de passe requis.", "Email and password are required."));

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) return showAuth(true, tbFriendlyAuthError(error));

  sbUser = data.user;
  window.sbUser = sbUser;

  try {
    tbSetAuthMessage(tbAuthText("Connexion reussie. Synchronisation...", "Signed in. Syncing..."), "success");
    await ensureBootstrap();
    await refreshFromServer();
    showAuth(false);
    showView("dashboard");
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("03_ui_auth.js"); else if (typeof renderAll === "function") renderAll();
  } catch (e) {
    showAuth(true, `${tbAuthText("Erreur init", "Init error")}: ${e?.message || e}`);
  }
}

async function signUp() {
  const { email, pass, confirm } = tbAuthValues();
  if (!email || !pass) return showAuth(true, tbAuthText("Email et mot de passe requis.", "Email and password are required."));
  if (pass.length < 8) return showAuth(true, tbAuthText("Mot de passe trop court : 8 caracteres minimum.", "Password too short: 8 characters minimum."));
  if (pass !== confirm) return showAuth(true, tbAuthText("Les deux mots de passe ne correspondent pas.", "Passwords do not match."));

  const { data, error } = await sb.auth.signUp({ email, password: pass });
  if (error) return showAuth(true, tbFriendlyAuthError(error));

  const user = data?.user || null;
  const session = data?.session || null;

  if (!session || !user) {
    setAuthMode("signin", tbAuthText("Compte cree. Verifie ton email puis connecte-toi.", "Account created. Check your email, then sign in."));
    return;
  }

  sbUser = user;
  window.sbUser = sbUser;

  try {
    tbSetAuthMessage(tbAuthText("Compte cree. Initialisation...", "Account created. Initializing..."), "success");
    await ensureBootstrap();
    await refreshFromServer();
    showAuth(false);
    showView("dashboard");
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("03_ui_auth.js:signup");
    else if (typeof renderAll === "function") renderAll();
  } catch (e) {
    showAuth(true, `${tbAuthText("Compte cree, mais l'initialisation a echoue", "Account created, but initialization failed")}: ${e?.message || e}`);
  }
}

async function resetPassword() {
  const { email } = tbAuthValues();
  if (!email) return showAuth(true, tbAuthText("Email requis pour reinitialiser le mot de passe.", "Email is required to reset your password."));
  try {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return showAuth(true, tbFriendlyAuthError(error));
    tbSetAuthMessage(tbAuthText("Email de reinitialisation envoye. Verifie ta boite mail.", "Password reset email sent. Check your inbox."), "success");
  } catch (e) {
    showAuth(true, tbFriendlyAuthError(e));
  }
}

async function signInWithProvider(provider) {
  try {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) return showAuth(true, tbFriendlyAuthError(error));
  } catch (e) {
    showAuth(true, tbFriendlyAuthError(e));
  }
}

async function signOut() {
  await sb.auth.signOut();
  sbUser = null;
  window.sbUser = null;

  try {
    if (window.state) {
      state.wallets = [];
      state.transactions = [];
      state.allocations = [];
      state.periods = [];
      state.budgetSegments = [];
    }
  } catch (_) {}

  setAuthMode("signin", tbAuthText("Deconnecte.", "Signed out."));
  showAuth(true);
}
