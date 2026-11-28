async function readGuidedAccount(sb, tables, accountId) {
  const auth = await sb.auth.getUser();
  const user = auth.data?.user;
  if (auth.error || !accountId || user?.id !== accountId) throw new Error('Session modifiée. Reconnecte-toi.');
  const [prefs, profile] = await Promise.all([
    sb.from(tables.settings).select('base_currency,birth_date').eq('user_id', accountId).single(),
    sb.from(tables.profiles).select('whatsapp_phone_e164').eq('id', accountId).single(),
  ]);
  if (prefs.error || profile.error || !prefs.data || !profile.data) throw new Error('Réglages indisponibles. Réessaie en ligne.');
  return {
    email: user.email || '',
    baseCurrency: String(prefs.data.base_currency || 'EUR').toUpperCase(),
    birthDate: prefs.data.birth_date || '',
    phone: profile.data.whatsapp_phone_e164 || '',
  };
}

async function saveGuidedAccount(sb, tables, accountId, initial, draft) {
  const baseCurrency = String(draft.baseCurrency || '').toUpperCase();
  const birthDate = draft.birthDate || '';
  const phone = String(draft.phone || '').trim().replace(/[\s().-]/g, '');
  const today = new Date();
  const cutoff = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? new Date(birthDate + 'T00:00:00Z') : null;
  if (!/^[A-Z]{3}$/.test(baseCurrency) || (phone && !/^\+[1-9]\d{6,14}$/.test(phone))
    || (birthDate && (!iso || !Number.isFinite(+iso) || iso.toISOString().slice(0, 10) !== birthDate || birthDate > cutoff))) {
    throw new Error('Vérifie la devise, le format international du numéro et la date de naissance.');
  }
  const current = await readGuidedAccount(sb, tables, accountId);
  if (['baseCurrency', 'birthDate', 'phone'].some(key => current[key] !== initial[key])) {
    throw new Error('Les réglages ont changé. Relance le guide pour revoir les valeurs actuelles.');
  }
  const update = {};
  if (baseCurrency !== current.baseCurrency) update.base_currency = baseCurrency;
  if (birthDate !== current.birthDate) update.birth_date = birthDate || null;
  const changed = Object.keys(update).length > 0;
  if (changed) {
    const result = await sb.from(tables.settings).update(update).eq('user_id', accountId).select('base_currency,birth_date').single();
    if (result.error || !result.data) throw new Error('Les préférences n’ont pas pu être confirmées. Relance le guide avant de réessayer.');
  }
  if (phone !== current.phone) {
    const result = await sb.from(tables.profiles).update({ whatsapp_phone_e164: phone || null }).eq('id', accountId).select('whatsapp_phone_e164').single();
    if (result.error || !result.data) throw new Error('Le numéro n’a pas pu être confirmé. Les préférences précédentes ont peut-être été enregistrées.');
  }
  const verified = changed || phone !== current.phone ? await readGuidedAccount(sb, tables, accountId) : current;
  if (verified.baseCurrency !== baseCurrency || verified.birthDate !== birthDate || verified.phone !== phone) {
    throw new Error('Les valeurs enregistrées n’ont pas pu être confirmées. Relance le guide.');
  }
  return verified;
}

export async function openGuidedAccount({ uid, getUid, sb, tables, currencies, onSave, canOpenTravels, openTravels }) {
  if (!uid || getUid() !== uid || document.querySelector('.tb-guided-account')) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'card tb-guided-account';
  dialog.setAttribute('aria-labelledby', 'tb-guided-account-title');
  dialog.innerHTML = `
    <h2 id="tb-guided-account-title">1 sur 2 · Ton compte</h2>
    <p>Ces réglages s’appliquent à ton vrai compte. Tes voyages, wallets et transactions restent intacts.</p>
    <form hidden>
      <label class="field">E-mail de connexion<input name="email" type="email" readonly></label>
      <label class="field">Devise de base du compte<select name="currency" required></select></label>
      <p class="muted">Cette devise sert à lire le compte, indépendamment des devises de tes voyages.</p>
      <label class="field">WhatsApp (facultatif)<input name="phone" type="tel" placeholder="+ suivi de l’indicatif"></label>
      <label class="field">Date de naissance (facultatif)<input name="birth" type="date"></label>
      <button class="btn primary" type="submit">Enregistrer sur mon compte</button>
    </form>
    <p data-setup-status role="status">Chargement de tes réglages…</p>
    <button class="btn" type="button" data-setup-close>Fermer</button>`;
  document.body.append(dialog);
  const status = dialog.querySelector('[data-setup-status]');
  const form = dialog.querySelector('form');
  const close = dialog.querySelector('[data-setup-close]');
  close.onclick = () => dialog.close();
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
  try {
    const initial = await readGuidedAccount(sb, tables, uid);
    if (!dialog.isConnected || getUid() !== uid) return;
    form.elements.email.value = initial.email;
    form.elements.phone.value = initial.phone;
    form.elements.birth.value = initial.birthDate;
    const currency = form.elements.currency;
    for (const code of new Set([initial.baseCurrency, ...(currencies || ['EUR', 'AUD', 'NZD', 'USD'])])) {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = code;
      currency.append(option);
    }
    currency.value = initial.baseCurrency;
    form.hidden = false;
    status.textContent = '';
    let saving = false;
    dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (saving || getUid() !== uid) return;
      const submit = form.querySelector('button[type="submit"]');
      saving = close.disabled = submit.disabled = true;
      status.textContent = 'Enregistrement…';
      try {
        const saved = await saveGuidedAccount(sb, tables, uid, initial, {
          baseCurrency: currency.value, birthDate: form.elements.birth.value, phone: form.elements.phone.value,
        });
        if (!dialog.isConnected || getUid() !== uid) return;
        onSave(saved);
        status.remove();
        form.remove();
        close.textContent = 'Terminer';
        if (!canOpenTravels()) {
          dialog.querySelector('h2').textContent = 'Ton compte est configuré';
          dialog.querySelector('p').textContent = 'Tes réglages ont été confirmés. Les exemples du tuto ne sont pas copiés.';
          close.focus();
          return;
        }
        dialog.querySelector('h2').textContent = '2 sur 2 · Tes voyages';
        dialog.querySelector('p').textContent = 'Tes réglages ont été confirmés. Tu peux ouvrir tes voyages et périodes, ou créer volontairement un nouveau voyage. Les exemples du tuto ne sont pas copiés.';
        const travel = document.createElement('button');
        travel.className = 'btn primary';
        travel.type = 'button';
        travel.textContent = 'Voir voyages et périodes';
        travel.onclick = () => {
          dialog.close();
          openTravels();
        };
        close.before(travel);
        travel.focus();
      } catch (error) {
        status.textContent = error?.message || 'Impossible de confirmer l’enregistrement.';
      } finally {
        saving = close.disabled = submit.disabled = false;
      }
    };
  } catch (error) {
    status.textContent = error?.message || 'Réglages indisponibles.';
  }
}
