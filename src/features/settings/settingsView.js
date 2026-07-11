function defaultEsc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fallbackT(key, vars) {
  let out = String(key || '');
  if (vars && typeof vars === 'object') {
    Object.keys(vars).forEach((name) => {
      out = out.replaceAll(`{${name}}`, String(vars[name]));
    });
  }
  return out;
}

function activeTravel(state = {}) {
  return (state.travels || []).find((travel) => String(travel?.id || '') === String(state.activeTravelId || '')) || null;
}

export function getSettingsPanelState(key, fallbackOpen, storage) {
  try {
    const raw = storage?.getItem?.(`tb_settings_open_${key}`);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch (_) {}
  return !!fallbackOpen;
}

export function setSettingsPanelState(key, isOpen, storage) {
  try { storage?.setItem?.(`tb_settings_open_${key}`, isOpen ? '1' : '0'); } catch (_) {}
}

export function getSettingsCardSummary({
  id = '',
  title = '',
  state = {},
  t = fallbackT,
} = {}) {
  const cardId = String(id || '');
  const tr = typeof t === 'function' ? t : fallbackT;

  if (cardId === 'tb-account-card') {
    const base = String(state?.user?.baseCurrency || 'EUR').toUpperCase();
    return { kicker: tr('settings.card.account'), summary: tr('settings.card.account_summary', { base }), pills: [base] };
  }
  if (cardId === 'tb-travel-card') {
    const travel = activeTravel(state);
    const name = String(travel?.name || state?.period?.name || tr('analysis.trip.active'));
    return { kicker: tr('settings.card.travel'), summary: tr('settings.card.travel_summary', { name }), pills: [name] };
  }
  if (cardId === 'tb-periods-card') {
    const count = Array.isArray(state?.budgetSegments) ? state.budgetSegments.length : 0;
    return { kicker: tr('settings.card.periods'), summary: tr('settings.card.periods_summary', { count }), pills: [tr('settings.card.periods_count', { count })] };
  }
  if (cardId === 'tb-recurring-card') {
    const count = Array.isArray(state?.recurringRules) ? state.recurringRules.length : 0;
    return { kicker: tr('settings.card.recurring'), summary: tr('settings.card.recurring_summary', { count }), pills: [tr('settings.card.recurring_count', { count })] };
  }
  if (cardId.includes('palette')) return { kicker: tr('settings.card.palette'), summary: tr('settings.card.palette_summary'), pills: [tr('settings.card.visual')] };
  if (cardId.includes('categories')) return { kicker: tr('settings.card.categories'), summary: tr('settings.card.categories_summary'), pills: [tr('settings.card.classification')] };

  return { kicker: tr('settings.hero.title'), summary: String(title || '').trim() || tr('settings.hero.title'), pills: [] };
}

export function renderSettingsHero({
  state = {},
  t = fallbackT,
  esc = defaultEsc,
} = {}) {
  const tr = typeof t === 'function' ? t : fallbackT;
  const travel = activeTravel(state);
  const segCount = Array.isArray(state?.budgetSegments) ? state.budgetSegments.length : 0;
  const rrCount = Array.isArray(state?.recurringRules) ? state.recurringRules.length : 0;

  return `
    <div>
      <div class="tb-settings-hero-title">${esc(tr('settings.hero.title'))}</div>
      <div class="tb-settings-hero-copy">${esc(tr('settings.hero.body'))}</div>
    </div>
    <div class="tb-settings-hero-chips">
      <span class="tb-settings-hero-chip">${esc(String(travel?.name || tr('analysis.trip.active')))}</span>
      <span class="tb-settings-hero-chip">${esc(tr('settings.card.periods_count', { count: segCount }))}</span>
      <span class="tb-settings-hero-chip">${esc(tr('settings.card.recurring_count', { count: rrCount }))}</span>
    </div>`;
}

export function ensureSettingsHero(view, {
  state = {},
  t = fallbackT,
  esc = defaultEsc,
  documentRef,
} = {}) {
  if (!view) return null;
  const doc = documentRef || view.ownerDocument || globalThis.document;
  let hero = view.querySelector('.tb-settings-hero');
  if (!hero) {
    hero = doc.createElement('div');
    hero.className = 'tb-settings-hero';
    view.insertBefore(hero, view.firstChild);
  }
  hero.innerHTML = renderSettingsHero({ state, t, esc });
  return hero;
}

export function decorateSettingsPanels(view, {
  state = {},
  t = fallbackT,
  storage,
  documentRef,
} = {}) {
  if (!view) return;
  const doc = documentRef || view.ownerDocument || globalThis.document;
  const cards = Array.from(view.querySelectorAll('#tb-account-card, #tb-travel-card, #tb-periods-card, #tb-recurring-card, .tb-settings-card--palette, .tb-settings-card--categories'));
  cards.forEach((card) => {
    card.classList.add('tb-settings-panel');
    const id = String(card.id || card.className || 'settings');
    let h2 = card.querySelector(':scope > h2');
    if (!h2) h2 = card.querySelector('h2');
    if (!h2) return;

    const meta = getSettingsCardSummary({
      id,
      title: String(h2.textContent || '').trim(),
      state,
      t,
    });

    let body = card.querySelector(':scope > .tb-settings-panel-body');
    if (!body) {
      body = doc.createElement('div');
      body.className = 'tb-settings-panel-body';
      const nodes = [];
      let n = h2.nextSibling;
      while (n) {
        const next = n.nextSibling;
        nodes.push(n);
        n = next;
      }
      nodes.forEach((node) => body.appendChild(node));
      const head = doc.createElement('button');
      head.type = 'button';
      head.className = 'tb-settings-panel-head';
      head.innerHTML = `
        <span class="tb-settings-panel-head-main">
          <span class="tb-settings-panel-kicker"></span>
          <span class="tb-settings-panel-title"></span>
          <span class="tb-settings-panel-summary"></span>
        </span>
        <span class="tb-settings-panel-side">
          <span class="tb-settings-pill tb-settings-panel-pill"></span>
          <span class="tb-settings-panel-arrow">⌄</span>
        </span>`;
      head.onclick = () => {
        const isCollapsed = card.classList.toggle('is-collapsed');
        setSettingsPanelState(id, !isCollapsed, storage);
      };
      card.insertBefore(head, h2);
      const divider = doc.createElement('div');
      divider.className = 'tb-settings-divider';
      card.insertBefore(divider, body);
      card.appendChild(body);
      h2.style.display = 'none';
    }

    const head = card.querySelector(':scope > .tb-settings-panel-head');
    if (head) {
      const titleEl = head.querySelector('.tb-settings-panel-title');
      const kickerEl = head.querySelector('.tb-settings-panel-kicker');
      const summaryEl = head.querySelector('.tb-settings-panel-summary');
      const pillEl = head.querySelector('.tb-settings-panel-pill');
      if (titleEl) titleEl.textContent = String(h2.textContent || '').trim();
      if (kickerEl) kickerEl.textContent = meta.kicker || 'Reglages';
      if (summaryEl) summaryEl.textContent = meta.summary || '';
      if (pillEl) {
        pillEl.textContent = meta.pills?.[0] || 'Ouvrir';
        pillEl.style.display = (meta.pills && meta.pills.length) ? '' : 'none';
      }
    }
    const shouldOpen = getSettingsPanelState(id, id === 'tb-travel-card' || id === 'tb-periods-card', storage);
    card.classList.toggle('is-collapsed', !shouldOpen);
  });
}

export default {
  getSettingsCardSummary,
  renderSettingsHero,
  ensureSettingsHero,
  decorateSettingsPanels,
  getSettingsPanelState,
  setSettingsPanelState,
};
