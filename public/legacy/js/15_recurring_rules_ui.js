(function(){
  function _rrGetSB() {
    if (typeof _tbGetSB === "function") return _tbGetSB();
    return window.supabase || window.sb || null;
  }

  function _rrFmtDate(v) {
    if (!v) return "—";
    try { return String(v).slice(0, 10); } catch (_) { return "—"; }
  }

  function _rrFreqLabel(rule) {
    const type = String(rule?.ruleType || rule?.rule_type || rule?.type || "").toLowerCase();
    const every = Number(rule?.intervalCount || rule?.interval_count || 1) || 1;

    if (type === "daily") return every === 1 ? "Quotidien" : `Tous les ${every} jours`;
    if (type === "weekly") return every === 1 ? "Hebdomadaire" : `Toutes les ${every} semaines`;
    if (type === "monthly") return every === 1 ? "Mensuel" : `Tous les ${every} mois`;
    if (type === "yearly") return every === 1 ? "Annuel" : `Tous les ${every} ans`;
    return type || "—";
  }

  function _rrStatus(rule) {
    if (rule?.archived) return "archivée";
    if (rule?.isActive === false || rule?.is_active === false) return "pause";
    return "active";
  }

  function _rrWalletOptions() {
    const tid = String(state?.activeTravelId || "");
    return (state?.wallets || []).filter(w => String(w?.travelId || w?.travel_id || "") === tid);
  }

  function _rrEnsureSettingsBox() {
    const view = document.getElementById("view-settings");
    if (!view) return null;

    let box = document.getElementById("tb-recurring-card");
    if (box) return box.querySelector("#tb-recurring-box");

    const card = document.createElement("div");
    card.className = "card";
    card.id = "tb-recurring-card";
    card.style.marginBottom = "12px";
    card.innerHTML = `
      <h2>Échéances périodiques</h2>
      <div class="muted" style="margin-bottom:10px;">
        Crée des règles récurrentes liées au voyage actif. Le moteur SQL génère ensuite les occurrences.
      </div>
      <div class="row" style="justify-content:flex-end; margin-bottom:10px;">
        <button class="btn primary" id="tb-recurring-add-btn">+ Nouvelle échéance</button>
      </div>
      <div id="tb-recurring-box"></div>
    `;

    const paletteCard = document.getElementById("tb-account-card")?.nextElementSibling?.nextElementSibling;
    if (paletteCard && paletteCard.parentNode === view) {
      view.insertBefore(card, paletteCard);
    } else {
      view.appendChild(card);
    }

    const btn = card.querySelector("#tb-recurring-add-btn");
    if (btn) btn.onclick = () => safeCall("Nouvelle échéance", window.openRecurringRuleModal);

    return card.querySelector("#tb-recurring-box");
  }

  async function _rrCreateRule(payload) {
    const s = _rrGetSB();
    if (!s) throw new Error("Supabase non prêt.");

    const uid = await _tbAuthUid();
    const tid = String(state?.activeTravelId || "");
    if (!tid) throw new Error("Voyage actif requis.");

    const insertPayload = {
      user_id: uid,
      travel_id: tid,
      wallet_id: payload.wallet_id,
      label: payload.label,
      amount: payload.amount,
      currency: payload.currency,
      category: payload.category || null,
      subcategory: payload.subcategory || null,
      rule_type: payload.rule_type,
      interval_count: payload.interval_count,
      weekday: payload.weekday,
      monthday: payload.monthday,
      week_of_month: null,
      start_date: payload.start_date,
      end_date: payload.end_date || null,
      max_occurrences: payload.max_occurrences,
      is_active: true,
      archived: false
    };

    const { error } = await s
      .from(TB_CONST.TABLES.recurring_rules)
      .insert(insertPayload);

    if (error) throw error;
  }

  async function _rrSetActive(ruleId, isActive) {
    const s = _rrGetSB();
    if (!s) throw new Error("Supabase non prêt.");

    const { error } = await s
      .from(TB_CONST.TABLES.recurring_rules)
      .update({ is_active: !!isActive, updated_at: new Date().toISOString() })
      .eq("id", ruleId);

    if (error) throw error;

    if (typeof window.refreshFromServer === "function") {
      await window.refreshFromServer();
    } else if (typeof refreshFromServer === "function") {
      await refreshFromServer();
    }

    window.renderRecurringRules();
  }

  async function _rrArchive(ruleId) {
    const s = _rrGetSB();
    if (!s) throw new Error("Supabase non prêt.");

    const { error } = await s
      .from(TB_CONST.TABLES.recurring_rules)
      .update({
        archived: true,
        archived_at: new Date().toISOString(),
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", ruleId);

    if (error) throw error;

    if (typeof window.refreshFromServer === "function") {
      await window.refreshFromServer();
    } else if (typeof refreshFromServer === "function") {
      await refreshFromServer();
    }

    window.renderRecurringRules();
  }

  window.openRecurringRuleModal = async function openRecurringRuleModal() {
    const wallets = _rrWalletOptions();
    if (!wallets.length) throw new Error("Aucun wallet disponible sur le voyage actif.");

    const activeTravel = (state?.travels || []).find(t => String(t.id) === String(state?.activeTravelId || ""));
    const baseCur = String(activeTravel?.base_currency || state?.period?.baseCurrency || "EUR").toUpperCase();
    const cats = Array.isArray(state?.categories) ? state.categories : [];

    const modal = (typeof _tbEnsureModal === "function") ? _tbEnsureModal() : null;
    if (!modal) throw new Error("Modal indisponible.");

    const today = _tbISO(new Date());

    modal.setTitle("Nouvelle échéance périodique");
    modal.setBody(`
      <div class="row">
        <div class="field" style="min-width:220px;">
          <label>Nom</label>
          <input id="rr-label" type="text" placeholder="Ex: Loyer, Assurance, Netflix" />
        </div>
        <div class="field" style="min-width:140px;">
          <label>Montant</label>
          <input id="rr-amount" type="number" step="0.01" min="0" />
        </div>
        <div class="field" style="min-width:120px;">
          <label>Devise</label>
          <input id="rr-currency" type="text" value="${escapeHTML(baseCur)}" />
        </div>
      </div>

      <div class="row">
        <div class="field" style="min-width:220px;">
          <label>Wallet</label>
          <select id="rr-wallet">
            ${wallets.map(w => `<option value="${escapeHTML(w.id)}">${escapeHTML(w.name)} — ${escapeHTML(w.currency)}</option>`).join("")}
          </select>
        </div>

        <div class="field" style="min-width:180px;">
          <label>Catégorie</label>
          <input id="rr-category" list="rr-category-list" type="text" placeholder="Catégorie" />
          <datalist id="rr-category-list">
            ${cats.map(c => `<option value="${escapeHTML(c.name || "")}"></option>`).join("")}
          </datalist>
        </div>

        <div class="field" style="min-width:180px;">
          <label>Sous-catégorie</label>
          <input id="rr-subcategory" type="text" placeholder="Sous-catégorie" />
        </div>
      </div>

      <div class="row">
        <div class="field" style="min-width:180px;">
          <label>Fréquence</label>
          <select id="rr-rule-type">
            <option value="daily">Quotidien</option>
            <option value="weekly">Hebdomadaire</option>
            <option value="monthly" selected>Mensuel</option>
            <option value="yearly">Annuel</option>
          </select>
        </div>

        <div class="field" style="min-width:140px;">
          <label>Intervalle</label>
          <input id="rr-interval-count" type="number" min="1" step="1" value="1" />
        </div>

        <div class="field" style="min-width:140px;">
          <label>Jour semaine</label>
          <input id="rr-weekday" type="number" min="0" max="6" placeholder="0-6" />
        </div>

        <div class="field" style="min-width:140px;">
          <label>Jour mois</label>
          <input id="rr-monthday" type="number" min="1" max="31" placeholder="1-31" />
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label>Début</label>
          <input id="rr-start-date" type="date" value="${escapeHTML(today)}" />
        </div>

        <div class="field">
          <label>Fin</label>
          <input id="rr-end-date" type="date" />
        </div>

        <div class="field">
          <label>Occurrences max</label>
          <input id="rr-max-occurrences" type="number" min="1" step="1" placeholder="Optionnel" />
        </div>
      </div>
    `);

    modal.setActions([
      { label: "Annuler", className: "btn", onClick: () => modal.close() },
      {
        label: "Créer",
        className: "btn primary",
        onClick: async () => {
          const label = String(document.getElementById("rr-label")?.value || "").trim();
          const amount = Number(document.getElementById("rr-amount")?.value || 0);
          const currency = String(document.getElementById("rr-currency")?.value || "").trim().toUpperCase();
          const wallet_id = String(document.getElementById("rr-wallet")?.value || "");
          const category = String(document.getElementById("rr-category")?.value || "").trim();
          const subcategory = String(document.getElementById("rr-subcategory")?.value || "").trim();
          const rule_type = String(document.getElementById("rr-rule-type")?.value || "").trim();
          const interval_count = Math.max(1, Number(document.getElementById("rr-interval-count")?.value || 1));
          const weekdayRaw = document.getElementById("rr-weekday")?.value;
          const monthdayRaw = document.getElementById("rr-monthday")?.value;
          const start_date = String(document.getElementById("rr-start-date")?.value || "");
          const end_date = String(document.getElementById("rr-end-date")?.value || "");
          const maxOccRaw = document.getElementById("rr-max-occurrences")?.value;

          if (!label) throw new Error("Nom requis.");
          if (!(amount > 0)) throw new Error("Montant invalide.");
          if (!currency) throw new Error("Devise requise.");
          if (!wallet_id) throw new Error("Wallet requis.");
          if (!start_date) throw new Error("Date de début requise.");
          if (end_date && end_date < start_date) throw new Error("La date de fin doit être ≥ à la date de début.");

          const payload = {
            label,
            amount,
            currency,
            wallet_id,
            category: category || null,
            subcategory: subcategory || null,
            rule_type,
            interval_count,
            weekday: weekdayRaw === "" ? null : Number(weekdayRaw),
            monthday: monthdayRaw === "" ? null : Number(monthdayRaw),
            start_date,
            end_date: end_date || null,
            max_occurrences: maxOccRaw === "" ? null : Number(maxOccRaw)
          };

          await _rrCreateRule(payload);
          modal.close();

          if (typeof window.refreshFromServer === "function") {
            await window.refreshFromServer();
          } else if (typeof refreshFromServer === "function") {
            await refreshFromServer();
          }

          window.renderRecurringRules();
          _tbToastOk("Échéance créée.");
        }
      }
    ]);

    modal.open();
  };

  window.renderRecurringRules = function renderRecurringRules() {
    const host = _rrEnsureSettingsBox();
    if (!host) return;

    const tid = String(state?.activeTravelId || "");
    const rows = (state?.recurringRules || [])
      .filter(r => String(r?.travelId || r?.travel_id || "") === tid)
      .filter(r => !r?.archived)
      .slice()
      .sort((a, b) => String(a?.nextDueAt || a?.next_due_at || "").localeCompare(String(b?.nextDueAt || b?.next_due_at || "")));

    if (!rows.length) {
      host.innerHTML = `<div class="muted">Aucune échéance périodique sur ce voyage.</div>`;
      return;
    }

    host.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Montant</th>
              <th>Fréquence</th>
              <th>Prochaine</th>
              <th>Statut</th>
              <th style="width:220px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${escapeHTML(r.label || r.name || "—")}</td>
                <td>${escapeHTML(fmtMoney(Number(r.amount || 0), r.currency || ""))}</td>
                <td>${escapeHTML(_rrFreqLabel(r))}</td>
                <td>${escapeHTML(_rrFmtDate(r.nextDueAt || r.next_due_at))}</td>
                <td>${escapeHTML(_rrStatus(r))}</td>
                <td>
                  <div class="row" style="gap:8px; justify-content:flex-start;">
                    ${_rrStatus(r) === "active"
                      ? `<button class="btn" data-rr-act="pause" data-rr-id="${escapeHTML(r.id)}">Pause</button>`
                      : `<button class="btn" data-rr-act="resume" data-rr-id="${escapeHTML(r.id)}">Reprendre</button>`
                    }
                    <button class="btn danger" data-rr-act="delete" data-rr-id="${escapeHTML(r.id)}">Supprimer</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    host.querySelectorAll("[data-rr-act]").forEach(btn => {
      btn.onclick = () => safeCall("Échéances périodiques", async () => {
        const id = String(btn.getAttribute("data-rr-id") || "");
        const act = String(btn.getAttribute("data-rr-act") || "");

        if (!id || !act) return;

        if (act === "pause") {
          await _rrSetActive(id, false);
          _tbToastOk("Échéance mise en pause.");
          return;
        }

        if (act === "resume") {
          await _rrSetActive(id, true);
          _tbToastOk("Échéance reprise.");
          return;
        }

        if (act === "delete") {
          if (!confirm("Supprimer cette échéance périodique ?")) return;
          await _rrArchive(id);
          _tbToastOk("Échéance supprimée.");
        }
      });
    });
  };
})();