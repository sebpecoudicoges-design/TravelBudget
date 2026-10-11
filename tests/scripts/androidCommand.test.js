import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const helper = path.resolve('scripts/android-command.ps1');

describe.skipIf(process.platform !== 'win32')('Android native command failures', () => {
  it.each([0, 23])('continues only after a successful native exit (%i)', (exitCode) => {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      `$ErrorActionPreference = 'Stop'; . ${quote(helper)}; Invoke-CheckedAndroidCommand -Command ${quote(process.execPath)} -Arguments @('-e', 'process.exit(${exitCode})'); Write-Output 'NEXT_STEP'`,
    ], { encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    if (exitCode === 0) {
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('NEXT_STEP');
    } else {
      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain('NEXT_STEP');
      expect(result.stderr).toContain('code 23');
    }
  });
});

it('routes Android build and verification steps through the checked executor', () => {
  for (const file of ['scripts/build-android-debug.ps1', 'scripts/build-android-release-bundle.ps1']) {
    const source = fs.readFileSync(file, 'utf8');
    for (const command of ['npm.cmd', 'npx.cmd', '.\\gradlew.bat']) {
      expect(source).toContain(`Invoke-CheckedAndroidCommand -Command "${command}"`);
    }
    expect(source).not.toMatch(/^\s*(?:npm\.cmd|npx\.cmd|\.\\gradlew\.bat)\s/m);
  }
});
