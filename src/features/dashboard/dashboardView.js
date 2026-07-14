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

function renderWalletTypeOptions({
  selected = '',
  labels = {},
  esc = defaultEsc,
} = {}) {
  const value = String(selected || '').toLowerCase();
  const opts = [
    ['cash', labels.cash || 'Espèces (cash)'],
    ['bank', labels.bank || 'Banque (bank)'],
    ['card', labels.card || 'Carte (card)'],
    ['savings', labels.savings || 'Épargne (savings)'],
    ['other', labels.other || 'Autre (other)'],
  ];
  return opts.map(([key, label]) => `<option value="${esc(key)}"${value === key ? ' selected' : ''}>${esc(label)}</option>`).join('');
}

export function renderDashboardOnboardingPanel({
  rows = [],
  done = 0,
  total = 0,
  t = fallbackT,
  esc = defaultEsc,
} = {}) {
  const tr = typeof t === 'function' ? t : fallbackT;
  const list = Array.isArray(rows) ? rows : [];
  const rowTotal = Number(total) || list.length;
  const rowDone = Number(done) || list.filter((row) => row?.ok).length;

  return `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;">
      <div>
        <div class="muted" style="margin-bottom:6px;">${esc(tr('onboarding.subtitle'))}</div>
        <div class="pill" style="display:inline-flex;font-weight:900;">${esc(tr('onboarding.progress', { done: rowDone, total: rowTotal }))}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn primary" type="button" onclick="if(typeof tbStartGuidedTour==='function')tbStartGuidedTour({mode:'dashboard'});">${esc(tr('onboarding.action.guide'))}</button>
        <button class="btn" type="button" onclick="hideOnboardingPanel()">${esc(tr('onboarding.hide'))}</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:12px;">
      ${list.map((row) => {
        const isOk = !!row?.ok;
        return `
        <div style="border:1px solid ${isOk ? 'rgba(16,185,129,.28)' : 'rgba(148,163,184,.25)'};background:${isOk ? 'rgba(16,185,129,.08)' : 'rgba(255,255,255,.62)'};border-radius:16px;padding:12px;">
          <div style="display:flex;gap:8px;align-items:flex-start;">
            <span style="width:24px;height:24px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-weight:950;background:${isOk ? 'rgba(16,185,129,.18)' : 'rgba(37,99,235,.12)'};color:${isOk ? '#047857' : '#1d4ed8'};">${isOk ? '&#10003;' : '&bull;'}</span>
            <div style="min-width:0;flex:1;">
              <div style="font-weight:800;line-height:1.3;">${esc(row?.text || '')}</div>
              ${isOk ? '' : `<button class="btn" type="button" style="margin-top:10px;padding:7px 10px;font-size:12px;" onclick="${esc(row?.action || '')}">${esc(row?.label || '')}</button>`}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div style="margin-top:10px; opacity:.82;" class="muted">${esc(tr('onboarding.tip'))}</div>
  `;
}

export function renderDashboardContextHelp({
  t = fallbackT,
  esc = defaultEsc,
} = {}) {
  const tr = typeof t === 'function' ? t : fallbackT;
  return `
    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
      <div style="min-width:260px; flex:1;">
        <div style="font-weight:700; margin-bottom:6px;">${esc(tr('dashboard.help.title'))}</div>
        <div class="muted">
          <div>&bull; ${esc(tr('dashboard.help.wallets'))}</div>
          <div>&bull; ${esc(tr('dashboard.help.daily'))}</div>
          <div>&bull; ${esc(tr('dashboard.help.trip'))}</div>
        </div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn" type="button" onclick="showView('help')">${esc(tr('nav.help'))}</button>
        <button class="btn" type="button" onclick="showView('trip')">${esc(tr('nav.trip'))}</button>
        <button class="btn" type="button" data-tb-help-close="dashboard_overview">${esc(tr('common.hide'))}</button>
      </div>
    </div>`;
}

export function renderWalletEmptyState({
  t = fallbackT,
  esc = defaultEsc,
} = {}) {
  const tr = typeof t === 'function' ? t : fallbackT;
  return `
    <b>${esc(tr('wallet.empty.title'))}</b><br/>
    ${esc(tr('wallet.empty.body'))}
  `;
}

export function renderWalletQuickOnboarding({
  t = fallbackT,
  esc = defaultEsc,
} = {}) {
  const tr = typeof t === 'function' ? t : fallbackT;
  return `
    <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap;">
      <div style="font-weight:600;">${esc(tr('onboarding.title'))}</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn" type="button" onclick="showView('settings')">${esc(tr('nav.settings'))}</button>
        <button class="btn" type="button" onclick="showView('help')">${esc(tr('nav.help'))}</button>
      </div>
    </div>
    <div style="margin-top:8px;" class="muted">
      <div>${esc(tr('onboarding.step.wallet'))}</div>
      <div>${esc(tr('onboarding.step.period'))}</div>
      <div>${esc(tr('onboarding.step.tx'))}</div>
      <div style="margin-top:6px;">${esc(tr('onboarding.tip'))}</div>
    </div>
  `;
}

export function renderWalletCard({
  wallet = {},
  isBase = false,
  today = '',
  budgetToday = 0,
  daily = 1,
  baseCurrency = 'EUR',
  balance = '',
  recentHtml = '',
  archived = false,
  barPct = 0,
  t = fallbackT,
  esc = defaultEsc,
} = {}) {
  const tr = typeof t === 'function' ? t : fallbackT;
  const id = String(wallet?.id || '');
  const name = String(wallet?.name || '');
  const currency = String(wallet?.currency || baseCurrency || '');
  const base = String(baseCurrency || currency || 'EUR').toUpperCase();
  const pct = Math.max(0, Math.min(100, Number(barPct) || 0));
  const actionButtons = archived
    ? `
      <button class="btn" onclick="editWallet('${esc(id)}')">&#9998; ${esc(tr('wallet.action.edit'))}</button>
      <button class="btn" style="border:1px solid rgba(239,68,68,0.6); color: rgba(239,68,68,0.95);" onclick="deleteWallet('${esc(id)}')">&#128465; ${esc(tr('wallet.action.delete'))}</button>
      <button class="btn" type="button" data-wallet-archive-action="unarchive">${esc(tr('wallet.action.unarchive'))}</button>
    `
    : `
      <button class="btn primary" onclick="openTxModal('expense','${esc(id)}')">${esc(tr('wallet.action.add_expense'))}</button>
      <button class="btn" onclick="openTxModal('income','${esc(id)}')">${esc(tr('wallet.action.add_income'))}</button>
      <button class="btn" onclick="editWallet('${esc(id)}')">&#9998; ${esc(tr('wallet.action.edit'))}</button>
      <button class="btn" onclick="adjustWalletBalance('${esc(id)}')">&#9881; ${esc(tr('wallet.action.adjust'))}</button>
      <button class="btn" style="border:1px solid rgba(239,68,68,0.6); color: rgba(239,68,68,0.95);" onclick="deleteWallet('${esc(id)}')">&#128465; ${esc(tr('wallet.action.delete'))}</button>
      <button class="btn" type="button" data-wallet-archive-action="archive">${esc(tr('wallet.action.archive'))}</button>
    `;

  return `
    <div style="display:flex; justify-content:space-between; gap:18px; align-items:flex-start; flex-wrap:wrap;">
      <div style="min-width:280px; flex:1 1 520px;">
        <h3>${esc(name)} (${esc(currency)}) ${archived ? `<span class="pill">${esc(tr('wallet.archived'))}</span>` : ''}</h3>
        <p>${esc(tr('wallet.balance'))} : <strong style="color:var(--text);">${esc(balance)}</strong></p>
        ${isBase
          ? `<p class="muted">${esc(tr('wallet.today_budget', { date: today }))} <strong>${esc((Number(budgetToday) || 0).toFixed(2))} ${esc(base)}</strong></p>`
          : `<p class="muted">${esc(tr('wallet.daily_budget_base', { currency: base }))}</p>`}
        <div style="margin-top:12px;max-width:620px;">
          <div class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;font-weight:800;">${esc(tr('wallet.recent.title'))}</div>
          ${recentHtml || `<div class="muted" style="font-size:12px;">${esc(tr('wallet.recent.empty'))}</div>`}
        </div>
        ${isBase ? `
          <div class="bar" style="margin-top:12px;"><div style="width:${pct.toFixed(0)}%;"></div></div>
          <div class="muted" style="margin-top:6px;">${esc(tr('wallet.budget_level'))}</div>
        ` : ''}
      </div>
      <div class="tb-wallet-action-col" style="display:flex; flex-direction:column; gap:8px; flex:0 0 200px;">
        ${actionButtons}
      </div>
    </div>
  `;
}

export function renderWalletRecentTransactions({
  rows = [],
  t = fallbackT,
  lang = 'fr',
  fmtMoney = (amount, currency) => `${amount} ${currency || ''}`.trim(),
  esc = defaultEsc,
} = {}) {
  const tr = typeof t === 'function' ? t : fallbackT;
  const format = typeof fmtMoney === 'function' ? fmtMoney : ((amount, currency) => `${amount} ${currency || ''}`.trim());
  const list = Array.isArray(rows) ? rows : [];
  const isEn = String(lang || '').toLowerCase().startsWith('en');
  if (!list.length) {
    return `<div class="muted" style="font-size:12px;">${esc(tr('wallet.recent.empty'))}</div>`;
  }

  return list.map((row) => {
    const tx = row?.tx || {};
    const type = String(tx?.type || '').toLowerCase();
    const sign = type === 'expense' ? '-' : '+';
    const statusColor = row?.isFutureSoon
      ? 'rgba(59,130,246,.12)'
      : (row?.isPaid ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.14)');
    const statusBorder = row?.isFutureSoon
      ? 'rgba(59,130,246,.35)'
      : (row?.isPaid ? 'rgba(16,185,129,.35)' : 'rgba(245,158,11,.38)');
    const statusText = row?.isFutureSoon
      ? (isEn ? 'Upcoming' : 'A venir')
      : (row?.isPaid ? tr('wallet.recent.paid') : tr('wallet.recent.unpaid'));
    const warningText = isEn ? '! Overdraft risk' : '! Risque de decouvert';
    const warningTitle = isEn ? 'Overdraft risk' : 'Risque de decouvert';
    const warningChip = row?.isFutureSoon && row?.projectedNegative
      ? `<span title="${esc(warningTitle)}" style="display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(244,63,94,.38);background:rgba(244,63,94,.10);border-radius:999px;padding:2px 7px;color:#be123c;font-size:11px;font-weight:850;">${esc(warningText)}</span>`
      : '';
    const label = String(tx?.label || tx?.category || 'Transaction');
    const date = String(row?.date || '');
    const amount = `${sign}${format(Math.abs(Number(tx?.amount) || 0), tx?.currency || '')}`;
    const amountColor = type === 'expense' ? '#b42335' : '#047857';
    return `
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 0;border-top:1px solid rgba(15,23,42,.07);">
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(label)}</div>
          <div class="muted" style="font-size:12px;">${esc(date)} - <span style="display:inline-flex;align-items:center;border:1px solid ${statusBorder};background:${statusColor};border-radius:999px;padding:1px 7px;color:var(--text);font-weight:700;">${esc(statusText)}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-weight:800;white-space:nowrap;color:${amountColor};">${esc(amount)}${warningChip}</div>
      </div>
    `;
  }).join('');
}

export function renderDailyBudgetControls({
  viewStartISO = '',
  viewEndISO = '',
  t = fallbackT,
  esc = defaultEsc,
} = {}) {
  const tr = typeof t === 'function' ? t : fallbackT;
  return `
    <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between;">
      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
        <button class="btn" id="db-prev">${esc(tr('common.previous'))}</button>
        <button class="btn" id="db-today">${esc(tr('kpi.today'))}</button>
        <button class="btn" id="db-next">${esc(tr('common.next'))}</button>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
        <span class="muted" style="font-size:12px;">${esc(tr('dashboard.daily.display'))} :</span>
        <select class="input" id="db-mode" style="min-width:170px;">
          <option value="segment">${esc(tr('dashboard.daily.current_period'))}</option>
          <option value="voyage">${esc(tr('analysis.period.all_trip'))}</option>
        </select>
        <span class="muted" style="font-size:12px;">${esc(viewStartISO)} &rarr; ${esc(viewEndISO)}</span>
      </div>
    </div>
  `;
}

export function renderDailyBudgetDay({
  date = '',
  budget = 0,
  budgetClassName = '',
  used = 0,
  daily = 0,
  baseCurrency = 'EUR',
  details = [],
  t = fallbackT,
  esc = defaultEsc,
} = {}) {
  const tr = typeof t === 'function' ? t : fallbackT;
  const base = String(baseCurrency || 'EUR').toUpperCase();
  const detailRows = Array.isArray(details) ? details : [];
  return `
    <div class="top">
      <div><strong>${esc(date)}</strong></div>
      <div class="pill ${esc(budgetClassName)}"><span class="dot"></span>${esc((Number(budget) || 0).toFixed(0))} ${esc(base)}</div>
    </div>
    <div style="margin-top:6px; color:#6b7280; font-size:12px; display:flex; justify-content:space-between; gap:10px;">
      <div>${esc(tr('dashboard.daily.used'))} : <b style="color:#111827;">${esc((Number(used) || 0).toFixed(0))} ${esc(base)}</b></div>
      <div>${esc(tr('dashboard.daily.target'))} : <b style="color:#111827;">${esc((Number(daily) || 0).toFixed(0))} ${esc(base)}</b></div>
    </div>
    ${detailRows.length
      ? `<div class="details">${detailRows.map((item) => `&bull; ${esc(item?.label || '')} : ${esc((Number(item?.amountBase) || 0).toFixed(0))} ${esc(item?.baseCurrency || base)}`).join('<br>')}</div>`
      : `<div class="details">${esc(tr('dashboard.daily.no_allocation'))}</div>`}
  `;
}

export function renderWalletCreateDialog({
  labels = {},
  esc = defaultEsc,
} = {}) {
  return `
      <div class="tb-dlg" role="dialog" aria-modal="true" aria-label="${esc(labels.title || 'Créer un wallet')}">
        <div class="tb-dlg-h">${esc(labels.title || 'Créer un wallet')}</div>
        <div class="tb-dlg-b">
          <div class="tb-dlg-row">
            <label>${esc(labels.name || 'Nom')}</label>
            <input id="tbWName" type="text" placeholder="${esc(labels.namePlaceholder || 'ex: Cash (THB), Banque EUR')}" />
          </div>
          <div class="tb-dlg-row">
            <label>${esc(labels.currency || 'Devise')}</label>
            <input id="tbWCur" type="text" placeholder="${esc(labels.currencyPlaceholder || 'ex: EUR, THB, VND')}" maxlength="6" />
            <div class="hint">${esc(labels.currencyHint || 'Code devise (ISO) - ex: EUR, THB.')}</div>
          </div>
          <div class="tb-dlg-row">
            <label>${esc(labels.type || 'Type')}</label>
            <select id="tbWType">
              ${renderWalletTypeOptions({ labels: labels.typeOptions, esc })}
            </select>
            <div class="hint">${esc(labels.typeHint || 'Le type sert au calcul du KPI Cash et du runway.')}</div>
          </div>
          <div class="tb-dlg-row">
            <label>${esc(labels.balance || 'Solde initial')}</label>
            <input id="tbWBal" type="text" inputmode="decimal" placeholder="0" value="0" />
          </div>
          <div id="tbWErr" class="tb-dlg-err"></div>
        </div>
        <div class="tb-dlg-f">
          <button class="tb-dlg-btn" id="tbWCancel" type="button">${esc(labels.cancel || 'Annuler')}</button>
          <button class="tb-dlg-btn primary" id="tbWCreate" type="button">${esc(labels.create || 'Créer')}</button>
        </div>
      </div>
    `;
}

export function renderWalletEditDialog({
  wallet = {},
  labels = {},
  esc = defaultEsc,
} = {}) {
  const type = String(wallet?.type || 'other').toLowerCase();
  return `
      <div class="tb-dlg-h">${esc(labels.title || 'Modifier wallet')}</div>
      <div class="tb-dlg-b">
        <div class="tb-dlg-row">
          <label>${esc(labels.name || 'Nom')}</label>
          <input id="tbWEditName" type="text" value="${esc(wallet?.name || '')}" />
        </div>

        <div class="tb-dlg-row">
          <label>${esc(labels.currency || 'Devise')}</label>
          <input type="text" value="${esc(wallet?.currency || '')}" disabled />
          <div class="hint">${esc(labels.currencyLocked || "La devise n'est pas modifiable ici.")}</div>
        </div>

        <div class="tb-dlg-row">
          <label>${esc(labels.type || 'Type')}</label>
          <select id="tbWEditType">
            ${renderWalletTypeOptions({ selected: type, labels: labels.typeOptions, esc })}
          </select>
        </div>
      </div>
      <div class="tb-dlg-f">
        <button class="tb-dlg-btn" id="tbWEditCancel">${esc(labels.cancel || 'Annuler')}</button>
        <button class="tb-dlg-btn primary" id="tbWEditOk">${esc(labels.save || 'Enregistrer')}</button>
      </div>
    `;
}

export function renderWalletTypesFixDialog({
  wallets = [],
  labels = {},
  inferType = () => 'other',
  typeLabel = (value) => value,
  esc = defaultEsc,
} = {}) {
  const list = Array.isArray(wallets) ? wallets : [];
  const rowsHtml = list.map((wallet) => {
    const suggested = String(inferType(wallet?.name) || 'other').toLowerCase();
    return `
      <div class="tb-dlg-row" style="display:grid; grid-template-columns: 1fr 170px; gap:10px; align-items:center;">
        <div>
          <div style="font-weight:700;">${esc(wallet?.name || '')}</div>
          <div class="hint">${esc(wallet?.currency || '')} &bull; ${esc(labels.suggestion || 'suggestion')} : <b>${esc(typeLabel(suggested))}</b></div>
        </div>
        <select data-wid="${esc(wallet?.id || '')}">
          ${renderWalletTypeOptions({ selected: suggested, labels: labels.typeOptions, esc })}
        </select>
      </div>
    `;
  }).join('');

  return `
    <div class="tb-dlg-h">${esc(labels.title || 'Corriger les types de wallets')}</div>
    <div class="tb-dlg-b">
      <div class="hint" style="margin-bottom:12px;">
        ${esc(labels.intro || 'On a détecté des wallets sans type. Sélectionne le bon type puis applique.')}
      </div>
      ${rowsHtml}
    </div>
    <div class="tb-dlg-f">
      <button class="tb-dlg-btn" id="tbWFixCancel">${esc(labels.cancel || 'Annuler')}</button>
      <button class="tb-dlg-btn primary" id="tbWFixApply">${esc(labels.apply || 'Appliquer')}</button>
    </div>
  `;
}

export default {
  renderDashboardOnboardingPanel,
  renderDashboardContextHelp,
  renderWalletEmptyState,
  renderWalletQuickOnboarding,
  renderWalletCard,
  renderDailyBudgetControls,
  renderDailyBudgetDay,
  renderWalletCreateDialog,
  renderWalletEditDialog,
  renderWalletTypesFixDialog,
};
