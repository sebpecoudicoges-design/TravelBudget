/* TravelBudget V9.7.3 - Inbox / A traiter UI
   Scope V1: display WhatsApp inbox items, preview stored documents, create core transactions, classify documents, snooze/delete soft actions.
   Trip expense action is visible but intentionally disabled. */
(function(){
  const BUCKET = 'inbox-documents';
  const TABLE = (window.TB_CONST?.TABLES?.inbox_items || 'inbox_items');
  const CACHE = {
    items: [],
    loading: false,
    error: '',
    status: 'active',
    search: '',
    signedUrls: {},
  };

  function client(){
    try { if (typeof sb !== 'undefined' && sb && sb.from) return sb; } catch(_) {}
    try { if (window.sb && window.sb.from) return window.sb; } catch(_) {}
    return null;
  }

  function esc(v){
    try { return escapeHTML(String(v ?? '')); } catch(_) {
      return String(v ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
    }
  }

  function inboxLang(){
    try {
      if(typeof window.tbGetLang === 'function') return String(window.tbGetLang() || 'fr').toLowerCase();
      return String(window.__tbLang || localStorage.getItem('tb_lang_v1') || navigator.language || 'fr').toLowerCase();
    } catch(_) { return 'fr'; }
  }

  function tr(fr, en){
    return inboxLang().startsWith('en') ? (en || fr) : fr;
  }

  function fmtDateTime(v){
    if(!v) return '—';
    try { return new Date(v).toLocaleString(inboxLang().startsWith('en') ? 'en-AU' : 'fr-FR', { dateStyle:'short', timeStyle:'short' }); }
    catch(_) { return String(v).slice(0, 16); }
  }

  function statusLabel(s){
    const v = String(s || 'pending');
    if(v === 'pending') return tr('À traiter', 'Pending');
    if(v === 'snoozed') return tr('Reporté', 'Snoozed');
    if(v === 'processed') return tr('Traité', 'Processed');
    if(v === 'deleted') return tr('Supprimé', 'Deleted');
    if(v === 'error') return tr('Erreur', 'Error');
    return v;
  }

  function isImage(item){ return /^image\//i.test(String(item?.media_content_type || '')); }
  function isPdf(item){ return /pdf/i.test(String(item?.media_content_type || '')) || /\.pdf$/i.test(String(item?.storage_path || item?.raw_text || '')); }

  function normalizeText(v){
    return String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function parseQuickText(raw){
    try {
      if(window.Core?.inboxRules?.parseInboxText) return window.Core.inboxRules.parseInboxText(raw);
    } catch(_) {}
    const text = String(raw || '').trim();
    if(!text) return null;
    const m = text.match(/(?:^|\s)(AUD|EUR|USD|JPY|THB|LAK|VND|GBP|CHF|CAD|NZD|SGD)?\s*([0-9]+(?:[,.][0-9]{1,2})?)\s*(€|eur|aud|usd|jpy|thb|lak|vnd|gbp|chf|cad|nzd|sgd)?\b/i);
    if(!m) return null;
    const amount = Number(String(m[2] || '').replace(',', '.'));
    if(!Number.isFinite(amount) || amount <= 0) return null;
    const symbol = String(m[3] || '').toUpperCase();
    const prefix = String(m[1] || '').toUpperCase();
    const currency = symbol === '€' ? 'EUR' : (prefix || symbol || '');
    const label = text.replace(m[0], ' ').replace(/\s+/g, ' ').trim();
    return { amount, currency, label };
  }


  function tableName(name, fallback){
    return (window.TB_CONST && window.TB_CONST.TABLES && window.TB_CONST.TABLES[name]) || fallback || name;
  }

  async function currentUserId(){
    try { if(window.sbUser && window.sbUser.id) return window.sbUser.id; } catch(_) {}
    const c = client();
    try {
      if(c && c.auth && typeof c.auth.getUser === 'function'){
        const res = await c.auth.getUser();
        return res?.data?.user?.id || '';
      }
    } catch(_) {}
    return '';
  }

  function activeTravelId(){
    try { return window.state?.activeTravelId || window.state?.travel?.id || window.state?.currentTravelId || ''; } catch(_) { return ''; }
  }

  function todayISO(){
    try { return new Date().toISOString().slice(0,10); } catch(_) { return ''; }
  }

  function cleanFilename(name){
    return String(name || 'document')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9._-]+/g,'-')
      .replace(/-+/g,'-')
      .replace(/^-|-$/g,'')
      .slice(0,120) || 'document';
  }

  function nameFromInbox(item){
    const text = String(item?.raw_text || '').trim();
    if(text) return text.slice(0,90);
    const path = String(item?.storage_path || item?.media_url || 'document');
    return path.split('/').pop() || tr('Document reçu', 'Received document');
  }

  function mimeExtension(mime, fallbackPath){
    const m = String(mime || '').toLowerCase();
    if(m.includes('pdf')) return '.pdf';
    if(m.includes('png')) return '.png';
    if(m.includes('webp')) return '.webp';
    if(m.includes('jpeg') || m.includes('jpg')) return '.jpg';
    const ext = String(fallbackPath || '').match(/\.([a-z0-9]{1,8})(?:\?|$)/i);
    return ext ? `.${ext[1].toLowerCase()}` : '';
  }

  function walletOptionsHtml(selectedCurrency){
    const wallets = Array.isArray(window.state?.wallets) ? window.state.wallets : [];
    return wallets.map(w => {
      const id = w.id || w.wallet_id;
      const cur = String(w.currency || '').toUpperCase();
      const selected = selectedCurrency && cur === String(selectedCurrency).toUpperCase() ? 'selected' : '';
      return `<option value="${esc(id)}" ${selected}>${esc(w.name || 'Wallet')} · ${esc(cur)}</option>`;
    }).join('');
  }

  function findWallet(id){
    const sid = String(id || '');
    return (Array.isArray(window.state?.wallets) ? window.state.wallets : [])
      .find(w => String(w.id || w.wallet_id || '') === sid) || null;
  }

  function defaultCategory(){
    return (window.TB_CONST?.CATS?.other || 'Autre');
  }

  function categoriesList(){
    try { if (typeof window.getCategories === 'function') return window.getCategories() || []; } catch(_) {}
    try { return Array.isArray(window.state?.categories) ? window.state.categories : []; } catch(_) { return []; }
  }

  function categoryOptionsHtml(selected){
    const cats = categoriesList();
    const selectedKey = String(selected || '').trim().toLowerCase();
    const out = [];
    const seen = new Set();
    for (const c of cats) {
      const name = String(c || '').trim();
      if (!name) continue;
      const k = name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(`<option value="${esc(name)}" ${k === selectedKey ? 'selected' : ''}>${esc(name)}</option>`);
    }
    if (selected && !seen.has(selectedKey)) out.unshift(`<option value="${esc(selected)}" selected>${esc(selected)}</option>`);
    return out.join('');
  }

  function subcategoryOptionsHtml(categoryName, selected){
    let rows = [];
    try { if (typeof window.getCategorySubcategories === 'function') rows = window.getCategorySubcategories(categoryName) || []; } catch(_) {}
    const selectedKey = String(selected || '').trim().toLowerCase();
    const out = [`<option value="">${esc(tr('Aucune', 'None'))}</option>`];
    const seen = new Set();
    for (const row of rows) {
      const name = String(row?.name || row || '').trim();
      if (!name) continue;
      const k = name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(`<option value="${esc(name)}" ${k === selectedKey ? 'selected' : ''}>${esc(name)}</option>`);
    }
    if (selected && !seen.has(selectedKey)) out.push(`<option value="${esc(selected)}" selected>${esc(selected)}</option>`);
    return out.join('');
  }

  function transactionDateValue(tx){
    return String(tx?.dateStart || tx?.date_start || tx?.cashDate || tx?.date || tx?.created_at || '').slice(0,10);
  }

  function inferDraft(item){
    try {
      if(window.Core?.inboxRules?.inferInboxDraft){
        return window.Core.inboxRules.inferInboxDraft(item, {
          categories: categoriesList(),
          defaultCategory: defaultCategory()
        });
      }
    } catch(_) {}
    const parsed = parseQuickText(item?.raw_text) || {};
    return {
      amount: parsed.amount || '',
      currency: parsed.currency || '',
      label: parsed.label || String(item?.raw_text || '').trim() || nameFromInbox(item),
      category: defaultCategory(),
      type: 'expense'
    };
  }

  async function ensureInvoiceFolder(userId){
    const c = client();
    if(!c || !userId) return null;
    const names = ['Factures', 'Facture'];
    const { data: existing, error: selectError } = await c
      .from(tableName('document_folders','document_folders'))
      .select('id,name')
      .eq('user_id', userId)
      .in('name', names)
      .limit(1);
    if(selectError) {
      console.warn('[TB][inbox] invoice folder lookup failed', selectError);
      return null;
    }
    if(existing?.[0]?.id) return existing[0].id;
    const { data: created, error: insertError } = await c
      .from(tableName('document_folders','document_folders'))
      .insert({ user_id: userId, name: 'Factures', parent_id: null })
      .select('id')
      .single();
    if(insertError) {
      console.warn('[TB][inbox] invoice folder creation failed', insertError);
      return null;
    }
    return created?.id || null;
  }

  async function createDocumentFromInbox(item, opts = {}){
    const c = client();
    if(!c) throw new Error(tr('Client Supabase indisponible.', 'Supabase client unavailable.'));
    const uid = await currentUserId();
    if(!uid) throw new Error(tr('Utilisateur non connecté.', 'User not connected.'));
    if(!item?.storage_path) throw new Error(tr('Aucun fichier Storage associé à cet élément.', 'No Storage file linked to this item.'));

    const asInvoice = !!opts.asInvoice;
    const docId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const baseName = nameFromInbox(item).replace(/\.[a-z0-9]{1,8}$/i, '') || tr('Document reçu', 'Received document');
    const ext = mimeExtension(item.media_content_type, item.storage_path);
    const original = cleanFilename(baseName + ext);
    const invoiceFolderId = asInvoice ? await ensureInvoiceFolder(uid) : null;
    const existing = await c.from(tableName('documents','documents'))
      .select('id,tags,folder_id')
      .eq('user_id', uid)
      .eq('storage_bucket', BUCKET)
      .eq('storage_path', item.storage_path)
      .maybeSingle();
    if(existing.error) throw existing.error;
    if(existing.data?.id){
      if(asInvoice && invoiceFolderId){
        const tags = Array.isArray(existing.data.tags) ? existing.data.tags.map(String) : [];
        const nextTags = window.Core?.documentRules?.normalizeTagsForFolder
          ? window.Core.documentRules.normalizeTagsForFolder(tags, 'Factures')
          : Array.from(new Set([...tags, 'Facture']));
        const up = await c.from(tableName('documents','documents'))
          .update({ folder_id: invoiceFolderId, tags: nextTags })
          .eq('id', existing.data.id);
        if(up.error) throw up.error;
      }
      return existing.data.id;
    }

    const { error } = await c.from(tableName('documents','documents')).insert({
      id: docId,
      user_id: uid,
      folder_id: invoiceFolderId,
      name: baseName,
      original_filename: original,
      storage_bucket: BUCKET,
      storage_path: item.storage_path,
      mime_type: item.media_content_type || '',
      size_bytes: 0,
      tags: asInvoice ? ['Facture'] : [],
      notes: `${tr('Importé depuis WhatsApp / À traiter', 'Imported from WhatsApp / Inbox')}${item.raw_text ? ` — ${item.raw_text}` : ''}`
    });
    if(error) throw error;
    return docId;
  }

  async function linkDocumentToTransaction(docId, txId){
    const c = client();
    if(!c || !docId || !txId) return;
    const uid = await currentUserId();
    if(!uid) throw new Error(tr('Utilisateur non connecté.', 'User not connected.'));
    const existing = await c.from(tableName('transaction_documents','transaction_documents'))
      .select('id')
      .eq('user_id', uid)
      .eq('document_id', docId)
      .eq('transaction_id', txId)
      .limit(1);
    if(existing.error) throw existing.error;
    if(existing.data?.[0]?.id) return existing.data[0].id;
    const { error } = await c.from(tableName('transaction_documents','transaction_documents')).insert({
      user_id: uid,
      document_id: docId,
      transaction_id: txId,
      relation_type: 'invoice'
    });
    if(error && error.code !== '23505') throw error;
  }

  async function createTransactionFromInbox(item, form){
    const c = client();
    if(!c) throw new Error(tr('Client Supabase indisponible.', 'Supabase client unavailable.'));
    const wallet = findWallet(form.walletId);
    if(!wallet) throw new Error(tr('Wallet invalide.', 'Invalid wallet.'));
    const amount = Number(String(form.amount || '').replace(',', '.'));
    if(!Number.isFinite(amount) || amount <= 0) throw new Error(tr('Montant invalide.', 'Invalid amount.'));

    const txType = String(form.type || 'expense') === 'income' ? 'income' : 'expense';
    const cashStart = String(form.cashDateStart || form.date || todayISO()).slice(0,10);
    const cashEnd = String(form.cashDateEnd || cashStart).slice(0,10);
    const budgetStart = String(form.budgetDateStart || cashStart).slice(0,10);
    const budgetEnd = String(form.budgetDateEnd || budgetStart).slice(0,10);

    const core = {
      walletId: form.walletId,
      type: txType,
      label: String(form.label || '').trim() || nameFromInbox(item),
      amount,
      currency: String(wallet.currency || form.currency || '').toUpperCase(),
      category: String(form.category || '').trim() || (txType === 'income' ? 'Revenu' : defaultCategory()),
      subcategory: String(form.subcategory || '').trim() || null,
      cashDate: cashStart,
      dateStart: cashStart,
      dateEnd: cashEnd,
      budgetDateStart: budgetStart,
      budgetDateEnd: budgetEnd,
      payNow: !!form.payNow,
      outOfBudget: !!form.outOfBudget,
      nightCovered: false,
      affectsBudget: !form.outOfBudget,
      tripExpenseId: null,
      tripShareLinkId: null
    };

    const args = (typeof window._txBuildApplyV2Args === 'function')
      ? window._txBuildApplyV2Args(core)
      : {
          p_wallet_id: core.walletId,
          p_type: core.type,
          p_label: core.label,
          p_amount: core.amount,
          p_currency: core.currency,
          p_date_start: core.dateStart,
          p_date_end: core.dateEnd,
          p_budget_date_start: core.budgetDateStart,
          p_budget_date_end: core.budgetDateEnd,
          p_category: core.category,
          p_subcategory: core.subcategory,
          p_pay_now: core.payNow,
          p_out_of_budget: core.outOfBudget,
          p_night_covered: false,
          p_affects_budget: core.affectsBudget,
          p_trip_expense_id: null,
          p_trip_share_link_id: null,
          p_user_id: await currentUserId()
        };

    const rpcName = window.TB_CONST?.RPCS?.apply_transaction_v2 || 'apply_transaction_v2';
    const res = (typeof window.tbRpcWithRetry === 'function')
      ? await window.tbRpcWithRetry(rpcName, args)
      : await c.rpc(rpcName, args);
    if(res.error) throw res.error;

    let txId = typeof res.data === 'string' ? res.data : (res.data?.id || res.data?.tx_id || null);
    if(!txId){
      const { data, error } = await c.from(tableName('transactions','transactions'))
        .select('id')
        .eq('wallet_id', core.walletId)
        .eq('label', core.label)
        .eq('date_start', core.dateStart)
        .order('created_at', { ascending:false })
        .limit(1);
      if(error) throw error;
      txId = data?.[0]?.id || null;
    }
    if(!txId) throw new Error(tr('Transaction créée mais identifiant introuvable.', 'Transaction created but identifier not found.'));
    return txId;
  }

  async function linkInboxDocumentToExistingTransaction(item, txId){
    if(!item?.storage_path) throw new Error(tr('Aucun document Storage associé à cet élément.', 'No Storage document linked to this item.'));
    if(!txId) throw new Error(tr('Transaction cible invalide.', 'Invalid target transaction.'));
    const docId = await createDocumentFromInbox(item, { asInvoice: true });
    await linkDocumentToTransaction(docId, txId);
    await updateItem(item.id, {
      status:'processed',
      processed_at:new Date().toISOString(),
      target_type:'transaction',
      target_id:txId,
      error_message:null
    });
    try { if(typeof window.tbAfterMutationRefresh === 'function') await window.tbAfterMutationRefresh('inbox:link-transaction'); else if(typeof window.refreshFromServer === 'function') await window.refreshFromServer(); } catch(_) {}
    alert(tr('Document classé et lié à la transaction.', 'Document filed and linked to the transaction.'));
  }

  function closeInboxModal(){
    document.querySelector('.tb-inbox-modal-backdrop')?.remove();
  }

  function openTransactionModalForInbox(item){
    const draft = inferDraft(item);
    const wallets = Array.isArray(window.state?.wallets) ? window.state.wallets : [];
    if(!wallets.length) return alert(tr('Aucun wallet disponible.', 'No wallet available.'));
    const preferredCurrency = draft.currency || String(window.state?.period?.baseCurrency || window.state?.period?.base_currency || '').toUpperCase();
    const firstWallet = wallets.find(w => String(w.currency || '').toUpperCase() === preferredCurrency) || wallets[0];
    const date = String(item.created_at || '').slice(0,10) || todayISO();
    const label = draft.label || String(item.raw_text || '').trim() || nameFromInbox(item);
    const initialType = draft.type || 'expense';
    const initialCategory = draft.category || defaultCategory();

    closeInboxModal();
    const wrap = document.createElement('div');
    wrap.className = 'tb-inbox-modal-backdrop';
    wrap.onclick = (e) => { if(e.target === wrap) closeInboxModal(); };
    wrap.innerHTML = `
      <div class="tb-inbox-modal" role="dialog" aria-modal="true">
        <div class="tb-inbox-modal-head">
          <div><h3>${esc(tr('Créer une transaction', 'Create transaction'))}</h3><div class="tb-inbox-note">${esc(tr('Prérempli depuis À traiter. Vérifie avant validation.', 'Prefilled from Inbox. Review before saving.'))}</div></div>
          <button class="btn" type="button" data-inbox-modal-close>×</button>
        </div>
        <div class="tb-inbox-form-grid">
          <div class="field"><label>${esc(tr('Type', 'Type'))}</label><select id="tb-inbox-tx-type"><option value="expense" ${initialType==='expense'?'selected':''}>${esc(tr('Dépense', 'Expense'))}</option><option value="income">${esc(tr('Entrée', 'Income'))}</option></select></div>
          <div class="field"><label>${esc(tr('Wallet', 'Wallet'))}</label><select id="tb-inbox-tx-wallet">${walletOptionsHtml(preferredCurrency)}</select></div>
          <div class="field"><label>${esc(tr('Devise', 'Currency'))}</label><input id="tb-inbox-tx-currency" type="text" value="" disabled style="opacity:1;font-weight:800;"></div>
          <div class="field"><label>${esc(tr('Montant', 'Amount'))}</label><input id="tb-inbox-tx-amount" type="number" step="0.01" value="${esc(draft.amount || '')}"></div>
          <div class="field span-2"><label>${esc(tr('Libellé', 'Label'))}</label><input id="tb-inbox-tx-label" type="text" value="${esc(label)}"></div>
          <div class="field"><label>${esc(tr('Date paiement début', 'Cash start date'))}</label><input id="tb-inbox-tx-cash-start" type="date" value="${esc(date)}"></div>
          <div class="field"><label>${esc(tr('Date paiement fin', 'Cash end date'))}</label><input id="tb-inbox-tx-cash-end" type="date" value="${esc(date)}"></div>
          <div class="field"><label>${esc(tr('Budget du', 'Budget from'))}</label><input id="tb-inbox-tx-budget-start" type="date" value="${esc(date)}"></div>
          <div class="field"><label>${esc(tr('Budget au', 'Budget to'))}</label><input id="tb-inbox-tx-budget-end" type="date" value="${esc(date)}"></div>
          <div class="field"><label>${esc(tr('Catégorie', 'Category'))}</label><select id="tb-inbox-tx-category">${categoryOptionsHtml(initialCategory)}</select></div>
          <div class="field"><label>${esc(tr('Sous-catégorie', 'Subcategory'))}</label><select id="tb-inbox-tx-subcategory">${subcategoryOptionsHtml(initialCategory, '')}</select></div>
          <div class="field span-2"><label>${esc(tr('Options', 'Options'))}</label><div style="display:flex;gap:14px;flex-wrap:wrap;"><label style="display:flex;gap:8px;align-items:center;color:var(--text);font-weight:700;"><input id="tb-inbox-tx-paynow" type="checkbox" checked> ${esc(tr('Payée maintenant', 'Paid now'))}</label><label style="display:flex;gap:8px;align-items:center;color:var(--text);font-weight:700;"><input id="tb-inbox-tx-out" type="checkbox"> ${esc(tr('Hors budget', 'Out of budget'))}</label></div></div>
        </div>
        <div class="tb-inbox-modal-actions">
          <button class="btn" type="button" data-inbox-modal-close>${esc(tr('Annuler', 'Cancel'))}</button>
          <button class="btn primary" type="button" id="tb-inbox-tx-save">${esc(tr('Créer transaction', 'Create transaction'))}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const walletEl = wrap.querySelector('#tb-inbox-tx-wallet');
    const currencyEl = wrap.querySelector('#tb-inbox-tx-currency');
    const typeEl = wrap.querySelector('#tb-inbox-tx-type');
    const catEl = wrap.querySelector('#tb-inbox-tx-category');
    const subEl = wrap.querySelector('#tb-inbox-tx-subcategory');
    if(firstWallet?.id) walletEl.value = firstWallet.id;
    const syncCurrency = () => { const w = findWallet(walletEl.value); if(currencyEl) currencyEl.value = String(w?.currency || '').toUpperCase(); };
    const syncSubcategories = () => { if(subEl && catEl) subEl.innerHTML = subcategoryOptionsHtml(catEl.value, ''); };
    const syncCategoryForType = () => {
      if(!catEl) return;
      if(typeEl?.value === 'income'){
        const cats = categoriesList().map(x => String(x || ''));
        const rev = cats.find(x => x.toLowerCase() === 'revenu') || cats.find(x => /revenu|income/i.test(x));
        if(rev) catEl.value = rev;
      }
      syncSubcategories();
    };
    syncCurrency();
    syncSubcategories();
    walletEl?.addEventListener('change', syncCurrency);
    catEl?.addEventListener('change', syncSubcategories);
    typeEl?.addEventListener('change', syncCategoryForType);
    wrap.querySelectorAll('[data-inbox-modal-close]').forEach(b => b.onclick = closeInboxModal);
    wrap.querySelector('#tb-inbox-tx-save').onclick = async () => {
      const btn = wrap.querySelector('#tb-inbox-tx-save');
      try{
        btn.disabled = true;
        const form = {
          type: wrap.querySelector('#tb-inbox-tx-type')?.value,
          walletId: wrap.querySelector('#tb-inbox-tx-wallet')?.value,
          currency: wrap.querySelector('#tb-inbox-tx-currency')?.value,
          cashDateStart: wrap.querySelector('#tb-inbox-tx-cash-start')?.value,
          cashDateEnd: wrap.querySelector('#tb-inbox-tx-cash-end')?.value,
          budgetDateStart: wrap.querySelector('#tb-inbox-tx-budget-start')?.value,
          budgetDateEnd: wrap.querySelector('#tb-inbox-tx-budget-end')?.value,
          amount: wrap.querySelector('#tb-inbox-tx-amount')?.value,
          category: wrap.querySelector('#tb-inbox-tx-category')?.value,
          subcategory: wrap.querySelector('#tb-inbox-tx-subcategory')?.value,
          label: wrap.querySelector('#tb-inbox-tx-label')?.value,
          payNow: wrap.querySelector('#tb-inbox-tx-paynow')?.checked,
          outOfBudget: wrap.querySelector('#tb-inbox-tx-out')?.checked
        };
        const txId = await createTransactionFromInbox(item, form);
        let docId = null;
        if(item.storage_path){
          docId = await createDocumentFromInbox(item, { asInvoice: true });
          await linkDocumentToTransaction(docId, txId);
        }
        await updateItem(item.id, {
          status:'processed',
          processed_at:new Date().toISOString(),
          target_type:'transaction',
          target_id:txId,
          error_message:null
        });
        closeInboxModal();
        try { if(typeof window.tbAfterMutationRefresh === 'function') await window.tbAfterMutationRefresh('inbox:transaction'); else if(typeof window.refreshFromServer === 'function') await window.refreshFromServer(); } catch(_) {}
        alert(docId ? tr('Transaction créée et document lié/classé en Factures.', 'Transaction created and document linked/filed in Invoices.') : tr('Transaction créée.', 'Transaction created.'));
      }catch(e){
        console.error('[TB][inbox] create transaction failed', e);
        alert(e.message || String(e));
        btn.disabled = false;
      }
    };
  }

  function openLinkTransactionModalForInbox(item){
    if(!item?.storage_path) return alert(tr('Aucun document à lier.', 'No document to link.'));
    const rawTxs = Array.isArray(window.state?.transactions) ? window.state.transactions : [];
    const scored = window.Core?.inboxRules?.sortInboxTransactionCandidates
      ? window.Core.inboxRules.sortInboxTransactionCandidates(item, rawTxs, 120)
      : rawTxs.map(tx => ({ tx, match:{ score:0, reasons:[] } }));
    const allTxs = scored.map(x => x.tx);
    if(!allTxs.length) return alert(tr('Aucune transaction chargée.', 'No loaded transaction.'));

    const txLabel = (tx) => {
      const scoredRow = scored.find(row => String(row.tx?.id || '') === String(tx?.id || ''));
      const score = Number(scoredRow?.match?.score || 0);
      const date = transactionDateValue(tx);
      const label = tx.label || tx.description || 'Transaction';
      const amount = tx.amount ?? '';
      const cur = tx.currency || tx.currencyCode || '';
      const prefix = score >= 70 ? tr('Probable', 'Likely') : (score >= 40 ? tr('Possible', 'Possible') : '');
      return `${prefix ? `${prefix} ${score}% · ` : ''}${date} · ${label} · ${amount} ${cur}`.trim();
    };

    const txSearchText = (tx) => [
      tx.id,
      transactionDateValue(tx),
      tx.label,
      tx.description,
      tx.category,
      tx.subcategory,
      tx.amount,
      tx.currency,
      tx.currencyCode,
    ].map(v => String(v || '').toLowerCase()).join(' ');

    const buildOptions = (q = '') => {
      const needle = String(q || '').trim().toLowerCase();
      const rows = needle
        ? allTxs.filter(tx => txSearchText(tx).includes(needle))
        : allTxs;
      const limited = rows.slice(0, 80);
      if(!limited.length) return `<option value="">${esc(tr('Aucune transaction trouvée', 'No transaction found'))}</option>`;
      return limited.map(tx => `<option value="${esc(tx.id)}">${esc(txLabel(tx))}</option>`).join('');
    };

    closeInboxModal();
    const wrap = document.createElement('div');
    wrap.className = 'tb-inbox-modal-backdrop';
    wrap.onclick = (e) => { if(e.target === wrap) closeInboxModal(); };
    wrap.innerHTML = `
      <div class="tb-inbox-modal" role="dialog" aria-modal="true">
        <div class="tb-inbox-modal-head">
          <div><h3>${esc(tr('Lier à une transaction', 'Link to a transaction'))}</h3><div class="tb-inbox-note">${esc(tr('Les transactions les plus probables sont en haut selon montant, devise, date et libellé. Le document sera classé comme facture puis lié à la transaction choisie.', 'Likely transactions are shown first using amount, currency, date and label. The document will be filed as an invoice and linked to the selected transaction.'))}</div></div>
          <button class="btn" type="button" data-inbox-modal-close>×</button>
        </div>
        <div class="tb-inbox-form-grid">
          <div class="field span-2">
            <label>${esc(tr('Rechercher', 'Search'))}</label>
            <input id="tb-inbox-link-search" type="search" placeholder="${esc(tr('Ex. auberge, 12.50, 2026-05, AUD...', 'Ex. hostel, 12.50, 2026-05, AUD...'))}" autocomplete="off" />
          </div>
          <div class="field span-2">
            <label>${esc(tr('Transaction', 'Transaction'))}</label>
            <select id="tb-inbox-link-tx">${buildOptions('')}</select>
          </div>
        </div>
        <div class="tb-inbox-modal-actions">
          <button class="btn" type="button" data-inbox-modal-close>${esc(tr('Annuler', 'Cancel'))}</button>
          <button class="btn primary" type="button" id="tb-inbox-link-save">${esc(tr('Lier et classer', 'Link and file'))}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const searchEl = wrap.querySelector('#tb-inbox-link-search');
    const selectEl = wrap.querySelector('#tb-inbox-link-tx');
    searchEl?.addEventListener('input', () => {
      if(selectEl) selectEl.innerHTML = buildOptions(searchEl.value);
    });
    wrap.querySelectorAll('[data-inbox-modal-close]').forEach(b => b.onclick = closeInboxModal);
    wrap.querySelector('#tb-inbox-link-save').onclick = async () => {
      const btn = wrap.querySelector('#tb-inbox-link-save');
      try{
        btn.disabled = true;
        const txId = wrap.querySelector('#tb-inbox-link-tx')?.value;
        if(!txId) throw new Error(tr('Choisis une transaction.', 'Choose a transaction.'));
        await linkInboxDocumentToExistingTransaction(item, txId);
        closeInboxModal();
      }catch(e){
        console.error('[TB][inbox] link transaction failed', e);
        alert(e.message || String(e));
        btn.disabled = false;
      }
    };
  }

  async function classifyInboxDocument(item){
    if(!item.storage_path) throw new Error(tr('Aucun document Storage à classer.', 'No Storage document to file.'));
    const docId = await createDocumentFromInbox(item);
    await updateItem(item.id, {
      status:'processed',
      processed_at:new Date().toISOString(),
      target_type:'document',
      target_id:docId,
      error_message:null
    });
    try { if(typeof window.renderDocuments === 'function') window.renderDocuments(); } catch(_) {}
    alert(tr('Document classé.', 'Document filed.'));
  }

  function root(){ return document.getElementById('inbox-root'); }

  function ensureStyles(){
    if(document.getElementById('tb-inbox-style')) return;
    const style = document.createElement('style');
    style.id = 'tb-inbox-style';
    style.textContent = `
      #view-inbox{display:flex;flex-direction:column;gap:18px;}
      .tb-inbox-shell{display:flex;flex-direction:column;gap:14px;}
      .tb-inbox-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;}
      .tb-inbox-title{display:flex;flex-direction:column;gap:4px;}
      .tb-inbox-title h2{margin:0;font-size:22px;letter-spacing:-.03em;}
      .tb-inbox-title p{margin:0;color:var(--muted);font-size:13px;}
      .tb-inbox-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
      .tb-inbox-actions select,.tb-inbox-actions input{padding:9px 11px;border:1px solid var(--border);border-radius:13px;background:var(--panel);color:var(--text);font-size:13px;}
      .tb-inbox-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;}
      .tb-inbox-card{border:1px solid var(--border);border-radius:22px;padding:14px;background:linear-gradient(180deg,rgba(255,255,255,.9),rgba(255,255,255,.72));box-shadow:0 10px 30px rgba(15,23,42,.06);display:flex;flex-direction:column;gap:12px;min-width:0;}
      .tb-inbox-card[data-status="snoozed"]{opacity:.82;}
      .tb-inbox-card[data-status="deleted"]{opacity:.55;}
      .tb-inbox-meta{display:flex;justify-content:space-between;gap:10px;align-items:center;color:var(--muted);font-size:12px;}
      .tb-inbox-badge{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:999px;padding:4px 9px;background:rgba(255,255,255,.7);font-size:12px;color:var(--muted);}
      .tb-inbox-text{font-size:15px;font-weight:750;letter-spacing:-.02em;word-break:break-word;}
      .tb-inbox-parse{display:flex;gap:6px;flex-wrap:wrap;}
      .tb-inbox-chip{font-size:12px;border-radius:999px;border:1px solid var(--border);padding:4px 8px;background:rgba(124,58,237,.06);color:var(--text);}
      .tb-inbox-preview{border:1px solid var(--border);border-radius:16px;overflow:hidden;background:rgba(15,23,42,.035);min-height:86px;display:flex;align-items:center;justify-content:center;}
      .tb-inbox-preview img{width:100%;max-height:220px;object-fit:cover;display:block;}
      .tb-inbox-file{display:flex;align-items:center;gap:10px;padding:14px;color:var(--text);font-weight:700;}
      .tb-inbox-buttons{display:flex;gap:8px;flex-wrap:wrap;}
      .tb-inbox-buttons button,.tb-inbox-buttons a{border:1px solid var(--border);border-radius:13px;padding:8px 10px;background:var(--panel);color:var(--text);font-size:12px;cursor:pointer;text-decoration:none;}
      .tb-inbox-buttons button.primary{background:linear-gradient(135deg,#7c3aed,#06b6d4);border-color:transparent;color:#fff;}
      .tb-inbox-buttons button.danger{color:#b91c1c;}
      .tb-inbox-buttons button:disabled{opacity:.5;cursor:not-allowed;}
      .tb-inbox-empty{border:1px dashed var(--border);border-radius:22px;padding:24px;text-align:center;color:var(--muted);background:rgba(255,255,255,.55);}
      .tb-inbox-note{font-size:12px;color:var(--muted);line-height:1.35;}
      .tb-inbox-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.38);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px;}
      .tb-inbox-modal{width:min(720px,100%);max-height:88vh;overflow:auto;border:1px solid var(--border);border-radius:24px;background:var(--panel);color:var(--text);box-shadow:0 28px 80px rgba(15,23,42,.26);padding:18px;display:flex;flex-direction:column;gap:14px;}
      .tb-inbox-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;}
      .tb-inbox-modal-head h3{margin:0;font-size:19px;letter-spacing:-.03em;}
      .tb-inbox-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
      .tb-inbox-form-grid .field{display:flex;flex-direction:column;gap:6px;}
      .tb-inbox-form-grid label{font-size:12px;color:var(--muted);font-weight:800;}
      .tb-inbox-form-grid input,.tb-inbox-form-grid select{padding:10px 11px;border:1px solid var(--border);border-radius:13px;background:var(--bg);color:var(--text);font-size:14px;}
      .tb-inbox-form-grid input:disabled{opacity:1;color:var(--text);background:rgba(127,127,127,.06);font-weight:800;}
      .tb-inbox-form-grid .span-2{grid-column:1/-1;}
      .tb-inbox-modal-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;}
      @media(max-width:720px){.tb-inbox-form-grid{grid-template-columns:1fr}}
      #tab-inbox{display:inline-flex;align-items:center;gap:7px;}
      .tb-inbox-nav-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 6px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;font-weight:900;line-height:1;box-shadow:0 6px 14px rgba(239,68,68,.22);}
      @media(max-width:720px){.tb-inbox-head{flex-direction:column}.tb-inbox-actions{width:100%}.tb-inbox-actions input{flex:1;min-width:0}.tb-inbox-list{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }


  function setInboxTabBadge(count){
    try{
      const tab = document.getElementById('tab-inbox');
      if(!tab) return;

      let label = tab.querySelector('.tb-inbox-tab-label');
      if(!label){
        const current = String(tab.textContent || '').replace(/\s+/g, ' ').trim() || tr('À traiter', 'Inbox');
        tab.textContent = '';
        label = document.createElement('span');
        label.className = 'tb-inbox-tab-label';
        label.textContent = current.replace(/\s*\d+\s*$/, '') || tr('À traiter', 'Inbox');
        tab.appendChild(label);
      }

      tab.querySelector('.tb-inbox-nav-badge')?.remove();

      const n = Number(count || 0);
      if(n <= 0) return;

      const badge = document.createElement('span');
      badge.className = 'tb-inbox-nav-badge';
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.title = `${n} ${tr('élément(s) à traiter', 'pending item(s)')}`;
      tab.appendChild(badge);
    }catch(e){
      console.warn('[TB][inbox] tab badge render failed', e);
    }
  }

  async function refreshInboxTabBadge(){
    try{
      ensureView();
      const c = client();
      if(!c) return;
      const { count, error } = await c
        .from(TABLE)
        .select('id', { count:'exact', head:true })
        .eq('status', 'pending');
      if(error){
        console.warn('[TB][inbox] tab badge count failed', error);
        return;
      }
      setInboxTabBadge(count || 0);
    }catch(e){
      console.warn('[TB][inbox] tab badge refresh failed', e);
    }
  }

  function ensureView(){
    ensureStyles();
    const tabs = document.querySelector('.tabs') || document.querySelector('nav') || document.getElementById('tabs');
    if(tabs && !document.getElementById('tab-inbox')){
      const tab = document.createElement('div');
      tab.id = 'tab-inbox';
      tab.className = 'tab';
      tab.innerHTML = `<span class="tb-inbox-tab-label">${esc(tr('À traiter', 'Inbox'))}</span>`;
      tab.onclick = () => window.showView ? window.showView('inbox') : renderInbox('tab');
      const ref = document.getElementById('tab-documents') || document.getElementById('tab-transactions') || tabs.lastElementChild;
      if(ref && ref.parentNode === tabs) tabs.insertBefore(tab, ref.nextSibling);
      else tabs.appendChild(tab);
    }

    const existingTab = document.getElementById('tab-inbox');
    if(existingTab && !existingTab.querySelector('.tb-inbox-tab-label')){
      const txt = String(existingTab.textContent || '').replace(/\s+/g, ' ').trim() || tr('À traiter', 'Inbox');
      existingTab.innerHTML = `<span class="tb-inbox-tab-label">${esc(txt)}</span>`;
    }

    if(!document.getElementById('view-inbox')){
      const main = document.querySelector('main') || document.querySelector('.main') || document.querySelector('.content') || document.body;
      const view = document.createElement('div');
      view.id = 'view-inbox';
      view.className = 'hidden';
      view.innerHTML = '<div id="inbox-root" class="card"></div>';
      const docs = document.getElementById('view-documents');
      if(docs && docs.parentNode) docs.parentNode.insertBefore(view, docs.nextSibling);
      else main.appendChild(view);
    }
  }

  async function loadInbox(){
    const c = client();
    if(!c) throw new Error(tr('Client Supabase indisponible.', 'Supabase client unavailable.'));
    CACHE.loading = true;
    CACHE.error = '';
    renderInboxShell();

    let q = c
      .from(TABLE)
      .select('id,user_id,travel_id,source,source_from,source_to,source_message_id,status,raw_text,media_count,media_url,media_content_type,media,storage_path,snoozed_until,deleted_at,target_type,target_id,created_at,processed_at,error_message')
      .order('created_at', { ascending:false })
      .limit(200);

    if(CACHE.status === 'active') q = q.in('status', ['pending', 'snoozed']);
    else if(CACHE.status && CACHE.status !== 'all') q = q.eq('status', CACHE.status);

    const { data, error } = await q;
    if(error) throw error;
    CACHE.items = data || [];
    CACHE.loading = false;
    await hydrateSignedUrls();
    renderInboxShell();
    setInboxTabBadge((CACHE.items || []).filter(x => x.status === 'pending').length);
    refreshInboxTabBadge();
  }

  async function hydrateSignedUrls(){
    const c = client();
    if(!c || !c.storage) return;
    const paths = (CACHE.items || []).map(x => x.storage_path).filter(Boolean);
    for(const path of paths){
      if(CACHE.signedUrls[path]) continue;
      try{
        const { data, error } = await c.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
        if(!error && data?.signedUrl) {
          CACHE.signedUrls[path] = data.signedUrl;
        } else {
          console.warn('[TB][inbox] signed url failed', { path, error });
        }
      }catch(e){
        console.warn('[TB][inbox] signed url failed', { path, error:e });
      }
    }
  }

  function filteredItems(){
    const q = normalizeText(CACHE.search);
    let items = CACHE.items || [];
    if(q){
      items = items.filter(item => normalizeText(`${item.raw_text || ''} ${item.source_from || ''} ${item.media_content_type || ''} ${item.storage_path || ''}`).includes(q));
    }
    return items;
  }

  function renderPreview(item){
    if(!item.storage_path && !item.media_url) return '';

    if(!item.storage_path && item.media_url){
      return `<div class="tb-inbox-preview"><div class="tb-inbox-file">⚠️ ${esc(tr('Document reçu, non copié dans Storage', 'Document received, not copied to Storage'))}</div></div>`;
    }

    const url = item.storage_path ? CACHE.signedUrls[item.storage_path] : '';
    if(!url){
      return `<div class="tb-inbox-preview"><div class="tb-inbox-file">📎 ${esc(item.media_content_type || 'Document')} · ${esc(tr('aperçu indisponible', 'preview unavailable'))}</div></div>`;
    }

    if(isImage(item)) return `<div class="tb-inbox-preview"><a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="${esc(tr('Aperçu document reçu', 'Received document preview'))}" loading="lazy"></a></div>`;
    const icon = isPdf(item) ? '📄' : '📎';
    return `<div class="tb-inbox-preview"><a class="tb-inbox-file" href="${esc(url)}" target="_blank" rel="noopener">${icon} ${esc(item.raw_text || item.storage_path || 'Document')}</a></div>`;
  }

  function renderCard(item){
    const parsed = parseQuickText(item.raw_text);
    const text = String(item.raw_text || '').trim();
    const title = text || (item.media_count ? tr('Document reçu', 'Received document') : tr('Élément reçu', 'Received item'));
    const mediaBadge = item.media_count ? `${item.media_count} doc · ${item.media_content_type || 'media'}` : tr('Texte', 'Text');
    const snoozeInfo = item.status === 'snoozed' && item.snoozed_until ? `<span class="tb-inbox-badge">⏰ ${esc(fmtDateTime(item.snoozed_until))}</span>` : '';

    return `
      <article class="tb-inbox-card" data-id="${esc(item.id)}" data-status="${esc(item.status || 'pending')}">
        <div class="tb-inbox-meta">
          <span class="tb-inbox-badge">${esc(statusLabel(item.status))}</span>
          <span>${esc(fmtDateTime(item.created_at))}</span>
        </div>
        <div class="tb-inbox-text">${esc(title)}</div>
        <div class="tb-inbox-parse">
          <span class="tb-inbox-chip">WhatsApp</span>
          <span class="tb-inbox-chip">${esc(mediaBadge)}</span>
          ${parsed ? `<span class="tb-inbox-chip">${esc(parsed.amount)} ${esc(parsed.currency || '')}</span>` : ''}
          ${parsed?.label ? `<span class="tb-inbox-chip">${esc(parsed.label)}</span>` : ''}
          ${snoozeInfo}
        </div>
        ${renderPreview(item)}
        <div class="tb-inbox-note">${esc(item.source_from || '')}${item.storage_path ? ` · ${esc(tr('Storage OK', 'Storage OK'))}` : (item.media_count ? ` · ${esc(tr('Storage manquant', 'Missing Storage'))}` : '')}</div>
        <div class="tb-inbox-buttons">
          <button class="primary" type="button" data-inbox-action="transaction" data-id="${esc(item.id)}" ${item.status === 'deleted' || item.status === 'processed' ? 'disabled' : ''}>${esc(tr('Créer transaction', 'Create transaction'))}</button>
          <button type="button" data-inbox-action="document" data-id="${esc(item.id)}" ${item.status === 'deleted' || item.status === 'processed' || !item.storage_path ? 'disabled' : ''}>${esc(tr('Classer document', 'File document'))}</button>
          <button type="button" data-inbox-action="link-transaction" data-id="${esc(item.id)}" ${item.status === 'deleted' || item.status === 'processed' || !item.storage_path ? 'disabled' : ''}>${esc(tr('Lier à transaction', 'Link transaction'))}</button>
          <button type="button" disabled title="${esc(tr('En cours de développement', 'Work in progress'))}">${esc(tr('Dépense partagée', 'Shared expense'))}</button>
          <button type="button" data-inbox-action="snooze" data-id="${esc(item.id)}" ${item.status === 'deleted' ? 'disabled' : ''}>${esc(tr('Reporter', 'Snooze'))}</button>
          <button class="danger" type="button" data-inbox-action="delete" data-id="${esc(item.id)}" ${item.status === 'deleted' ? 'disabled' : ''}>${esc(tr('Supprimer', 'Delete'))}</button>
        </div>
      </article>
    `;
  }

  function renderInboxShell(){
    ensureView();
    const el = root();
    if(!el) return;
    const items = filteredItems();
    const pendingCount = (CACHE.items || []).filter(x => x.status === 'pending').length;
    const snoozedCount = (CACHE.items || []).filter(x => x.status === 'snoozed').length;

    el.innerHTML = `
      <section class="tb-inbox-shell">
        <div class="tb-inbox-head">
          <div class="tb-inbox-title">
            <h2>${esc(tr('À traiter', 'Inbox'))}</h2>
            <p>${esc(tr('Messages WhatsApp, reçus, photos et PDF à classer plus tard.', 'WhatsApp messages, receipts, images and PDFs to process later.'))}</p>
          </div>
          <div class="tb-inbox-actions">
            <select id="inbox-status-filter" aria-label="${esc(tr('Statut', 'Status'))}">
              <option value="active" ${CACHE.status==='active'?'selected':''}>${esc(tr('Actifs', 'Active'))}</option>
              <option value="pending" ${CACHE.status==='pending'?'selected':''}>${esc(tr('À traiter', 'Pending'))}</option>
              <option value="snoozed" ${CACHE.status==='snoozed'?'selected':''}>${esc(tr('Reportés', 'Snoozed'))}</option>
              <option value="deleted" ${CACHE.status==='deleted'?'selected':''}>${esc(tr('Supprimés', 'Deleted'))}</option>
              <option value="all" ${CACHE.status==='all'?'selected':''}>${esc(tr('Tous', 'All'))}</option>
            </select>
            <input id="inbox-search" value="${esc(CACHE.search)}" placeholder="${esc(tr('Rechercher...', 'Search...'))}">
            <button type="button" id="inbox-refresh" class="btn">${esc(tr('Actualiser', 'Refresh'))}</button>
          </div>
        </div>
        <div class="tb-inbox-parse">
          <span class="tb-inbox-chip">${pendingCount} ${esc(tr('à traiter', 'pending'))}</span>
          <span class="tb-inbox-chip">${snoozedCount} ${esc(tr('reportés', 'snoozed'))}</span>
        </div>
        ${CACHE.loading ? `<div class="tb-inbox-empty">${esc(tr('Chargement...', 'Loading...'))}</div>` : ''}
        ${CACHE.error ? `<div class="tb-inbox-empty">${esc(CACHE.error)}</div>` : ''}
        ${!CACHE.loading && !CACHE.error && items.length === 0 ? `<div class="tb-inbox-empty">${esc(tr('Aucun élément à traiter.', 'No item to process.'))}</div>` : ''}
        ${!CACHE.loading && !CACHE.error && items.length ? `<div class="tb-inbox-list">${items.map(renderCard).join('')}</div>` : ''}
      </section>
    `;

    const statusEl = document.getElementById('inbox-status-filter');
    if(statusEl) statusEl.onchange = () => { CACHE.status = statusEl.value; loadInbox().catch(showError); };
    const searchEl = document.getElementById('inbox-search');
    if(searchEl) searchEl.oninput = () => { CACHE.search = searchEl.value; renderInboxShell(); };
    const refreshEl = document.getElementById('inbox-refresh');
    if(refreshEl) refreshEl.onclick = () => loadInbox().catch(showError);

    el.querySelectorAll('[data-inbox-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.inboxAction, btn.dataset.id));
    });
  }

  function showError(e){
    CACHE.loading = false;
    CACHE.error = String(e?.message || e || tr('Erreur inbox', 'Inbox error'));
    console.error('[TB][inbox]', e);
    renderInboxShell();
  }

  async function updateItem(id, patch){
    const c = client();
    if(!c) throw new Error(tr('Client Supabase indisponible.', 'Supabase client unavailable.'));
    const { error } = await c.from(TABLE).update(patch).eq('id', id);
    if(error) throw error;
    await loadInbox();
  }

  async function handleAction(action, id){
    if(!id) return;
    try{
      if(action === 'snooze'){
        const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        await updateItem(id, { status:'snoozed', snoozed_until: until });
        return;
      }
      if(action === 'delete'){
        const ok = confirm(tr('Supprimer cet élément de la liste active ?', 'Delete this item from the active list?'));
        if(!ok) return;
        await updateItem(id, { status:'deleted', deleted_at: new Date().toISOString() });
        return;
      }
      const item = (CACHE.items || []).find(x => String(x.id) === String(id));
      if(!item) throw new Error(tr('Élément inbox introuvable.', 'Inbox item not found.'));
      if(action === 'transaction'){
        openTransactionModalForInbox(item);
        return;
      }
      if(action === 'document'){
        await classifyInboxDocument(item);
        return;
      }
      if(action === 'link-transaction'){
        openLinkTransactionModalForInbox(item);
        return;
      }
    }catch(e){ showError(e); }
  }

  function renderInbox(reason){
    ensureView();
    return loadInbox(reason).catch(showError);
  }

  function patchNavigation(){
    ensureView();
    if(window.__tbInboxNavPatched) return;
    window.__tbInboxNavPatched = true;

    const oldSetActive = window.setActiveTab;
    if(typeof oldSetActive === 'function'){
      window.setActiveTab = function(view){
        oldSetActive(view);
        try {
          document.getElementById('tab-inbox')?.classList.toggle('active', view === 'inbox');
          document.getElementById('view-inbox')?.classList.toggle('hidden', view !== 'inbox');
        } catch(_) {}
      };
    }

    const oldShow = window.showView;
    if(typeof oldShow === 'function'){
      window.showView = function(view){
        if(view === 'inbox'){
          try { if(typeof activeView !== 'undefined') activeView = 'inbox'; window.activeView = 'inbox'; } catch(_) {}
          try { if(typeof window.setActiveTab === 'function') window.setActiveTab('inbox'); } catch(_) {}
          renderInbox('navigation');
          return;
        }
        return oldShow(view);
      };
    }

    const oldRenderAll = window.renderAll;
    if(typeof oldRenderAll === 'function'){
      window.renderAll = function(){
        const view = (typeof activeView === 'string' && activeView) ? activeView : window.activeView;
        if(view === 'inbox') return renderInbox('renderAll');
        return oldRenderAll();
      };
    }
  }

  window.renderInbox = renderInbox;
  window.tbInboxRefresh = renderInbox;
  window.refreshInboxTabBadge = refreshInboxTabBadge;

  function boot(){
    patchNavigation();
    try {
      window.tbOnLangChange = window.tbOnLangChange || [];
      window.tbOnLangChange.push(() => {
        try { ensureView(); } catch(_) {}
        try {
          const tabLabel = document.querySelector('#tab-inbox .tb-inbox-tab-label');
          if(tabLabel) tabLabel.textContent = tr('À traiter', 'Inbox');
        } catch(_) {}
        try {
          const view = (typeof activeView === 'string' && activeView) ? activeView : window.activeView;
          if(view === 'inbox') renderInboxShell();
        } catch(_) {}
      });
    } catch(_) {}
    refreshInboxTabBadge();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
