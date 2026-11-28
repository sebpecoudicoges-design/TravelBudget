const errors = {
  session: ["Session modifiée. Reconnecte-toi.", "Your session changed. Sign in again."],
  offline: ["Réglages indisponibles. Réessaie en ligne.", "Settings are unavailable. Try again when online."],
  invalid: ["Vérifie la devise, le format international du numéro et la date de naissance.", "Check the currency, international phone number and date of birth."],
  stale: ["Les réglages ont changé. Relance le guide pour revoir les valeurs actuelles.", "These settings changed. Restart the guide to review the current values."],
  prefs: ["Les préférences n’ont pas pu être confirmées. Relance le guide avant de réessayer.", "Your preferences could not be confirmed. Restart the guide before trying again."],
  phone: ["Le numéro n’a pas pu être confirmé. Les préférences précédentes ont peut-être été enregistrées.", "The number could not be confirmed. Your other preferences may already be saved."],
  verify: ["Les valeurs enregistrées n’ont pas pu être confirmées. Relance le guide.", "The saved values could not be confirmed. Restart the guide."],
  unknown: ["Réglages non confirmés. Réessaie.", "Settings could not be confirmed. Try again."],
};

async function readGuidedAccount(sb, tables, accountId) {
  const auth = await sb.auth.getUser();
  const user = auth.data?.user;
  if (auth.error || !accountId || user?.id !== accountId) throw new Error('session');
  const [prefs, profile] = await Promise.all([
    sb.from(tables.settings).select('base_currency,birth_date').eq('user_id', accountId).single(),
    sb.from(tables.profiles).select('whatsapp_phone_e164').eq('id', accountId).single(),
  ]);
  if (prefs.error || profile.error || !prefs.data || !profile.data) throw new Error('offline');
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
    throw new Error('invalid');
  }
  const current = await readGuidedAccount(sb, tables, accountId);
  if (['baseCurrency', 'birthDate', 'phone'].some(key => current[key] !== initial[key])) {
    throw new Error('stale');
  }
  const update = {};
  if (baseCurrency !== current.baseCurrency) update.base_currency = baseCurrency;
  if (birthDate !== current.birthDate) update.birth_date = birthDate || null;
  const changed = Object.keys(update).length > 0;
  if (changed) {
    const result = await sb.from(tables.settings).update(update).eq('user_id', accountId).select('base_currency,birth_date').single();
    if (result.error || !result.data) throw new Error('prefs');
  }
  if (phone !== current.phone) {
    const result = await sb.from(tables.profiles).update({ whatsapp_phone_e164: phone || null }).eq('id', accountId).select('whatsapp_phone_e164').single();
    if (result.error || !result.data) throw new Error('phone');
  }
  const verified = changed || phone !== current.phone ? await readGuidedAccount(sb, tables, accountId) : current;
  if (verified.baseCurrency !== baseCurrency || verified.birthDate !== birthDate || verified.phone !== phone) {
    throw new Error('verify');
  }
  return verified;
}

export async function openGuidedAccount({ uid, getUid, sb, tables, currencies, onSave, canOpenTravels, openTravels, language }) {
  if (!uid || getUid() !== uid || document.querySelector('.tb-guided-account')) return;
  const english = language === 'en';
  const t = (fr, en) => english ? en : fr;
  const message = error => (Object.hasOwn(errors, error?.message) ? errors[error.message] : errors.unknown)[english ? 1 : 0];
  const dialog = document.createElement('dialog');
  dialog.className = 'card tb-guided-account';
  dialog.setAttribute('aria-labelledby', 'tb-guided-account-title');
  dialog.innerHTML = `
    <h2 id="tb-guided-account-title">${canOpenTravels() ? t("1 sur 2 · Ton compte", "1 of 2 · Your account") : t("Ton compte", "Your account")}</h2>
    <p>${t("Ces réglages s’appliquent à ton vrai compte. Tes voyages, wallets et transactions restent intacts.", "These settings apply to your real account. Your trips, wallets and transactions stay intact.")}</p>
    <form hidden>
      <label class="field">${t("E-mail de connexion", "Sign-in email")}<input name="email" type="email" readonly></label>
      <label class="field">${t("Devise de base du compte", "Account base currency")}<select name="currency" required></select></label>
      <p class="muted">${t("Cette devise sert à lire le compte, indépendamment des devises de tes voyages.", "This is the display currency for your account, independent of your trip currencies.")}</p>
      <label class="field">${t("WhatsApp (facultatif)", "WhatsApp (optional)")}<input name="phone" type="tel" placeholder="${t("+ suivi de l’indicatif", "+ followed by the country code")}"></label>
      <label class="field">${t("Date de naissance (facultatif)", "Date of birth (optional)")}<input name="birth" type="date"></label>
      <button class="btn primary" type="submit">${t("Enregistrer sur mon compte", "Save to my account")}</button>
    </form>
    <p data-setup-status role="status">${t("Chargement de tes réglages…", "Loading your settings…")}</p>
    <button class="btn" type="button" data-setup-close>${t("Fermer", "Close")}</button>`;
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
      status.textContent = t("Enregistrement…", "Saving…");
      try {
        const saved = await saveGuidedAccount(sb, tables, uid, initial, {
          baseCurrency: currency.value, birthDate: form.elements.birth.value, phone: form.elements.phone.value,
        });
        if (!dialog.isConnected || getUid() !== uid) return;
        onSave(saved);
        status.remove();
        form.remove();
        close.textContent = t("Terminer", "Done");
        if (!canOpenTravels()) {
          dialog.querySelector('h2').textContent = t("Ton compte est configuré", "Your account is set up");
          dialog.querySelector('p').textContent = t("Tes réglages ont été confirmés. Les exemples du tuto ne sont pas copiés.", "Your settings are confirmed. Tutorial examples were not copied.");
          close.focus();
          return;
        }
        dialog.querySelector('h2').textContent = t("2 sur 2 · Tes voyages", "2 of 2 · Your trips");
        dialog.querySelector('p').textContent = t("Tes réglages ont été confirmés. Tu peux ouvrir tes voyages et périodes, ou créer volontairement un nouveau voyage. Les exemples du tuto ne sont pas copiés.", "Your settings are confirmed. You can view your trips and periods or choose to create a new trip. Tutorial examples were not copied.");
        const travel = document.createElement('button');
        travel.className = 'btn primary';
        travel.type = 'button';
        travel.textContent = t("Voir voyages et périodes", "View trips and periods");
        travel.onclick = () => {
          dialog.close();
          openTravels();
        };
        close.before(travel);
        travel.focus();
      } catch (error) {
        status.textContent = message(error);
      } finally {
        saving = close.disabled = submit.disabled = false;
      }
    };
  } catch (error) {
    status.textContent = message(error);
  }
}
