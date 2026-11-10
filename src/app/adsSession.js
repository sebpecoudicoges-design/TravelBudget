// One cold-start attempt. A late load must never interrupt an already usable screen.
export function createAdsSession({ sdk, ids, online, active, gate, setInset, privacyStatus, report = () => {} }) {
  let initialized = false, allowed = false, opening = true, banner = false, task = null;
  const skipOpening = () => { opening = false; gate.close(); };
  const eligible = () => allowed && online() && active();
  async function removeBanner() {
    banner = false;
    try { await sdk.removeBanner(); } finally { await setInset(0); }
  }
  async function syncBanner() {
    if (!eligible()) { if (banner) await removeBanner(); return; }
    if (banner) return;
    banner = true;
    try {
      // Reserve space before the native ad can become visible; SizeChanged refines it.
      await setInset(90);
      await sdk.showBanner({ adId: ids.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0 });
      if (!eligible()) await removeBanner();
    } catch (error) { await removeBanner(); throw error; }
  }
  async function consent() {
    let info = await sdk.requestConsentInfo();
    if (info.status === 'REQUIRED' && info.isConsentFormAvailable) {
      skipOpening();
      info = await sdk.showConsentForm();
    }
    allowed = info.canRequestAds === true;
    privacyStatus(info.privacyOptionsRequirementStatus === 'REQUIRED');
    if (allowed && !initialized) { await sdk.initialize(); initialized = true; }
  }
  async function start() {
    if (!online() || !active()) { skipOpening(); return; }
    try {
      await consent();
      if (!eligible()) { skipOpening(); return; }
      if (opening && gate.isOpen()) {
        try {
          await sdk.loadAppOpen({ adId: ids.open });
          if (opening && gate.isOpen() && eligible()) {
            const loaded = await sdk.isAppOpenLoaded({ adId: ids.open });
            if (loaded.value && opening && gate.isOpen() && eligible()) {
              opening = false;
              // The native ad now owns dismissal. The loading screen can disappear.
              await sdk.showAppOpen({ adId: ids.open });
            }
          }
        } catch (error) { report(error); }
      }
      skipOpening();
      await syncBanner();
    } catch (error) { skipOpening(); report(error); }
  }
  function run() { if (!task) task = start().finally(() => { task = null; }); return task; }
  return {
    start: run,
    skipOpening,
    async stateChanged() {
      if (!online() || !active()) skipOpening();
      try { if (initialized) await syncBanner(); else await run(); } catch (error) { report(error); }
    },
    async privacy() {
      skipOpening();
      allowed = false;
      await removeBanner();
      await sdk.showPrivacyOptionsForm();
      await consent();
      await syncBanner();
    },
    async sizeChanged(height) {
      try { await setInset(banner && eligible() ? Math.max(0, Number(height) || 0) : 0); }
      catch (error) { await removeBanner(); report(error); }
    },
    async failedBanner() { try { await removeBanner(); } catch (error) { report(error); } },
  };
}
