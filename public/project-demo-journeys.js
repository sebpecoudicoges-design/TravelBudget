(() => {
  const nav = document.querySelector('[data-demo-switch]');
  const host = document.getElementById('demo-journey');
  const trip = document.getElementById('demo-trip');
  if (!nav || !host || !trip) return;

  const lang = () => document.documentElement.lang === 'en' ? 'en' : 'fr';
  const t = (fr, en) => lang() === 'en' ? en : fr;
  const number = (value, precision = 2) => new Intl.NumberFormat(t('fr-FR', 'en-GB'), {
    maximumFractionDigits: precision,
  }).format(value);
  const amount = (value, unit) => number(value) + ' ' + unit;
  const fields = {
    fx: {
      title: ['Convertir sans toucher à la réserve', 'Convert without using the reserve'],
      lead: ['Compare le montant disponible et sa contre-valeur avec un taux fictif, sans frais.', 'Compare the available amount and its equivalent at a fictional rate, before fees.'],
      fields: [
        ['Solde source (EUR)', 'Source balance (EUR)', 1200, 0, 100000, 1],
        ['Réserve (EUR)', 'Reserve (EUR)', 500, 0, 100000, 1],
        ['USD pour 1 EUR', 'USD per EUR', 1.085, 0.01, 10, 0.001],
      ],
      result: ([balance, reserve, rate]) => {
        const convert = Math.max(0, balance - reserve);
        return [
          [t('Solde disponible à convertir', 'Available to convert'), amount(convert, 'EUR')],
          [t('Contre-valeur simulée', 'Simulated equivalent'), amount(convert * rate, 'USD')],
          [t('Réserve demandée', 'Requested reserve'), amount(reserve, 'EUR')],
        ];
      },
      feedback: ['La réserve n’est pas convertie ; si elle dépasse le solde, le montant disponible vaut zéro. Ce taux n’est pas une cotation.', 'The reserve is not converted. If it exceeds the balance, there is nothing to convert. This is not a live quote.'],
    },
    transaction: {
      title: ['Enregistrer une dépense payée', 'Record a paid expense'],
      lead: ['Observe la différence entre le solde du compte et le budget du jour après une dépense de transport.', 'See how a transport expense affects both your account balance and your daily budget.'],
      fields: [
        ['Solde initial (EUR)', 'Opening balance (EUR)', 300, 0, 100000, 0.01],
        ['Budget du jour (EUR)', 'Daily budget (EUR)', 80, 0, 100000, 0.01],
        ['Transport (EUR)', 'Transport (EUR)', 35, 0.01, 100000, 0.01],
      ],
      result: ([balance, budget, spend]) => [
        [t('Solde après paiement', 'Balance after payment'), amount(balance - spend, 'EUR')],
        [t('Analyse · Transport', 'Analysis · Transport'), amount(spend, 'EUR')],
        [t('Reste à dépenser', 'Left to spend'), amount(budget - spend, 'EUR')],
      ],
      feedback: ['Une dépense déjà payée réduit le solde du compte et consomme du budget. Un reste négatif signale un dépassement.', 'A paid expense reduces your account balance and uses your budget. A negative amount means you are over budget.'],
    },
    documents: {
      title: ['Relier un justificatif', 'Link a receipt'],
      lead: ['Choisis l’un des justificatifs fictifs, puis rattache-le à une transaction ou à une dépense Trip. Aucun fichier n’est envoyé.', 'Choose one fictional receipt and link it to a transaction or Trip expense. No files are uploaded.'],
      fields: [
        ['Justificatif', 'Receipt', 0, [['Facture d’auberge', 'Hostel invoice'], ['Reçu de transport', 'Transport receipt']]],
        ['Élément associé', 'Link to', 0, [['Transaction', 'Transaction'], ['Dépense Trip', 'Trip expense']]],
      ],
      result: ([document, target]) => [
        [t('Justificatif', 'Receipt'), document],
        [t('Retrouvable depuis', 'Available from'), target],
      ],
      feedback: ['Le lien permet de retrouver le justificatif depuis l’élément associé ; il ne modifie aucun montant.', 'Linking makes the receipt available from the selected item without changing any amounts.'],
    },
    sport: {
      title: ['Saisir une série de sport', 'Log a workout set'],
      lead: ['Renseigne une série fictive de développé couché pour l’ajouter au résumé de la séance.', 'Enter a fictional bench press set to add it to the workout summary.'],
      fields: [
        ['Répétitions', 'Repetitions', 8, 1, 100, 1],
        ['Charge (kg)', 'Load (kg)', 30, 0.5, 500, 0.5],
      ],
      result: ([reps, weight]) => [
        [t('Séries enregistrées', 'Sets logged'), '1'],
        [t('Répétitions', 'Repetitions'), number(reps)],
        [t('Volume de la série', 'Set volume'), amount(reps * weight, 'kg')],
      ],
      feedback: ['Le volume de cette série est la charge multipliée par les répétitions. Ce n’est pas une estimation des calories.', 'The load multiplied by repetitions gives the set volume. It does not estimate calories.'],
    },
    nutrition: {
      title: ['Ajouter un aliment au journal', 'Add food to the journal'],
      lead: ['Ajuste le nombre de grammes de flocons d’avoine pour voir leur contribution au repas. Valeurs nutritionnelles fictives.', 'Change the weight of oats to see their contribution to the meal. Nutrition values are fictional.'],
      fields: [['Portion (g)', 'Portion (g)', 50, 1, 1000, 1]],
      result: ([grams]) => [
        [t('Portion', 'Portion'), amount(grams, 'g')],
        [t('Énergie ajoutée', 'Added energy'), amount(grams * 3.8, 'kcal')],
        [t('Protéines ajoutées', 'Added protein'), amount(grams * 0.13, 'g')],
      ],
      feedback: ['Exemple simplifié : les valeurs pour 100 g sont ajustées au poids de ta portion.', 'The values per 100 g are scaled to the weight of your portion.'],
    },
  };
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  const tr = pair => t(...pair);
  const state = new Map();
  const pageFor = id => {
    if (!state.has(id)) state.set(id, { step: 0, values: fields[id].fields.map(([, , value]) => String(value)) });
    return state.get(id);
  };
  const localizedValues = (scenario, values) => values.map((value, index) => {
    const options = scenario.fields[index][3];
    return Array.isArray(options) ? tr(options[Number(value)]) : Number(value);
  });
  let current = 'trip';

  function render(focus = false) {
    nav.setAttribute('aria-label', t('Démonstrations', 'Demos'));
    nav.querySelectorAll('a').forEach(link => {
      if (link.dataset.scenario === current) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    trip.hidden = current !== 'trip';
    host.hidden = current === 'trip';
    if (current === 'trip') {
      if (focus) trip.querySelector('h3').focus({ preventScroll: true });
      return;
    }

    const id = current;
    const scenario = fields[id];
    const { step, values } = pageFor(id);
    const heading = element('h3', tr(scenario.title));
    heading.tabIndex = -1;
    const intro = element('div', '', 'section-head demo-scenario-head');
    intro.id = 'demo-' + id;
    intro.append(heading, element('p', tr(scenario.lead)));
    const panels = element('div', '', 'trip-demo');
    const play = element('div', '', 'trip-demo-play');
    const result = element('div', '', 'trip-demo-results');
    const steps = element('ol', '', 'demo-steps');
    steps.setAttribute('aria-label', t('Étapes', 'Steps'));
    [t('Saisir', 'Enter'), t('Vérifier', 'Review'), t('Résultat', 'Result')].forEach((label, i) => {
      const li = element('li', label);
      if (step === i) li.setAttribute('aria-current', 'step');
      steps.append(li);
    });
    const stepTitle = element('h4', [
      t('Saisir les valeurs', 'Enter values'),
      t('Vérifier les données', 'Review your inputs'),
      t('Voir le résultat', 'See the result'),
    ][step]);
    stepTitle.tabIndex = -1;
    play.append(steps, stepTitle);
    if (step === 0) {
      const form = element('form');
      form.className = 'demo-journey-fields';
      scenario.fields.forEach(([fr, en, , min, max, granularity], index) => {
        const label = element('label', t(fr, en), 'demo-journey-field');
        let input;
        if (Array.isArray(min)) {
          input = element('select');
          min.forEach((item, i) => {
            const option = element('option', tr(item));
            option.value = i;
            input.append(option);
          });
        } else {
          input = element('input');
          input.type = 'number';
          input.min = min;
          input.max = max;
          input.step = granularity;
          input.inputMode = granularity === 1 ? 'numeric' : 'decimal';
        }
        input.name = 'entry-' + index;
        input.required = true;
        input.value = values[index];
        input.addEventListener('input', () => { values[index] = input.value; });
        label.append(input);
        form.append(label);
      });
      const next = element('button', t('Vérifier la saisie', 'Review inputs'), 'btn primary');
      next.type = 'submit';
      form.append(next);
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (!form.checkValidity()) return;
        pageFor(id).step = 1;
        render('step');
      });
      play.append(form);
    } else {
      const next = element('button', step === 1 ? t('Valider la simulation', 'Confirm simulation') : t('Recommencer', 'Start over'), 'btn primary');
      next.type = 'button';
      next.addEventListener('click', () => {
        if (step === 1) pageFor(id).step = 2;
        else state.delete(id);
        render('step');
      });
      if (step === 1) {
        const inputs = localizedValues(scenario, values);
        const review = element('dl', '', 'demo-split-preview');
        scenario.fields.forEach(([fr, en, , options], index) => {
          const row = element('div');
          const value = Array.isArray(options) ? inputs[index] : number(inputs[index], 3);
          row.append(element('dt', t(fr, en)), element('dd', value));
          review.append(row);
        });
        play.append(review, next);
        const back = element('button', t('Modifier la saisie', 'Edit inputs'), 'btn');
        back.type = 'button';
        back.addEventListener('click', () => {
          pageFor(id).step = 0;
          render('step');
        });
        play.append(back);
      } else {
        play.append(element('p', tr(scenario.feedback)), next);
      }
    }
    const group = element('div', '', 'demo-result-group');
    group.append(element('h4', t('Résultat de la simulation', 'Simulation result')));
    const results = element('dl');
    if (step === 2) scenario.result(localizedValues(scenario, values)).forEach(([label, value]) => {
      const row = element('div');
      row.append(element('dt', label), element('dd', value));
      results.append(row);
    });
    else group.append(element('p', t('Valide la simulation pour afficher le résultat.', 'Confirm the simulation to see its result.')));
    group.append(results);
    result.append(group);
    panels.append(play, result);
    host.replaceChildren(intro, panels);
    if (focus === 'step') stepTitle.focus();
    if (focus === 'heading') heading.focus({ preventScroll: true });
  }

  function readHash(focus) {
    const id = window.location.hash.slice(6);
    if (id === 'trip' || Object.hasOwn(fields, id)) current = id;
    else if (['#demo', '#lab', '#video-demo'].includes(window.location.hash)) current = 'trip';
    else if (window.location.hash !== '#demo-selection') return;
    render(focus);
    const target = focus ? nav : document.getElementById(window.location.hash.slice(1));
    if (target) target.scrollIntoView({ block: 'start' });
  }

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const targetHash = link.getAttribute('href');
      if (window.location.hash !== targetHash) history.pushState(null, '', targetHash);
      readHash('heading');
    });
  });
  nav.hidden = false;
  const returnLink = document.querySelector('[data-demo-return]');
  if (returnLink) {
    returnLink.hidden = false;
    returnLink.addEventListener('click', () => {
      nav.querySelector('[aria-current]')?.focus({ preventScroll: true });
    });
  }
  render();
  readHash(false);
  window.addEventListener('hashchange', () => readHash(false));
  new MutationObserver(() => render()).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
