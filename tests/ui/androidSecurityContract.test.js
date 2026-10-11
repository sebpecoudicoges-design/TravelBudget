import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Android security release contract', () => {
  it('prevents restoring a vulnerable Capacitor runtime in the manifest or lockfile', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
    // Conservative supported baseline for GHSA-rvm3-566m-v7fv.
    // Earlier maintenance branches have their own fixes; do not silently downgrade to them.
    const minimum = [8, 5, 1];
    const atLeastMinimum = version => {
      const parts = version.split('.').map(Number);
      for (let i = 0; i < minimum.length; i++) {
        if (parts[i] !== minimum[i]) return parts[i] > minimum[i];
      }
      return true;
    };
    for (const name of ['@capacitor/android', '@capacitor/core', '@capacitor/cli']) {
      const declared = pkg.devDependencies[name];
      expect(declared).toMatch(/^\d+\.\d+\.\d+$/);
      expect(lock.packages[''].devDependencies[name]).toBe(declared);
      expect(lock.packages[`node_modules/${name}`].version).toBe(declared);
    }
    expect(atLeastMinimum(pkg.devDependencies['@capacitor/android'])).toBe(true);
  });
});
