/* =========================
   Supabase config
   ========================= */
const SUPABASE_URL = "https://obznbrzarhvmlbprcfie.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xMHxyW0Cs9oRpGQsdatnyA_JIaaAC0D";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let sbUser = null;
let activeView = "dashboard";
// ---- expose for plugins (do not remove) ----

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

