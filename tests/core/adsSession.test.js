import { describe, it, expect, vi } from 'vitest';
import { createAdsSession } from '../../src/app/adsSession.js';

function harness() {
  let online = true, active = true, open = true;
  let resolveClosed;
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  const close = () => { open = false; resolveClosed(); };
  const sdk = Object.fromEntries(['initialize','showConsentForm','showPrivacyOptionsForm','loadAppOpen','showAppOpen','showBanner','removeBanner'].map(key => [key,vi.fn().mockResolvedValue(undefined)]));
  sdk.requestConsentInfo = vi.fn().mockResolvedValue({canRequestAds:true,status:'NOT_REQUIRED'});
  sdk.isAppOpenLoaded = vi.fn().mockResolvedValue({value:true});
  const setInset = vi.fn().mockResolvedValue(undefined), privacyStatus=vi.fn(), report=vi.fn();
  const session = createAdsSession({sdk,ids:{open:'open',banner:'banner'},online:()=>online,active:()=>active,
    gate:{isOpen:()=>open,close,closed},setInset,privacyStatus,report});
  return {sdk,session,setInset,privacyStatus,report,setOnline:v=>{online=v;},setActive:v=>{active=v;},expire:close};
}
describe('Android advertising lifecycle',()=>{
  it('requests consent before SDK initialization and shows one opening ad across resume',async()=>{
    const h=harness(); await h.session.start();
    expect(h.sdk.requestConsentInfo.mock.invocationCallOrder[0]).toBeLessThan(h.sdk.initialize.mock.invocationCallOrder[0]);
    expect(h.sdk.showAppOpen).toHaveBeenCalledTimes(1);
    h.setActive(false); await h.session.stateChanged(); h.setActive(true); await h.session.stateChanged();
    expect(h.sdk.showAppOpen).toHaveBeenCalledTimes(1);
    expect(h.sdk.showBanner).toHaveBeenCalledTimes(2);
    expect(h.setInset).toHaveBeenCalledWith(0);
  });
  it('skips offline opening and displays only a banner on reconnection',async()=>{
    const h=harness();h.setOnline(false);await h.session.start();
    expect(h.sdk.initialize).not.toHaveBeenCalled();
    h.setOnline(true);await h.session.stateChanged();
    expect(h.sdk.showAppOpen).not.toHaveBeenCalled();expect(h.sdk.showBanner).toHaveBeenCalledTimes(1);
  });
  it('does not initialize or request ads without permission',async()=>{
    const h=harness();h.sdk.requestConsentInfo.mockResolvedValue({canRequestAds:false,status:'UNKNOWN'});
    await h.session.start();expect(h.sdk.initialize).not.toHaveBeenCalled();expect(h.sdk.showBanner).not.toHaveBeenCalled();
  });
  it('never presents a late opening ad and coalesces startup',async()=>{
    const h=harness(); let resolve;
    h.sdk.loadAppOpen.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    const a=h.session.start(),b=h.session.start();await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'));
    h.expire();resolve();await Promise.all([a,b]);
    expect(h.sdk.loadAppOpen).toHaveBeenCalledTimes(1);expect(h.sdk.showAppOpen).not.toHaveBeenCalled();
  });
  it('skips opening after an interactive consent form',async()=>{
    const h=harness();h.sdk.requestConsentInfo.mockResolvedValue({status:'REQUIRED',isConsentFormAvailable:true});
    h.sdk.showConsentForm.mockResolvedValue({canRequestAds:true,privacyOptionsRequirementStatus:'REQUIRED'});
    await h.session.start();expect(h.sdk.showAppOpen).not.toHaveBeenCalled();expect(h.privacyStatus).toHaveBeenCalledWith(true);
  });
  it('releases the banner at the launch deadline even if opening never loads',async()=>{
    const h=harness(); let reject;
    h.sdk.loadAppOpen.mockImplementation(()=>new Promise((_,r)=>{reject=r;}));
    const pending=h.session.start();
    await vi.waitFor(()=>expect(h.sdk.loadAppOpen).toHaveBeenCalledOnce());
    h.expire(); await pending;
    expect(h.sdk.showBanner).toHaveBeenCalledOnce();
    expect(h.sdk.showAppOpen).not.toHaveBeenCalled();
    reject(new Error('Late network error')); await Promise.resolve();
    expect(h.sdk.showBanner).toHaveBeenCalledOnce();
  });
  it('reports a consent failure without bypassing it and can retry on resume',async()=>{
    const h=harness(); const error=new Error('No consent message configured');
    h.sdk.requestConsentInfo.mockRejectedValueOnce(error);
    await h.session.start();
    expect(h.report).toHaveBeenCalledWith(error);
    expect(h.sdk.initialize).not.toHaveBeenCalled();
    await h.session.stateChanged();
    expect(h.sdk.showBanner).toHaveBeenCalledOnce();
    expect(h.sdk.showAppOpen).not.toHaveBeenCalled();
  });
  it('clears native space on no-fill and removes ads before changing privacy',async()=>{
    const h=harness();await h.session.start();await h.session.failedBanner();expect(h.setInset).toHaveBeenLastCalledWith(0);
    h.sdk.requestConsentInfo.mockResolvedValue({canRequestAds:false});await h.session.privacy();
    expect(h.sdk.removeBanner.mock.invocationCallOrder.at(-1)).toBeLessThan(h.sdk.showPrivacyOptionsForm.mock.invocationCallOrder[0]);
    expect(h.sdk.showBanner).toHaveBeenCalledTimes(1);
  });
});
