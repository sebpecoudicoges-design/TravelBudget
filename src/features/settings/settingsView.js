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

export function renderSettingsAccountPanel({
  baseCurrency = 'EUR',
  currencies = ['EUR', 'USD', 'THB'],
  savedBirthDate = '',
  savedBodyWeight = '',
  savedBodyHeight = '',
  thresholdDisplay = '',
  thresholdEur = 500,
  notificationPrefs = {},
  simpleMode = false,
  t = fallbackT,
  esc = defaultEsc,
} = {}) {
  const tr = typeof t === 'function' ? t : fallbackT;
  const cur = String(baseCurrency || 'EUR').toUpperCase();
  const opts = Array.isArray(currencies) && currencies.length ? currencies : ['EUR', 'USD', 'THB'];
  const prefs = notificationPrefs || {};
  const simpleSelected = !!simpleMode;
  const thresholdRef = Math.round(Number(thresholdEur) || 500);

  return `
        <div class="muted" style="margin-bottom:10px;">${tr('settings.account.summary')}</div>

        <div class="row" style="gap:12px; align-items:end; flex-wrap:wrap;">
          <div class="field" style="min-width:260px;">
            <label>${tr('settings.account.email')}</label>
            <input id="tb-account-email" type="text" value="—" disabled />
          </div>

          <div class="field" style="min-width:260px;max-width:320px;">
            <label>WhatsApp</label>
            <input
              id="tb-account-whatsapp"
              type="tel"
              placeholder="+33612345678"
              value=""
              autocomplete="tel"
              style="color:var(--text);font-weight:750;background:var(--panel);opacity:1;"
            />
            <small class="muted" style="display:block;margin-top:6px;line-height:1.3;">Format international, ex. +33612345678.</small>
          </div>

          <div class="field" style="min-width:180px;">
            <label>Date de naissance</label>
            <input id="tb-account-birthdate" type="date" value="${esc(savedBirthDate)}" />
            <small class="muted" style="display:block;margin-top:6px;line-height:1.3;">Utilisee pour le BMR et le suivi sante.</small>
          </div>

          <div class="field" style="min-width:120px;">
            <label>Poids kg</label>
            <input id="tb-account-body-weight" type="number" min="1" step="0.1" value="${esc(savedBodyWeight)}" />
          </div>

          <div class="field" style="min-width:120px;">
            <label>Taille cm</label>
            <input id="tb-account-body-height" type="number" min="60" step="1" value="${esc(savedBodyHeight)}" />
          </div>

          <div class="field" style="min-width:160px;">
            <label>${tr('settings.account.base_currency')}</label>
            <select id="tb-user-basecur">
              ${opts.map((c) => `<option value="${esc(c)}" ${String(c).toUpperCase() === cur ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>

          <div class="field" style="min-width:190px;">
            <label>${tr('settings.account.ui_mode')}</label>
            <select id="tb-user-uimode">
              <option value="simple" ${simpleSelected ? 'selected' : ''}>${tr('settings.account.mode.simple')}</option>
              <option value="advanced" ${!simpleSelected ? 'selected' : ''}>${tr('settings.account.mode.advanced')}</option>
            </select>
          </div>

          <button class="btn" id="tb-user-basecur-save" type="button">${tr('settings.account.save')}</button>
          <button class="btn" id="tb-user-whatsapp-save" type="button">Enregistrer WhatsApp</button>
          <button class="btn" id="tb-user-birthdate-save" type="button">Enregistrer santé</button>
          <button class="btn" id="tb-user-uimode-save" type="button">${tr('settings.account.save_mode')}</button>
          <button class="btn" id="tb-user-resetpwd" type="button">${tr('settings.account.reset_password')}</button>
        </div>

        <div class="row tb-advanced-only" style="gap:12px; align-items:end; flex-wrap:wrap; margin-top:10px;">
          <div class="field" style="min-width:220px;">
            <label>${tr('settings.account.cashflow_threshold')}</label>
            <input id="tb-user-cfthr" type="number" min="1" step="1" value="${esc(thresholdDisplay || '')}" />
          </div>
          <div class="muted" style="padding-bottom:6px;">${tr('settings.account.cashflow_reference', { amount: esc(String(thresholdRef)) })}</div>
          <button class="btn" id="tb-user-cfthr-save" type="button">${tr('settings.account.save_threshold')}</button>
        </div>

        <div class="tb-settings-notif-box" style="margin-top:14px;padding:12px;border:1px solid var(--border);border-radius:14px;background:rgba(37,99,235,.05);">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
            <div>
              <strong>Notifications mobile</strong>
              <div class="muted" style="margin-top:4px;line-height:1.35;">Test rapide mobile. Les messages sont courts pour rester lisibles sur l'écran verrouillé.</div>
            </div>
            <div class="row" style="gap:8px;">
              <button class="btn" id="tb-notif-open-manager" type="button">Gerer</button>
              <button class="btn primary" id="tb-notif-test" type="button">Envoyer un test</button>
            </div>
          </div>
          <div style="margin-top:12px;display:grid;gap:8px;">
            <label class="pill" style="display:flex;align-items:center;gap:8px;width:max-content;max-width:100%;">
              <input id="tb-notif-health" type="checkbox" ${prefs.healthMealReminders ? 'checked' : ''} />
              Rappels alimentation / sante
            </label>
            <div class="muted" style="font-size:12px;line-height:1.35;">5 nudges simples : petit dej, 10h, dejeuner, gouter et diner. Ils ouvrent directement Alimentation.</div>
            <button class="btn" id="tb-notif-save" type="button" style="width:max-content;max-width:100%;">Activer les rappels</button>
          </div>
          <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px;">
            <span class="muted" style="font-size:12px;font-weight:800;">Notification reçue ?</span>
            <button class="btn" id="tb-notif-test-yes" type="button">Oui</button>
            <button class="btn" id="tb-notif-test-no" type="button">Non</button>
          </div>
          <div id="tb-notif-test-status" class="muted" style="font-size:12px;line-height:1.35;margin-top:8px;">Serveur actif : matin + soir selon le fuseau du téléphone. Le bouton ci-dessus force seulement un test immédiat.</div>
        </div>
      `;
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
  renderSettingsAccountPanel,
  renderSettingsHero,
  ensureSettingsHero,
  decorateSettingsPanels,
  getSettingsPanelState,
  setSettingsPanelState,
};
