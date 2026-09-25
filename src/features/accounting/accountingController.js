import { buildAccountingReport, validDate } from './accountingRules.js';
import { loadAccountingData, readSettings, saveSettings } from './accountingData.js';
import { renderAccounting } from './accountingView.js';
import { loadAccountingFx } from './accountingFx.js';
import './accounting.css';

const localToday = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const priorYear = value => { const [y, m, d] = value.split('-').map(Number); const day = Math.min(d, new Date(Date.UTC(y - 1, m, 0)).getUTCDate()); return `${y - 1}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`; };

export function installAccountingRuntime(win = window) {
  if (win.renderAccounting) return;
  let generation = 0, scope = '', data = null, settings = {}, ui = null, status = '', pending = false;
  let fxRequest = null;
  const root = () => win.document.getElementById('accounting-root');
  const identity = () => `${win.sbUser?.id || ''}|${win.state?.activeTravelId || ''}`;
  function reset() { generation += 1; fxRequest?.abort(); scope = ''; data = null; settings = {}; ui = null; pending = false; status = ''; if (root()) root().replaceChildren(); }
  async function prepareFx() {
    fxRequest?.abort();
    const request = new AbortController(); fxRequest = request;
    const snapshot = data, currentScope = scope;
    const today = data.asOf || localToday();
    const inScope = r => !(r.travel_id || r.travelId) || String(r.travel_id || r.travelId) === String(win.state.activeTravelId);
    const assets = data.assets.filter(inScope);
    const rows = [...data.transactions, ...data.wallets, ...assets];
    const dates = [today, ...assets.map(a => a.purchase_date), ...data.transactions.map(t => t.date_start || t.dateStart).filter(d => (d >= ui.start && d <= ui.end) || (d >= priorYear(ui.start) && d <= priorYear(ui.end)))];
    root().innerHTML = '<p role="status">Consolidation avec les taux FX journaliers…</p>';
    const fx = await loadAccountingFx({ currencies: ui.mode === 'native' ? [] : [...rows.map(r => r.currency), ...Object.keys(settings.balances || {})], target: ui.currency, dates, today, offline: win.tbIsOfflineMode?.() === true, manualRates: snapshot.manualRates || {}, signal: request.signal });
    if (request.signal.aborted || identity() !== currentScope || data !== snapshot) return;
    data.fx = fx; draw();
  }
  function draw() {
    if (!root() || !data || !ui || identity() !== scope) return;
    const today = data.asOf || localToday();
    const currencies = [...new Set([ui.currency, ...(data.transactions || []), ...(data.wallets || []), ...(data.assets || [])].map(r => typeof r === 'string' ? r : r.currency).filter(Boolean).map(c => String(c).toUpperCase()))].sort();
    const options = { ...ui, settings, today, travelId: win.state.activeTravelId };
    const report = buildAccountingReport(data, options);
    const previous = buildAccountingReport(data, { ...options, start: priorYear(ui.start), end: priorYear(ui.end) });
    root().innerHTML = renderAccounting({ report, previous, data, settings, ui, currencies, status, scopeName: win.state.travels?.find(t => String(t.id) === String(win.state.activeTravelId))?.name || 'Voyage actif' });
  }
  async function refresh() {
    if (!root()) return;
    const nextScope = identity();
    if (scope !== nextScope) { reset(); scope = nextScope; }
    if (!win.sbUser?.id || !win.state?.activeTravelId) { root().innerHTML = '<p role="status">Connecte-toi et sélectionne un voyage pour ouvrir la comptabilité.</p>'; return; }
    if (pending) return;
    const token = ++generation;
    pending = true;
    root().innerHTML = '<p role="status">Chargement de la comptabilité…</p>';
    const current = () => generation === token && identity() === nextScope;
    try {
      const offline = win.tbIsOfflineMode?.() === true;
      if (offline) {
        if (!data) throw new Error('Actualisation en ligne nécessaire pour charger les données comptables.');
        data = { ...data, partial: true };
        status = 'Hors ligne : dernière lecture conservée dans cette session.';
      } else {
        const result = await loadAccountingData({ client: win.sb, userId: win.sbUser.id, travelId: win.state.activeTravelId });
        if (!current()) return;
        data = { ...result, manualRates: win.tbFxGetManualRates?.() || win.state.fx?.manualRates || {}, asOf: localToday() }; status = 'Données actualisées. Paramétrage enregistré sur cet appareil uniquement.';
      }
      if (!current()) return;
      settings = readSettings(win.localStorage, win.sbUser.id, win.state.activeTravelId);
      const today = localToday();
      ui ||= { tab: 'summary', source: null, start: `${today.slice(0, 4)}-01-01`, end: today, currency: String(win.state.user?.baseCurrency || 'EUR').toUpperCase(), mode: 'consolidated' };
      await prepareFx();
    } catch {
      if (!current()) return;
      if (data && ui) { data = { ...data, partial: true }; status = 'Actualisation indisponible : dernière lecture conservée, chiffres à vérifier.'; draw(); }
      else root().innerHTML = '<div class="tb-accounting-panel"><p role="alert">Lecture comptable indisponible. Vérifie la connexion et réessaie ; aucune donnée n’a été modifiée.</p><button class="btn" data-ac-refresh type="button">Réessayer</button></div>';
    } finally { if (current()) pending = false; }
  }
  function setStatus(message) { status = message; const el = root()?.querySelector('[role="status"]'); if (el) el.textContent = message; }
  win.document.addEventListener('click', event => {
    const button = event.target.closest?.('#accounting-root button');
    if (!button) return;
    if (button.hasAttribute('data-ac-refresh')) { refresh(); return; }
    if (!ui || scope !== identity()) { reset(); return; }
    if (button.dataset.acTab) { ui.tab = button.dataset.acTab; ui.source = null; draw(); root().querySelector(`.tb-accounting-tabs [data-ac-tab="${ui.tab}"]`)?.focus(); }
    else if (button.dataset.acSource) { ui.source = button.dataset.acSource; draw(); root().querySelector('#tb-accounting-detail')?.focus(); }
    else if (button.hasAttribute('data-ac-back')) { ui.source = null; draw(); root().querySelector(`.tb-accounting-tabs [data-ac-tab="${ui.tab}"]`)?.focus(); }
    else if (button.dataset.acOpen) win.showView?.(button.dataset.acOpen);
    else if (button.dataset.acTransaction) {
      const id = button.dataset.acTransaction;
      if (win.state.transactions?.some(t => String(t.id) === id) && typeof win.openTxEditModal === 'function') win.openTxEditModal(id);
      else setStatus('La fiche source est affichée ici. Actualise les transactions pour ouvrir leur éditeur.');
    }
  });
  win.document.addEventListener('submit', event => {
    if (!['tb-accounting-period', 'tb-accounting-settings'].includes(event.target.id)) return;
    event.preventDefault();
    if (!ui || scope !== identity()) { reset(); return; }
    const form = new FormData(event.target);
    if (event.target.id === 'tb-accounting-period') {
      const start = String(form.get('start')), end = String(form.get('end'));
      if (!validDate(start) || !validDate(end) || start > end) { setStatus('Choisis une date de début antérieure ou égale à la date de fin.'); return; }
      ui = { ...ui, start, end, currency: String(form.get('currency')), mode: String(form.get('mode') || 'consolidated'), source: null }; prepareFx();
    } else {
      const balances = { ...settings.balances };
      for (const fieldset of event.target.querySelectorAll('[data-ac-balance]')) {
        const cur = fieldset.dataset.acBalance;
        const debt = fieldset.querySelector('[data-ac-debt]').value, receivable = fieldset.querySelector('[data-ac-receivable]').value;
        if ([debt, receivable].some(v => v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0))) { setStatus('Les soldes doivent être des nombres positifs ou zéro.'); return; }
        balances[cur] = { debt, receivable, asOf: data.asOf || localToday() };
      }
      const mapping = { ...settings.mapping, ...Object.fromEntries([...event.target.querySelectorAll('[data-ac-mapping]')].map(el => [el.dataset.acMapping, el.value])) };
      const next = { ...settings, mapping, balances };
      try { saveSettings(win.localStorage, win.sbUser.id, win.state.activeTravelId, next); settings = next; status = 'Paramétrage enregistré sur cet appareil. Les états ont été recalculés.'; draw(); }
      catch { setStatus('Enregistrement local impossible. Les réglages précédents sont conservés.'); }
    }
  });
  win.addEventListener('tb:auth_scope_changed', reset);
  win.document.addEventListener('tb:state:reset', reset);
  win.document.addEventListener('data:updated', () => {
    if (scope && scope !== identity()) reset();
    if (win.activeView === 'accounting') refresh();
  });
  win.renderAccounting = refresh;
}
