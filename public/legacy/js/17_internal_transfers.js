(function () {
  'use strict';

  function t(k, vars) {
    try { return window.tbT ? window.tbT(k, vars) : k; } catch (_) { return k; }
  }
  function txt(fr, en) {
    try { return (typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? en : fr; }
    catch (_) { return fr; }
  }

  function esc(v) {
    try { return escapeHTML(String(v ?? '')); }
    catch (_) {
      return String(v ?? '').replace(/[&<>'"]/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      }[c]));
    }
  }

  function client() {
    try { if (typeof sb !== 'undefined' && sb?.rpc) return sb; } catch (_) {}
    try { if (window.sb?.rpc) return window.sb; } catch (_) {}
    return null;
  }

  function wallets() {
    return Array.isArray(window.state?.wallets) ? window.state.wallets : [];
  }

  function categories() {
    try { return typeof getCategories === 'function' ? getCategories() : []; }
    catch (_) { return []; }
  }

  function subcategories(category) {
    try { return typeof getCategorySubcategories === 'function' ? getCategorySubcategories(category) : []; }
    catch (_) { return []; }
  }

  function todayISO() {
    try { return toLocalISODate(new Date()); }
    catch (_) { return new Date().toISOString().slice(0, 10); }
  }

  function findWallet(id) {
    return wallets().find(w => String(w.id) === String(id)) || null;
  }

  function ensureStyles() {
    if (document.getElementById('tb-internal-transfer-style')) return;
    const st = document.createElement('style');
    st.id = 'tb-internal-transfer-style';
    st.textContent = `
      .tb-it-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:10020;display:flex;align-items:center;justify-content:center;padding:18px;}
      .tb-it-modal{width:min(760px,96vw);max-height:92vh;overflow:auto;border-radius:24px;background:var(--panel,#fff);box-shadow:0 28px 90px rgba(0,0,0,.38);padding:18px;color:var(--text,#111);}
      .tb-it-modal h3{margin:0 0 6px;font-size:22px;}
      .tb-it-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px;}
      .tb-it-grid .field{min-width:0;}
      .tb-it-wide{grid-column:1/-1;}
      .tb-it-preview{margin-top:12px;border:1px solid rgba(148,163,184,.22);border-radius:18px;padding:12px;background:rgba(148,163,184,.08);font-size:13px;line-height:1.45;}
      .tb-it-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:16px;}
      .tb-it-msg{display:none;margin-top:12px;border:1px solid rgba(245,158,11,.35);background:rgba(245,158,11,.12);border-radius:14px;padding:10px;font-weight:700;font-size:13px;}
      @media(max-width:720px){.tb-it-grid{grid-template-columns:1fr;}.tb-it-wide{grid-column:auto;}}
    `;
    document.head.appendChild(st);
  }

  function walletOptions(selectedId) {
    return wallets().map(w => {
      const cur = String(w.currency || '').toUpperCase();
      const sel = String(w.id) === String(selectedId || '') ? ' selected' : '';
      return `<option value="${esc(w.id)}"${sel}>${esc(w.name || 'Wallet')} (${esc(cur)})</option>`;
    }).join('');
  }

  function categoryOptions(selected) {
  const cats = categories();
  const wanted = String(selected || '').trim().toLowerCase();

  return cats.map(c => {
    const sel = String(c || '').trim().toLowerCase() === wanted ? ' selected' : '';
    return `<option value="${esc(c)}"${sel}>${esc(c)}</option>`;
  }).join('');
}

function pickDefaultCategory(name, fallback) {
  const cats = categories();
  const wanted = String(name || '').trim().toLowerCase();
  const fb = String(fallback || '').trim().toLowerCase();

  return (
    cats.find(c => String(c || '').trim().toLowerCase() === wanted)
    || cats.find(c => String(c || '').trim().toLowerCase() === fb)
    || cats[0]
    || fallback
    || 'Autre'
  );
}

  function subcategoryOptions(category, selected) {
    const rows = subcategories(category);
    const out = [`<option value="">${esc(txt('Aucune', 'None'))}</option>`];
    rows.forEach(row => {
      const name = String(row?.name || '').trim();
      if (!name) return;
      const sel = name === String(selected || '') ? ' selected' : '';
      out.push(`<option value="${esc(name)}"${sel}>${esc(name)}</option>`);
    });
    return out.join('');
  }

  function setMessage(msg) {
    const el = document.getElementById('tb-it-msg');
    if (!el) return;
    el.textContent = String(msg || '');
    el.style.display = msg ? 'block' : 'none';
  }

  function refreshSubcategories() {
    const cat = document.getElementById('tb-it-category')?.value || '';
    const sub = document.getElementById('tb-it-subcategory');
    if (sub) sub.innerHTML = subcategoryOptions(cat, sub.value);
    refreshPreview();
  }

  function refreshPreview() {
    const fromId = document.getElementById('tb-it-from-wallet')?.value || '';
    const toId = document.getElementById('tb-it-to-wallet')?.value || '';
    const fromAmount = Number(document.getElementById('tb-it-from-amount')?.value || 0);
    const toAmount = Number(document.getElementById('tb-it-to-amount')?.value || 0);
    const fee = !!document.getElementById('tb-it-create-fee')?.checked;

    const fromW = findWallet(fromId);
    const toW = findWallet(toId);
    const box = document.getElementById('tb-it-preview');
    if (!box) return;

    box.innerHTML = `
      <strong>${esc(txt('Aperçu', 'Preview'))}</strong><br>
      1. ${esc(txt('Sortie wallet', 'Wallet out'))} : ${esc(fromW?.name || txt('Wallet source', 'Source wallet'))} — ${fromAmount || 0} ${esc(fromW?.currency || '')}, ${esc(txt('hors budget, impact wallet.', 'out of budget, wallet impact.'))}<br>
      2. ${esc(txt('Entrée wallet', 'Wallet in'))} : ${esc(toW?.name || txt('Wallet destination', 'Destination wallet'))} — ${toAmount || 0} ${esc(toW?.currency || '')}, ${esc(txt('hors budget, impact wallet.', 'out of budget, wallet impact.'))}<br>
      3. ${esc(txt('Frais estimés', 'Estimated fee'))} : ${esc(fee ? txt('créés automatiquement si écart positif, inclus budget, sans impact wallet.', 'created automatically when the difference is positive, included in budget, no wallet impact.') : txt('désactivés.', 'disabled.'))}
    `;
  }

  function closeModal() {
    document.getElementById('tb-internal-transfer-modal')?.remove();
  }

  async function saveTransfer() {
    setMessage('');

    const c = client();
    if (!c) {
      setMessage(txt('Supabase indisponible.', 'Supabase unavailable.'));
      return;
    }

const fromW = findWallet(document.getElementById('tb-it-from-wallet')?.value || '');
const toW = findWallet(document.getElementById('tb-it-to-wallet')?.value || '');

const feeFxRate = (
  fromW && toW && String(fromW.currency || '').toUpperCase() !== String(toW.currency || '').toUpperCase()
    && typeof window.fxRate === 'function'
)
  ? window.fxRate(
      String(toW.currency || '').toUpperCase(),
      String(fromW.currency || '').toUpperCase()
    )
  : null;

    const payload = {
      p_from_wallet_id: document.getElementById('tb-it-from-wallet')?.value || null,
      p_to_wallet_id: document.getElementById('tb-it-to-wallet')?.value || null,
      p_from_amount: Number(document.getElementById('tb-it-from-amount')?.value || 0),
      p_to_amount: Number(document.getElementById('tb-it-to-amount')?.value || 0),
      p_transfer_date: document.getElementById('tb-it-date')?.value || todayISO(),
      p_category: document.getElementById('tb-it-category')?.value || '',
      p_subcategory: document.getElementById('tb-it-subcategory')?.value || null,
      p_label: document.getElementById('tb-it-label')?.value || t('transactions.action.internal_transfer'),
      p_note: document.getElementById('tb-it-note')?.value || null,
      p_create_fee: !!document.getElementById('tb-it-create-fee')?.checked,
      p_fee_category: document.getElementById('tb-it-fee-category')?.value || 'Frais bancaires',
      p_fee_subcategory: document.getElementById('tb-it-fee-subcategory')?.value || 'Change / transfert',
      p_fee_fx_rate: feeFxRate,
      p_fee_fx_source: feeFxRate ? 'frontend_fxRate' : null,
    };

    if (!payload.p_from_wallet_id || !payload.p_to_wallet_id) return setMessage(txt('Choisis les deux wallets.', 'Choose both wallets.'));
    if (payload.p_from_wallet_id === payload.p_to_wallet_id) return setMessage(txt('Les deux wallets doivent être différents.', 'The two wallets must be different.'));
    if (!(payload.p_from_amount > 0) || !(payload.p_to_amount > 0)) return setMessage(txt('Les deux montants doivent être positifs.', 'Both amounts must be positive.'));
    if (!payload.p_category) return setMessage(txt('Choisis une catégorie.', 'Choose a category.'));

    const btn = document.getElementById('tb-it-save');
    if (btn) btn.disabled = true;

    try {
      const { error } = await c.rpc('create_wallet_transfer_v1', payload);
      if (error) throw error;

      closeModal();

      if (typeof window.tbAfterMutationRefresh === 'function') {
        await window.tbAfterMutationRefresh('wallet_transfer:create');
      } else if (typeof refreshFromServer === 'function') {
        await refreshFromServer();
      }

      if (typeof renderTransactions === 'function') renderTransactions();
      if (typeof renderAll === 'function') renderAll();
    } catch (e) {
      const msg = typeof normalizeSbError === 'function'
        ? normalizeSbError(e)
        : (e?.message || String(e));
      console.warn('[TB][internal-transfer]', e);
      setMessage(msg);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  window.tbOpenInternalTransferModal = function tbOpenInternalTransferModal() {
    ensureStyles();

    const ws = wallets();
    if (ws.length < 2) {
      alert(txt('Il faut au moins deux wallets pour créer un mouvement interne.', 'You need at least two wallets to create an internal transfer.'));
      return;
    }

    const defaultTransferCategory = pickDefaultCategory('Mouvement interne', 'Autre');
    const defaultFeeCategory = pickDefaultCategory('Frais Bancaire', 'Frais bancaires');
    const defaultFeeSubcategory = 'Frais Bancaire';
    const fromId = ws[0]?.id || '';
    const toId = ws.find(w => String(w.id) !== String(fromId))?.id || ws[1]?.id || '';

    const wrap = document.createElement('div');
    wrap.id = 'tb-internal-transfer-modal';
    wrap.className = 'tb-it-backdrop';
    wrap.onclick = (e) => { if (e.target === wrap) closeModal(); };

    wrap.innerHTML = `
      <div class="tb-it-modal" role="dialog" aria-modal="true">
        <h3>↔ ${esc(t('transactions.action.internal_transfer'))}</h3>
        <div class="muted">
          ${esc(txt('Crée automatiquement une sortie wallet, une entrée wallet, et une ligne de frais estimés optionnelle.', 'Automatically creates a wallet out transaction, a wallet in transaction, and an optional estimated fee line.'))}
        </div>

        <div class="tb-it-grid">
          <div class="field">
            <label>${esc(txt('Wallet source', 'Source wallet'))}</label>
            <select id="tb-it-from-wallet">${walletOptions(fromId)}</select>
          </div>

          <div class="field">
            <label>${esc(txt('Wallet destination', 'Destination wallet'))}</label>
            <select id="tb-it-to-wallet">${walletOptions(toId)}</select>
          </div>

          <div class="field">
            <label>${esc(txt('Montant sorti', 'Amount sent'))}</label>
            <input id="tb-it-from-amount" type="number" step="0.01" min="0" placeholder="0.00" />
          </div>

          <div class="field">
            <label>${esc(txt('Montant reçu', 'Amount received'))}</label>
            <input id="tb-it-to-amount" type="number" step="0.01" min="0" placeholder="0.00" />
          </div>

          <div class="field">
            <label>${esc(txt('Date', 'Date'))}</label>
            <input id="tb-it-date" type="date" value="${esc(todayISO())}" />
          </div>

          <div class="field">
            <label>${esc(txt('Catégorie', 'Category'))}</label>
            <select id="tb-it-category">${categoryOptions(defaultTransferCategory)}</select>
          </div>

          <div class="field">
            <label>${esc(txt('Sous-catégorie', 'Subcategory'))}</label>
            <select id="tb-it-subcategory">${subcategoryOptions(defaultTransferCategory, '')}</select>
          </div>

          <div class="field">
            <label>${esc(txt('Créer frais estimés', 'Create estimated fee'))}</label>
            <input id="tb-it-create-fee" type="checkbox" checked />
          </div>

          <div class="field">
            <label>${esc(txt('Catégorie frais', 'Fee category'))}</label>
            <select id="tb-it-fee-category">${categoryOptions(defaultFeeCategory)}</select>
          </div>

          <div class="field">
            <label>${esc(txt('Sous-catégorie frais', 'Fee subcategory'))}</label>
            <select id="tb-it-fee-subcategory">${subcategoryOptions(defaultFeeCategory, defaultFeeSubcategory)}</select>
          </div>

          <div class="field tb-it-wide">
            <label>${esc(txt('Libellé', 'Label'))}</label>
            <input id="tb-it-label" type="text" value="${esc(t('transactions.action.internal_transfer'))}" />
          </div>

          <div class="field tb-it-wide">
            <label>${esc(txt('Note', 'Note'))}</label>
            <input id="tb-it-note" type="text" placeholder="${esc(txt('Optionnel', 'Optional'))}" />
          </div>
        </div>

        <div id="tb-it-preview" class="tb-it-preview"></div>
        <div id="tb-it-msg" class="tb-it-msg"></div>

        <div class="tb-it-actions">
          <button class="btn" type="button" id="tb-it-cancel">${esc(txt('Annuler', 'Cancel'))}</button>
          <button class="btn primary" type="button" id="tb-it-save">${esc(txt('Créer le mouvement', 'Create transfer'))}</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    [
      'tb-it-from-wallet',
      'tb-it-to-wallet',
      'tb-it-from-amount',
      'tb-it-to-amount',
      'tb-it-create-fee'
    ].forEach(id => {
      document.getElementById(id)?.addEventListener('input', refreshPreview);
      document.getElementById(id)?.addEventListener('change', refreshPreview);
    });

    document.getElementById('tb-it-category')?.addEventListener('change', refreshSubcategories);
    document.getElementById('tb-it-fee-category')?.addEventListener('change', () => {
  const cat = document.getElementById('tb-it-fee-category')?.value || '';
  const sub = document.getElementById('tb-it-fee-subcategory');
  if (sub) sub.innerHTML = subcategoryOptions(cat, sub.value);
});
    document.getElementById('tb-it-cancel')?.addEventListener('click', closeModal);
    document.getElementById('tb-it-save')?.addEventListener('click', saveTransfer);

    refreshPreview();
  };

  window.openInternalTransferModal = function openInternalTransferModal() {
    return window.tbOpenInternalTransferModal();
  };

  window.TBInternalTransfers = {
    isInternalTransferTx(tx) {
      return !!(tx?.internal_transfer_id || tx?.internalTransferId);
    },
    getInternalTransferLabel(tx) {
      return tx?.label || t('transactions.action.internal_transfer');
    }
  };

window.deleteInternalTransfer = async function deleteInternalTransfer(transferId) {
  const id = String(transferId || '').trim();
  if (!id) return;

  if (!confirm(txt('Supprimer ce mouvement interne ? Cela supprimera la sortie, l’entrée et les frais estimés liés.', 'Delete this internal transfer? It will delete the outgoing, incoming and linked estimated fee transactions.'))) return;

  const c = client();
  if (!c) return alert(txt('Supabase indisponible.', 'Supabase unavailable.'));

  try {
    const { error } = await c.rpc('delete_wallet_transfer_v1', {
      p_transfer_id: id
    });
    if (error) throw error;

    if (typeof window.tbAfterMutationRefresh === 'function') {
      await window.tbAfterMutationRefresh('wallet_transfer:delete');
    } else if (typeof refreshFromServer === 'function') {
      await refreshFromServer();
    }

    if (typeof renderTransactions === 'function') renderTransactions();
    if (typeof renderAll === 'function') renderAll();
  } catch (e) {
    const msg = typeof normalizeSbError === 'function'
      ? normalizeSbError(e)
      : (e?.message || String(e));
    alert(msg);
  }
};

})();
