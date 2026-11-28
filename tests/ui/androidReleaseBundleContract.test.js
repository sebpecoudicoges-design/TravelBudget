import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

describe('Android release bundle contract', () => {
  it('separates the Play identity from existing debug installs and scopes OAuth to each variant', () => {
    const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
    const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
    const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
    expect(config.appId).toBe('fr.pecloud.travelbudget');
    expect(gradle).toContain('applicationId "fr.pecloud.travelbudget"');
    expect(gradle).toContain('onVariants(selector().withBuildType("debug"))');
    expect(gradle).toContain('variant.applicationId.set("com.travelbudget.app")');
    expect(manifest).toContain('android:scheme="${applicationId}"');
    expect(manifest).not.toContain('android:scheme="com.travelbudget.app"');
  });

  it('uses a distinct launcher name for the direct APK without renaming the Play app', () => {
    const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
    const playStrings = fs.readFileSync(path.join(root, 'android/app/src/main/res/values/strings.xml'), 'utf8');
    const directStrings = fs.readFileSync(path.join(root, 'android/app/src/debug/res/values/strings.xml'), 'utf8');

    expect(manifest).toMatch(/<application\b[^>]*android:label="@string\/app_name"/);
    expect(manifest).toMatch(/<activity\b[^>]*android:label="@string\/title_activity_main"[^>]*>[\s\S]*?android.intent.category.LAUNCHER/);
    for (const name of ['app_name', 'title_activity_main']) {
      expect(playStrings).toContain(`<string name="${name}">TravelBudget</string>`);
      expect(directStrings).toContain(`<string name="${name}">TravelBudget APK</string>`);
    }
  });

  it('keeps R8 explicit and scoped to release builds', () => {
    const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
    expect(gradle).toContain('providers.gradleProperty("tbEnableR8").orNull == "true"');
    expect(gradle).toMatch(/release\s*\{\s*minifyEnabled enableReleaseR8/);
    expect(gradle).toContain("enableReleaseR8 ? 'proguard-android-optimize.txt' : 'proguard-android.txt'");
    expect(gradle).not.toContain('shrinkResources true');
  });

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
    expect(script).toContain('-Command "jarsigner.exe" -Arguments @("-verify", "-certs", $TargetBundle)');
    expect(debugScript).toContain('Filter "*.aab"');
    expect(debugScript).toContain('Upload Supabase Storage echoue');
    expect(debugScript).toContain('SUPABASE_TELEMETRY_DISABLED');
    expect(debugScript).not.toMatch(/storage\s+(?:rm|mv)\b/);
    expect(debugScript).toContain('storage cp --linked');
    expect(script).not.toMatch(/storePassword\s+["'][^"']+["']/);
    expect(script).not.toMatch(/keyPassword\s+["'][^"']+["']/);
  });
});
