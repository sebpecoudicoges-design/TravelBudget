/* =========================
   Supabase config
   ========================= */

const SUPABASE_URL = "https://obznbrzarhvmlbprcfie.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xMHxyW0Cs9oRpGQsdatnyA_JIaaAC0D";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});



/* =========================
   Freeze mode (V6.5)
   - Enable with ?freeze=1 to prevent any write to Supabase from the browser
   ========================= */
(function () {
  try {
    const qs = new URLSearchParams(location.search || "");
    const freeze = qs.get("freeze") === "1" || qs.get("freeze") === "true";
    window.TB_FREEZE = freeze;

    if (!freeze) return;

    console.warn("[TB_FREEZE] Write operations are disabled (read-only mode).");

    const _origRpc = sb.rpc.bind(sb);
    sb.rpc = function (fnName, args, options) {
      const name = String(fnName || "");
      // Allow read-only RPCs if you ever add them; block everything by default.
      return Promise.reject(new Error(`[TB_FREEZE] RPC blocked: ${name}`));
    };

    const _origFrom = sb.from.bind(sb);
    sb.from = function (table) {
      const q = _origFrom(table);
      const wrap = (method) => {
        if (typeof q[method] !== "function") return;
        const _orig = q[method].bind(q);
        q[method] = function () {
          return Promise.reject(new Error(`[TB_FREEZE] ${method} blocked on ${String(table)}`));
        };
      };
      ["insert","update","delete","upsert"].forEach(wrap);
      return q;
    };
  } catch (e) {
    console.warn("[TB_FREEZE] init failed", e);
  }
})();
let sbUser = null;
let activeView = "dashboard";
let redrawPending = false;

const THEME_KEY = "travelbudget_theme_v1";
const ACTIVE_PERIOD_KEY = "travelbudget_active_period_id_v1";

/* Palette sync */
const PALETTE_KEY = "travelbudget_palette_v1";
const PRESET_KEY = "travelbudget_palette_preset_v1";

/* Presets */
const PALETTES = {
  "Ocean":   { accent:"#2563eb", good:"#16a34a", warn:"#f59e0b", bad:"#ef4444" },
  "Sunset":  { accent:"#f97316", good:"#22c55e", warn:"#fbbf24", bad:"#ef4444" },
  "Grape":   { accent:"#7c3aed", good:"#22c55e", warn:"#f59e0b", bad:"#fb7185" },
  "Mint":    { accent:"#06b6d4", good:"#22c55e", warn:"#fbbf24", bad:"#f43f5e" },
  "Rose":    { accent:"#e11d48", good:"#22c55e", warn:"#fbbf24", bad:"#ef4444" },
  "Mono":    { accent:"#334155", good:"#16a34a", warn:"#f59e0b", bad:"#ef4444" },
  "Custom":  null,
};

let editingTxId = null;


/* =========================
   Auth redirect handler
   (Invite / Recovery flow)
   ========================= */

async function handleAuthRedirectFlow() {

  const hash = window.location.hash || "";
  const search = window.location.search || "";

  const isAuthFlow =
    hash.includes("type=recovery") ||
    hash.includes("type=invite") ||
    hash.includes("access_token=") ||
    search.includes("type=recovery") ||
    search.includes("type=invite");

  if (!isAuthFlow) return;

  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData?.session) return;

  // Affiche écran set password
  document.body.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
      <div style="max-width:420px;width:100%;">
        <h2>Définir un nouveau mot de passe</h2>

        <input id="new-password" type="password"
          placeholder="Nouveau mot de passe (min 8 caractères)"
          style="width:100%;padding:10px;margin-top:14px;" />

        <input id="new-password-2" type="password"
          placeholder="Confirmer le mot de passe"
          style="width:100%;padding:10px;margin-top:10px;" />

        <button id="save-password"
          style="margin-top:14px;padding:10px;width:100%;">
          Valider
        </button>

        <div id="pwd-status" style="margin-top:10px;"></div>
      </div>
    </div>
  `;

  const statusEl = document.getElementById("pwd-status");
  const btn = document.getElementById("save-password");

  btn.onclick = async () => {
    const p1 = document.getElementById("new-password").value || "";
    const p2 = document.getElementById("new-password-2").value || "";

    if (p1.length < 8) {
      statusEl.textContent = "Mot de passe trop court.";
      return;
    }

    if (p1 !== p2) {
      statusEl.textContent = "Les mots de passe ne correspondent pas.";
      return;
    }

    statusEl.textContent = "Mise à jour...";

    const { error } = await sb.auth.updateUser({ password: p1 });

    if (error) {
      statusEl.textContent = "Erreur : " + error.message;
      return;
    }

    // Marque qu’on sort d’un flow auth
    sessionStorage.setItem("tb_post_auth_redirect", "1");

    // Nettoie URL
    window.history.replaceState({}, document.title, window.location.pathname);

    setTimeout(() => {
      window.location.href = "/";
    }, 800);
  };
}


/* =========================
   BOOT INTERCEPT
   ========================= */

handleAuthRedirectFlow();

// Debug-only: expose env to console checks
try {
  const isDebug = new URLSearchParams(location.search).get("debug") === "1";
  if (isDebug) {
    window.__TB_ENV = {
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    };
  }
} catch (_) {}