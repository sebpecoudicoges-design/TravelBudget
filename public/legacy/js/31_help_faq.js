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
      tags: ["taux", "fx", "devise", "exchange", "ecb"],
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
      const text = _norm((item.q && item.q[lang]) || "") + " " + _norm((item.a && item.a[lang]) || "") + " " + _norm((item.tags || []).join(" "));
      let score = 0;
      for (const t of tokens) {
        if (!t) continue;
        if (text.includes(t)) score += (t.length >= 5 ? 3 : 2);
      }
      // bonus for exact phrase
      if (text.includes(qn)) score += 4;
      return { item, score };
    }).filter(x => x.score > 0);

    scored.sort((a,b) => b.score - a.score);
    return scored.slice(0, limit || 3).map(x => x.item);
  }

  function renderHelpFaq() {
    const root = document.getElementById("help-root");
    if (!root) return;

    const lang = _lang();
    const t = (k) => (window.tbT ? tbT(k) : k);

    const qEl = document.getElementById("help-search");
    const resultsEl = document.getElementById("help-results");
    const listEl = document.getElementById("help-list");
    const emptyEl = document.getElementById("help-empty");

    // Render full list (collapsed)
    if (listEl && !listEl.__renderedOnce) {
      listEl.__renderedOnce = true;
      const frag = document.createDocumentFragment();
      for (const f of FAQ) {
        const details = document.createElement("details");
        details.className = "help-item";
        const summary = document.createElement("summary");
        summary.textContent = (f.q && f.q[lang]) || "";
        const p = document.createElement("p");
        p.className = "help-answer";
        p.textContent = (f.a && f.a[lang]) || "";
        details.appendChild(summary);
        details.appendChild(p);
        frag.appendChild(details);
      }
      listEl.innerHTML = "";
      listEl.appendChild(frag);
    }

    function showResults(items) {
      if (!resultsEl || !emptyEl) return;
      if (!items || items.length === 0) {
        resultsEl.innerHTML = "";
        emptyEl.classList.remove("hidden");
        return;
      }
      emptyEl.classList.add("hidden");
      const frag = document.createDocumentFragment();
      for (const f of items) {
        const div = document.createElement("div");
        div.className = "help-result";
        const q = document.createElement("div");
        q.className = "help-q";
        q.textContent = (f.q && f.q[lang]) || "";
        const a = document.createElement("div");
        a.className = "help-a";
        a.textContent = (f.a && f.a[lang]) || "";
        div.appendChild(q);
        div.appendChild(a);
        frag.appendChild(div);
      }
      resultsEl.innerHTML = "";
      resultsEl.appendChild(frag);
    }

    function onSearch() {
      const q = (qEl && qEl.value) || "";
      const items = tbSearchFaq(q, 5);
      showResults(items);
    }

    if (qEl && !qEl.__bound) {
      qEl.__bound = true;
      qEl.placeholder = t("help.search_placeholder");
      qEl.addEventListener("input", () => {
        // small debounce without timers
        requestAnimationFrame(onSearch);
      });
    }

    // initial state
    showResults([]);
  }

  // Expose
  window.tbGetFaqEntries = tbGetFaqEntries;
  window.tbSearchFaq = tbSearchFaq;
  window.renderHelpFaq = renderHelpFaq;
})();
