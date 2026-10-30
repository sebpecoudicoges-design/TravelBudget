import { computeWalletBalanceRows } from '../../core/walletBalanceRules.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const text = (fr, en) => document.documentElement.lang?.startsWith('en') ? en : fr;
const money = (value, currency) => new Intl.NumberFormat(document.documentElement.lang || 'fr', { style: 'currency', currency }).format(value);

export async function journalPages(query) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query().range(offset, offset + 499);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Incomplete journal response');
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export function journalRows(transactions, marks) {
  const marked = new Map(marks.map(row => [row.transaction_id, row]));
  return transactions.filter(row => row.pay_now !== false && row.is_internal !== true).map(row => {
    const mark = marked.get(row.id);
    return { ...row, reconciled: !!mark && mark.wallet_id === row.wallet_id && mark.transaction_updated_at === row.updated_at,
      changed: !!mark && (mark.wallet_id !== row.wallet_id || mark.transaction_updated_at !== row.updated_at) };
  }).sort((a, b) => String(b.date_start || '').localeCompare(String(a.date_start || '')) || String(b.id).localeCompare(String(a.id)));
}

export async function openWalletJournal(walletId, { client, userId, onClose } = {}) {
  document.getElementById('tb-wallet-journal')?.close();
  document.getElementById('tb-wallet-journal')?.remove();
  const dialog = document.createElement('dialog');
  dialog.id = 'tb-wallet-journal';
  dialog.className = 'tb-wallet-journal';
  dialog.setAttribute('aria-labelledby', 'tb-journal-title');
  document.body.append(dialog);
  const previousFocus = document.activeElement;
  dialog.addEventListener('close', () => { dialog.remove(); previousFocus?.focus?.(); onClose?.(); }, { once: true });
  dialog.showModal();
  let validScope = true;
  const subscription = client?.auth?.onAuthStateChange?.((_event, session) => {
    if (session?.user?.id !== userId) { validScope = false; dialog.close(); }
  })?.data?.subscription;
  dialog.addEventListener('close', () => subscription?.unsubscribe(), { once: true });
  let wallet, transactions = [], marks = [], busy = false;
  let filters = { from: '', to: '', status: 'all', q: '' };
  let statement = '';
  const stillCurrent = () => dialog.isConnected && validScope;
  function message(value) { const node = dialog.querySelector('[data-journal-message]'); if (node) node.textContent = value; }
  function render() {
    const all = journalRows(transactions, marks);
    const visible = all.filter(row => (!filters.from || row.date_start >= filters.from) && (!filters.to || row.date_start <= filters.to)
      && (filters.status === 'all' || (filters.status === 'unmarked' ? !row.reconciled : row.reconciled))
      && `${row.label || ''} ${row.category || ''} ${row.amount}`.toLowerCase().includes(filters.q.toLowerCase()));
    const current = computeWalletBalanceRows([wallet], transactions)[0].effective_balance;
    const unmarked = all.filter(row => !row.reconciled);
    dialog.innerHTML = `<header><h2 id="tb-journal-title">${esc(text('Journal bancaire', 'Bank journal'))} — ${esc(wallet.name)} (${esc(wallet.currency)})</h2><button class="btn" data-journal-close>${esc(text('Fermer', 'Close'))}</button></header>
      <p class="muted">${esc(text('Opérations payées de ce wallet, tous voyages. Le pointage ne modifie pas les soldes. Une opération modifiée doit être repointée.', 'Paid movements for this wallet, all trips. Reconciliation does not change balances. Edited movements must be reconciled again.'))}</p>
      <div class="tb-journal-summary"><strong>${esc(text('Solde calculé actuel', 'Current calculated balance'))} : ${esc(money(current, wallet.currency))}</strong>
      <span>${unmarked.length} ${esc(text('opération(s) non pointée(s)', 'unreconciled movement(s)'))}</span>
      <label>${esc(text('Solde actuel du relevé', 'Current statement balance'))}<input data-journal-statement type="number" step="any" value="${esc(statement)}"></label><output data-journal-difference></output></div>
      <div class="tb-journal-filters">
      <label>${esc(text('Du', 'From'))}<input data-journal-filter="from" type="date" value="${filters.from}"></label>
      <label>${esc(text('Au', 'To'))}<input data-journal-filter="to" type="date" value="${filters.to}"></label>
      <label>${esc(text('Pointage', 'Reconciliation'))}<select data-journal-filter="status">${[['all', text('Toutes', 'All')], ['unmarked', text('Non pointées', 'Unreconciled')], ['marked', text('Pointées', 'Reconciled')]].map(([value, label]) => `<option value="${value}" ${filters.status === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
      <label>${esc(text('Rechercher', 'Search'))}<input data-journal-filter="q" type="search" value="${esc(filters.q)}"></label>
      <button class="btn" data-journal-reload>${esc(text('Actualiser', 'Refresh'))}</button></div>
      <p data-journal-message role="status"></p>
      <div class="tb-journal-table"><table><thead><tr><th>${esc(text('Pointée', 'Reconciled'))}</th><th>Date</th><th>${esc(text('Libellé', 'Description'))}</th><th>${esc(text('Débit', 'Debit'))}</th><th>${esc(text('Crédit', 'Credit'))}</th></tr></thead><tbody>
      ${visible.map(row => `<tr><td><input type="checkbox" data-journal-mark="${esc(row.id)}" aria-label="${esc(text('Pointer', 'Reconcile'))} ${esc(row.label || row.category)}" ${row.reconciled ? 'checked' : ''}></td><td>${esc(row.date_start)}</td><td>${esc(row.label || row.category)}${row.changed ? `<small>${esc(text('Modifiée : à vérifier', 'Edited: review required'))}</small>` : ''}</td><td>${row.type === 'expense' ? esc(money(Number(row.amount), row.currency)) : ''}</td><td>${row.type === 'income' ? esc(money(Number(row.amount), row.currency)) : ''}</td></tr>`).join('') || `<tr><td colspan="5">${esc(text('Aucune opération pour ces filtres.', 'No movements match these filters.'))}</td></tr>`}</tbody></table></div>`;
    dialog.querySelector('[data-journal-close]').onclick = () => dialog.close();
    dialog.querySelector('[data-journal-reload]').onclick = load;
    for (const input of dialog.querySelectorAll('[data-journal-filter]')) input.onchange = () => { filters[input.dataset.journalFilter] = input.value; render(); };
    const balance = dialog.querySelector('[data-journal-statement]');
    const updateDifference = () => {
      statement = balance.value;
      dialog.querySelector('[data-journal-difference]').textContent = statement !== '' && Number.isFinite(Number(statement))
        ? `${text('Écart relevé − solde calculé', 'Statement − calculated balance')}: ${money(Number(statement) - current, wallet.currency)}` : '';
    };
    balance.oninput = updateDifference;
    updateDifference();
    for (const checkbox of dialog.querySelectorAll('[data-journal-mark]')) checkbox.onchange = async () => {
      if (busy || !stillCurrent()) return;
      busy = true;
      dialog.querySelectorAll('input,select,button:not([data-journal-close])').forEach(node => { node.disabled = true; });
      try {
        const row = transactions.find(tx => tx.id === checkbox.dataset.journalMark);
        const { data, error } = await client.rpc('set_wallet_transaction_reconciliation', { p_transaction_id: row.id, p_reconciled: checkbox.checked, p_expected_updated_at: row.updated_at });
        if (error) throw error;
        if (!stillCurrent()) return;
        marks = marks.filter(mark => mark.transaction_id !== row.id);
        if (data) marks.push(data);
        render();
      } catch (error) { if (stillCurrent()) { render(); message(error.message || String(error)); } }
      finally { busy = false; }
    };
  }
  async function load() {
    if (busy) return;
    busy = true;
    dialog.innerHTML = `<h2 id="tb-journal-title">${esc(text('Chargement du journal…', 'Loading journal…'))}</h2><button class="btn" data-journal-close>${esc(text('Fermer', 'Close'))}</button><p data-journal-message role="status"></p>`;
    dialog.querySelector('[data-journal-close]').onclick = () => dialog.close();
    try {
      if (!client || !userId) throw new Error(text('Connexion requise pour le pointage synchronisé.', 'Sign in to use synced reconciliation.'));
      const { data, error } = await client.from('wallets').select('*').eq('id', walletId).eq('user_id', userId).single();
      if (error) throw error;
      const [txs, checked] = await Promise.all([
        journalPages(() => client.from('transactions').select('*').eq('wallet_id', walletId).eq('user_id', userId).order('id')),
        journalPages(() => client.from('wallet_transaction_reconciliation').select('*').eq('wallet_id', walletId).eq('user_id', userId).order('transaction_id')),
      ]);
      if (!stillCurrent()) { dialog.close(); return; }
      wallet = data; transactions = txs; marks = checked;
      render();
    } catch (error) {
      if (stillCurrent()) {
        message(error.message || String(error));
        const retry = document.createElement('button');
        retry.className = 'btn';
        retry.textContent = text('Réessayer', 'Retry');
        retry.onclick = load;
        dialog.append(retry);
      }
    }
    finally { busy = false; }
  }
  await load();
}
