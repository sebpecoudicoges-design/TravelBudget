/* =========================
   Settings – Periods / Segments
   Stable rebuild – no overlap / no holes
   ========================= */

(function () {
  if (!window.sb) {
    console.error("[Settings] Supabase client (window.sb) not found.");
    return;
  }

  const sb = window.sb;

  /* --------------------------------------------------
     Utils
  -------------------------------------------------- */

  function toastOk(msg) {
    if (window.toastOk) window.toastOk(msg);
    else alert(msg);
  }

  function toastErr(msg) {
    if (window.toastErr) window.toastErr(msg);
    else alert(msg);
  }

  async function authUid() {
    const { data } = await sb.auth.getUser();
    return data?.user?.id || null;
  }

  function byDate(a, b) {
    return new Date(a.start_date) - new Date(b.start_date);
  }

  /* --------------------------------------------------
     Render
  -------------------------------------------------- */

  window.renderSettings = async function () {
    const uid = await authUid();
    if (!uid) return;

    const { data: periods } = await sb
      .from("periods")
      .select("*")
      .eq("user_id", uid)
      .order("start_date");

    if (!periods || !periods.length) {
      document.getElementById("settings-container").innerHTML =
        "<p>Aucun voyage.</p>";
      return;
    }

    const active = periods[0];

    const { data: segments } = await sb
      .from("budget_segments")
      .select("*")
      .eq("period_id", active.id)
      .order("start_date");

    let html = `
      <h2>Voyage actif</h2>
      <div>
        <label>Début</label>
        <input type="date" id="voyage-start" value="${active.start_date}" />
        <label>Fin</label>
        <input type="date" id="voyage-end" value="${active.end_date}" />
        <button onclick="saveSettings()">Enregistrer dates</button>
        <button onclick="createVoyage()">+ Nouveau voyage</button>
        <button onclick="deleteVoyage()">Supprimer voyage</button>
      </div>

      <hr/>
      <h3>Périodes</h3>
      <button onclick="newPeriod()">+ Ajouter période</button>
      <div id="segments-list">
    `;

    segments.sort(byDate);

    segments.forEach((s) => {
      html += `
        <div class="segment-card" data-id="${s.id}">
          <input type="date" class="seg-start" value="${s.start_date}" />
          <input type="date" class="seg-end" value="${s.end_date}" />
          <input type="number" class="seg-budget" value="${s.daily_budget_base}" />
          <button onclick="saveSegment('${s.id}')">Save</button>
          <button onclick="deleteSegment('${s.id}')">Supprimer</button>
        </div>
      `;
    });

    html += `</div>`;
    document.getElementById("settings-container").innerHTML = html;
  };

  /* --------------------------------------------------
     Voyage
  -------------------------------------------------- */

  window.saveSettings = async function () {
    const uid = await authUid();
    if (!uid) return toastErr("Not authenticated");

    const start = document.getElementById("voyage-start").value;
    const end = document.getElementById("voyage-end").value;

    const { data: periods } = await sb
      .from("periods")
      .select("*")
      .eq("user_id", uid)
      .order("start_date");

    const active = periods[0];

    await sb
      .from("periods")
      .update({ start_date: start, end_date: end })
      .eq("id", active.id);

    // Sync first + last segment
    const { data: segs } = await sb
      .from("budget_segments")
      .select("*")
      .eq("period_id", active.id)
      .order("start_date");

    if (segs.length) {
      const first = segs[0];
      const last = segs[segs.length - 1];

      await sb
        .from("budget_segments")
        .update({ start_date: start })
        .eq("id", first.id);

      await sb
        .from("budget_segments")
        .update({ end_date: end })
        .eq("id", last.id);
    }

    toastOk("Voyage mis à jour");
    renderSettings();
  };

  window.createVoyage = async function () {
    const uid = await authUid();
    if (!uid) return toastErr("Not authenticated");

    const { data: periods } = await sb
      .from("periods")
      .select("*")
      .eq("user_id", uid)
      .order("end_date", { ascending: false });

    const lastEnd = periods.length
      ? new Date(periods[0].end_date)
      : new Date();

    const newStart = new Date(lastEnd);
    newStart.setDate(newStart.getDate() + 1);

    const newEnd = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + 30);

    const { data: newPeriod } = await sb
      .from("periods")
      .insert({
        user_id: uid,
        start_date: newStart.toISOString().slice(0, 10),
        end_date: newEnd.toISOString().slice(0, 10),
        base_currency: "EUR",
        eur_base_rate: 1,
      })
      .select()
      .single();

    await sb.from("budget_segments").insert({
      user_id: uid,
      period_id: newPeriod.id,
      start_date: newPeriod.start_date,
      end_date: newPeriod.end_date,
      base_currency: "EUR",
      daily_budget_base: 0,
      fx_mode: "live_ecb",
      sort_order: 1,
    });

    toastOk("Voyage créé");
    renderSettings();
  };

  window.deleteVoyage = async function () {
    const uid = await authUid();
    if (!uid) return toastErr("Not authenticated");

    if (!confirm("Supprimer le voyage actif ?")) return;

    const { data: periods } = await sb
      .from("periods")
      .select("*")
      .eq("user_id", uid)
      .order("start_date");

    const active = periods[0];

    await sb.from("budget_segments").delete().eq("period_id", active.id);
    await sb.from("periods").delete().eq("id", active.id);

    toastOk("Voyage supprimé");
    renderSettings();
  };

  /* --------------------------------------------------
     Segments
  -------------------------------------------------- */

  window.newPeriod = async function () {
    const uid = await authUid();
    if (!uid) return toastErr("Not authenticated");

    const { data: periods } = await sb
      .from("periods")
      .select("*")
      .eq("user_id", uid)
      .order("start_date");

    const active = periods[0];

    const start = prompt("Date début (YYYY-MM-DD)");
    const end = prompt("Date fin (YYYY-MM-DD)");

    if (!start || !end) return;

    await sb.from("budget_segments").insert({
      user_id: uid,
      period_id: active.id,
      start_date: start,
      end_date: end,
      base_currency: active.base_currency,
      daily_budget_base: 0,
      fx_mode: "live_ecb",
      sort_order: Date.now(),
    });

    toastOk("Période ajoutée");
    renderSettings();
  };

  window.saveSegment = async function (id) {
    const card = document.querySelector(`[data-id="${id}"]`);
    const start = card.querySelector(".seg-start").value;
    const end = card.querySelector(".seg-end").value;
    const budget = card.querySelector(".seg-budget").value;

    await sb
      .from("budget_segments")
      .update({
        start_date: start,
        end_date: end,
        daily_budget_base: budget,
      })
      .eq("id", id);

    toastOk("Période mise à jour");
    renderSettings();
  };

  window.deleteSegment = async function (id) {
    if (!confirm("Supprimer cette période ?")) return;
    await sb.from("budget_segments").delete().eq("id", id);
    toastOk("Période supprimée");
    renderSettings();
  };
})();