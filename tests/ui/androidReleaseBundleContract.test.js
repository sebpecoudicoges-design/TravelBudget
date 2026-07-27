import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

describe('Android release bundle contract', () => {
  it('keeps Play Store AAB generation scripted without committing signing secrets', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
    const script = fs.readFileSync(path.join(root, 'scripts/build-android-release-bundle.ps1'), 'utf8');
    const debugScript = fs.readFileSync(path.join(root, 'scripts/build-android-debug.ps1'), 'utf8');

    expect(packageJson.scripts['android:bundle-release']).toBe('powershell -ExecutionPolicy Bypass -File scripts/build-android-release-bundle.ps1 -RequireSigned');
    expect(packageJson.scripts['android:bundle-check']).toBe('powershell -ExecutionPolicy Bypass -File scripts/build-android-release-bundle.ps1');

    for (const name of [
      'TB_ANDROID_KEYSTORE_PATH',
      'TB_ANDROID_KEYSTORE_PASSWORD',
      'TB_ANDROID_KEY_ALIAS',
      'TB_ANDROID_KEY_PASSWORD',
    ]) {
      expect(gradle).toContain(`System.getenv("${name}")`);
      expect(script).toContain(name);
    }

    expect(gradle).toContain('signingConfigs');
    expect(script).toContain('bundleRelease');
    expect(script).toContain('Signature release manquante');
    expect(script).toContain('jarsigner.exe -verify -certs');
    expect(debugScript).toContain('Filter "*.aab"');
    expect(debugScript).toContain('Upload Supabase Storage echoue');
    expect(debugScript).toContain('SUPABASE_TELEMETRY_DISABLED');
    expect(script).not.toMatch(/storePassword\s+["'][^"']+["']/);
    expect(script).not.toMatch(/keyPassword\s+["'][^"']+["']/);
  });
});
