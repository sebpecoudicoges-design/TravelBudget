/* =========================
   Help / FAQ (V1)
   - Static FAQ entries (FR/EN)
   - Search helper for assistant
   - Rendered on demand (view: help)
   ========================= */

(function () {
  // Keep data creation lightweight
  const FAQ = [
    {
      id: "budget_daily",
      tags: ["budget", "journalier", "daily", "kpi", "projection"],
      q: { fr: "Comment fonctionne le budget journalier ?", en: "How does the daily budget work?" },
      a: {
        fr: "On répartit ton budget sur la durée de la période. La valeur “/jour” sert à projeter ton solde futur. Si le budget/jour est vide, la projection peut paraître “plate”.",
        en: "Your budget is spread across the period. The “/day” value is used to project your future balance. If daily budget is empty, the projection can look “flat”."
      }
    },
    {
      id: "out_of_budget",
      tags: ["hors budget", "out of budget", "budget", "jour"],
      q: { fr: "“Hors budget/jour” : ça veut dire quoi ?", en: "What does “Out of daily budget” mean?" },
      a: {
        fr: "La dépense n’impacte pas ton budget/jour (projection), mais elle reste comptée dans tes dépenses et dans ton solde réel. Exemple : dépôt de garantie, achat exceptionnel.",
        en: "The expense doesn't affect your daily budget projection, but it still counts in your spend totals and real balance. Example: deposit, one-off purchase."
      }
    },
    {
      id: "to_pay_to_receive",
      tags: ["à payer", "à recevoir", "cashflow", "due", "pending"],
      q: { fr: "“À payer / À recevoir” : comment l’utiliser ?", en: "How to use “To pay / To receive”?" },
      a: {
        fr: "Utilise-le quand l’argent n’est pas encore sorti/entré. Ça ajuste la trésorerie projetée sans modifier le fait que la dépense existe.",
        en: "Use it when money hasn’t left/arrived yet. It adjusts projected cashflow without changing the fact the expense exists."
      }
    },
    {
      id: "fx_live_vs_fixed",
      tags: ["taux", "fx", "devise", "exchange", "auto"],
      q: { fr: "Taux live vs taux fixe : lequel choisir ?", en: "Live vs fixed FX rate: which one?" },
      a: {
        fr: "Live : tu veux une estimation à jour. Fixe : tu veux figer le taux (ex: budget planifié, frais déjà payés). En pratique : fixe si tu dois être exact, live si tu veux suivre la tendance.",
        en: "Live: you want up-to-date estimates. Fixed: you want to lock a rate (planned budget, already paid fees). In practice: fixed for accuracy, live for trend."
      }
    },
    {
      id: "segments_vs_period",
      tags: ["segment", "période", "scope", "period"],
      q: { fr: "Segment vs période : quelle différence ?", en: "Segment vs period: what's the difference?" },
      a: {
        fr: "La période définit les dates. Le segment est un “mode” à l’intérieur de la période (ex: une phase du voyage, un budget spécifique). Si tu n’en as pas besoin, reste en mode simple (1 période).",
        en: "The period defines dates. A segment is a “mode” inside the period (a trip phase, a specific budget). If you don’t need it, stay simple (1 period)."
      }
    },
    {
      id: "curve_down",
      tags: ["courbe", "cashflow", "projection", "baisse", "down"],
      q: { fr: "Pourquoi la courbe de trésorerie baisse ?", en: "Why is the cashflow curve going down?" },
      a: {
        fr: "La courbe projette ton solde futur à partir de ton budget/jour et des éléments “à payer/à recevoir”. Si ton budget/jour est négatif (ou tes paiements à venir importants), la courbe baisse.",
        en: "The curve projects future balance from your daily budget and “to pay/to receive”. If daily budget is negative (or upcoming payments are large), the curve goes down."
      }
    },

    {
      id: "wallet_balance",
      tags: ["wallet", "solde", "balance", "cash"],
      q: { fr: "Pourquoi le solde du wallet ne correspond pas à ma banque ?", en: "Why does my wallet balance differ from my bank?" },
      a: {
        fr: 'Le solde affiché = solde de base du wallet + transactions payées ("Payé maintenant"). Les dépenses "à payer" n\'impactent pas le cash. Utilise "Ajuster solde" pour recaler une fois le solde de base.',
        en: 'Displayed balance = wallet base balance + paid transactions ("Pay now"). Future/unpaid items do not impact cash. Use "Adjust balance" once to recalibrate the base balance.'
      }
    },
    {
      id: "fx_auto_fixed",
      tags: ["fx", "taux", "auto", "fixed", "manuel"],
      q: { fr: "Taux FX : auto ou fixe, comment ça marche ?", en: "FX rate: auto or fixed—how does it work?" },
      a: {
        fr: "Si la devise est disponible via la source FX auto, l'app utilise automatiquement le taux (mode auto). Sinon, le mode passe en fixe et te demande un taux EUR→BASE. Objectif : éviter les erreurs de saisie.",
        en: "If the currency is available from the auto FX provider, the app uses it automatically (auto mode). Otherwise it switches to fixed and asks for an EUR→BASE rate. Goal: prevent input mistakes."
      }
    },
    {
      id: "fx_refday_weekend",
      tags: ["fx", "ecb", "weekend", "refday", "asof"],
      q: { fr: "FX (ECB) : c’est quoi refDay / asOf ?", en: "FX (ECB): what are refDay / asOf?" },
      a: {
        fr: "Les taux ECB ont une date de publication (asOf). refDay = le jour de référence choisi par l’app pour éviter les trous (week-ends / jours fériés). En bref : tu vois la date utilisée pour le calcul.",
        en: "ECB rates have a publication date (asOf). refDay is the reference day chosen to avoid gaps (weekends/holidays). In short: you see which date is used for calculations."
      }
    },
    {
      id: "fx_manual_fallback",
      tags: ["fx", "manuel", "fallback", "taux", "audit"],
      q: { fr: "Quand dois-je saisir un taux manuel ?", en: "When do I need to enter a manual rate?" },
      a: {
        fr: "Seulement si l’ECB ne fournit pas ta devise base. Dans ce cas, l’app te demande un taux EUR→DEV daté (fallback). Si l’ECB couvre la devise : aucune saisie, le taux est verrouillé.",
        en: "Only if ECB doesn’t provide your base currency. Then the app requests a dated EUR→CUR fallback rate. If ECB covers the currency: no input, the rate is locked."
      }
    },
    {
      id: "segments_no_gaps",
      tags: ["périodes", "segments", "overlap", "trou", "dates"],
      q: { fr: "Pourquoi je ne peux pas avoir de trou / overlap entre les périodes ?", en: "Why can’t I have gaps/overlaps between periods?" },
      a: {
        fr: "Pour garder un calcul cohérent (budget/j, courbes, FX), l’app garantit une continuité parfaite : aucune journée manquante et aucune journée comptée deux fois. Quand tu modifies une borne, les autres périodes s’ajustent.",
        en: "To keep calculations consistent (daily budget, charts, FX), the app enforces perfect continuity: no missing day and no day counted twice. When you change a boundary, other periods are adjusted."
      }
    },
    {
      id: "wallet_negative",
      tags: ["wallet", "négatif", "découvert", "balance"],
      q: { fr: "Un wallet peut-il être négatif ?", en: "Can a wallet be negative?" },
      a: {
        fr: "Oui. Un wallet représente une poche (cash, banque). Si tu es à découvert ou si tu avances des frais, un solde négatif est possible. L’important est de bien tagger “Payé maintenant” vs “À payer”.",
        en: "Yes. A wallet is a pocket (cash, bank). If you’re overdrafted or fronting costs, a negative balance is possible. The key is using “Paid now” vs “To pay” correctly."
      }
    }
  ];

  function _lang() {
    return (window.tbGetLang && tbGetLang()) || "fr";
  }

  function tbGetFaqEntries() {
    return FAQ;
  }

  function _norm(s) {
    try {
      return String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    } catch (_) {
      return String(s || "").toLowerCase().trim();
    }
  }

  function tbSearchFaq(query, limit) {
    const qn = _norm(query);
    if (!qn) return [];
    const tokens = qn.split(" ").filter(Boolean);
    const lang = _lang();

    const scored = FAQ.map(item => {
      const text =
        _norm((item.q && item.q[lang]) || "") +
        " " +
        _norm((item.a && item.a[lang]) || "") +
        " " +
        _norm((item.tags || []).join(" "));

      let score = 0;
      for (const t of tokens) {
        if (!t) continue;
        if (text.includes(t)) score += (t.length >= 5 ? 3 : 2);
      }
      return { item, score };
    })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const out = scored.slice(0, Math.max(1, Number(limit) || 6)).map(x => x.item);
    return out;
  }

  // Expose globally
  window.tbGetFaqEntries = tbGetFaqEntries;
  window.tbSearchFaq = tbSearchFaq;

  /* =========================
     Help page renderer (V1)
     - Uses #help-root DOM from index.html
     - Keeps it dependency-free
     ========================= */

  function _t(k){ return (window.tbT ? tbT(k) : k); }

  function renderHelpFaq() {
    const root = document.getElementById("help-root");
    if (!root) return;

    // i18n static nodes
    try { if (window.tbApplyI18nDom) tbApplyI18nDom(root); } catch (_) {}

    const input = document.getElementById("help-search");
    if (input && !input.__tbBound) {
      input.__tbBound = true;
      input.placeholder = _t("help.search_placeholder");
      input.addEventListener("input", () => doSearch());
    } else if (input) {
      input.placeholder = _t("help.search_placeholder");
    }

    // Guides block (top)
    let guides = document.getElementById("help-guides");
    if (!guides) {
      guides = document.createElement("div");
      guides.id = "help-guides";
      guides.style.marginTop = "12px";
      guides.style.marginBottom = "12px";
      root.insertBefore(guides, root.querySelector(".form-row"));
    }

    guides.innerHTML = `
      <div style="font-weight:600; margin-bottom:8px;">${_t("help.guides.title")}</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:10px;">
        ${[
          ["help.guide.create_trip.title", "help.guide.create_trip.body"],
          ["help.guide.create_periods.title", "help.guide.create_periods.body"],
          ["help.guide.fx.title", "help.guide.fx.body"],
          ["help.guide.wallets.title", "help.guide.wallets.body"],
          ["help.guide.trip.title", "help.guide.trip.body"],
        ].map(([kt, kb]) => `
          <div class="hint" style="padding:10px; border:1px solid rgba(0,0,0,.08); border-radius:12px; background:rgba(0,0,0,.02);">
            <div style="font-weight:600; margin-bottom:6px;">${_t(kt)}</div>
            <div class="muted">${_t(kb)}</div>
          </div>
        `).join("")}
      </div>
    `;

    // Full list
    const list = document.getElementById("help-list");
    if (list) list.innerHTML = FAQ.map(item => _renderFaqItem(item)).join("");

    // initial state
    doSearch(true);
  }

  function _renderFaqItem(item) {
    const l = _lang();
    const q = (item.q && item.q[l]) || "";
    const a = (item.a && item.a[l]) || "";
    return `
      <div class="card" style="padding:10px; margin:10px 0;">
        <div style="font-weight:600;">${escapeHTML(q)}</div>
        <div class="muted" style="margin-top:6px; white-space:pre-wrap;">${escapeHTML(a)}</div>
      </div>
    `;
  }

  function doSearch(isInit) {
    const input = document.getElementById("help-search");
    const q = String(input && input.value || "").trim();
    const results = document.getElementById("help-results");
    const empty = document.getElementById("help-empty");
    if (!results || !empty) return;

    if (!q) {
      // nothing typed: hide top results
      results.innerHTML = "";
      empty.classList.add("hidden");
      return;
    }

    const hits = tbSearchFaq(q, 6);
    if (!hits.length) {
      results.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    results.innerHTML = `
      <div class="muted" style="margin:8px 0;">${_t("help.top_results")}</div>
      ${hits.map(item => _renderFaqItem(item)).join("")}
    `;
  }

  window.renderHelpFaq = renderHelpFaq;
})();