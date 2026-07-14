import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('sport fullscreen focus contract', () => {
  const sport = fs.readFileSync('public/legacy/js/45_sport_ui.js', 'utf8');

  it('uses a CSS focus lock fallback in addition to the native Fullscreen API', () => {
    expect(sport).toContain('function syncTimerFocusLock()');
    expect(sport).toContain('tb-sport-focus-lock');
    expect(sport).toContain('body.tb-sport-focus-lock .mobile-bottom-nav');
    expect(sport).toContain('width:100vw;height:100dvh');
    expect(sport).toContain('function sportTimerFullscreenTarget()');
    expect(sport).toContain('document.getElementById("sport-root")');
    expect(sport).toContain('const target = sportTimerFullscreenTarget()');
    expect(sport).not.toContain('document.querySelector(".tb-sport-timer-card.focus")');
    expect(sport).toContain('target?.webkitRequestFullscreen');
    expect(sport).toContain('document.webkitExitFullscreen');
    expect(sport).toContain('async function exitTimerFullscreen()');
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
    expect(sport).toContain('tb-sport-free-card.focus');
    expect(sport).toContain('saveFreeTimerState();');
    expect(sport).toContain('loadFreeTimerState()');
    expect(sport).toContain('if ((!CACHE.timer || CACHE.timer.paused) && (!CACHE.freeTimer || CACHE.freeTimer.paused || CACHE.freeTimer.stoppedAt)) return false;');
    expect(sport).toContain('if ((!CACHE.timer && !CACHE.freeTimer) || document.visibilityState === "hidden") return;');
  });
});
