/* =========================
   Settings: Voyages (periods) + Périodes (budget_segments)
   - UI is rendered into existing DOM nodes in index.html:
     #s-period, #s-start, #s-end, #seg-list, #manual-fx-box
   - Uses the in-memory shapes produced by 07_supabase_bootstrap.js:
     state.period: { id, start, end, baseCurrency, ... }
     state.periods: [{ id, start, end, baseCurrency }]
     state.budgetSegments: [{ id, periodId, start, end, baseCurrency, dailyBudgetBase, fxMode, eurBaseRateFixed, sortOrder }]
   ========================= */

/* ---------- small helpers ---------- */

function _tbGetSB() {
  return (typeof window !== "undefined" && (window.sb || window.supabaseClient)) || null;
}

function _tbISO(d) {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch (_) {
    return "";
  }
}

function _tbAddDays(iso, n) {
  const dt = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + Number(n || 0));
  return dt.toISOString().slice(0, 10);
}

function _tbParseNum(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).replace(/\u00A0/g, " ").trim().replace(/\s+/g, "");
  if (!s) return NaN;
  return Number(s.replace(",", "."));
}

function _tbToast(msg) {
  try {
    if (typeof toastOk === "function") return toastOk(msg);
  } catch (_) {}
  try {
    if (typeof toastInfo === "function") return toastInfo(msg);
  } catch (_) {}
  try {
    if (typeof toastWarn === "function") return toastWarn(msg);
  } catch (_) {}
  try {
    alert(msg);
  } catch (_) {}
}

async function _tbAuthUserId() {
  const s = _tbGetSB();
  if (!s) return null;
  try {
    const { data, error } = await s.auth.getUser();
    if (error) return null;
    return data?.user?.id || null;
  } catch (_) {
    return null;
  }
}

/* ---------- data refresh (settings scope) ---------- */

async function refreshSegmentsForActiveVoyage() {
  const s = _tbGetSB();
  if (!s) throw new Error("Supabase non prêt.");
  const pid = state?.period?.id;
  if (!pid) return;

  const { data, error } = await s
    .from("budget_segments")
    .select(
      "id,period_id,start_date,end_date,base_currency,daily_budget_base,fx_mode,eur_base_rate_fixed,sort_order,created_at,updated_at"
    )
    .eq("period_id", pid)
    .order("start_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throw error;

  state.budgetSegments = (data || []).map((r) => ({
    id: r.id,
    periodId: r.period_id,
    start: r.start_date,
    end: r.end_date,
    baseCurrency: (r.base_currency || "").toUpperCase(),
    dailyBudgetBase: Number(r.daily_budget_base || 0),
    fxMode: r.fx_mode || "fixed",
    eurBaseRateFixed:
      r.eur_base_rate_fixed === null || r.eur_base_rate_fixed === undefined
        ? null
        : Number(r.eur_base_rate_fixed),
    sortOrder: Number(r.sort_order || 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function _getPeriodsSorted() {
  const arr = (state.periods || []).slice();
  arr.sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
  return arr;
}

function _getSegsSorted() {
  const arr = (state.budgetSegments || []).slice();
  arr.sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
  return arr;
}

/* ---------- render ---------- */

async function loadVoyagesIntoSelect() {
  const sel = document.getElementById("s-period");
  if (!sel) return;

  const periods = _getPeriodsSorted();
  sel.innerHTML = "";

  periods.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    const cur = (p.baseCurrency || "").toUpperCase();
    opt.textContent = `${_tbISO(p.start)} → ${_tbISO(p.end)}${cur ? " (" + cur + ")" : ""}`;
    sel.appendChild(opt);
  });

  const activeId = state?.period?.id || (periods[0]?.id || "");
  if (activeId) {
    sel.value = activeId;
    if (!state.period || state.period.id !== activeId) {
      const p = periods.find((x) => x.id === activeId);
      if (p) {
        state.period.id = p.id;
        state.period.start = p.start;
        state.period.end = p.end;
        state.period.baseCurrency = p.baseCurrency;
      }
    }
  }

  sel.onchange = async () => {
    const id = sel.value;
    const p = periods.find((x) => x.id === id);
    if (p) {
      state.period.id = p.id;
      state.period.start = p.start;
      state.period.end = p.end;
      state.period.baseCurrency = p.baseCurrency;
    }
    await refreshSegmentsForActiveVoyage();
    renderSettings();
  };
}

function renderSettings() {
  const view = document.getElementById("view-settings");
  if (!view) return;

  loadVoyagesIntoSelect();

  const inStart = document.getElementById("s-start");
  const inEnd = document.getElementById("s-end");
  const segs = _getSegsSorted();

  const voyageStart = segs.length ? _tbISO(segs[0].start) : _tbISO(state?.period?.start);
  const voyageEnd = segs.length ? _tbISO(segs[segs.length - 1].end) : _tbISO(state?.period?.end);

  if (inStart) {
    inStart.type = "date";
    inStart.value = voyageStart || "";
  }
  if (inEnd) {
    inEnd.type = "date";
    inEnd.value = voyageEnd || "";
  }

  const host = document.getElementById("seg-list");
  if (!host) return;

  host.innerHTML = "";

  if (!state?.period?.id) {
    host.innerHTML = '<div class="muted">Aucun voyage sélectionné.</div>';
    return;
  }

  if (!segs.length) {
    host.innerHTML = '<div class="muted">Aucune période pour ce voyage. Utilise “Ajouter période”.</div>';
    return;
  }

  segs.forEach((seg, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "card";
    wrap.style.marginBottom = "10px";

    wrap.innerHTML = `
      <div class="row" style="align-items:flex-end; gap:10px;">
        <div class="field">
          <label>Début</label>
          <input type="date" data-k="start" value="${_tbISO(seg.start)}" />
        </div>
        <div class="field">
          <label>Fin</label>
          <input type="date" data-k="end" value="${_tbISO(seg.end)}" />
        </div>
        <div class="field" style="min-width:110px;">
          <label>Devise base</label>
          <input data-k="baseCurrency" value="${(seg.baseCurrency || "").toUpperCase()}" placeholder="ISO3 (ex: THB)" />
        </div>
        <div class="field" style="min-width:130px;">
          <label>Budget/jour</label>
          <input data-k="dailyBudgetBase" value="${seg.dailyBudgetBase ?? ""}" />
        </div>
        <div class="field" style="min-width:150px;">
          <label>FX</label>
          <select data-k="fxMode">
            <option value="live_ecb"${seg.fxMode === "live_ecb" ? " selected" : ""}>auto (ECB)</option>
            <option value="fixed"${seg.fxMode !== "live_ecb" ? " selected" : ""}>fixe (manuel)</option>
          </select>
        </div>
        <div class="field" style="min-width:170px;">
          <label>EUR → Devise (si fixe)</label>
          <input data-k="eurBaseRateFixed" value="${seg.eurBaseRateFixed ?? ""}" placeholder="ex: 36.57" />
        </div>

        <div style="flex:1"></div>
        <button class="btn primary" data-act="save">Enregistrer</button>
        <button class="btn danger" data-act="del">Supprimer</button>
      </div>
      <div class="muted" style="margin-top:6px;">
        #${idx + 1} • ${_tbISO(seg.start)} → ${_tbISO(seg.end)}
      </div>
    `;

    wrap.querySelector('[data-act="save"]').onclick = () => safeCall(() => saveBudgetSegment(seg.id, wrap));
    wrap.querySelector('[data-act="del"]').onclick = () => safeCall(() => deleteBudgetSegment(seg.id));

    const sel = wrap.querySelector('select[data-k="fxMode"]');
    const rate = wrap.querySelector('input[data-k="eurBaseRateFixed"]');
    if (sel && rate) {
      const update = () => {
        rate.disabled = sel.value === "live_ecb";
      };
      sel.onchange = update;
      update();
    }

    host.appendChild(wrap);
  });

  try {
    const box = document.getElementById("manual-fx-box");
    if (box && typeof renderManualFxFallbackBox === "function") renderManualFxFallbackBox(box);
  } catch (_) {}
}

/* ---------- voyage actions ---------- */

async function saveSettings() {
  const s = _tbGetSB();
  if (!s) throw new Error("Supabase non prêt.");
  const pid = state?.period?.id;
  if (!pid) throw new Error("Voyage non sélectionné.");

  const start = document.getElementById("s-start")?.value;
  const end = document.getElementById("s-end")?.value;

  if (!start || !end) throw new Error("Dates invalides.");
  if (start > end) throw new Error("Date de début > date de fin.");

  const { error } = await s.from("periods").update({ start_date: start, end_date: end }).eq("id", pid);
  if (error) throw error;

  state.period.start = start;
  state.period.end = end;

  await _syncVoyageBoundsToSegments(pid, start, end);

  await refreshSegmentsForActiveVoyage();
  _tbToast("Dates du voyage enregistrées.");
  renderSettings();
}

async function createVoyagePrompt() {
  const s = _tbGetSB();
  if (!s) throw new Error("Supabase non prêt.");

  const uid = await _tbAuthUserId();
  if (!uid) throw new Error("Not authenticated.");

  const start = prompt("Début du voyage (YYYY-MM-DD) :", _tbISO(new Date()));
  if (!start) return;
  const end = prompt("Fin du voyage (YYYY-MM-DD) :", start);
  if (!end) return;
  if (start > end) throw new Error("Date de début > date de fin.");

  const base = (state?.period?.baseCurrency || "EUR").toUpperCase();

  const ins = {
    user_id: uid,
    start_date: start,
    end_date: end,
    base_currency: base,
    eur_base_rate: 1,
    daily_budget_base: 0,
  };

  const { data, error } = await s
    .from("periods")
    .insert(ins)
    .select("id,start_date,end_date,base_currency")
    .single();
  if (error) throw error;

  state.periods = (state.periods || []).concat([
    {
      id: data.id,
      start: data.start_date,
      end: data.end_date,
      baseCurrency: data.base_currency,
    },
  ]);

  state.period.id = data.id;
  state.period.start = data.start_date;
  state.period.end = data.end_date;
  state.period.baseCurrency = data.base_currency;

  await _createInitialSegmentForVoyage(data.id, uid, start, end, base);

  await refreshSegmentsForActiveVoyage();
  renderSettings();
  _tbToast("Voyage créé.");
}

async function deleteActiveVoyage() {
  const s = _tbGetSB();
  if (!s) throw new Error("Supabase non prêt.");
  const pid = state?.period?.id;
  if (!pid) throw new Error("Voyage non sélectionné.");

  if (!confirm("Supprimer ce voyage ? (Les wallets/transactions liés doivent être gérés avant suppression)")) return;

  const { error } = await s.from("periods").delete().eq("id", pid);
  if (error) throw error;

  state.periods = (state.periods || []).filter((p) => p.id !== pid);
  const next = _getPeriodsSorted()[0] || null;
  if (next) {
    state.period.id = next.id;
    state.period.start = next.start;
    state.period.end = next.end;
    state.period.baseCurrency = next.baseCurrency;
    await refreshSegmentsForActiveVoyage();
  } else {
    state.budgetSegments = [];
  }
  renderSettings();
  _tbToast("Voyage supprimé.");
}

/* ---------- segment actions ---------- */

async function createPeriodPrompt() {
  const s = _tbGetSB();
  if (!s) throw new Error("Supabase non prêt.");
  const pid = state?.period?.id;
  if (!pid) throw new Error("Voyage non sélectionné.");

  const uid = await _tbAuthUserId();
  if (!uid) throw new Error("Not authenticated.");

  const segs = _getSegsSorted();
  if (!segs.length) {
    const start = _tbISO(state?.period?.start);
    const end = _tbISO(state?.period?.end);
    const base = (state?.period?.baseCurrency || "EUR").toUpperCase();
    await _createInitialSegmentForVoyage(pid, uid, start, end, base);
    await refreshSegmentsForActiveVoyage();
    renderSettings();
    return;
  }

  const last = segs[segs.length - 1];
  const defaultStart = _tbAddDays(_tbISO(last.end), 1);
  const defaultEnd = defaultStart;

  const start = prompt("Début de la nouvelle période (YYYY-MM-DD) :", defaultStart);
  if (!start) return;
  const end = prompt("Fin de la nouvelle période (YYYY-MM-DD) :", defaultEnd);
  if (!end) return;
  if (start > end) throw new Error("Date de début > date de fin.");

  const voyageStart = document.getElementById("s-start")?.value || _tbISO(state?.period?.start);
  const voyageEnd = document.getElementById("s-end")?.value || _tbISO(state?.period?.end);
  if (start < voyageStart || end > voyageEnd) {
    throw new Error("La nouvelle période doit être dans les bornes du voyage.");
  }

  const base = prompt(
    "Devise base (ISO3, ex: THB / IDR) :",
    (last.baseCurrency || state?.period?.baseCurrency || "EUR").toUpperCase()
  );
  if (!base) return;

  const daily = _tbParseNum(prompt("Budget/jour (en devise base) :", String(last.dailyBudgetBase ?? 0)));
  if (!Number.isFinite(daily) || daily < 0) throw new Error("Budget/jour invalide.");

  const fxMode = (prompt("FX mode: live_ecb ou fixed ?", last.fxMode || "fixed") || "").trim() || "fixed";
  if (!["live_ecb", "fixed"].includes(fxMode)) throw new Error("FX mode invalide (live_ecb/fixed).");

  let eurFix = null;
  if (fxMode === "fixed") {
    eurFix = _tbParseNum(prompt("Taux EUR→Devise (si fixe) :", String(last.eurBaseRateFixed ?? "")));
    if (!Number.isFinite(eurFix) || eurFix <= 0) throw new Error("Taux EUR→Devise invalide.");
  }

  const payload = {
    user_id: uid,
    period_id: pid,
    start_date: start,
    end_date: end,
    base_currency: base.toUpperCase(),
    daily_budget_base: daily,
    fx_mode: fxMode,
    eur_base_rate_fixed: fxMode === "fixed" ? eurFix : null,
    sort_order: Number(segs.length || 0),
  };

  const { error } = await s.from("budget_segments").insert(payload);
  if (error) throw error;

  await refreshSegmentsForActiveVoyage();
  await _normalizeSegmentsToNoHoles(pid);
  await refreshSegmentsForActiveVoyage();

  renderSettings();
  _tbToast("Période ajoutée.");
}

async function saveBudgetSegment(segId, wrapEl) {
  const s = _tbGetSB();
  if (!s) throw new Error("Supabase non prêt.");

  const pid = state?.period?.id;
  if (!pid) throw new Error("Voyage non sélectionné.");

  const getVal = (k) => {
    const el = wrapEl.querySelector(`[data-k="${k}"]`);
    return el ? el.value : "";
  };

  const start = getVal("start");
  const end = getVal("end");
  if (!start || !end) throw new Error("Dates invalides.");
  if (start > end) throw new Error("Date de début > date de fin.");

  const base = String(getVal("baseCurrency") || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(base)) throw new Error("Devise invalide (ISO3 attendu).");

  const daily = _tbParseNum(getVal("dailyBudgetBase"));
  if (!Number.isFinite(daily) || daily < 0) throw new Error("Budget/jour invalide.");

  const fxMode = String(getVal("fxMode") || "fixed").trim();
  if (!["live_ecb", "fixed"].includes(fxMode)) throw new Error("FX mode invalide.");

  let eurFix = null;
  if (fxMode === "fixed") {
    eurFix = _tbParseNum(getVal("eurBaseRateFixed"));
    if (!Number.isFinite(eurFix) || eurFix <= 0) throw new Error("Taux EUR→Devise invalide.");
  }

  const upd = {
    start_date: start,
    end_date: end,
    base_currency: base,
    daily_budget_base: daily,
    fx_mode: fxMode,
    eur_base_rate_fixed: fxMode === "fixed" ? eurFix : null,
  };

  const { error } = await s.from("budget_segments").update(upd).eq("id", segId);
  if (error) throw error;

  await _syncPeriodBoundsFromSegmentsIfNeeded(pid);
  await _normalizeSegmentsToNoHoles(pid);

  await refreshSegmentsForActiveVoyage();
  renderSettings();
  _tbToast("Période enregistrée.");
}

async function deleteBudgetSegment(segId) {
  const s = _tbGetSB();
  if (!s) throw new Error("Supabase non prêt.");
  const pid = state?.period?.id;
  if (!pid) throw new Error("Voyage non sélectionné.");

  const segs = _getSegsSorted();
  const seg = segs.find((x) => x.id === segId);
  if (!seg) return;

  if (!confirm(`Supprimer la période ${_tbISO(seg.start)} → ${_tbISO(seg.end)} ?`)) return;

  const { error } = await s.from("budget_segments").delete().eq("id", segId);
  if (error) throw error;

  await refreshSegmentsForActiveVoyage();
  await _normalizeSegmentsToNoHoles(pid);
  await refreshSegmentsForActiveVoyage();

  renderSettings();
  _tbToast("Période supprimée.");
}

/* ---------- normalization / sync ---------- */

async function _createInitialSegmentForVoyage(periodId, userId, start, end, base) {
  const s = _tbGetSB();
  const payload = {
    user_id: userId,
    period_id: periodId,
    start_date: start,
    end_date: end,
    base_currency: (base || "EUR").toUpperCase(),
    daily_budget_base: 0,
    fx_mode: "fixed",
    eur_base_rate_fixed: 1,
    sort_order: 0,
  };
  const { error } = await s.from("budget_segments").insert(payload);
  if (error) throw error;
}

async function _syncVoyageBoundsToSegments(periodId, start, end) {
  const s = _tbGetSB();
  const { data, error } = await s
    .from("budget_segments")
    .select("id,start_date,end_date")
    .eq("period_id", periodId)
    .order("start_date", { ascending: true });

  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return;

  const first = rows[0];
  const last = rows[rows.length - 1];

  if (_tbISO(first.start_date) !== start) {
    const { error: e1 } = await s.from("budget_segments").update({ start_date: start }).eq("id", first.id);
    if (e1) throw e1;
  }
  if (_tbISO(last.end_date) !== end) {
    const { error: e2 } = await s.from("budget_segments").update({ end_date: end }).eq("id", last.id);
    if (e2) throw e2;
  }

  await _normalizeSegmentsToNoHoles(periodId);
}

async function _syncPeriodBoundsFromSegmentsIfNeeded(periodId) {
  const s = _tbGetSB();
  const { data, error } = await s
    .from("budget_segments")
    .select("id,start_date,end_date")
    .eq("period_id", periodId)
    .order("start_date", { ascending: true });

  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return;

  const first = rows[0];
  const last = rows[rows.length - 1];

  const newStart = _tbISO(first.start_date);
  const newEnd = _tbISO(last.end_date);

  const { data: pRow, error: pe } = await s.from("periods").select("start_date,end_date").eq("id", periodId).single();
  if (pe) throw pe;

  const pStart = _tbISO(pRow.start_date);
  const pEnd = _tbISO(pRow.end_date);

  if (newStart !== pStart || newEnd !== pEnd) {
    const { error: e2 } = await s.from("periods").update({ start_date: newStart, end_date: newEnd }).eq("id", periodId);
    if (e2) throw e2;

    state.period.start = newStart;
    state.period.end = newEnd;
    const idx = (state.periods || []).findIndex((x) => x.id === periodId);
    if (idx >= 0) {
      state.periods[idx].start = newStart;
      state.periods[idx].end = newEnd;
    }
  }
}

async function _normalizeSegmentsToNoHoles(periodId) {
  const s = _tbGetSB();

  const { data: pRow, error: pe } = await s.from("periods").select("start_date,end_date").eq("id", periodId).single();
  if (pe) throw pe;
  const pStart = _tbISO(pRow.start_date);
  const pEnd = _tbISO(pRow.end_date);

  const { data, error } = await s
    .from("budget_segments")
    .select("id,start_date,end_date,sort_order")
    .eq("period_id", periodId)
    .order("start_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return;

  let expectedStart = pStart;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const curStart = _tbISO(r.start_date);
    const curEnd = _tbISO(r.end_date);

    if (curStart !== expectedStart) {
      const { error: e1 } = await s.from("budget_segments").update({ start_date: expectedStart }).eq("id", r.id);
      if (e1) throw e1;
    }

    const startAfterPatch = expectedStart;
    let endAfterPatch = curEnd;
    if (endAfterPatch < startAfterPatch) endAfterPatch = startAfterPatch;

    if (i === rows.length - 1) {
      if (endAfterPatch !== pEnd) {
        const { error: e2 } = await s.from("budget_segments").update({ end_date: pEnd }).eq("id", r.id);
        if (e2) throw e2;
      }
      break;
    }

    expectedStart = _tbAddDays(endAfterPatch, 1);
  }
}

/* 10_navigation.js calls renderSettings() directly */