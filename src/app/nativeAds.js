import { registerPlugin } from '@capacitor/core';
import { AdMob, BannerAdPluginEvents } from '@capacitor-community/admob';
import { App } from '@capacitor/app';
import { createAdsSession } from './adsSession.js';

export async function installNativeAds(win, gate) {
  const placement = registerPlugin('TravelBudgetAds');
  const { testing } = await placement.configuration();
  const ids = testing ? {
    open: 'ca-app-pub-3940256099942544/9257395921', banner: 'ca-app-pub-3940256099942544/9214589741',
  } : {
    open: 'ca-app-pub-4442850970011184/3365349065', banner: 'ca-app-pub-4442850970011184/2941681387',
  };
  let foreground = (await App.getState()).isActive;
  const button = win.document.getElementById('tb-ad-privacy');
  const report = () => console.warn('[TB Ads] Annonce indisponible');
  const session = createAdsSession({ sdk: AdMob, ids, gate,
    online: () => win.navigator.onLine !== false, active: () => foreground,
    setInset: height => placement.inset({ height }), report,
    privacyStatus: required => { if (button) button.hidden = !required; },
  });
  await AdMob.addListener(BannerAdPluginEvents.SizeChanged, size => { void session.sizeChanged(size.height); });
  await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => { void session.failedBanner(); });
  await App.addListener('appStateChange', state => { foreground = state.isActive; void session.stateChanged(); });
  win.addEventListener('offline', () => { void session.stateChanged(); });
  win.addEventListener('online', () => { void session.stateChanged(); });
  button?.addEventListener('click', async () => {
    button.disabled = true;
    try { await session.privacy(); } catch { report(); } finally { button.disabled = false; }
  });
  await session.start();
}
