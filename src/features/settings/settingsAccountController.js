function noop() {}

function getValue(box, selector) {
  return box?.querySelector?.(selector)?.value ?? '';
}

function setValue(box, selector, value) {
  const input = box?.querySelector?.(selector);
  if (input) input.value = value ?? '';
}

export function collectLocalAccountData(storage) {
  const values = {};
  if (!storage || typeof storage.length !== 'number') return values;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !/^(travelbudget|tb[_:-])/i.test(key)) continue;
    const raw = storage.getItem(key);
    try { values[key] = JSON.parse(raw); }
    catch (_) { values[key] = raw; }
  }
  return values;
}

export function accountExportFilename(date = new Date()) {
  const isoDate = date.toISOString().slice(0, 10);
  return `travelbudget-account-export-${isoDate}.json`;
}

export function formatDeletionStatus(request, locale = 'fr-FR') {
  if (!request) return '';
  if (request.status === 'cancelled') return 'Demande annulée.';
  if (request.status === 'completed') return 'Compte supprimé.';
  if (request.status === 'failed') return 'La suppression nécessite une intervention du support.';
  if (request.status === 'processing') return 'Suppression en cours.';
  const date = request.execute_after ? new Date(request.execute_after) : null;
  const formatted = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(locale)
    : '';
  return formatted ? `Suppression programmée le ${formatted}.` : 'Suppression programmée.';
}

function downloadJson(documentRef, filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  documentRef.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function normalizeWhatsappPhone(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[().-]/g, '');
}

export function isValidWhatsappPhone(value) {
  const phone = normalizeWhatsappPhone(value);
  return !phone || /^\+[1-9]\d{6,14}$/.test(phone);
}

export function validateSettingsAccountDraft({
  whatsapp = '',
  birthDate = '',
  weightKg = '',
  heightCm = '',
  baseCurrency = '',
  uiMode = '',
  cashflowThreshold = '',
} = {}) {
  const phone = normalizeWhatsappPhone(whatsapp);
  const birth = String(birthDate || '').slice(0, 10);
  const weight = Number(String(weightKg).replace(',', '.'));
  const height = Number(String(heightCm).replace(',', '.'));
  const currency = String(baseCurrency || '').trim().toUpperCase();
  const mode = String(uiMode || '').trim().toLowerCase();
  const threshold = Number(cashflowThreshold);
  if (!isValidWhatsappPhone(phone)) return { ok: false, reason: 'Format WhatsApp invalide.' };
  if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return { ok: false, reason: 'Date de naissance invalide.' };
  if (!Number.isFinite(weight) || weight <= 0) return { ok: false, reason: 'Poids invalide.' };
  if (!Number.isFinite(height) || height < 60) return { ok: false, reason: 'Taille invalide.' };
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, reason: 'Devise invalide (ISO3 attendu).' };
  if (!['simple', 'advanced'].includes(mode)) return { ok: false, reason: 'Mode d’interface invalide.' };
  if (!Number.isFinite(threshold) || threshold <= 0) return { ok: false, reason: 'Seuil invalide.' };
  return { ok: true, reason: '', phone, birthDate: birth, weightKg: weight, heightCm: height, baseCurrency: currency, uiMode: mode, cashflowThreshold: threshold };
}

export function bindSettingsAccountPanel({
  box,
  state = {},
  constants = {},
  thresholdKey,
  currency = 'EUR',
  safeCall = (_label, fn) => fn(),
  getSupabase,
  isOffline = () => false,
  localStorageRef,
  windowRef = globalThis,
  navigatorRef = globalThis.navigator,
  requestRenderAll,
  renderAll = noop,
  syncTabsForRole = noop,
  alertFn = (message) => windowRef?.alert?.(message),
  consoleRef = console,
} = {}) {
  if (!box) return;
  const LS = localStorageRef || windowRef?.localStorage;
  const tableSettings = constants?.TABLES?.settings;
  const tableProfiles = constants?.TABLES?.profiles;
  const birthDateKey = constants?.LS_KEYS?.body_birthdate || 'travelbudget_body_birthdate_v1';
  const bodyWeightKey = constants?.LS_KEYS?.sport_body_weight || 'travelbudget_sport_body_weight_v1';
  const bodyHeightKey = constants?.LS_KEYS?.sport_body_height || 'travelbudget_sport_body_height_v1';
  const uiModeKey = constants?.LS_KEYS?.ui_mode || 'travelbudget_ui_mode_v1';
  const thresholdStorageKey = thresholdKey || constants?.LS_KEYS?.cashflow_threshold_eur || 'travelbudget_cashflow_threshold_eur_v1';

  const render = (reason) => {
    if (typeof requestRenderAll === 'function') requestRenderAll(reason);
    else renderAll();
  };

  const getSb = () => {
    if (typeof getSupabase === 'function') return getSupabase();
    try {
      if (typeof windowRef?._tbSb === 'function') return windowRef._tbSb();
      if (windowRef?.__TB_SB__) return windowRef.__TB_SB__;
      if (windowRef?.sb) return windowRef.sb;
    } catch (_) {}
    throw new Error('Supabase client not found');
  };

  const offline = () => {
    try {
      return !!(typeof isOffline === 'function' ? isOffline() : false)
        || (navigatorRef && navigatorRef.onLine === false);
    } catch (_) {
      return false;
    }
  };

  const cachedAccount = () => {
    const u = windowRef?.sbUser || {};
    return {
      id: u.id || u.user?.id || state?.profile?.id || state?.user?.id || '',
      email: u.email || u.user?.email || state?.profile?.email || state?.user?.email || '',
      whatsapp: state?.profile?.whatsapp_phone_e164 || state?.user?.whatsappPhone || '',
      birthDate: state?.user?.birthDate || (() => { try { return LS?.getItem?.(birthDateKey) || ''; } catch (_) { return ''; } })(),
      bodyWeightKg: state?.user?.bodyWeightKg || (() => { try { return windowRef?.tbReadScopedLocalStorage?.(bodyWeightKey, '') || ''; } catch (_) { return ''; } })(),
      bodyHeightCm: state?.user?.bodyHeightCm || (() => { try { return windowRef?.tbReadScopedLocalStorage?.(bodyHeightKey, '') || ''; } catch (_) { return ''; } })(),
    };
  };

  const fillCachedAccount = () => {
    const cached = cachedAccount();
    setValue(box, '#tb-account-email', cached.email || '—');
    if (!getValue(box, '#tb-account-whatsapp')) setValue(box, '#tb-account-whatsapp', cached.whatsapp || '');
    if (!getValue(box, '#tb-account-birthdate')) setValue(box, '#tb-account-birthdate', String(cached.birthDate || '').slice(0, 10));
    if (!getValue(box, '#tb-account-body-weight')) setValue(box, '#tb-account-body-weight', String(cached.bodyWeightKg || ''));
    if (!getValue(box, '#tb-account-body-height')) setValue(box, '#tb-account-body-height', String(cached.bodyHeightCm || ''));
  };

  const rememberAccount = (user, phone, birthDate) => {
    const uid = user?.id || user?.user?.id || state?.profile?.id || '';
    const email = user?.email || user?.user?.email || state?.profile?.email || state?.user?.email || null;
    state.profile = Object.assign({}, state.profile || {}, { id: uid, email, whatsapp_phone_e164: phone || '' });
    if (!state.user) state.user = {};
    state.user.email = email;
    state.user.whatsappPhone = phone || '';
    const nextBirthDate = birthDate === undefined ? (state.user.birthDate || (() => { try { return LS?.getItem?.(birthDateKey) || ''; } catch (_) { return ''; } })()) : birthDate;
    state.user.birthDate = String(nextBirthDate || '').slice(0, 10);
    try {
      if (state.user.birthDate) LS?.setItem?.(birthDateKey, state.user.birthDate);
      else LS?.removeItem?.(birthDateKey);
    } catch (_) {}
    try { if (typeof windowRef?.tbSaveOfflineSnapshot === 'function') windowRef.tbSaveOfflineSnapshot('settings:account'); } catch (_) {}
  };

  const rememberBodyProfile = (weightKg, heightCm) => {
    if (!state.user) state.user = {};
    const w = Number(weightKg);
    const h = Number(heightCm);
    if (Number.isFinite(w) && w > 0) {
      state.user.bodyWeightKg = w;
      try { windowRef?.tbWriteScopedLocalStorage?.(bodyWeightKey, String(w)); } catch (_) {}
    }
    if (Number.isFinite(h) && h > 0) {
      state.user.bodyHeightCm = h;
      try { windowRef?.tbWriteScopedLocalStorage?.(bodyHeightKey, String(h)); } catch (_) {}
    }
  };

  fillCachedAccount();

  (async () => {
    try {
      if (offline()) {
        fillCachedAccount();
        return;
      }
      const s = getSb();
      const u = (await s.auth.getUser()).data?.user;
      const uid = u?.id;
      if (!uid) return;
      setValue(box, '#tb-account-email', String(u?.email || '—'));

      const safeSettingsQuery = async () => {
        if (!tableSettings) return { data: null, error: null };
        try {
          return await s.from(tableSettings).select('birth_date,body_weight_kg,body_height_cm').eq('user_id', uid).maybeSingle();
        } catch (_) {
          return { data: null, error: null };
        }
      };

      const [{ data, error }, settingsRes] = await Promise.all([
        s.from(tableProfiles).select('whatsapp_phone_e164').eq('id', uid).maybeSingle(),
        safeSettingsQuery(),
      ]);
      if (error) throw error;

      setValue(box, '#tb-account-whatsapp', String(data?.whatsapp_phone_e164 || ''));
      const birthDate = String(settingsRes?.data?.birth_date || '').slice(0, 10);
      if (birthDate) setValue(box, '#tb-account-birthdate', birthDate);
      const bodyWeightKg = Number(settingsRes?.data?.body_weight_kg);
      const bodyHeightCm = Number(settingsRes?.data?.body_height_cm);
      if (Number.isFinite(bodyWeightKg) && bodyWeightKg > 0) setValue(box, '#tb-account-body-weight', String(bodyWeightKg));
      if (Number.isFinite(bodyHeightCm) && bodyHeightCm > 0) setValue(box, '#tb-account-body-height', String(bodyHeightCm));
      rememberAccount(u, data?.whatsapp_phone_e164 || '', birthDate || undefined);
      rememberBodyProfile(bodyWeightKg, bodyHeightCm);
    } catch (e) {
      fillCachedAccount();
      if (!offline() && !/failed to fetch|offline|network/i.test(String(e?.message || e))) {
        consoleRef?.warn?.('[TB][settings] account load failed', e);
      }
    }
  })();

  const saveWhatsapp = async ({ notify = true } = {}) => {
      if (offline()) throw new Error('Mode hors ligne : reconnecte-toi pour enregistrer WhatsApp.');
      const raw = getValue(box, '#tb-account-whatsapp');
      const phone = normalizeWhatsappPhone(raw);
      if (!isValidWhatsappPhone(phone)) {
        throw new Error('Format WhatsApp invalide. Utilise le format international, ex. +33612345678.');
      }
      const s = getSb();
      const u = (await s.auth.getUser()).data?.user;
      const uid = u?.id;
      if (!uid) throw new Error('Non authentifie');
      const { error } = await s.from(tableProfiles).update({ whatsapp_phone_e164: phone || null }).eq('id', uid);
      if (error) throw error;
      setValue(box, '#tb-account-whatsapp', phone);
      rememberAccount(u, phone);
      if (notify) alertFn('Numero WhatsApp enregistre.');
  };
  const btnWhatsapp = box.querySelector('#tb-user-whatsapp-save');
  if (btnWhatsapp) btnWhatsapp.onclick = () => safeCall('Enregistrer numero WhatsApp', () => saveWhatsapp());

  const saveHealthProfile = async ({ notify = true, shouldRender = true } = {}) => {
      if (offline()) throw new Error('Mode hors ligne : reconnecte-toi pour enregistrer le profil santé.');
      const s = getSb();
      const u = (await s.auth.getUser()).data?.user;
      const uid = u?.id;
      if (!uid) throw new Error('Non authentifié');
      const raw = String(getValue(box, '#tb-account-birthdate')).slice(0, 10);
      if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error('Date de naissance invalide.');
      const weightKg = Number(String(getValue(box, '#tb-account-body-weight')).replace(',', '.'));
      const heightCm = Number(String(getValue(box, '#tb-account-body-height')).replace(',', '.'));
      if (!Number.isFinite(weightKg) || weightKg <= 0) throw new Error('Poids invalide.');
      if (!Number.isFinite(heightCm) || heightCm < 60) throw new Error('Taille invalide.');
      const { error } = await s.from(tableSettings).upsert({
        user_id: uid,
        birth_date: raw || null,
        body_weight_kg: Math.round(weightKg * 10) / 10,
        body_height_cm: Math.round(heightCm),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw error;
      rememberAccount(u, state?.profile?.whatsapp_phone_e164 || state?.user?.whatsappPhone || '', raw);
      rememberBodyProfile(weightKg, heightCm);
      if (shouldRender) render('settings:body_profile');
      if (notify) alertFn('Profil santé enregistré.');
  };
  const btnBirthDate = box.querySelector('#tb-user-birthdate-save');
  if (btnBirthDate) btnBirthDate.onclick = () => safeCall('Enregistrer profil santé', () => saveHealthProfile());

  const saveBaseCurrency = async ({ shouldRender = true } = {}) => {
      const s = getSb();
      const value = String(getValue(box, '#tb-user-basecur')).trim().toUpperCase();
      if (!value || !/^[A-Z]{3}$/.test(value)) throw new Error('Devise invalide (ISO3 attendu)');
      const u = (await s.auth.getUser()).data?.user;
      const uid = u?.id;
      if (!uid) throw new Error('Non authentifié');
      const { error } = await s.from(tableSettings).upsert({ user_id: uid, base_currency: value }, { onConflict: 'user_id' });
      if (error) throw error;
      if (!state.user) state.user = {};
      state.user.baseCurrency = value;
      if (shouldRender) render('settings:base_currency');
  };
  const btnSave = box.querySelector('#tb-user-basecur-save');
  if (btnSave) btnSave.onclick = () => safeCall('Enregistrer devise de base', () => saveBaseCurrency());

  const saveUiMode = async ({ shouldRender = true } = {}) => {
      const s = getSb();
      const modeRaw = String(getValue(box, '#tb-user-uimode') || 'advanced').trim().toLowerCase();
      const mode = (typeof windowRef?.tbNormalizeUiMode === 'function') ? windowRef.tbNormalizeUiMode(modeRaw) : (modeRaw === 'simple' ? 'simple' : 'advanced');
      const u = (await s.auth.getUser()).data?.user;
      const uid = u?.id;
      if (!uid) throw new Error('Non authentifié');
      let remoteSaved = false;
      try {
        const { error } = await s.from(tableSettings).upsert({ user_id: uid, ui_mode: mode }, { onConflict: 'user_id' });
        if (error) throw error;
        remoteSaved = true;
      } catch (e) {
        consoleRef?.warn?.('[ui mode] remote save fallback to local only', e?.message || e);
      }
      try { LS?.setItem?.(uiModeKey, mode); } catch (_) {}
      if (!state.user) state.user = {};
      state.user.uiMode = mode;
      try { if (typeof windowRef?.tbApplyUiModeToDocument === 'function') windowRef.tbApplyUiModeToDocument(); } catch (_) {}
      syncTabsForRole();
      if (shouldRender) render(remoteSaved ? 'settings:ui_mode' : 'settings:ui_mode:local');
  };
  const btnMode = box.querySelector('#tb-user-uimode-save');
  if (btnMode) btnMode.onclick = () => safeCall('Enregistrer mode d’interface', () => saveUiMode());

  const btnReset = box.querySelector('#tb-user-resetpwd');
  if (btnReset) {
    btnReset.onclick = () => safeCall('Reset mot de passe', async () => {
      if (offline()) throw new Error("Mode hors ligne : reconnecte-toi pour envoyer l'email de réinitialisation.");
      const s = getSb();
      const u = (await s.auth.getUser()).data?.user;
      const email = String(u?.email || '').trim();
      if (!email) throw new Error('Email introuvable');
      const redirectTo = (typeof windowRef?.tbAuthWebRedirectUrl === 'function') ? windowRef.tbAuthWebRedirectUrl() : `${windowRef.location?.origin || ''}${windowRef.location?.pathname || ''}`;
      await s.auth.resetPasswordForEmail(email, { redirectTo });
      alertFn('Email de réinitialisation envoyé.');
    });
  }

  const deletionStatus = box.querySelector('#tb-user-deletion-status');
  const cancelDeletion = box.querySelector('#tb-user-cancel-deletion');
  const deleteAccount = box.querySelector('#tb-user-delete-account');
  const renderDeletionRequest = (request) => {
    const active = request?.status === 'pending' || request?.status === 'processing';
    if (deletionStatus) deletionStatus.textContent = formatDeletionStatus(request);
    if (cancelDeletion) cancelDeletion.hidden = !active || request?.status !== 'pending';
    if (deleteAccount) deleteAccount.hidden = !!active;
  };

  const invokeDeletion = async (body) => {
    if (offline()) throw new Error('Mode hors ligne : reconnecte-toi pour gérer la suppression du compte.');
    const s = getSb();
    const { data, error } = await s.functions.invoke('request-account-deletion', { body });
    if (error) throw error;
    return data;
  };

  (async () => {
    try {
      if (offline()) return;
      const data = await invokeDeletion({ action: 'status' });
      renderDeletionRequest(data?.request || null);
    } catch (error) {
      if (!/failed to fetch|offline|network/i.test(String(error?.message || error))) {
        consoleRef?.warn?.('[TB][settings] deletion status unavailable', error);
      }
    }
  })();

  const btnExportAll = box.querySelector('#tb-user-export-all');
  if (btnExportAll) {
    btnExportAll.onclick = () => safeCall('Exporter toutes les données', async () => {
      if (offline()) throw new Error("Mode hors ligne : reconnecte-toi pour générer l'export complet.");
      const s = getSb();
      const { data, error } = await s.functions.invoke('export-account-data', { body: {} });
      if (error) throw error;
      const payload = {
        ...data,
        deviceExportedAt: new Date().toISOString(),
        localData: collectLocalAccountData(LS),
      };
      downloadJson(windowRef.document, accountExportFilename(), payload);
      const fileCount = Array.isArray(data?.storageFiles) ? data.storageFiles.length : 0;
      alertFn(
        `Export complet téléchargé.${fileCount
          ? ` Il contient le manifeste de ${fileCount} fichier(s) avec des liens valables 1 heure.`
          : ''}`,
      );
    });
  }

  if (deleteAccount) {
    deleteAccount.onclick = () => safeCall('Demander la suppression du compte', async () => {
      const shouldExport = windowRef.confirm?.(
        "As-tu déjà exporté les données que tu souhaites conserver ?\n\nOK : continuer vers la suppression.\nAnnuler : revenir sans envoyer de demande.",
      );
      if (!shouldExport) return;
      const confirmation = windowRef.prompt?.(
        'Cette action supprimera définitivement le compte et ses données après 7 jours.\nTape SUPPRIMER pour confirmer.',
        '',
      );
      if (confirmation !== 'SUPPRIMER') {
        if (confirmation) alertFn('Confirmation incorrecte. La demande n’a pas été envoyée.');
        return;
      }
      const data = await invokeDeletion({
        action: 'request',
        confirmation,
        requestedFrom: 'app',
        exportRequested: true,
      });
      renderDeletionRequest(data?.request || null);
      alertFn('Demande enregistrée. Tu peux encore l’annuler pendant le délai indiqué.');
    });
  }

  if (cancelDeletion) {
    cancelDeletion.onclick = () => safeCall('Annuler la suppression du compte', async () => {
      if (!windowRef.confirm?.('Annuler la demande de suppression du compte ?')) return;
      const data = await invokeDeletion({ action: 'cancel' });
      renderDeletionRequest(data?.request || { status: 'cancelled' });
      alertFn(data?.cancelled ? 'Demande de suppression annulée.' : 'Aucune demande en attente.');
    });
  }

  const saveCashflowThreshold = async ({ shouldRender = true } = {}) => {
    const value = Number(getValue(box, '#tb-user-cfthr'));
    if (!Number.isFinite(value) || value <= 0) throw new Error('Seuil invalide');
    const eur = (typeof windowRef?.safeFxConvert === 'function')
      ? windowRef.safeFxConvert(value, currency, 'EUR', null)
      : (typeof windowRef?.fxConvert === 'function' ? windowRef.fxConvert(value, currency, 'EUR') : null);
    if (eur === null || !Number.isFinite(eur) || eur <= 0) throw new Error('Conversion FX impossible');
    try { LS?.setItem?.(thresholdStorageKey, String(Math.round(eur))); } catch (_) {}
    if (shouldRender) render('settings:cashflow_threshold');
  };
  const btnThreshold = box.querySelector('#tb-user-cfthr-save');
  if (btnThreshold) btnThreshold.onclick = () => safeCall('Enregistrer seuil trésorerie', () => saveCashflowThreshold());

  const btnAccountSave = box.querySelector('#tb-user-account-save');
  if (btnAccountSave) {
    btnAccountSave.onclick = () => safeCall('Tout enregistrer', async () => {
      const draft = validateSettingsAccountDraft({
        whatsapp: getValue(box, '#tb-account-whatsapp'),
        birthDate: getValue(box, '#tb-account-birthdate'),
        weightKg: getValue(box, '#tb-account-body-weight'),
        heightCm: getValue(box, '#tb-account-body-height'),
        baseCurrency: getValue(box, '#tb-user-basecur'),
        uiMode: getValue(box, '#tb-user-uimode'),
        cashflowThreshold: getValue(box, '#tb-user-cfthr'),
      });
      if (!draft.ok) throw new Error(draft.reason || 'Compte invalide.');
      btnAccountSave.disabled = true;
      try {
        await saveWhatsapp({ notify: false });
        await saveHealthProfile({ notify: false, shouldRender: false });
        await saveBaseCurrency({ shouldRender: false });
        await saveUiMode({ shouldRender: false });
        await saveCashflowThreshold({ shouldRender: false });
        render('settings:account_all');
        alertFn('Compte et préférences enregistrés.');
      } finally {
        btnAccountSave.disabled = false;
      }
    });
  }
}
