(() => {
  const state = {
    journey: "month",
    journeyStep: 0,
    lab: "transaction",
    checklistFilter: "all",
  };

  const lang = () => document.documentElement.lang === "en" ? "en" : "fr";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character]));
  const number = (value, fallback = 0) => {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const money = (value) => `${Math.round(value).toLocaleString(lang() === "fr" ? "fr-FR" : "en-US")} EUR`;

  const journeys = {
    fr: {
      month: {
        label: "Piloter son mois",
        steps: [
          ["Capturer", "Ajouter le salaire et les sorties reelles.", "Point de depart", "3 470 EUR", "Cash consolide"],
          ["Classer", "Relier chaque mouvement a la bonne categorie.", "Lecture active", "25 lignes", "a classer"],
          ["Projeter", "Combiner factures futures et revenus attendus.", "Horizon 30 jours", "+1 240 EUR", "projection nette"],
          ["Decider", "Voir le budget quotidien vraiment disponible.", "Decision du jour", "87 EUR", "budget / jour"],
        ],
      },
      trip: {
        label: "Preparer un voyage",
        steps: [
          ["Creer", "Definir la devise et les participants du voyage.", "Groupe actif", "4 personnes", "EUR + THB"],
          ["Partager", "Repartir une depense equitablement ou sur mesure.", "Restaurant", "28 EUR", "par personne"],
          ["Rapprocher", "Lier le paiement au budget sans double comptage.", "Matching", "1 transaction", "verrouillee"],
          ["Regler", "Calculer qui rembourse qui avec le minimum de transferts.", "Solde final", "56 EUR", "a recevoir"],
        ],
      },
      health: {
        label: "Suivre sa sante",
        steps: [
          ["Journaliser", "Ajouter repas, eau, sommeil et seance.", "Jour actif", "4 signaux", "synchronises"],
          ["Relier", "Croiser alimentation, sport et charge de travail.", "Energie", "2 180 kcal", "besoin ajuste"],
          ["Expliquer", "Comprendre le score plutot que voir une note opaque.", "Score Sante", "82 / 100", "6 facteurs"],
          ["Agir", "Choisir la prochaine action utile et realiste.", "Prochaine action", "+400 ml", "d'eau"],
        ],
      },
    },
    en: {
      month: {
        label: "Drive the month",
        steps: [
          ["Capture", "Add salary and actual outflows.", "Starting point", "3,470 EUR", "consolidated cash"],
          ["Classify", "Connect every movement to the right category.", "Active reading", "25 rows", "to classify"],
          ["Forecast", "Combine future invoices and expected income.", "30-day horizon", "+1,240 EUR", "net forecast"],
          ["Decide", "See the daily budget that is truly available.", "Today's decision", "87 EUR", "daily budget"],
        ],
      },
      trip: {
        label: "Prepare a trip",
        steps: [
          ["Create", "Define the currency and trip participants.", "Active group", "4 people", "EUR + THB"],
          ["Split", "Share an expense equally or with custom amounts.", "Restaurant", "28 EUR", "per person"],
          ["Match", "Link the payment to budget without double counting.", "Matching", "1 transaction", "locked"],
          ["Settle", "Calculate who pays whom with fewer transfers.", "Final balance", "56 EUR", "to receive"],
        ],
      },
      health: {
        label: "Track health",
        steps: [
          ["Log", "Add meals, water, sleep and a workout.", "Active day", "4 signals", "synchronized"],
          ["Connect", "Cross nutrition, sport and physical workload.", "Energy", "2,180 kcal", "adjusted need"],
          ["Explain", "Understand the score instead of seeing an opaque grade.", "Health score", "82 / 100", "6 factors"],
          ["Act", "Choose the next useful and realistic action.", "Next action", "+400 ml", "of water"],
        ],
      },
    },
  };

  function renderJourneys() {
    const tabs = document.getElementById("journeyTabs");
    const steps = document.getElementById("journeySteps");
    const preview = document.getElementById("journeyPreview");
    if (!tabs || !steps || !preview) return;
    const catalog = journeys[lang()];
    const active = catalog[state.journey] || catalog.month;
    state.journeyStep = Math.min(state.journeyStep, active.steps.length - 1);
    tabs.innerHTML = Object.entries(catalog).map(([key, journey]) => (
      `<button class="journey-tab${state.journey === key ? " active" : ""}" type="button" role="tab" aria-selected="${state.journey === key}" data-journey="${key}">${esc(journey.label)}</button>`
    )).join("");
    steps.innerHTML = active.steps.map((step, index) => (
      `<button class="journey-step${state.journeyStep === index ? " active" : ""}" type="button" data-journey-step="${index}"><b>${index + 1}</b><span><strong>${esc(step[0])}</strong><span>${esc(step[1])}</span></span></button>`
    )).join("");
    const selected = active.steps[state.journeyStep];
    preview.innerHTML = `
      <span class="journey-kicker">${esc(active.label)} · ${state.journeyStep + 1}/${active.steps.length}</span>
      <h3>${esc(selected[0])}</h3>
      <p>${esc(selected[1])}</p>
      <div class="journey-metric"><div><small>${esc(selected[2])}</small><strong>${esc(selected[3])}</strong></div><span>${esc(selected[4])}</span></div>`;
    tabs.querySelectorAll("[data-journey]").forEach((button) => button.addEventListener("click", () => {
      state.journey = button.dataset.journey;
      state.journeyStep = 0;
      renderJourneys();
    }));
    steps.querySelectorAll("[data-journey-step]").forEach((button) => button.addEventListener("click", () => {
      state.journeyStep = Number(button.dataset.journeyStep) || 0;
      renderJourneys();
    }));
  }

  const labCopy = {
    fr: {
      tabs: { transaction: "Transaction", trip: "Trip", sport: "Sport", nutrition: "Nutrition" },
      run: "Calculer",
      transaction: { fields: [["amount", "Montant", "number", "68"], ["direction", "Type", "select", "expense", [["expense", "Depense"], ["income", "Revenu"]]], ["category", "Categorie", "select", "food", [["food", "Alimentation"], ["transport", "Transport"], ["income", "Salaire"]]]], label: "Cash apres mouvement", description: "Le budget et la projection sont recalcules sans enregistrer la transaction." },
      trip: { fields: [["total", "Depense totale", "number", "112"], ["participants", "Participants", "number", "2"], ["paid", "Paye par moi", "number", "112"]], label: "Ma part", description: "La difference indique le montant a recevoir ou a rembourser." },
      sport: { fields: [["sets", "Series", "number", "4"], ["reps", "Repetitions", "number", "10"], ["load", "Charge kg", "number", "50"]], label: "Volume de travail", description: "Une lecture simple de la charge totale de la seance." },
      nutrition: { fields: [["kcal", "Kcal consommees", "number", "1850"], ["protein", "Proteines g", "number", "98"], ["water", "Eau ml", "number", "1600"]], label: "Equilibre du jour", description: "Comparaison avec des cibles fictives de 2 200 kcal, 120 g et 2 L." },
    },
    en: {
      tabs: { transaction: "Transaction", trip: "Trip", sport: "Sport", nutrition: "Nutrition" },
      run: "Calculate",
      transaction: { fields: [["amount", "Amount", "number", "68"], ["direction", "Type", "select", "expense", [["expense", "Expense"], ["income", "Income"]]], ["category", "Category", "select", "food", [["food", "Food"], ["transport", "Transport"], ["income", "Salary"]]]], label: "Cash after movement", description: "Budget and forecast are recalculated without saving the transaction." },
      trip: { fields: [["total", "Total expense", "number", "112"], ["participants", "Participants", "number", "2"], ["paid", "Paid by me", "number", "112"]], label: "My share", description: "The difference shows the amount to receive or reimburse." },
      sport: { fields: [["sets", "Sets", "number", "4"], ["reps", "Repetitions", "number", "10"], ["load", "Load kg", "number", "50"]], label: "Training volume", description: "A simple reading of the workout's total load." },
      nutrition: { fields: [["kcal", "Consumed kcal", "number", "1850"], ["protein", "Protein g", "number", "98"], ["water", "Water ml", "number", "1600"]], label: "Daily balance", description: "Compared with fictional goals of 2,200 kcal, 120 g and 2 L." },
    },
  };

  function fieldHtml(field) {
    const [id, label, type, value, options] = field;
    if (type === "select") {
      return `<div class="lab-field"><label for="lab-${id}">${esc(label)}</label><select id="lab-${id}">${options.map(([optionValue, optionLabel]) => `<option value="${esc(optionValue)}"${optionValue === value ? " selected" : ""}>${esc(optionLabel)}</option>`).join("")}</select></div>`;
    }
    return `<div class="lab-field"><label for="lab-${id}">${esc(label)}</label><input id="lab-${id}" type="number" min="0" step="1" value="${esc(value)}" /></div>`;
  }

  function labResult() {
    const locale = lang();
    if (state.lab === "trip") {
      const total = number(document.getElementById("lab-total")?.value, 112);
      const participants = Math.max(1, Math.round(number(document.getElementById("lab-participants")?.value, 2)));
      const paid = number(document.getElementById("lab-paid")?.value, 112);
      const share = total / participants;
      const balance = paid - share;
      return { main: money(share), stats: [[locale === "fr" ? "Solde" : "Balance", money(Math.abs(balance))], [locale === "fr" ? "Decision" : "Decision", balance >= 0 ? (locale === "fr" ? "A recevoir" : "To receive") : (locale === "fr" ? "A rembourser" : "To reimburse")], [locale === "fr" ? "Participants" : "Participants", participants]] };
    }
    if (state.lab === "sport") {
      const sets = Math.max(0, number(document.getElementById("lab-sets")?.value, 4));
      const reps = Math.max(0, number(document.getElementById("lab-reps")?.value, 10));
      const load = Math.max(0, number(document.getElementById("lab-load")?.value, 50));
      const volume = sets * reps * load;
      return { main: `${Math.round(volume).toLocaleString()} kg`, stats: [[locale === "fr" ? "Series" : "Sets", sets], [locale === "fr" ? "Reps totales" : "Total reps", sets * reps], ["Kcal est.", Math.round(90 + Math.min(240, volume * .025))]] };
    }
    if (state.lab === "nutrition") {
      const kcal = number(document.getElementById("lab-kcal")?.value, 1850);
      const protein = number(document.getElementById("lab-protein")?.value, 98);
      const water = number(document.getElementById("lab-water")?.value, 1600);
      const score = Math.round(((Math.min(1, kcal / 2200) + Math.min(1, protein / 120) + Math.min(1, water / 2000)) / 3) * 100);
      return { main: `${score} / 100`, stats: [["Kcal", `${Math.round(kcal / 22)}%`], [locale === "fr" ? "Proteines" : "Protein", `${Math.round(protein / 1.2)}%`], [locale === "fr" ? "Hydratation" : "Hydration", `${Math.round(water / 20)}%`]] };
    }
    const amount = number(document.getElementById("lab-amount")?.value, 68);
    const direction = document.getElementById("lab-direction")?.value || "expense";
    const available = 3470 + (direction === "income" ? amount : -amount);
    return { main: money(available), stats: [[locale === "fr" ? "Mouvement" : "Movement", `${direction === "income" ? "+" : "-"}${money(amount)}`], [locale === "fr" ? "Budget/jour" : "Daily budget", money(Math.max(0, (available - 280) / 30))], [locale === "fr" ? "Projection" : "Forecast", money(available + 920)]] };
  }

  function updateLabResult() {
    const result = labResult();
    const main = document.getElementById("labResultMain");
    const stats = document.getElementById("labResultStats");
    if (main) main.textContent = result.main;
    if (stats) stats.innerHTML = result.stats.map(([label, value]) => `<div class="lab-result-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("");
  }

  function renderProductLab() {
    const tabs = document.getElementById("productLabTabs");
    const stage = document.getElementById("productLabStage");
    if (!tabs || !stage) return;
    const copy = labCopy[lang()];
    const active = copy[state.lab];
    tabs.innerHTML = Object.entries(copy.tabs).map(([key, label]) => `<button class="lab-tab${state.lab === key ? " active" : ""}" type="button" role="tab" aria-selected="${state.lab === key}" data-lab="${key}">${esc(label)}</button>`).join("");
    stage.innerHTML = `<div class="lab-controls">${active.fields.map(fieldHtml).join("")}<button class="lab-run" id="labRun" type="button">${esc(copy.run)}</button></div><article class="lab-result"><div><small>${esc(active.label)}</small><h4 id="labResultMain"></h4><p>${esc(active.description)}</p></div><div class="lab-result-grid" id="labResultStats"></div></article>`;
    tabs.querySelectorAll("[data-lab]").forEach((button) => button.addEventListener("click", () => { state.lab = button.dataset.lab; renderProductLab(); }));
    stage.querySelectorAll("input,select").forEach((input) => input.addEventListener("input", updateLabResult));
    document.getElementById("labRun")?.addEventListener("click", updateLabResult);
    updateLabResult();
  }

  function releaseFamily(text) {
    const value = text.toLowerCase();
    if (/(sport|timer|workout|seance|séance)/.test(value)) return lang() === "fr" ? "Sport" : "Sport";
    if (/(nutrition|meal|repas|alimentation)/.test(value)) return lang() === "fr" ? "Nutrition" : "Nutrition";
    if (/(trip|split|participant)/.test(value)) return "Trip";
    if (/(performance|chunk|bundle|boot|legacy)/.test(value)) return "Performance";
    if (/(settings|reglages|réglages)/.test(value)) return "Settings";
    return lang() === "fr" ? "Produit" : "Product";
  }

  function renderReleasePulse() {
    const host = document.getElementById("releasePulseGrid");
    if (!host) return;
    const rows = [...document.querySelectorAll("#releaseSource .release-row")].slice(0, 5);
    const locale = lang();
    host.innerHTML = rows.map((row) => {
      const version = row.querySelector("strong")?.textContent?.trim() || "";
      const text = row.querySelector("span")?.textContent?.trim() || "";
      const family = releaseFamily(text);
      const title = text.includes(":") ? text.split(":")[0] : family;
      const summary = text.length > 155 ? `${text.slice(0, 152).trim()}…` : text;
      const proof = /test/i.test(text) ? (locale === "fr" ? "Tests couverts" : "Tests covered") : /kib|bundle|chunk/i.test(text) ? (locale === "fr" ? "Poids mesure" : "Size measured") : (locale === "fr" ? "Version tracee" : "Version traced");
      return `<article class="release-pulse-card"><small>${esc(version)} · ${esc(family)}</small><h4>${esc(title)}</h4><p>${esc(summary)}</p><span class="release-pulse-proof">${esc(proof)}</span></article>`;
    }).join("");
  }

  const checklistItems = {
    fr: [
      ["cash", "product", true, "Cash Pulse et Atlas interactifs", "Les deux visualisations sont integrees et responsives."],
      ["journeys", "product", true, "Parcours narratifs", "Mois, voyage et sante sont explorables etape par etape."],
      ["labs", "product", true, "Mini-demos produit", "Transaction, Trip, Sport et Nutrition sont manipulables."],
      ["user-review", "product", false, "Relecture par deux utilisateurs", "Faire noter comprehension, confiance et points de friction."],
      ["privacy", "privacy", true, "Politique FR/EN", "La page couvre donnees, prestataires, conservation et droits."],
      ["deletion-link", "privacy", true, "Suppression accessible", "Le parcours externe est lie depuis les reglages et le projet."],
      ["deletion-test", "privacy", false, "Test de suppression complet", "Executer la demande sur un compte de demonstration."],
      ["data-safety", "privacy", false, "Formulaire Data safety", "Reporter les traitements exactement dans Google Play Console."],
      ["legal-review", "privacy", false, "Relecture juridique", "Faire valider la politique avant publication publique."],
      ["apk", "android", true, "APK de test versionnee", "Le telechargement direct reste disponible sur la page."],
      ["permissions", "android", true, "Permissions minimales", "Internet et notifications uniquement."],
      ["aab", "android", false, "AAB de production signe", "Generer la version destinee au Play Store."],
      ["store-assets", "android", false, "Assets Play Store", "Finaliser icone, banniere et captures d'ecran."],
      ["closed-test", "android", false, "Test ferme termine", "Centraliser les retours et traiter les blocages."],
      ["build", "quality", true, "Build et syntaxe valides", "Vite, lint et tests cibles passent."],
      ["atlas-docs", "quality", true, "Inventaire Atlas regenerable", "La source publique suit docs/generated/project-inventory.json."],
      ["devices", "quality", false, "Validation appareils reels", "Verifier telephone, tablette et desktop."],
      ["links", "quality", false, "Liens publics controles", "Verifier Privacy, APK et futurs liens Store."],
    ],
    en: [
      ["cash", "product", true, "Interactive Cash Pulse and Atlas", "Both visualizations are integrated and responsive."],
      ["journeys", "product", true, "Narrative journeys", "Month, trip and health can be explored step by step."],
      ["labs", "product", true, "Product mini-demos", "Transaction, Trip, Sport and Nutrition can be manipulated."],
      ["user-review", "product", false, "Review by two users", "Collect notes on clarity, trust and friction."],
      ["privacy", "privacy", true, "FR/EN privacy policy", "The page covers data, providers, retention and rights."],
      ["deletion-link", "privacy", true, "Accessible deletion path", "The external path is linked from Settings and the project page."],
      ["deletion-test", "privacy", false, "End-to-end deletion test", "Run the request on a demonstration account."],
      ["data-safety", "privacy", false, "Data safety form", "Declare processing exactly in Google Play Console."],
      ["legal-review", "privacy", false, "Legal review", "Have the policy reviewed before public release."],
      ["apk", "android", true, "Versioned test APK", "Direct download remains available on the page."],
      ["permissions", "android", true, "Minimal permissions", "Internet and notifications only."],
      ["aab", "android", false, "Signed production AAB", "Generate the version intended for Play Store."],
      ["store-assets", "android", false, "Play Store assets", "Finalize icon, feature graphic and screenshots."],
      ["closed-test", "android", false, "Closed test completed", "Centralize feedback and resolve blockers."],
      ["build", "quality", true, "Build and syntax validated", "Vite, lint and targeted tests pass."],
      ["atlas-docs", "quality", true, "Regenerable Atlas inventory", "The public source follows docs/generated/project-inventory.json."],
      ["devices", "quality", false, "Real-device validation", "Check phone, tablet and desktop."],
      ["links", "quality", false, "Public links checked", "Verify Privacy, APK and future Store links."],
    ],
  };
  const checklistStorageKey = "budgetpacker_project_checklist_v1";

  function savedChecklist() {
    try { return JSON.parse(localStorage.getItem(checklistStorageKey) || "{}"); } catch (_) { return {}; }
  }
  function saveChecklist(value) {
    try { localStorage.setItem(checklistStorageKey, JSON.stringify(value)); } catch (_) {}
  }

  function renderChecklist() {
    const filters = document.getElementById("checklistFilters");
    const grid = document.getElementById("checklistGrid");
    if (!filters || !grid) return;
    const locale = lang();
    const labels = locale === "fr" ? { all: "Tout", product: "Produit", privacy: "Confidentialite", android: "Android", quality: "Qualite" } : { all: "All", product: "Product", privacy: "Privacy", android: "Android", quality: "Quality" };
    const saved = savedChecklist();
    const items = checklistItems[locale];
    const completed = items.filter(([id,, defaultDone]) => Object.prototype.hasOwnProperty.call(saved, id) ? !!saved[id] : defaultDone).length;
    const percent = Math.round(completed / items.length * 100);
    const label = document.getElementById("checklistProgressLabel");
    const bar = document.getElementById("checklistProgressBar");
    if (label) label.textContent = `${percent}% · ${completed}/${items.length}`;
    if (bar) bar.style.width = `${percent}%`;
    filters.innerHTML = Object.entries(labels).map(([key, text]) => `<button class="checklist-filter${state.checklistFilter === key ? " active" : ""}" type="button" data-checklist-filter="${key}">${esc(text)}</button>`).join("");
    grid.innerHTML = items.filter(([, category]) => state.checklistFilter === "all" || category === state.checklistFilter).map(([id, category, defaultDone, title, description]) => {
      const done = Object.prototype.hasOwnProperty.call(saved, id) ? !!saved[id] : defaultDone;
      return `<label class="checklist-item${done ? " done" : ""}"><input type="checkbox" data-checklist-id="${esc(id)}" ${done ? "checked" : ""}/><span><strong>${esc(title)}</strong><span>${esc(description)}</span></span><em>${esc(labels[category])}</em></label>`;
    }).join("");
    filters.querySelectorAll("[data-checklist-filter]").forEach((button) => button.addEventListener("click", () => { state.checklistFilter = button.dataset.checklistFilter; renderChecklist(); }));
    grid.querySelectorAll("[data-checklist-id]").forEach((checkbox) => checkbox.addEventListener("change", () => {
      const next = savedChecklist();
      next[checkbox.dataset.checklistId] = checkbox.checked;
      saveChecklist(next);
      renderChecklist();
    }));
  }

  function connectTrustLinks() {
    const source = document.querySelector('a[href*="app-downloads/apk"]');
    const target = document.getElementById("trustApkLink");
    if (source && target) target.href = source.href;
    const deleteLink = document.querySelector('[data-i18n="trusthub.deleteaction"]');
    if (deleteLink) deleteLink.href = `/privacy.html#${lang() === "fr" ? "fr-suppression" : "en-deletion"}`;
  }

  function renderAll() {
    renderJourneys();
    renderProductLab();
    renderReleasePulse();
    renderChecklist();
    connectTrustLinks();
  }

  document.getElementById("checklistReset")?.addEventListener("click", () => {
    try { localStorage.removeItem(checklistStorageKey); } catch (_) {}
    renderChecklist();
  });

  let previousLanguage = lang();
  new MutationObserver(() => {
    const nextLanguage = lang();
    if (nextLanguage !== previousLanguage) {
      previousLanguage = nextLanguage;
      renderAll();
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  renderAll();
})();
