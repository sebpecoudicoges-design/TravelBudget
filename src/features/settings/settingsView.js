const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function defaultEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESC[char]);
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

export function renderCreateVoyageModalBody({
  start = '',
  end = '',
  esc = defaultEsc,
} = {}) {
  return `<div class="row"><div class="field"><label for="tb-vstart">Début</label><input id="tb-vstart" type="date" value="${esc(start)}" /></div><div class="field"><label for="tb-vend">Fin</label><input id="tb-vend" type="date" value="${esc(end)}" /></div></div><div class="muted" style="margin-top:8px;">Le voyage doit être non chevauchant.</div>`;
}

export function renderCreatePeriodModalBody({
  start = '',
  end = '',
  currency = 'EUR',
  dailyBudget = 0,
  esc = defaultEsc,
} = {}) {
  const cur = String(currency || 'EUR').toUpperCase();
  return `<div class="row"><div class="field"><label for="tb-pstart">Début</label><input id="tb-pstart" type="date" value="${esc(start)}" min="${esc(start)}" max="${esc(end)}" /></div><div class="field"><label for="tb-pend">Fin</label><input id="tb-pend" type="date" value="${esc(end)}" min="${esc(start)}" max="${esc(end)}" /></div></div><div class="row"><div class="field"><label for="tb-pcur">Devise</label><input id="tb-pcur" value="${esc(cur)}" /></div><div class="field"><label for="tb-pbud">Budget/jour</label><input id="tb-pbud" value="${esc(dailyBudget)}" /></div></div><div class="muted" style="margin-top:8px;">La nouvelle période doit être incluse dans une période existante (split automatique).</div>`;
}

export function getBudgetSegmentDeleteReadiness({
  segments = [],
  segmentId = '',
} = {}) {
  const list = Array.isArray(segments) ? segments : [];
  if (list.length <= 1) return { ok: false, reason: 'Impossible: au moins 1 période requise.' };
  const exists = list.some((segment) => String(segment?.id || '') === String(segmentId || ''));
  if (!exists) return { ok: false, reason: 'Période introuvable.' };
  return { ok: true, reason: '' };
}

export function normalizeManualFxRates({
  manualRates = {},
  manualFxMeta,
} = {}) {
  return Object.entries(manualRates || {})
    .map(([currency, value]) => {
      const c = String(currency || '').toUpperCase();
      let meta = {};
      try {
        meta = (typeof manualFxMeta === 'function') ? (manualFxMeta(c) || {}) : {};
      } catch (_) {
        meta = {};
      }
      return {
        c,
        rate: Number(value && value.rate),
        asOf: value && value.asOf ? String(value.asOf).slice(0, 10) : null,
        stale: !!meta.stale,
      };
    })
    .filter((item) => item.c && item.c !== 'EUR' && Number.isFinite(item.rate) && item.rate > 0)
    .sort((a, b) => a.c.localeCompare(b.c));
}

export function renderSettingsManualFxPanel({
  manualList = [],
  t = fallbackT,
  esc = defaultEsc,
} = {}) {
  const tr = typeof t === 'function' ? t : fallbackT;
  const list = Array.isArray(manualList) ? manualList : [];
  const hasStaleRate = list.some((item) => item.stale);
  const statusBadge = hasStaleRate
    ? `<span class="tb-fx-alert-badge">⚠ ${tr('settings.fx.update_needed')}</span>`
    : '<span class="tb-fx-ok-badge">OK</span>';

  return `
      <div data-act="mf-toggle" style="display:flex; align-items:center; justify-content:space-between; gap:8px; cursor:pointer;">
        <div>
          <b>${tr('settings.fx.title')}</b>
          <span class="muted">${tr('settings.fx.subtitle')}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${statusBadge}
          <button class="btn" data-act="mf-add" title="${tr('settings.fx.add_title')}">${tr('settings.fx.add')}</button><span class="tb-recurring-arrow" data-manual-fx-arrow>›</span>
        </div>
      </div>
      <div data-manual-fx-list style="margin-top:8px; overflow:auto; display:none;">
        ${list.length ? `
          <table class="table" style="width:100%; min-width:520px;">
            <thead><tr>
              <th>${tr('settings.fx.currency')}</th><th>${tr('settings.fx.rate')}</th><th>${tr('settings.fx.date')}</th><th>${tr('settings.fx.status')}</th><th style="text-align:right;">${tr('settings.fx.actions')}</th>
            </tr></thead>
            <tbody>
              ${list.map((item) => `
                <tr>
                  <td><b>${esc(item.c)}</b></td>
                  <td>${esc(String(Number(item.rate).toFixed(6)).replace(/\.0+$/, ''))}</td>
                  <td>${esc(item.asOf || "—")}</td>
                  <td>${item.stale ? `<span class="tb-fx-alert-badge">⚠ ${tr('settings.fx.update_needed')}</span>` : '<span class="tb-fx-ok-badge">OK</span>'}</td>
                  <td style="text-align:right; white-space:nowrap;">
                    <button class="btn" data-act="mf-edit" data-cur="${esc(item.c)}">${tr('settings.fx.edit')}</button>
                    <button class="btn danger" data-act="mf-del" data-cur="${esc(item.c)}">${tr('settings.fx.delete')}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `<div class="muted">${tr('settings.fx.empty')}</div>`}
      </div>
    `;
}

export function renderSettingsPeriodCard({
  segment = {},
  currency = '',
  durationDays = '',
  countryLabel = '',
  localAmountMain = '',
  rateDisplay = '',
  nightTransportBudget = '',
  fxNeedsUpdate = false,
  override = null,
  resolvedCountry = {},
  countryOptionsHtml = '',
  helpHtml = '',
  lang = 'fr',
  t = fallbackT,
  esc = defaultEsc,
} = {}) {
  const tr = typeof t === 'function' ? t : fallbackT;
  const isEn = String(lang || '').toLowerCase() === 'en';
  const pt = (fr, en) => (isEn ? en : fr);
  const cur = String(currency || segment?.baseCurrency || '').toUpperCase();
  const start = String(segment?.start || segment?.start_date || '');
  const end = String(segment?.end || segment?.end_date || '');
  const dailyBudget = segment?.dailyBudgetBase ?? segment?.daily_budget_base ?? '';
  const activeOverride = !!override;
  const resolved = resolvedCountry || {};
  const profile = override?.travel_profile || resolved?.travel_profile || 'solo';
  const style = override?.travel_style || resolved?.travel_style || 'standard';

  return `
          <button type="button" class="tb-period-head" data-act="toggle-period">
            <span class="tb-period-head-main">
              <span class="tb-period-title">${esc(pt('Période', 'Period'))} ${esc(start || "—")} → ${esc(end || "—")}</span>
              <span class="tb-period-subtitle">${esc(String(durationDays || ""))} ${esc(pt('jours', 'days'))} · ${esc(pt('Pays', 'Country'))} ${esc(countryLabel || "—")} · ${esc(cur)} · ${esc(localAmountMain || "—")}</span>
            </span>
            <span class="tb-period-head-side">
              ${fxNeedsUpdate ? `<span class="tb-fx-alert-badge">⚠ ${esc(pt('Taux à mettre à jour', 'Rate needs update'))}</span>` : ''}
              <span class="tb-period-status">${esc(String(dailyBudget || 0))} ${esc(cur)}/${esc(pt('jour', 'day'))}</span>
              <span class="tb-period-arrow">⌄</span>
            </span>
          </button>
          <div class="tb-period-quick-actions">
            <button class="btn primary" type="button" data-act="edit-seg">${esc(pt('Modifier la période', 'Edit period'))}</button>
            <span>${esc(pt('Dates, devise, budget par jour, nuit transport et référence.', 'Dates, currency, daily budget, night transport and reference.'))}</span>
          </div>
          <div class="tb-period-body">
            <div class="tb-period-shell">
              <div class="tb-settings-inline-strip tb-settings-inline-strip--period tb-settings-inline-strip--period-2col">
                <div class="tb-settings-chipstat tb-settings-chipstat--blue"><span>${esc(pt('Devise locale', 'Local currency'))}</span><strong>${esc(cur)}</strong><small>${esc(pt('Nuit transport', 'Night transport'))} · ${esc(nightTransportBudget || "—")}</small></div>
                <div class="tb-settings-chipstat tb-settings-chipstat--blue"><span>${esc(pt('Change', 'Exchange rate'))}</span><strong>${esc((rateDisplay || "—"))}</strong><small>${fxNeedsUpdate ? `⚠ ${esc(pt('Taux à mettre à jour', 'Rate needs update'))}` : esc(pt('Bloc séparé', 'Separate block'))}</small></div>
              </div>
              <div data-br-inline-seg-id="${esc(String(segment?.id || ''))}"></div>
              <div class="tb-period-editor"><div class="tb-edit-kicker">${esc(pt('Réglages modifiables', 'Editable settings'))}</div>
                <div class="tb-settings-subgrid tb-settings-subgrid--period-edit">
                  <div class="field field--span-2"><label>${esc(pt('Début', 'Start'))}</label><input type="date" data-k="start_date" value="${esc(start)}" /></div>
                  <div class="field field--span-2"><label>${esc(pt('Fin', 'End'))}</label><input type="date" data-k="end_date" value="${esc(end)}" /></div>
                  <div class="field field--span-2"><label>${esc(pt('Devise', 'Currency'))}</label><input data-k="base_currency" value="${esc(cur)}" /></div>
                  <div class="field field--span-2"><label>${esc(pt('Budget / jour', 'Budget / day'))}</label><input data-k="daily_budget_base" value="${esc(dailyBudget ?? "")}" /></div>
                  <div class="field field--span-2"><label>${esc(pt('Nuit transport', 'Night transport'))} ${helpHtml || ''}</label><input data-k="night_transport_budget" value="${esc(nightTransportBudget)}" /></div>
                  <div class="field field--span-2"><label>${esc(pt('Mode', 'Mode'))}</label><select data-br="seg-mode"><option value="inherit" ${activeOverride ? '' : 'selected'}>${esc(pt('Hériter du voyage', 'Inherit from trip'))}</option><option value="custom" ${activeOverride ? 'selected' : ''}>${esc(pt('Personnaliser', 'Customize'))}</option></select></div>
                  <div class="field field--span-2" data-br="seg-custom" style="display:${activeOverride ? '' : 'none'};"><label>${esc(pt('Pays', 'Country'))}</label><select data-br="seg-country" data-selected-country="${esc(String(resolved.country_code || ""))}" data-selected-region="${esc(String(resolved.region_code || ""))}">${countryOptionsHtml || ''}</select></div>
                  <div class="field field--span-2" data-br="seg-custom" style="display:${activeOverride ? '' : 'none'};"><label>${esc(pt('Profil', 'Profile'))}</label><select data-br="seg-profile"><option value="solo" ${profile === "solo" ? "selected" : ""}>Solo</option><option value="couple" ${profile === "couple" ? "selected" : ""}>Couple</option><option value="family" ${profile === "family" ? "selected" : ""}>${esc(pt('Famille', 'Family'))}</option></select></div>
                  <div class="field field--span-2" data-br="seg-custom" style="display:${activeOverride ? '' : 'none'};"><label>Style</label><select data-br="seg-style"><option value="budget" ${style === "budget" ? "selected" : ""}>Budget</option><option value="standard" ${(!style || style === "standard") ? "selected" : ""}>Standard</option><option value="comfort" ${style === "comfort" ? "selected" : ""}>Comfort</option></select></div>
                  <div class="field field--span-2" data-br="seg-custom" style="display:${activeOverride ? '' : 'none'};"><label>${esc(pt('Adultes', 'Adults'))}</label><input data-br="seg-adults" type="number" min="1" step="1" value="${esc(String(override?.adult_count ?? resolved.adult_count ?? 1))}" /></div>
                  <div class="field field--span-2" data-br="seg-custom" style="display:${activeOverride ? '' : 'none'};"><label>${esc(pt('Enfants', 'Children'))}</label><input data-br="seg-children" type="number" min="0" step="1" value="${esc(String(override?.child_count ?? resolved.child_count ?? 0))}" /></div>
                </div>
                <div class="tb-period-inline-actions">
                  <button class="btn" data-act="edit-cancel">${esc(pt('Annuler', 'Cancel'))}</button>
                  <button class="btn primary" data-act="save">${esc(pt('Enregistrer', 'Save'))}</button>
                  <button class="btn danger" data-act="del">${esc(pt('Supprimer', 'Delete'))}</button>
                </div>
              </div>
            </div>
          </div>
        `;
}

export function renderSettingsPeriodReference({
  sourceLabel = '',
  inherited = false,
  countryName = '',
  countryCode = '',
  profile = 'solo',
  style = 'standard',
  recommendedMain = '—',
  recommendedSecondary = '',
  plannedMain = '—',
  plannedSecondary = '',
  modeText = '',
  plannedDiff = '—',
  posts = [],
  lang = 'fr',
  esc = defaultEsc,
} = {}) {
  const isEn = String(lang || '').toLowerCase() === 'en';
  const rt = (fr, en) => (isEn ? en : fr);
  const postRows = Array.isArray(posts) ? posts.filter((post) => post && post.label && post.amount) : [];
  const pillClass = inherited ? 'tb-settings-pill--positive' : '';

  return `
        <div class="tb-period-compare tb-period-compare--minimal tb-period-compare--tight">
          <div class="tb-period-ref-head">
            <div>
              <h4 class="tb-period-ref-title">${esc(rt('Référence de la période', 'Period reference'))}</h4>
              <div class="tb-period-ref-copy">${esc(rt('Lecture de la référence sur cette période.', 'Reference readout for this period.'))}</div>
            </div>
            <span class="tb-settings-pill ${pillClass}">${esc(sourceLabel || '—')}</span>
          </div>
          <div class="tb-period-ref-grid tb-period-ref-grid--tight">
            <div class="tb-settings-chipstat tb-settings-chipstat--violet"><span>${esc(rt('Pays', 'Country'))}</span><strong>${esc(countryName || countryCode || '—')}</strong><small>${esc(String(profile || 'solo'))} · ${esc(String(style || 'standard'))}</small></div>
            <div class="tb-settings-chipstat tb-settings-chipstat--violet"><span>${esc(rt('Reco / jour', 'Reco / day'))}</span><strong>${esc(recommendedMain || '—')}</strong>${recommendedSecondary ? `<small>${esc(recommendedSecondary)} · base</small>` : ''}</div>
            <div class="tb-settings-chipstat tb-settings-chipstat--violet"><span>${esc(rt('Prévu / jour', 'Planned / day'))}</span><strong>${esc(plannedMain || '—')}</strong>${plannedSecondary ? `<small>${esc(plannedSecondary)} · base</small>` : ''}</div>
            <div class="tb-settings-chipstat tb-settings-chipstat--violet"><span>${esc(rt('Mode', 'Mode'))}</span><strong>${esc(modeText || '—')}</strong><small>${esc(plannedDiff || '—')}</small></div>
          </div>
          ${postRows.length ? `<div class="tb-mini-post-grid tb-mini-post-grid--tight">${postRows.map((post) => `<div class="tb-mini-post"><span>${esc(post.label)}</span><strong>${esc(post.amount)}</strong></div>`).join('')}</div>` : ''}
          <div class="tb-period-inline-actions">
            <button class="btn" data-act="edit-seg">${esc(rt('Modifier', 'Edit'))}</button>
            <button class="btn" data-br-act="seg-reset" style="display:${inherited ? 'none' : ''};">${esc(rt('Hériter', 'Inherit'))}</button>
          </div>
        </div>
      `;
}

export function renderSettingsTravelOverview({
  travelName = '',
  segmentCount = 0,
  totalDays = 0,
  baseCurrency = 'EUR',
  budgetMain = '—',
  budgetSecondary = '',
  referenceMain = '—',
  referenceSub = '',
  recommendationMain = '—',
  recommendationSecondary = '',
  cadenceMain = '—',
  cadenceSub = '',
  startISO = '',
  endISO = '',
  countryOptionsHtml = '',
  profile = 'solo',
  style = 'standard',
  adults = 1,
  children = 0,
  posts = [],
  lang = 'fr',
  esc = defaultEsc,
} = {}) {
  const isEn = String(lang || '').toLowerCase() === 'en';
  const st = (fr, en) => (isEn ? en : fr);
  const count = Number(segmentCount) || 0;
  const days = Number(totalDays) || 0;
  const postRows = Array.isArray(posts) ? posts.filter((post) => post && post.label && post.amount) : [];

  return `
        <div class="tb-settings-summary tb-settings-summary--minimal tb-travel-unified tb-travel-unified-card">
          <div class="tb-v11-travel-hero tb-v11-travel-hero--minimal">
            <div class="tb-v11-travel-main tb-v11-travel-main--compact">
              <div class="tb-v11-travel-row tb-v11-travel-row--lot-a">
                <div class="tb-v11-travel-row-title">
                  <div class="tb-v11-travel-title">${esc(String(travelName || st('Voyage actif', 'Active trip')))}</div>
                  <div class="tb-v11-travel-sub">${esc(st('Voyage, référence et budget dans un seul espace.', 'Trip, reference and budget in one place.'))}</div>
                </div>
                <div class="tb-v11-travel-meta">
                  <span class="tb-settings-pill">${esc(String(count))} ${esc(st(count > 1 ? 'périodes' : 'période', count > 1 ? 'periods' : 'period'))}</span>
                  <span class="tb-settings-pill">${esc(String(days))} ${esc(st('jours', 'days'))}</span>
                  <span class="tb-settings-pill">Base · ${esc(String(baseCurrency || 'EUR').toUpperCase())}</span>
                </div>
              </div>
              <div class="tb-settings-inline-strip tb-settings-inline-strip--travel tb-settings-inline-strip--travel-lot-a">
                <div class="tb-settings-chipstat tb-settings-chipstat--violet"><span>${esc(st('Budget / jour', 'Budget / day'))}</span><strong id="tb-travel-budget-main">${esc(budgetMain || '—')}</strong>${budgetSecondary ? `<small id="tb-travel-budget-secondary">${esc(budgetSecondary)} · base</small>` : '<small id="tb-travel-budget-secondary" style="display:none"></small>'}</div>
                <div class="tb-settings-chipstat tb-settings-chipstat--violet"><span>${esc(st('Référence', 'Reference'))}</span><strong id="tb-travel-ref-main">${esc(referenceMain || '—')}</strong><small id="tb-travel-ref-sub">${esc(referenceSub || st('À définir', 'To define'))}</small></div>
                <div class="tb-settings-chipstat tb-settings-chipstat--violet"><span>${esc(st('Reco / jour', 'Reco / day'))}</span><strong id="tb-travel-reco-main">${esc(recommendationMain || '—')}</strong>${recommendationSecondary ? `<small id="tb-travel-reco-secondary">${esc(recommendationSecondary)} · base</small>` : '<small id="tb-travel-reco-secondary" style="display:none"></small>'}</div>
                <div class="tb-settings-chipstat tb-settings-chipstat--violet"><span>${esc(st('Cadence', 'Pace'))}</span><strong id="tb-travel-cadence-main">${esc(cadenceMain || '—')}</strong><small id="tb-travel-cadence-sub">${esc(cadenceSub || '—')}</small></div>
              </div>
              <div class="tb-edit-kicker">${esc(st('Réglages modifiables', 'Editable settings'))}</div>
              <div class="tb-settings-inline-grid tb-settings-inline-grid--travel tb-travel-edit-grid tb-travel-edit-grid--equal" style="margin-top:10px; align-items:end;">
                <div class="field field--span-2"><label>${esc(st('Voyage', 'Trip'))}</label><select id="tb-inline-travel-select"></select></div>
                <div class="field field--span-2"><label>${esc(st('Nom', 'Name'))}</label><input id="tb-inline-travel-name" type="text" value="${esc(String(travelName || ''))}" /></div>
                <div class="field field--span-2"><label>${esc(st('Début', 'Start'))}</label><input id="tb-inline-travel-start" type="date" value="${esc(startISO || '')}" /></div>
                <div class="field field--span-2"><label>${esc(st('Fin', 'End'))}</label><input id="tb-inline-travel-end" type="date" value="${esc(endISO || '')}" /></div>
                <div class="field field--span-2"><label>${esc(st('Pays', 'Country'))}</label><select data-br="travel-country">${countryOptionsHtml || ''}</select></div>
                <div class="field field--span-2"><label>${esc(st('Profil', 'Profile'))}</label><select data-br="travel-profile"><option value="solo" ${profile === 'solo' ? 'selected' : ''}>Solo</option><option value="couple" ${profile === 'couple' ? 'selected' : ''}>Couple</option><option value="family" ${profile === 'family' ? 'selected' : ''}>${esc(st('Famille', 'Family'))}</option></select></div>
                <div class="field field--span-2"><label>Style</label><select data-br="travel-style"><option value="budget" ${style === 'budget' ? 'selected' : ''}>Budget</option><option value="standard" ${(!style || style === 'standard') ? 'selected' : ''}>Standard</option><option value="comfort" ${style === 'comfort' ? 'selected' : ''}>Comfort</option></select></div>
                <div class="field field--span-2"><label>${esc(st('Adultes', 'Adults'))}</label><input data-br="travel-adults" type="number" min="1" step="1" value="${esc(String(adults ?? 1))}" /></div>
                <div class="field field--span-2"><label>${esc(st('Enfants', 'Children'))}</label><input data-br="travel-children" type="number" min="0" step="1" value="${esc(String(children ?? 0))}" /></div>
              </div>
              ${postRows.length ? `<div class="tb-mini-post-grid tb-mini-post-grid--travel">${postRows.map((post) => `<div class="tb-mini-post"><span>${esc(post.label)}</span><strong>${esc(post.amount)}</strong></div>`).join('')}</div>` : ''}
              <div class="row" style="justify-content:flex-end; margin-top:14px; gap:10px;">
                <button class="btn" onclick="createVoyagePrompt()">+ ${esc(st('Nouveau voyage', 'New trip'))}</button>
                <button class="btn danger" onclick="deleteActiveVoyage()">${esc(st('Supprimer voyage', 'Delete trip'))}</button>
                <button class="btn" onclick="createPeriodPrompt()">+ ${esc(st('Ajouter période', 'Add period'))}</button>
                <button class="btn primary" id="tb-inline-save-travel">${esc(st('Enregistrer le voyage', 'Save trip'))}</button>
              </div>
            </div>
          </div>
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
