// public/legacy/js/15_recurring_rules_ui.js
(function(){
  function _rrGetSB() {
    if (typeof _tbGetSB === "function") return _tbGetSB();
    return window.supabase || window.sb || null;
  }

  function _rrFmtDate(v) {
    if (!v) return "—";
    try { return String(v).slice(0, 10); } catch (_) { return "—"; }
  }

  function _rrParseISODate(iso) {
    const s = String(iso || "");
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return {
      y: Number(m[1]),
      m: Number(m[2]),
      d: Number(m[3])
    };
  }

  function _rrDaysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  function _rrISOFromParts(y, m, d) {
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  function _rrDateToUTCDate(iso) {
    const p = _rrParseISODate(iso);
    if (!p) return null;
    return new Date(Date.UTC(p.y, p.m - 1, p.d));
  }

  function _rrComputeFirstDueDate(ruleType, startDate, weekday, monthday) {
    const start = _rrDateToUTCDate(startDate);
    if (!start) return startDate;

    if (ruleType === "daily") return startDate;

    if (ruleType === "weekly") {
      if (weekday === null || weekday === undefined || weekday === "") return startDate;
      const target = Number(weekday);
      const cur = start.getUTCDay();
      const delta = (target - cur + 7) % 7;
      const due = new Date(start.getTime());
      due.setUTCDate(due.getUTCDate() + delta);
      return _rrISOFromParts(due.getUTCFullYear(), due.getUTCMonth() + 1, due.getUTCDate());
    }

    if (ruleType === "every_x_months") {
      const md = Number(monthday || 0);
      if (!(md >= 1 && md <= 31)) return startDate;

      const y = start.getUTCFullYear();
      const m = start.getUTCMonth() + 1;
      const d = start.getUTCDate();

      const dim = _rrDaysInMonth(y, m);
      const candidateDay = Math.min(md, dim);

      if (candidateDay >= d) {
        return _rrISOFromParts(y, m, candidateDay);
      }

      const next = new Date(Date.UTC(y, m, 1));
      const ny = next.getUTCFullYear();
      const nm = next.getUTCMonth() + 1;
      const ndim = _rrDaysInMonth(ny, nm);
      return _rrISOFromParts(ny, nm, Math.min(md, ndim));
    }

    if (ruleType === "yearly") return startDate;

    return startDate;
  }

  function _rrFreqLabel(rule) {
    const type = String(rule?.ruleType || rule?.rule_type || "").toLowerCase();
    const every = Number(rule?.intervalCount || rule?.interval_count || 1) || 1;

    if (type === "daily") return every === 1 ? "Quotidien" : `Tous les ${every} jours`;
    if (type === "weekly") return every === 1 ? "Hebdomadaire" : `Toutes les ${every} semaines`;
    if (type === "monthly") return every === 1 ? "Mensuel" : `Tous les ${every} mois`;
    if (type === "every_x_months") return every === 1 ? "Mensuel" : `Tous les ${every} mois`;
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

  function _rrCategoryOptions() {
    const out = new Set();

    (state?.categories || []).forEach((c) => {
      if (typeof c === "string") {
        const v = c.trim();
        if (v) out.add(v);
        return;
      }

      const candidates = [
        c?.name,
        c?.label,
        c?.category
      ];

      candidates.forEach((v) => {
        const s = String(v || "").trim();
        if (s) out.add(s);
      });
    });

    (state?.transactions || []).forEach((t) => {
      const s = String(t?.category || "").trim();
      if (s) out.add(s);
    });

    return Array.from(out).sort((a, b) => a.localeCompare(b));
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

      type: payload.type,
      rule_type: payload.rule_type,

      category: payload.category || null,
      subcategory: payload.subcategory || null,

      interval_count: payload.interval_count,
      weekday: payload.weekday,
      monthday: payload.monthday,
      week_of_month: null,
      start_date: payload.start_date,
      next_due_at: payload.next_due_at || payload.start_date,
      end_date: payload.end_date || null,
      max_occurrences: payload.max_occurrences,
      is_active: true,
      archived: false
    };

    const { data, error } = await s
      .from(TB_CONST.TABLES.recurring_rules)
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) throw error;

    const newRuleId = String(data?.id || "");
    if (!newRuleId) throw new Error("Règle créée sans id.");

    const rpcName =
      TB_CONST?.RPCS?.recurring_generate_for_rule ||
      "recurring_generate_for_rule";

    const { error: genErr } = await s.rpc(rpcName, { p_rule_id: newRuleId });
    if (genErr) throw genErr;

    return newRuleId;
  }

  async function _rrSetActive(ruleId, shouldBeActive) {
    const s = _rrGetSB();
    if (!s) throw new Error("Supabase non prêt.");

    const rid = String(ruleId || "").trim();
    if (!rid) throw new Error("Règle introuvable.");

    const rpcName = shouldBeActive
      ? (TB_CONST?.RPCS?.recurring_resume_rule || "recurring_resume_rule")
      : (TB_CONST?.RPCS?.recurring_pause_rule || "recurring_pause_rule");

    const { error } = await s.rpc(rpcName, { p_rule_id: rid });
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

    const rid = String(ruleId || "").trim();
    if (!rid) throw new Error("Règle introuvable.");

    const rpcName =
      TB_CONST?.RPCS?.recurring_delete_rule ||
      "recurring_delete_rule";

    const { error } = await s.rpc(rpcName, {
      p_rule_id: rid,
      p_mode: "rule_and_future"
    });
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
    const cats = _rrCategoryOptions();

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
          <label>Type</label>
          <select id="rr-type">
            <option value="expense">Dépense</option>
            <option value="income">Entrée</option>
          </select>
        </div>

        <div class="field" style="min-width:140px;">
          <label>Montant</label>
          <input id="rr-amount" type="number" step="0.01" min="0" />
        </div>
      </div>

      <div class="row">
        <div class="field" style="min-width:220px;">
          <label>Wallet</label>
          <select id="rr-wallet">
            ${wallets.map(w => `<option value="${escapeHTML(w.id)}" data-cur="${escapeHTML(String(w.currency || "").toUpperCase())}">${escapeHTML(w.name)} — ${escapeHTML(w.currency)}</option>`).join("")}
          </select>
        </div>

        <div class="field" style="min-width:120px;">
          <label>Devise</label>
          <input id="rr-currency" type="text" value="${escapeHTML(String(wallets[0]?.currency || baseCur || "EUR").toUpperCase())}" />
        </div>

        <div class="field" style="min-width:180px;">
          <label>Catégorie</label>
          <select id="rr-category">
            <option value="">Catégorie</option>
            ${cats.map(cat => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`).join("")}
          </select>
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
            <option value="every_x_months" selected>Mensuel</option>
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

    const walletSel = document.getElementById("rr-wallet");
    const curInp = document.getElementById("rr-currency");
    let currencyManuallyEdited = false;

    if (curInp) {
      curInp.addEventListener("input", () => {
        currencyManuallyEdited = true;
      });
    }

    if (walletSel && curInp) {
      walletSel.addEventListener("change", () => {
        if (currencyManuallyEdited) return;
        const opt = walletSel.options[walletSel.selectedIndex];
        const cur = String(opt?.dataset?.cur || "").trim().toUpperCase();
        if (cur) curInp.value = cur;
      });
    }

    modal.setActions([
      { label: "Annuler", className: "btn", onClick: () => modal.close() },
      {
        label: "Créer",
        className: "btn primary",
        onClick: async () => {
          const label = String(document.getElementById("rr-label")?.value || "").trim();
          const type = String(document.getElementById("rr-type")?.value || "expense");
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

          const weekday = weekdayRaw === "" ? null : Number(weekdayRaw);
          const monthday = monthdayRaw === "" ? null : Number(monthdayRaw);

          const next_due_at = _rrComputeFirstDueDate(
            rule_type,
            start_date,
            weekday,
            monthday
          );

          const payload = {
            label,
            type,
            amount,
            currency,
            wallet_id,
            category: category || null,
            subcategory: subcategory || null,
            rule_type,
            interval_count,
            weekday,
            monthday,
            start_date,
            next_due_at,
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
                <td>${escapeHTML(fmtMoney(Number(r.amount || 0), r.currency || ""))} ${escapeHTML(r.type || "")}</td>
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

    host.querySelectorAll("[data-rr-act]").forEach((btn) => {
      btn.onclick = (ev) => safeCall("Échéances périodiques", async () => {
        const el = ev.currentTarget;
        const id = String(el?.dataset?.rrId || "").trim();
        const act = String(el?.dataset?.rrAct || "").trim();

        if (!id) throw new Error("Règle introuvable.");
        if (!act) throw new Error("Action introuvable.");

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
          if (!confirm("Supprimer cette échéance périodique ?\n\nLes occurrences futures générées seront supprimées, mais les occurrences déjà passées resteront conservées.")) return;
          await _rrArchive(id);
          _tbToastOk("Échéance supprimée.");
          return;
        }

        throw new Error("Action non reconnue.");
      });
    });
  };
})();