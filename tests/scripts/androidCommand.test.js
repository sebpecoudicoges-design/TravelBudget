import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const helper = path.resolve('scripts/android-command.ps1');

describe.skipIf(process.platform !== 'win32')('Android native command failures', () => {
  it.each([0, 23, 409])('publishes without deleting an existing APK (copy exit %i)', (exitCode) => {
    // Execute the actual upload branch, with a local CLI double. No SDK, network or credentials.
    const script = path.resolve('scripts/build-android-debug.ps1');
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `
      $ErrorActionPreference = 'Stop'
      . ${quote(helper)}
      $ast = [System.Management.Automation.Language.Parser]::ParseFile(${quote(script)}, [ref]$null, [ref]$null)
      $branch = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.IfStatementAst] -and $node.Clauses[0].Item1.Extent.Text -eq '$UploadSupabase' }, $true)
      if (!$branch) { throw 'Upload branch missing' }
      $UploadSupabase = $true
      $ApkName = 'travelbudget-test-debug.apk'
      $SupabaseBucketPath = 'ss:///test/apk'
      function supabase {
        Write-Output ('CLI_ARGS=' + ($args -join '|'))
        if ($args -contains 'rm') { throw 'REMOTE_DELETE_FORBIDDEN' }
        $global:LASTEXITCODE = ${exitCode}
      }
      Invoke-Expression $branch.Extent.Text
      Write-Output 'NEXT_STEP'
    `], { encoding: 'utf8', timeout: 15000 });
    expect(result.error).toBeUndefined();
    expect(result.stderr).not.toContain('REMOTE_DELETE_FORBIDDEN');
    expect(result.stdout.match(/CLI_ARGS=/g)).toHaveLength(1);
    expect(result.stdout).toContain('storage|cp|');
    expect(result.stdout).toContain('public\\downloads\\travelbudget-test-debug.apk|ss:///test/apk/travelbudget-test-debug.apk');
    if (exitCode === 0) {
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('NEXT_STEP');
      expect(result.stdout).toContain('APK Supabase Storage:');
    } else {
      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain('NEXT_STEP');
      expect(result.stdout).not.toContain('APK Supabase Storage:');
    }
  }, 20000);

  it.each([0, 23])('continues only after a successful native exit (%i)', (exitCode) => {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      `$ErrorActionPreference = 'Stop'; . ${quote(helper)}; Invoke-CheckedAndroidCommand -Command ${quote(process.execPath)} -Arguments @('-e', 'process.exit(${exitCode})'); Write-Output 'NEXT_STEP'`,
    ], { encoding: 'utf8', timeout: 15000 });
    expect(result.error).toBeUndefined();
    if (exitCode === 0) {
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('NEXT_STEP');
    } else {
      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain('NEXT_STEP');
      expect(result.stderr).toContain('code 23');
    }
  }, 20000);
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
