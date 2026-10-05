import { debtLedger, repaymentEligible, debtOriginEligible, matchesOperationSearch } from './accountingDebts.js';
import { buildAccountingReport, validDate } from './accountingRules.js';
import { loadAccountingData, readSettings, saveSettings } from './accountingData.js';
import { renderAccounting } from './accountingView.js';
import { loadAccountingFx } from './accountingFx.js';
import { needsAccountingTransaction, accountingFxDate } from './accountingRecognition.js';
import { completeInitialMapping, assignWalletAccounts } from './accountingMapping.js';
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
    const transactions = data.transactions.filter(t => needsAccountingTransaction(t, ui.start, ui.end, today) || needsAccountingTransaction(t, priorYear(ui.start), priorYear(ui.end), today));
    const rows = [...transactions, ...data.wallets, ...assets, ...(data.tripBalances || [])];
    const dates = [today, ...assets.map(a => a.purchase_date), ...transactions.map(t => accountingFxDate(t, today))];
    root().innerHTML = '<p role="status">Consolidation avec les taux FX journaliers…</p>';
    const fx = await loadAccountingFx({ currencies: ui.mode === 'native' ? [] : [...rows.map(r => r.currency), ...Object.keys(settings.balances || {}), ...(settings.debts || []).map(d => d.currency)], target: ui.currency, dates, today, offline: win.tbIsOfflineMode?.() === true, manualRates: snapshot.manualRates || {}, signal: request.signal });
    if (request.signal.aborted || identity() !== currentScope || data !== snapshot) return;
    data.fx = fx; draw();
  }
  function draw() {
    if (!root() || !data || !ui || identity() !== scope) return;
    const today = data.asOf || localToday();
    const currencies = [...new Set([ui.currency, ...(settings.debts || []), ...(data.transactions || []), ...(data.wallets || []), ...(data.tripBalances || []), ...(data.assets || [])].map(r => typeof r === 'string' ? r : r.currency).filter(Boolean).map(c => String(c).toUpperCase()))].sort();
    const options = { ...ui, settings, today, travelId: win.state.activeTravelId };
    const report = buildAccountingReport(data, options);
    const previous = buildAccountingReport(data, { ...options, start: priorYear(ui.start), end: priorYear(ui.end) });
    root().innerHTML = renderAccounting({ report, previous, data, settings, ui, currencies, status, scopeName: win.state.travels?.find(t => String(t.id) === String(win.state.activeTravelId))?.name || 'Voyage actif' });
    if (ui.dialog) win.document.getElementById(ui.dialog)?.showModal();
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
      const mapped = !data.partial && data.transactions.length ? completeInitialMapping(data.transactions, settings) : settings;
      const completed = assignWalletAccounts(data.wallets, mapped);
      if (completed !== settings) {
        try { saveSettings(win.localStorage, win.sbUser.id, win.state.activeTravelId, completed); settings = completed; }
        catch { status = 'Classement initial non enregistré : stockage local indisponible.'; }
      }
      const today = localToday();
      ui ||= { tab: 'summary', source: null, start: `${today.slice(0, 4)}-01-01`, end: today, currency: String(win.state.user?.baseCurrency || 'EUR').toUpperCase(), mode: 'consolidated' };
      await prepareFx();
    } catch {
      if (!current()) return;
      if (data && ui) { data = { ...data, partial: true }; status = 'Actualisation indisponible : dernière lecture conservée, chiffres à vérifier.'; draw(); }
      else root().innerHTML = '<div class="tb-accounting-panel"><p role="alert">Lecture comptable indisponible. Vérifie la connexion et réessaie ; aucune donnée n’a été modifiée.</p><button class="btn" data-ac-refresh type="button">Réessayer</button></div>';
    } finally { if (current()) pending = false; }
  }
  function persistDebts(debts, archive = settings.archivedDebts || []) {
    const next = { ...settings, debts, archivedDebts: archive };
    try { saveSettings(win.localStorage, win.sbUser.id, win.state.activeTravelId, next); settings = next; ui.dialog = null; status = 'Dettes et remboursements enregistrés sur cet appareil.'; draw(); return true; }
    catch { setStatus('Enregistrement local impossible. Les données précédentes sont conservées.'); return false; }
  }
  function setStatus(message) { status = message; const el = root()?.querySelector('[role="status"]'); if (el) el.textContent = message; const alert = root()?.querySelector('dialog[open] [data-ac-dialog-status]'); if (alert) alert.textContent = message; }
  win.document.addEventListener('close', event => { if (!event.target.matches?.('#accounting-root dialog')) return; const id = event.target.id; if (ui) ui.dialog = null; [...(root()?.querySelectorAll('[data-ac-dialog]') || [])].find(b => b.dataset.acDialog === id)?.focus(); }, true);
  win.document.addEventListener('input', event => {
    if (!event.target.matches?.('#accounting-root [data-ac-operation-search]')) return;
    const picker = event.target.closest('.tb-accounting-operation-picker'), select = picker.querySelector('select');
    // Keep the original option nodes, including the selected value, while filtering.
    picker.searchOptions ||= [...select.options].slice(1);
    const selected = select.value, matches = picker.searchOptions.filter(o => matchesOperationSearch(o.dataset.acSearch, event.target.value));
    const retained = picker.searchOptions.find(o => o.value === selected);
    select.replaceChildren(select.options[0], ...matches, ...(retained && !matches.includes(retained) ? [retained] : []));
    select.value = selected;
    picker.querySelector('[data-ac-search-count]').textContent = `${matches.length} résultat(s)${retained && !matches.includes(retained) ? ' · sélection actuelle conservée hors recherche' : ''}.`;
  });
  win.document.addEventListener('click', event => {
    const button = event.target.closest?.('#accounting-root button');
    if (!button) return;
    if (button.hasAttribute('data-ac-refresh')) { refresh(); return; }
    if (!ui || scope !== identity()) { reset(); return; }
    if (button.dataset.acDialog) { ui.dialog = button.dataset.acDialog; win.document.getElementById(ui.dialog)?.showModal(); return; }
    if (button.hasAttribute('data-ac-dialog-close')) { button.closest('dialog')?.close(); return; }
    if (button.dataset.acRemoveDebt) {
      const removed = settings.debts.find(d => d.id === button.dataset.acRemoveDebt);
      if (removed) persistDebts(settings.debts.filter(d => d.id !== removed.id), [...(settings.archivedDebts || []), { ...removed, archivedAt: new Date().toISOString() }]); return;
    }
    if (button.dataset.acUnlinkDebt) {
      persistDebts((settings.debts || []).map(d => d.id === button.dataset.acUnlinkDebt ? { ...d, detachedRepayments: [...(d.detachedRepayments || []), ...d.repayments.filter(p => String(p.transactionId) === button.dataset.acUnlinkTx).map(p => ({ ...p, detachedAt: new Date().toISOString() }))], repayments: d.repayments.filter(p => String(p.transactionId) !== button.dataset.acUnlinkTx) } : d)); return;
    }
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
    if (!['tb-accounting-period', 'tb-accounting-settings', 'tb-accounting-debts'].includes(event.target.id) && !event.target.hasAttribute('data-ac-repayment') && !event.target.hasAttribute('data-ac-adjustment')) return;
    event.preventDefault();
    if (!ui || scope !== identity()) { reset(); return; }
    const form = new FormData(event.target);
    if (event.target.id === 'tb-accounting-debts' || event.target.hasAttribute('data-ac-repayment') || event.target.hasAttribute('data-ac-adjustment')) {
      const today = data.asOf || localToday();
      let debts = settings.debts || [];
      if (event.target.id === 'tb-accounting-debts') {
        const name = String(form.get('name') || '').trim(), currency = String(form.get('debtCurrency') || '').trim().toUpperCase();
        const openingAmount = Number(form.get('openingAmount')), openingDate = String(form.get('openingDate'));
        if (!name || name.length > 120 || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(openingAmount) || openingAmount <= 0 || !validDate(openingDate) || openingDate > today) { setStatus('Renseigne le créancier, une devise à trois lettres, un solde positif et une date passée ou actuelle.'); return; }
        const assetId = String(form.get('assetId') || ''), originTransactionId = String(form.get('originTransactionId') || '');
        const debt = { id: win.crypto.randomUUID(), name, currency, openingAmount, openingDate, assetId, originTransactionId, repayments: [] };
        const origin = data.transactions.find(t => String(t.id) === originTransactionId);
        const used = debts.some(d => String(d.originTransactionId) === originTransactionId || d.repayments.some(p => String(p.transactionId) === originTransactionId));
        if (originTransactionId && (!origin || used || !debtOriginEligible(origin, debt, today, data.links))) { setStatus('Origine invalide : choisis une opération externe réglée, de même devise et montant que le capital de départ, datée au plus tard au départ du suivi, sans autre rattachement.'); return; }
        if (assetId && !data.assets.some(a => String(a.id) === assetId && (!(a.travel_id || a.travelId) || String(a.travel_id || a.travelId) === String(win.state.activeTravelId)))) { setStatus('Bien indisponible dans ce voyage.'); return; }
        debts = [...debts, debt];
      } else if (event.target.hasAttribute('data-ac-adjustment')) {
        const id = String(form.get('debtId')), date = String(form.get('adjustmentDate')), amount = Number(form.get('adjustmentAmount')), reason = String(form.get('reason') || '').trim();
        const debt = debts.find(d => d.id === id);
        if (!debt || !validDate(date) || date < debt.openingDate || date > today || !Number.isFinite(amount) || Math.round(amount * 100) === 0 || !reason || reason.length > 300) { setStatus('Ajustement invalide : date comprise dans le suivi, montant signé non nul et motif requis.'); return; }
        debts = debts.map(d => d.id === id ? { ...d, adjustments: [...(d.adjustments || []), { id: win.crypto.randomUUID(), date, amount, reason, recordedAt: new Date().toISOString() }] } : d);
      } else {
        const id = String(form.get('debtId')), transactionId = String(form.get('transactionId')), principal = Number(form.get('principal'));
        const debt = debts.find(d => d.id === id), tx = data.transactions.find(t => String(t.id) === transactionId);
        const ledger = debtLedger(settings, data.transactions, today, data.links);
        const remaining = ledger.rows.find(d => d.id === id)?.remaining;
        if (!debt || !tx || !repaymentEligible(tx, debt, today, data.links) || debts.some(d => String(d.originTransactionId) === transactionId || d.repayments.some(p => String(p.transactionId) === transactionId)) || !Number.isFinite(principal) || principal <= 0 || !Number.isFinite(remaining) || Math.round(principal * 100) > Math.round(remaining * 100) || Math.round(principal * 100) > Math.round(Number(tx.amount) * 100)) { setStatus('Remboursement invalide : vérifie la devise, le règlement, le capital et le solde restant. Une transaction ne peut être attribuée qu’une fois.'); return; }
        debts = debts.map(d => d.id === id ? { ...d, repayments: [...d.repayments, { transactionId, principal }] } : d);
      }
      const changedId = event.target.id === 'tb-accounting-debts' ? debts.at(-1).id : String(form.get('debtId'));
      if (debtLedger({ ...settings, debts }, data.transactions, today, data.links).rows.find(d => d.id === changedId)?.remaining === null) { setStatus('Opération refusée : elle rendrait le solde négatif à une date de l’historique ou nécessite un rapprochement des sources.'); return; }
      if (persistDebts(debts)) prepareFx();
      return;
    }
    if (event.target.id === 'tb-accounting-period') {
      const start = String(form.get('start')), end = String(form.get('end'));
      if (!validDate(start) || !validDate(end) || start > end) { setStatus('Choisis une date de début antérieure ou égale à la date de fin.'); return; }
      ui = { ...ui, start, end, currency: String(form.get('currency')), mode: String(form.get('mode') || 'consolidated'), source: null }; prepareFx();
    } else {
      const balances = { ...settings.balances };
      for (const fieldset of event.target.querySelectorAll('[data-ac-balance]')) {
        const cur = fieldset.dataset.acBalance;
        const debt = fieldset.querySelector('[data-ac-debt]').value, receivable = fieldset.querySelector('[data-ac-receivable]').value, equity = fieldset.querySelector('[data-ac-equity]').value, evidence = fieldset.querySelector('[data-ac-evidence]').value.trim();
        if (equity !== '' && !Number.isFinite(Number(equity))) { setStatus('Capitaux propres invalides.'); return; }
        if ([debt, receivable].some(v => v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0))) { setStatus('Les soldes doivent être des nombres positifs ou zéro.'); return; }
        balances[cur] = { ...balances[cur], debt, receivable, equity, evidence, asOf: data.asOf || localToday() };
      }
      const mapping = { ...settings.mapping, ...Object.fromEntries([...event.target.querySelectorAll('[data-ac-mapping]')].map(el => [el.dataset.acMapping, el.value])) };
      const inferredMapping = { ...settings.inferredMapping };
      for (const key of Object.keys(mapping)) if (mapping[key] !== settings.mapping?.[key]) delete inferredMapping[key];
      const next = { ...settings, mapping, balances, inferredMapping, equityMode: form.get('equityMode') || settings.equityMode || 'calculated' };
      try { saveSettings(win.localStorage, win.sbUser.id, win.state.activeTravelId, next); settings = next; ui.dialog = null; status = 'Paramétrage enregistré sur cet appareil. Les états ont été recalculés.'; draw(); }
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
