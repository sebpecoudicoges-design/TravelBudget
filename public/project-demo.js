(() => {
  const root = document.querySelector('[data-trip-demo]');
  if (!root) return;
  const get = (id) => document.getElementById(id);
  const form = get('demo-expense');
  const amountField = get('demo-amount');
  const reset = get('demo-reset');
  const dailyBudgetCents = 15000;
  const openingBalanceCents = 30000;
  let paidCents = 0;
  let stage = 0;

  function render() {
    const lang = document.documentElement.lang === 'en' ? 'en-NZ' : 'fr-FR';
    const format = new Intl.NumberFormat(lang, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const money = (cents) => `${format.format(cents / 100)} NZD`;
    const share = paidCents / 2; // Only whole NZD can be entered; both shares are exact in cents.
    get('demo-balance').textContent = money(openingBalanceCents - (stage === 2 ? paidCents : 0));
    get('demo-paid').textContent = stage === 2 ? money(paidCents) : '—';
    get('demo-owed').textContent = stage === 2 ? money(share) : '—';
    get('demo-personal').textContent = stage === 2 ? money(share) : '—';
    get('demo-left').textContent = money(dailyBudgetCents - (stage === 2 ? share : 0));
    get('demo-preview-personal').textContent = money(share);
    get('demo-preview-alex').textContent = money(share);
    form.hidden = stage !== 0;
    get('demo-share').hidden = stage !== 1;
    get('demo-review').hidden = stage !== 2;
    reset.hidden = stage === 0;
    root.querySelectorAll('[data-demo-stage]').forEach((step) => {
      if (Number(step.dataset.demoStage) === stage) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const amount = amountField.valueAsNumber;
    if (stage !== 0 || !Number.isInteger(amount) || amount < 2 || amount > 300) return;
    paidCents = amount * 100;
    stage = 1;
    render();
    get('demo-share-title').focus();
  });
  get('demo-split').addEventListener('click', () => {
    if (stage !== 1) return;
    stage = 2;
    render();
    get('demo-review-title').focus();
  });
  get('demo-edit')?.addEventListener('click', () => {
    stage = 0;
    render();
    amountField.focus();
  });
  reset.addEventListener('click', () => {
    paidCents = 0;
    stage = 0;
    form.reset();
    render();
    amountField.focus();
  });
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  render();
})();
