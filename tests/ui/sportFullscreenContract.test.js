import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('sport fullscreen focus contract', () => {
  const sport = fs.readFileSync('public/legacy/js/45_sport_ui.js', 'utf8');
  const sportCss = fs.readFileSync('public/legacy/css/sport.css', 'utf8');
  const mobileCss = fs.readFileSync('public/legacy/css/sport_mobile.css', 'utf8');

  it('uses a CSS focus lock fallback in addition to the native Fullscreen API', () => {
    expect(sport).toContain('function syncTimerFocusLock()');
    expect(sport).toContain('tb-sport-focus-lock');
    expect(sportCss).toContain('body.tb-sport-focus-lock .mobile-bottom-nav');
    expect(sportCss).toContain('width:100vw;height:100dvh');
    expect(sport).toContain('function sportTimerFullscreenTarget()');
    expect(sport).toContain('document.getElementById("sport-root")');
    expect(sport).toContain('const target = sportTimerFullscreenTarget()');
    expect(sport).not.toContain('document.querySelector(".tb-sport-timer-card.focus")');
    expect(sport).toContain('target?.webkitRequestFullscreen');
    expect(sport).toContain('document.webkitExitFullscreen');
    expect(sport).toContain('async function exitTimerFullscreen()');
    expect(sport).toContain('tb-sport-css');
    expect(sport).toContain('./legacy/css/sport.css');
    expect(sport).toContain('tb-sport-mobile-css');
    expect(sport).toContain('./legacy/css/sport_mobile.css');
    expect(sportCss).toContain('.tb-sport-timer-card.focus,.tb-sport-free-card.focus');
    expect(mobileCss).toContain('body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-timer-card.focus');
    expect(mobileCss).toContain('height:calc(100dvh - 16px');
    expect(mobileCss).toContain('overflow:hidden!important');
    expect(sport).not.toContain('style.textContent = `');
    expect(sport).not.toContain('body.tb-capacitor-app[data-tb-view="sport"] #sport-root{padding:0!important');
  });

  it('syncs and clears the focus lock around timer focus and completion', () => {
    expect(sport).toContain('syncTimerFocusLock();\n      renderSport("timer-focus")');
    expect(sport).toContain('else if (!shouldFocus) await exitTimerFullscreen()');
    expect(sport).toContain('CACHE.timerFocus = false;\n    syncTimerFocusLock();\n    CACHE.pendingSummary = summary');
    expect(sport).toContain('CACHE.timerFocus = false;\n    syncTimerFocusLock();\n    clearTimerState()');
  });

  it('keeps the free sport timer persistent, fullscreen-capable and background-aware', () => {
    expect(sport).toContain('FREE_TIMER_STATE_KEY');
    expect(sport).toContain('function renderFreeTimer()');
    expect(sport).toContain('id="sport-free-focus"');
    expect(sportCss).toContain('tb-sport-free-card.focus');
    expect(sport).toContain('saveFreeTimerState();');
    expect(sport).toContain('loadFreeTimerState()');
    expect(sport).toContain('if ((!CACHE.timer || CACHE.timer.paused) && (!CACHE.freeTimer || CACHE.freeTimer.paused || CACHE.freeTimer.stoppedAt)) return false;');
    expect(sport).toContain('if ((!CACHE.timer && !CACHE.freeTimer) || document.visibilityState === "hidden") return;');
  });
});
