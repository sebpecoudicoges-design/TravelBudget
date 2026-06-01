/* =========================
   UI: Auth
   ========================= */
let tbAuthMode = "signin";

function tbAuthText(fr, en) {
  try { return (typeof window.tbGetLang === "function" && window.tbGetLang() === "en") ? en : fr; }
  catch (_) { return fr; }
}

function tbAuthIsNativeApp() {
  try {
    return !!window.Capacitor
      || document.body?.classList?.contains("tb-capacitor-app")
      || String(location.protocol || "").startsWith("capacitor");
  } catch (_) {
    return false;
  }
}

const TB_MOBILE_AUTH_REDIRECT_URL = "com.travelbudget.app://auth-callback";

function tbAuthWebRedirectUrl() {
  try {
    const origin = window.location.origin && window.location.origin !== "null"
      ? window.location.origin
      : "https://stunning-dieffenbachia-2b2ed0.netlify.app";
    return `${origin}${window.location.pathname || "/"}`;
  } catch (_) {
    return "https://stunning-dieffenbachia-2b2ed0.netlify.app/";
  }
}

function tbNormalizeAuthEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function tbIsValidAuthEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(email || "").trim());
}

function tbAuthGetCapacitorPlugin(name) {
  try {
    return window.Capacitor?.Plugins?.[name] || null;
  } catch (_) {
    return null;
  }
}

function tbAuthParamsFromUrl(url) {
  const out = new URLSearchParams();
  try {
    const parsed = new URL(String(url || ""));
    new URLSearchParams(parsed.search || "").forEach((value, key) => out.set(key, value));
    new URLSearchParams(String(parsed.hash || "").replace(/^#/, "")).forEach((value, key) => out.set(key, value));
  } catch (_) {}
  return out;
}

async function tbCompleteMobileOAuth(url) {
  const params = tbAuthParamsFromUrl(url);
  const error = params.get("error_description") || params.get("error");
  if (error) throw new Error(error);

  const code = params.get("code");
  if (code && sb?.auth?.exchangeCodeForSession) {
    const { error: codeError } = await sb.auth.exchangeCodeForSession(code);
    if (codeError) throw codeError;
    return true;
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error: sessionError } = await sb.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw sessionError;
    return true;
  }

  return false;
}

async function tbAfterOAuthSessionReady() {
  const { data } = await sb.auth.getUser();
  sbUser = data?.user || null;
  window.sbUser = sbUser;
  if (!sbUser) return false;

  tbSetAuthMessage(tbAuthText("Connexion Google reussie. Synchronisation...", "Google sign-in complete. Syncing..."), "success");
  await ensureBootstrap();
  await refreshFromServer();
  showAuth(false);
  showView("dashboard");
  if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("03_ui_auth.js:oauth");
  else if (typeof renderAll === "function") renderAll();
  return true;
}

function tbInitMobileOAuthListener() {
  if (!tbAuthIsNativeApp()) return;
  const App = tbAuthGetCapacitorPlugin("App");
  if (!App || typeof App.addListener !== "function") return;
  if (window.__tbMobileOAuthListenerReady) return;
  window.__tbMobileOAuthListenerReady = true;

  App.addListener("appUrlOpen", async (event) => {
    const url = String(event?.url || "");
    if (!url.startsWith(TB_MOBILE_AUTH_REDIRECT_URL)) return;
    try {
      const completed = await tbCompleteMobileOAuth(url);
      if (completed) await tbAfterOAuthSessionReady();
      else showAuth(true, tbAuthText("Retour Google incomplet. Reessaie.", "Incomplete Google callback. Try again."));
    } catch (e) {
      tbAuthLogError("mobileOAuthCallback", e, { callbackUrlPrefix: url.slice(0, 60) });
      showAuth(true, tbFriendlyAuthError(e));
    } finally {
      try { await tbAuthGetCapacitorPlugin("Browser")?.close?.(); } catch (_) {}
    }
  });
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
  if (/issued in the future|clock|skew/.test(msg)) {
    return tbAuthText("L'heure du telephone semble decalee. Active l'heure automatique puis reessaie.", "Your phone clock looks out of sync. Enable automatic time, then try again.");
  }
  if (/invalid login credentials|invalid credentials|invalid email or password/.test(msg)) {
    return tbAuthText("Email ou mot de passe incorrect.", "Incorrect email or password.");
  }
  if (/invalid email|email address is invalid/.test(msg)) {
    return tbAuthText("Adresse email invalide.", "Invalid email address.");
  }
  if (/email not confirmed|not confirmed/.test(msg)) {
    return tbAuthText("Ton email n'est pas encore confirme. Verifie ta boite mail.", "Your email is not confirmed yet. Check your inbox.");
  }
  if (/user already registered|already registered|already exists/.test(msg)) {
    return tbAuthText("Un compte existe deja avec cet email. Essaie de te connecter.", "An account already exists with this email. Try signing in.");
  }
  if (/expired|otp expired|link is invalid|invalid.*token/.test(msg)) {
    return tbAuthText("Le lien a expire ou n'est plus valide. Demande un nouveau lien.", "This link has expired or is no longer valid. Request a new link.");
  }
  if (/code verifier|pkce|flow state|auth session missing/.test(msg)) {
    return tbAuthText("La connexion Google a ete interrompue. Relance Google depuis l'app.", "Google sign-in was interrupted. Start Google again from the app.");
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

function tbSetAuthBusy(isBusy) {
  try {
    document.querySelectorAll("#auth-overlay button, #auth-overlay input").forEach((el) => {
      if (el.id === "auth-email" || el.id === "auth-pass" || el.id === "auth-pass-confirm") el.disabled = !!isBusy;
      else el.disabled = !!isBusy;
    });
  } catch (_) {}
}

function tbAuthLogError(section, error, details) {
  try {
    if (!window.__errorBus || typeof window.__errorBus.push !== "function") return;
    window.__errorBus.push({
      type: "auth.error",
      severity: "warn",
      section: section || "auth",
      message: error?.message || String(error || "Auth error"),
      details: Object.assign({
        mode: tbAuthMode,
        isNativeApp: tbAuthIsNativeApp(),
        protocol: String(location.protocol || ""),
        host: String(location.host || ""),
      }, details || {}),
    });
  } catch (_) {}
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
            <input id="auth-email" type="email" autocomplete="email" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="you@email.com" required />
          </div>
          <div id="auth-password-row" class="auth-field">
            <label for="auth-pass">${tbAuthText("Mot de passe", "Password")}</label>
            <input id="auth-pass" type="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" />
          </div>
          <div id="auth-confirm-row" class="auth-field" style="display:none;">
            <label for="auth-pass-confirm">${tbAuthText("Confirmer le mot de passe", "Confirm password")}</label>
            <input id="auth-pass-confirm" type="password" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false" />
          </div>
          <p id="auth-helper" class="auth-muted"></p>
          <p id="auth-edge-note" class="auth-muted"></p>
          <div class="auth-actions">
            <button id="auth-submit" class="btn primary" type="submit">${tbAuthText("Se connecter", "Sign in")}</button>
            <button id="auth-secondary" class="btn" type="button" onclick="setAuthMode('recovery')">${tbAuthText("Mot de passe oublie", "Forgot password")}</button>
          </div>
        </form>
        <div class="auth-provider-row">
          <button class="btn auth-google-btn" type="button" onclick="signInWithProvider('google')" aria-label="${tbAuthText("Continuer avec Google", "Continue with Google")}" title="${tbAuthText("Continuer avec Google", "Continue with Google")}"><span class="auth-google-mark" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9c.87-2.6 3.3-4.52 6.16-4.52z"/></svg></span></button>
        </div>
        <p class="auth-muted auth-provider-note">${tbAuthText("Les providers externes necessitent d'etre actives cote Supabase Auth.", "External providers need to be enabled in Supabase Auth.")}</p>
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
  const edgeNote = document.getElementById("auth-edge-note");

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
  if (edgeNote) {
    edgeNote.textContent = tbAuthMode === "signin"
      ? tbAuthText("Google rattache le meme compte si Supabase recoit le meme email verifie.", "Google links to the same account when Supabase receives the same verified email.")
      : "";
  }
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
  try {
    document.body?.classList?.toggle("tb-auth-visible", !!show);
  } catch (_) {}
  if (overlay) overlay.style.display = show ? "block" : "none";
  if (app) app.style.display = show ? "none" : "block";
}

function tbAuthValues() {
  return {
    email: tbNormalizeAuthEmail(document.getElementById("auth-email")?.value || ""),
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
  if (!tbIsValidAuthEmail(email)) return showAuth(true, tbAuthText("Adresse email invalide.", "Invalid email address."));

  tbSetAuthBusy(true);
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  tbSetAuthBusy(false);
  if (error) {
    tbAuthLogError("signInWithPassword", error, { emailDomain: email.split("@")[1] || "", emailLength: email.length, passwordLength: pass.length });
    return showAuth(true, tbFriendlyAuthError(error));
  }

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
  if (!tbIsValidAuthEmail(email)) return showAuth(true, tbAuthText("Adresse email invalide.", "Invalid email address."));
  if (pass.length < 8) return showAuth(true, tbAuthText("Mot de passe trop court : 8 caracteres minimum.", "Password too short: 8 characters minimum."));
  if (pass !== confirm) return showAuth(true, tbAuthText("Les deux mots de passe ne correspondent pas.", "Passwords do not match."));

  tbSetAuthBusy(true);
  const { data, error } = await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: tbAuthWebRedirectUrl() } });
  tbSetAuthBusy(false);
  if (error) {
    tbAuthLogError("signUp", error, { emailDomain: email.split("@")[1] || "", emailLength: email.length, passwordLength: pass.length });
    return showAuth(true, tbFriendlyAuthError(error));
  }

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
  if (!tbIsValidAuthEmail(email)) return showAuth(true, tbAuthText("Adresse email invalide.", "Invalid email address."));
  try {
    const redirectTo = tbAuthWebRedirectUrl();
    tbSetAuthBusy(true);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    tbSetAuthBusy(false);
    if (error) {
      tbAuthLogError("resetPassword", error, { emailDomain: email.split("@")[1] || "", emailLength: email.length });
      return showAuth(true, tbFriendlyAuthError(error));
    }
    tbSetAuthMessage(tbAuthText("Email de reinitialisation envoye. Verifie ta boite mail.", "Password reset email sent. Check your inbox."), "success");
  } catch (e) {
    tbSetAuthBusy(false);
    showAuth(true, tbFriendlyAuthError(e));
  }
}

async function signInWithProvider(provider) {
  try {
    tbSetAuthBusy(true);
    if (tbAuthIsNativeApp()) {
      const Browser = tbAuthGetCapacitorPlugin("Browser");
      const { data, error } = await sb.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: TB_MOBILE_AUTH_REDIRECT_URL,
          skipBrowserRedirect: true,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        tbAuthLogError("signInWithProvider:native", error, { provider: String(provider || "") });
        tbSetAuthBusy(false);
        return showAuth(true, tbFriendlyAuthError(error));
      }
      if (!data?.url) {
        tbSetAuthBusy(false);
        return showAuth(true, tbAuthText("Lien Google indisponible. Reessaie.", "Google sign-in link unavailable. Try again."));
      }
      sessionStorage.setItem("tb_oauth_provider", String(provider || ""));
      tbSetAuthMessage(tbAuthText("Ouverture de Google...", "Opening Google..."));
      if (Browser && typeof Browser.open === "function") await Browser.open({ url: data.url });
      else window.open(data.url, "_system");
      tbSetAuthBusy(false);
      return;
    }
    const redirectTo = tbAuthWebRedirectUrl();
    sessionStorage.setItem("tb_oauth_provider", String(provider || ""));
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
    tbSetAuthBusy(false);
    if (error) {
      tbAuthLogError("signInWithProvider", error, { provider: String(provider || "") });
      tbSetAuthBusy(false);
      return showAuth(true, tbFriendlyAuthError(error));
    }
  } catch (e) {
    tbSetAuthBusy(false);
    showAuth(true, tbFriendlyAuthError(e));
  }
}

try { tbInitMobileOAuthListener(); } catch (_) {}

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
