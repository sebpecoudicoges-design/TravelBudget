/* =========================
   Settings – Voyages (periods) / Périodes (budget_segments)
   STABLE + Voyage dropdown + segments bootstrap
   ========================= */

(function () {
  function _getSB() {
    try {
      if (typeof sb !== "undefined" && sb && typeof sb.from === "function") return sb;
    } catch (_) {}
    if (window.sb && typeof window.sb.from === "function") return window.sb;
    if (window.supabaseClient && typeof window.supabaseClient.from === "function") return window.supabaseClient;
    if (window.supabase && typeof window.supabase.from === "function") return window.supabase;
    return null;
  }

  function _toastOk(msg) {
    if (typeof window.toastOk === "function") return window.toastOk(msg);
    if (typeof window.toastInfo === "function") return window.toastInfo(msg);
    alert(msg);
  }
  function _toastErr(msg) {
    if (typeof window.toastErr === "function") return window.toastErr(msg);
    if (typeof window.toastWarn === "function") return window.toastWarn(msg);
    alert(msg);
  }

  async function _authUid(sbClient) {
    try {
      const res = await sbClient.auth.getUser();
      return res?.data?.user?.id || null;
    } catch (_) {
      return null;
    }
  }

  function _iso(d) {
    if (!d) return "";
    if (typeof d === "string") return d.slice(0, 10);
    return new Date(d).toISOString().slice(0, 10);
  }

  function _byStart(a, b) {
    return new Date(a.start_date) - new Date(b.start_date);
  }

  const ACTIVE_PERIOD_KEY = "tb_active_period_id_v1";

  window.renderSettings = async function renderSettings() {
    const sbClient = _getSB();
    const root = document.getElementById("settings-container");
    if (!root) return;

    if (!sbClient) {
      root.innerHTML =
        `<div style="padding:12px">
           <b>Settings</b><br/>
           Supabase client indisponible. (sb)<br/>
           Hard refresh (Ctrl+F5).
         </div>`;
      return;
    }

    const uid = await _authUid(sbClient);
    if (!uid) {
      root.innerHTML =
        `<div style="padding:12px">
           <b>Settings</b><br/>
           Non authentifié. Connecte-toi puis reviens.
         </div>`;
      return;
    }

    const { data: periods, error: eP } = await sbClient
      .from("periods")
      .select("id,start_date,end_date,base_currency,eur_base_rate,created_at")
      .eq("user_id", uid)
      .order("start_date");

    if (eP) {
      root.innerHTML = `<pre style="white-space:pre-wrap">Erreur periods: ${JSON.stringify(eP, null, 2)}</pre>`;
      return;
    }

    if (!periods || !periods.length) {
      root.innerHTML =
        `<div style="padding:12px">
           <b>Aucun voyage</b><br/>
           <button onclick="createVoyage()">+ Nouveau voyage</button>
         </div>`;
      return;
    }

    // Choose active voyage (from localStorage if valid, else first)
    const savedId = localStorage.getItem(ACTIVE_PERIOD_KEY);
    const active = periods.find(p => p.id === savedId) || periods[0];

    const { data: segs, error: eS } = await sbClient
      .from("budget_segments")
      .select("id,period_id,start_date,end_date,base_currency,daily_budget_base,fx_mode,eur_base_rate_fixed,sort_order")
      .eq("period_id", active.id)
      .order("start_date");

    if (eS) {
      root.innerHTML = `<pre style="white-space:pre-wrap">Erreur segments: ${JSON.stringify(eS, null, 2)}</pre>`;
      return;
    }

    const segments = (segs || []).slice().sort(_byStart);
    const segStart = segments.length ? segments[0].start_date : active.start_date;
    const segEnd = segments.length ? segments[segments.length - 1].end_date : active.end_date;

    // Build voyage dropdown
    const voyageOptions = periods.map(p => {
      const label = `${_iso(p.start_date)} → ${_iso(p.end_date)} (${(p.base_currency||"").toUpperCase() || "?"})`;
      const sel = p.id === active.id ? "selected" : "";
      return `<option value="${p.id}" ${sel}>${label}</option>`;
    }).join("");

    let html = `
      <h2>Voyage actif</h2>

      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
        <div>
          <label>Voyage</label><br/>
          <select id="voyage-select" style="min-width:260px">${voyageOptions}</select>
        </div>

        <div>
          <label>Début</label><br/>
          <input type="date" id="voyage-start" value="${_iso(segStart)}" />
        </div>
        <div>
          <label>Fin</label><br/>
          <input type="date" id="voyage-end" value="${_iso(segEnd)}" />
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="saveSettings()">Enregistrer dates</button>
          <button onclick="createVoyage()">+ Nouveau voyage</button>
          <button onclick="deleteVoyage()">Supprimer voyage</button>
        </div>
      </div>

      <div style="margin-top:6px;font-size:12px;opacity:.75">
        Voyages: <b>${periods.length}</b> • Segments: <b>${segments.length}</b>
      </div>

      <hr/>

      <h3>Périodes (segments)</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <button onclick="newPeriod()">+ Ajouter période</button>
        ${segments.length ? "" : `<button onclick="bootstrapSegments()">Recréer 1 segment pour ce voyage</button>`}
      </div>

      <div id="segments-list" style="display:flex;flex-direction:column;gap:10px">
    `;

    segments.forEach((s) => {
      html += `
        <div class="segment-card" data-id="${s.id}" style="border:1px solid #ddd;border-radius:8px;padding:10px">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
            <div>
              <label>Début</label><br/>
              <input type="date" class="seg-start" value="${_iso(s.start_date)}"/>
            </div>
            <div>
              <label>Fin</label><br/>
              <input type="date" class="seg-end" value="${_iso(s.end_date)}"/>
            </div>
            <div>
              <label>Devise</label><br/>
              <input type="text" class="seg-cur" value="${(s.base_currency || "").toUpperCase()}" style="width:90px"/>
            </div>
            <div>
              <label>Budget/jour</label><br/>
              <input type="number" class="seg-budget" value="${s.daily_budget_base ?? 0}" step="0.01" style="width:120px"/>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button onclick="saveSegment('${s.id}')">Save</button>
              <button onclick="deleteSegment('${s.id}')">Supprimer</button>
            </div>
          </div>
          <div style="margin-top:6px;font-size:12px;opacity:.75">
            fx_mode: <b>${s.fx_mode || "?"}</b>${s.eur_base_rate_fixed ? ` • taux fixe: ${s.eur_base_rate_fixed}` : ""}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    root.innerHTML = html;

    // Cache
    window.__TB_ACTIVE_PERIOD_ID = active.id;
    window.__TB_ACTIVE_UID = uid;

    // Attach select handler
    const sel = document.getElementById("voyage-select");
    sel.onchange = () => {
      localStorage.setItem(ACTIVE_PERIOD_KEY, sel.value);
      window.renderSettings();
    };
  };

  window.saveSettings = async function saveSettings() {
    const sbClient = _getSB();
    if (!sbClient) return _toastErr("Supabase non prêt.");
    const uid = await _authUid(sbClient);
    if (!uid) return _toastErr("Not authenticated.");

    const periodId = window.__TB_ACTIVE_PERIOD_ID;
    if (!periodId) return _toastErr("Voyage actif introuvable.");

    const start = document.getElementById("voyage-start")?.value;
    const end = document.getElementById("voyage-end")?.value;
    if (!start || !end) return _toastErr("Dates invalides.");

    const { error: eU } = await sbClient
      .from("periods")
      .update({ start_date: start, end_date: end })
      .eq("id", periodId);

    if (eU) return _toastErr(eU.message || "Erreur save voyage.");

    // Sync first+last segment
    const { data: segs } = await sbClient
      .from("budget_segments")
      .select("id,start_date,end_date")
      .eq("period_id", periodId)
      .order("start_date");

    if (segs && segs.length) {
      await sbClient.from("budget_segments").update({ start_date: start }).eq("id", segs[0].id);
      await sbClient.from("budget_segments").update({ end_date: end }).eq("id", segs[segs.length - 1].id);
    }

    _toastOk("Voyage mis à jour.");
    window.renderSettings();
  };

  window.bootstrapSegments = async function bootstrapSegments() {
    const sbClient = _getSB();
    if (!sbClient) return _toastErr("Supabase non prêt.");
    const uid = await _authUid(sbClient);
    if (!uid) return _toastErr("Not authenticated.");

    const periodId = window.__TB_ACTIVE_PERIOD_ID;
    if (!periodId) return _toastErr("Voyage actif introuvable.");

    const { data: p, error: eP } = await sbClient
      .from("periods")
      .select("id,start_date,end_date,base_currency")
      .eq("id", periodId)
      .single();

    if (eP) return _toastErr(eP.message || "Erreur lecture voyage.");

    const { error: eI } = await sbClient
      .from("budget_segments")
      .insert({
        user_id: uid,
        period_id: p.id,
        start_date: p.start_date,
        end_date: p.end_date,
        base_currency: (p.base_currency || "EUR").toUpperCase(),
        daily_budget_base: 0,
        fx_mode: "live_ecb",
        sort_order: 1
      });

    if (eI) return _toastErr(eI.message || "Erreur création segment.");

    _toastOk("1 segment recréé pour ce voyage.");
    window.renderSettings();
  };

  window.createVoyage = async function createVoyage() {
    const sbClient = _getSB();
    if (!sbClient) return _toastErr("Supabase non prêt.");
    const uid = await _authUid(sbClient);
    if (!uid) return _toastErr("Not authenticated.");

    const { data: periods } = await sbClient
      .from("periods")
      .select("id,end_date")
      .eq("user_id", uid)
      .order("end_date", { ascending: false });

    let start = new Date();
    if (periods && periods.length) {
      start = new Date(periods[0].end_date);
      start.setDate(start.getDate() + 1);
    }
    const end = new Date(start);
    end.setDate(end.getDate() + 30);

    const startStr = _iso(start);
    const endStr = _iso(end);

    const { data: pNew, error: eP } = await sbClient
      .from("periods")
      .insert({
        user_id: uid,
        start_date: startStr,
        end_date: endStr,
        base_currency: "EUR",
        eur_base_rate: 1
      })
      .select("id,start_date,end_date")
      .single();

    if (eP) return _toastErr(eP.message || "Erreur ajout voyage.");

    const { error: eS } = await sbClient
      .from("budget_segments")
      .insert({
        user_id: uid,
        period_id: pNew.id,
        start_date: pNew.start_date,
        end_date: pNew.end_date,
        base_currency: "EUR",
        daily_budget_base: 0,
        fx_mode: "live_ecb",
        sort_order: 1
      });

    if (eS) return _toastErr(eS.message || "Erreur init segment voyage.");

    localStorage.setItem(ACTIVE_PERIOD_KEY, pNew.id);
    _toastOk("Voyage créé.");
    window.renderSettings();
  };

  window.deleteVoyage = async function deleteVoyage() {
    const sbClient = _getSB();
    if (!sbClient) return _toastErr("Supabase non prêt.");
    const uid = await _authUid(sbClient);
    if (!uid) return _toastErr("Not authenticated.");

    const periodId = window.__TB_ACTIVE_PERIOD_ID;
    if (!periodId) return _toastErr("Voyage actif introuvable.");

    if (!confirm("Supprimer le voyage actif ? (segments inclus)")) return;

    await sbClient.from("budget_segments").delete().eq("period_id", periodId);
    const { error: eD } = await sbClient.from("periods").delete().eq("id", periodId);
    if (eD) return _toastErr(eD.message || "Erreur suppression voyage.");

    localStorage.removeItem(ACTIVE_PERIOD_KEY);
    _toastOk("Voyage supprimé.");
    window.renderSettings();
  };

  window.newPeriod = async function newPeriod() {
    const sbClient = _getSB();
    if (!sbClient) return _toastErr("Supabase non prêt.");
    const uid = await _authUid(sbClient);
    if (!uid) return _toastErr("Not authenticated.");

    const periodId = window.__TB_ACTIVE_PERIOD_ID;
    if (!periodId) return _toastErr("Voyage actif introuvable.");

    // Simple prompts for now (stable). We'll reintroduce modal after data is consistent.
    const start = prompt("Date début (YYYY-MM-DD)");
    const end = prompt("Date fin (YYYY-MM-DD)");
    if (!start || !end) return;

    const { error: eI } = await sbClient.from("budget_segments").insert({
      user_id: uid,
      period_id: periodId,
      start_date: start,
      end_date: end,
      base_currency: "EUR",
      daily_budget_base: 0,
      fx_mode: "live_ecb",
      sort_order: Date.now()
    });

    if (eI) return _toastErr(eI.message || "Erreur ajout période.");

    _toastOk("Période ajoutée.");
    window.renderSettings();
  };

  window.saveSegment = async function saveSegment(segId) {
    const sbClient = _getSB();
    if (!sbClient) return _toastErr("Supabase non prêt.");

    const card = document.querySelector(`[data-id="${segId}"]`);
    if (!card) return _toastErr("Segment introuvable.");

    const start = card.querySelector(".seg-start")?.value;
    const end = card.querySelector(".seg-end")?.value;
    const cur = (card.querySelector(".seg-cur")?.value || "EUR").trim().toUpperCase();
    const budgetRaw = card.querySelector(".seg-budget")?.value;
    const budget = budgetRaw === "" ? 0 : Number(String(budgetRaw).replace(",", "."));

    if (!start || !end || !cur || Number.isNaN(budget)) return _toastErr("Valeurs invalides.");

    const { error: eU } = await sbClient
      .from("budget_segments")
      .update({
        start_date: start,
        end_date: end,
        base_currency: cur,
        daily_budget_base: budget
      })
      .eq("id", segId);

    if (eU) return _toastErr(eU.message || "Erreur save période.");

    _toastOk("Période mise à jour.");
    window.renderSettings();
  };

  window.deleteSegment = async function deleteSegment(segId) {
    const sbClient = _getSB();
    if (!sbClient) return _toastErr("Supabase non prêt.");

    if (!confirm("Supprimer cette période ?")) return;

    const { error: eD } = await sbClient.from("budget_segments").delete().eq("id", segId);
    if (eD) return _toastErr(eD.message || "Erreur suppression période.");

    _toastOk("Période supprimée.");
    window.renderSettings();
  };
})();