function noop() {}

function getValue(box, selector) {
  return box?.querySelector?.(selector)?.value ?? '';
}

function setValue(box, selector, value) {
  const input = box?.querySelector?.(selector);
  if (input) input.value = value ?? '';
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

export function buildSettingsNotificationPrefs({
  box,
  notificationPrefs = {},
  timezone = '',
} = {}) {
  const prefs = notificationPrefs || {};
  return {
    inbox: prefs.inbox !== false,
    trip: prefs.trip !== false,
    lowBudget: prefs.lowBudget !== false,
    localDevice: true,
    serverPush: true,
    emojis: prefs.emojis !== false,
    motivationalTone: true,
    sportReminder: true,
    workReminder: true,
    healthMealReminders: box?.querySelector?.('#tb-notif-health')?.checked === true,
    morningBudget: true,
    eveningSummary: true,
    dailyBudget: true,
    timezone,
  };
}

export function bindSettingsAccountPanel({
  box,
  state = {},
  constants = {},
  thresholdKey,
  currency = 'EUR',
  notificationPrefs = {},
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
  const notifPrefsKey = constants?.LS_KEYS?.notification_prefs || 'travelbudget_notification_prefs_v1';
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

  const btnWhatsapp = box.querySelector('#tb-user-whatsapp-save');
  if (btnWhatsapp) {
    btnWhatsapp.onclick = () => safeCall('Enregistrer numero WhatsApp', async () => {
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
      alertFn('Numero WhatsApp enregistre.');
    });
  }

  const btnBirthDate = box.querySelector('#tb-user-birthdate-save');
  if (btnBirthDate) {
    btnBirthDate.onclick = () => safeCall('Enregistrer profil santé', async () => {
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
      render('settings:body_profile');
      alertFn('Profil santé enregistré.');
    });
  }

  const btnSave = box.querySelector('#tb-user-basecur-save');
  if (btnSave) {
    btnSave.onclick = () => safeCall('Enregistrer devise de base', async () => {
      const s = getSb();
      const value = String(getValue(box, '#tb-user-basecur')).trim().toUpperCase();
      if (!value || !/^[A-Z]{3}$/.test(value)) throw new Error('Devise invalide (ISO3 attendu)');
      const u = (await s.auth.getUser()).data?.user;
      const uid = u?.id;
      if (!uid) throw new Error('Non authentifié');
      await s.from(tableSettings).upsert({ user_id: uid, base_currency: value }, { onConflict: 'user_id' });
      if (!state.user) state.user = {};
      state.user.baseCurrency = value;
      render('settings:base_currency');
    });
  }

  const btnMode = box.querySelector('#tb-user-uimode-save');
  if (btnMode) {
    btnMode.onclick = () => safeCall('Enregistrer mode d’interface', async () => {
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
      render(remoteSaved ? 'settings:ui_mode' : 'settings:ui_mode:local');
    });
  }

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

  const readNotificationForm = () => buildSettingsNotificationPrefs({
    box,
    notificationPrefs,
    timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { return ''; } })(),
  });

  const btnNotifSave = box.querySelector('#tb-notif-save');
  if (btnNotifSave) {
    btnNotifSave.onclick = () => safeCall('Enregistrer notifications', async () => {
      const prefs = readNotificationForm();
      if (prefs.localDevice && typeof windowRef?.tbRequestLocalNotificationPermission === 'function') {
        const permission = await windowRef.tbRequestLocalNotificationPermission();
        if (permission === 'denied') throw new Error('Notifications refusées par le téléphone/navigateur.');
      }
      if (typeof windowRef?.tbSaveNotificationPrefs === 'function') await windowRef.tbSaveNotificationPrefs(prefs);
      else {
        if (!state.user) state.user = {};
        state.user.notificationPrefs = prefs;
        try { LS?.setItem?.(notifPrefsKey, JSON.stringify(prefs)); } catch (_) {}
      }
      if (prefs.dailyBudget && prefs.localDevice && typeof windowRef?.tbScheduleDailyBudgetLocalNotification === 'function') {
        await windowRef.tbScheduleDailyBudgetLocalNotification();
      }
      if (prefs.healthMealReminders && prefs.localDevice && typeof windowRef?.tbScheduleHealthMealLocalNotifications === 'function') {
        await windowRef.tbScheduleHealthMealLocalNotifications();
      }
      alertFn('Préférences notifications enregistrées.');
    });
  }

  const btnNotifManager = box.querySelector('#tb-notif-open-manager');
  if (btnNotifManager) {
    btnNotifManager.onclick = () => {
      try { if (typeof windowRef?.showView === 'function') windowRef.showView('notifications'); } catch (_) {}
    };
  }

  const btnNotifTest = box.querySelector('#tb-notif-test');
  if (btnNotifTest) {
    btnNotifTest.onclick = () => safeCall('Tester notification', async () => {
      const prefs = readNotificationForm();
      if (typeof windowRef?.tbSaveNotificationPrefs === 'function') await windowRef.tbSaveNotificationPrefs(prefs);
      else if (typeof windowRef?.tbRememberNotificationPrefs === 'function') windowRef.tbRememberNotificationPrefs(prefs);
      const msg = (typeof windowRef?.tbTriggerDailyBudgetNotificationTest === 'function') ? await windowRef.tbTriggerDailyBudgetNotificationTest() : null;
      const status = box.querySelector('#tb-notif-test-status');
      if (status) status.textContent = msg?.localDelivered
        ? "Test envoyé. Dis-moi ensuite si tu l'as reçue."
        : "Test ajouté au centre de notifications. Si rien n'apparait sur mobile, vérifie l'autorisation Android.";
    });
  }

  [
    ['#tb-notif-test-yes', 'Parfait, le téléphone reçoit bien les notifications.'],
    ['#tb-notif-test-no', "Noté. On vérifiera l'autorisation Android, le token mobile et l'envoi serveur."],
  ].forEach(([selector, message]) => {
    const btn = box.querySelector(selector);
    if (!btn) return;
    btn.onclick = () => {
      try { LS?.setItem?.('travelbudget_notification_last_test_v1', JSON.stringify({ selector, at: new Date().toISOString() })); } catch (_) {}
      const status = box.querySelector('#tb-notif-test-status');
      if (status) status.textContent = message;
    };
  });

  const btnThreshold = box.querySelector('#tb-user-cfthr-save');
  if (btnThreshold) {
    btnThreshold.onclick = () => safeCall('Enregistrer seuil trésorerie', async () => {
      const value = Number(getValue(box, '#tb-user-cfthr'));
      if (!Number.isFinite(value) || value <= 0) throw new Error('Seuil invalide');
      const eur = (typeof windowRef?.safeFxConvert === 'function')
        ? windowRef.safeFxConvert(value, currency, 'EUR', null)
        : (typeof windowRef?.fxConvert === 'function' ? windowRef.fxConvert(value, currency, 'EUR') : null);
      if (eur === null || !Number.isFinite(eur) || eur <= 0) throw new Error('Conversion FX impossible');
      try { LS?.setItem?.(thresholdStorageKey, String(Math.round(eur))); } catch (_) {}
      render('settings:cashflow_threshold');
    });
  }
}

export default {
  bindSettingsAccountPanel,
  buildSettingsNotificationPrefs,
  isValidWhatsappPhone,
  normalizeWhatsappPhone,
};
