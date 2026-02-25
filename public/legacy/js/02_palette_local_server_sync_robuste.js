/* =========================
   Palette: local + server sync (robuste)
   ========================= */
function isValidPalette(p) {
  return !!(p && p.accent && p.good && p.warn && p.bad);
}
function palettesEqual(a, b) {
  if (!isValidPalette(a) || !isValidPalette(b)) return false;
  return a.accent === b.accent && a.good === b.good && a.warn === b.warn && a.bad === b.bad;
}
function findPresetNameForPalette(p) {
  if (!isValidPalette(p)) return "Ocean";
  for (const [name, preset] of Object.entries(PALETTES)) {
    if (!preset) continue;
    if (palettesEqual(p, preset)) return name;
  }
  return "Custom";
}
function getStoredPalette() {
  try {
    const raw = localStorage.getItem(PALETTE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return isValidPalette(obj) ? obj : null;
  } catch {
    return null;
  }
}
function getStoredPreset() {
  return localStorage.getItem(PRESET_KEY) || null;
}
function setStoredPreset(name) {
  if (!name) return;
  localStorage.setItem(PRESET_KEY, name);
}
function setCssPalette(p) {
  const root = document.documentElement;
  root.style.setProperty("--accent", p.accent);
  root.style.setProperty("--good", p.good);
  root.style.setProperty("--warn", p.warn);
  root.style.setProperty("--bad", p.bad);
  root.style.setProperty("--accent-soft", hexToRgba(p.accent, 0.14));
}

async function savePaletteToServer(p, presetName) {
  if (!sbUser) return;

  const payloadFull = {
    palette_json: p,
    palette_preset: presetName || findPresetNameForPalette(p),
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb.from(TB_CONST.TABLES.settings).update(payloadFull).eq("user_id", sbUser.id);

  if (!error) return;

  // Fallback: colonne palette_preset absente dans le schema cache
  const msg = error.message || "";
  if (msg.includes("palette_preset") && msg.includes("schema cache")) {
    const payloadLite = {
      palette_json: p,
      updated_at: new Date().toISOString(),
    };
    const { error: error2 } = await sb.from(TB_CONST.TABLES.settings).update(payloadLite).eq("user_id", sbUser.id);
    if (error2) throw error2;
    return;
  }

  throw error;
}

/**
 * applyPalette(p, presetName, {persistLocal=true, persistRemote=false})
 * - presetName can be "Ocean"/.../"Custom"
 */
async function applyPalette(p, presetName, opts = {}) {
  const { persistLocal = true, persistRemote = false } = opts;

  const palette = isValidPalette(p) ? p : (getStoredPalette() || PALETTES["Ocean"]);
  const preset = presetName || findPresetNameForPalette(palette);

  setCssPalette(palette);

  if (persistLocal) {
    localStorage.setItem(PALETTE_KEY, JSON.stringify(palette));
    setStoredPreset(preset);
  }

  if (persistRemote && sbUser) {
    try { await savePaletteToServer(palette, preset); }
    catch (e) { console.warn("palette sync failed", e); }
  }

  syncPaletteUI();
  redrawCharts();

  // ✅ Guard: renderKPI uniquement si le conteneur existe (dashboard monté)
  if (typeof renderKPI === "function" && document.getElementById("kpi")) {
    renderKPI();
  }
}

function resetPalette() {
  applyPalette(PALETTES["Ocean"], "Ocean", { persistLocal: true, persistRemote: true });
}

function syncPaletteUI() {
  const p = getStoredPalette() || PALETTES["Ocean"];
  const presetStored = getStoredPreset() || findPresetNameForPalette(p);

  const presetEl = document.getElementById("p-preset");
  if (presetEl) presetEl.value = presetStored;

  const elAccent = document.getElementById("p-accent");
  const elGood = document.getElementById("p-good");
  const elWarn = document.getElementById("p-warn");
  const elBad = document.getElementById("p-bad");

  if (elAccent) elAccent.value = p.accent;
  if (elGood) elGood.value = p.good;
  if (elWarn) elWarn.value = p.warn;
  if (elBad) elBad.value = p.bad;

  const chipA = document.getElementById("chip-accent");
  const chipG = document.getElementById("chip-good");
  const chipW = document.getElementById("chip-warn");
  const chipB = document.getElementById("chip-bad");

  if (chipA) chipA.style.background = p.accent;
  if (chipG) chipG.style.background = p.good;
  if (chipW) chipW.style.background = p.warn;
  if (chipB) chipB.style.background = p.bad;
}

function initPaletteUI() {
  const preset = document.getElementById("p-preset");
  if (preset && !preset._bound) {
    preset._bound = true;
    preset.innerHTML = Object.keys(PALETTES).map(k => `<option value="${k}">${k}</option>`).join("");

    preset.addEventListener("change", () => {
      const name = preset.value || "Ocean";
      if (name === "Custom") {
        // keep current palette, just mark preset as custom and sync
        const cur = getStoredPalette() || PALETTES["Ocean"];
        applyPalette(cur, "Custom", { persistLocal: true, persistRemote: true });
        return;
      }
      const p = PALETTES[name] || PALETTES["Ocean"];
      applyPalette(p, name, { persistLocal: true, persistRemote: true });
    });
  }

  const bindColor = (id) => {
    const el = document.getElementById(id);
    if (!el || el._bound) return;
    el._bound = true;

    // live preview, local only
    el.addEventListener("input", () => savePaletteFromUI(false));

    // commit + server sync
    el.addEventListener("change", () => savePaletteFromUI(true));
  };

  bindColor("p-accent");
  bindColor("p-good");
  bindColor("p-warn");
  bindColor("p-bad");

  syncPaletteUI();
}

function savePaletteFromUI(persist = true) {
  const a = document.getElementById("p-accent")?.value;
  const g = document.getElementById("p-good")?.value;
  const w = document.getElementById("p-warn")?.value;
  const b = document.getElementById("p-bad")?.value;
  if (!a || !g || !w || !b) return;

  const p = { accent: a, good: g, warn: w, bad: b };

  // If user changes any color manually -> preset becomes Custom unless it matches a preset.
  const presetName = findPresetNameForPalette(p);

  // apply locally and optionally push
  setCssPalette(p);
  syncPaletteUI();

  if (persist) {
    localStorage.setItem(PALETTE_KEY, JSON.stringify(p));
    setStoredPreset(presetName);
    const presetEl = document.getElementById("p-preset");
    if (presetEl) presetEl.value = presetName;

    if (sbUser) {
      savePaletteToServer(p, presetName).catch(e => console.warn("palette sync failed", e));
    }
  }

  redrawCharts();

  // ✅ Guard: renderKPI uniquement si le conteneur existe (dashboard monté)
  if (typeof renderKPI === "function" && document.getElementById("kpi")) {
    renderKPI();
  }
}