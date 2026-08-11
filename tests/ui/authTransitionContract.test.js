import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));

describe('authentication transition contract', () => {
  it('lets SIGNED_IN own the bootstrap and refresh pipeline after password login', () => {
    const auth = read('public/legacy/js/03_ui_auth.js');
    const signIn = between(auth, 'async function signIn()', 'async function signUp()');

    expect(signIn).toContain('sb.auth.signInWithPassword');
    expect(signIn).not.toContain('await ensureBootstrap()');
    expect(signIn).not.toContain('await refreshFromServer()');
    expect(signIn).not.toContain('showView("dashboard")');
  });

  it('lets SIGNED_IN own initialization after a session-bearing signup too', () => {
    const auth = read('public/legacy/js/03_ui_auth.js');
    const signUp = between(auth, 'async function signUp()', 'async function resetPassword()');

    expect(signUp).toContain('sb.auth.signUp');
    expect(signUp).not.toContain('await ensureBootstrap()');
    expect(signUp).not.toContain('await refreshFromServer()');
    expect(signUp).not.toContain('showView("dashboard")');
  });

  it('marks the full SIGNED_IN synchronization as an authentication transition', () => {
    const boot = read('public/legacy/js/20_boot.js');
    const signedInStart = boot.indexOf('authEvent === "SIGNED_IN"');
    const deferredStart = boot.indexOf('setTimeout(async () => {', signedInStart);
    const transitionStart = boot.indexOf('window.__TB_AUTH_TRANSITION_ACTIVE__ = true', signedInStart);
    const refresh = boot.indexOf('await refreshFromServer({ force: false })', transitionStart);
    const transitionEnd = boot.indexOf('window.__TB_AUTH_TRANSITION_ACTIVE__ = false', refresh);

    expect(signedInStart).toBeGreaterThan(-1);
    expect(boot).toContain('sb.auth.onAuthStateChange((_event, session) => {');
    expect(boot).not.toContain('sb.auth.onAuthStateChange(async (_event, session) => {');
    expect(deferredStart).toBeGreaterThan(signedInStart);
    expect(transitionStart).toBeGreaterThan(signedInStart);
    expect(transitionStart).toBeGreaterThan(deferredStart);
    expect(refresh).toBeGreaterThan(transitionStart);
    expect(transitionEnd).toBeGreaterThan(refresh);
  });

  it('releases boot gating when the app initially opens on the sign-in screen', () => {
    const boot = read('public/legacy/js/20_boot.js');
    const noUserStart = boot.indexOf('if (!sbUser) {', boot.indexOf('sb.auth.getSession()'));
    const noUserEnd = boot.indexOf('\n  }', noUserStart);
    const noUserBranch = boot.slice(noUserStart, noUserEnd);

    expect(noUserBranch).toContain('window.__TB_BOOTING = false');
    expect(noUserBranch).toContain('window.__TB_BOOT_COMPLETED__ = true');
    expect(noUserBranch.indexOf('window.__TB_BOOT_COMPLETED__ = true')).toBeLessThan(noUserBranch.indexOf('return;'));
  });

  it('pauses stale refresh and automatic offline sync while authentication settles', () => {
    const refresh = read('public/legacy/js/08_refresh.js');
    const queue = read('public/legacy/js/00_offline_queue.js');

    expect(refresh).toContain('window.__TB_BOOTING || window.__TB_AUTH_TRANSITION_ACTIVE__');
    expect(refresh).toContain('opts?.auto || window.__TB_BOOTING || window.__TB_AUTH_TRANSITION_ACTIVE__');
    expect(queue).toContain('window.__TB_BOOTING || window.__TB_AUTH_TRANSITION_ACTIVE__');
    expect(queue).toContain('skipped: "auth-transition"');
  });
});
