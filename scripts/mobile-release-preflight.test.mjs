import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMobileStoreConfig } from './mobile-release-preflight.mjs';

function validConfig() {
  return {
    expo: {
      name: 'KnowMe',
      slug: 'knowme',
      scheme: 'knowme',
      version: '1.0.0',
      ios: {
        bundleIdentifier: 'com.knowme.app',
        buildNumber: '1',
      },
      android: {
        package: 'com.knowme.app',
        versionCode: 1,
      },
    },
  };
}

test('accepts a stable mobile store identity with monotonic build identifiers', () => {
  const result = validateMobileStoreConfig(validConfig());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('rejects a pre-1.0 market version and missing build identifiers', () => {
  const config = validConfig();
  config.expo.version = '0.9.9';
  delete config.expo.ios.buildNumber;
  delete config.expo.android.versionCode;
  const result = validateMobileStoreConfig(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('at least 1.0.0')));
  assert.ok(result.errors.some((error) => error.includes('expo.ios.buildNumber')));
  assert.ok(result.errors.some((error) => error.includes('expo.android.versionCode')));
});

test('rejects malformed or placeholder store identifiers', () => {
  const malformed = validConfig();
  malformed.expo.ios.bundleIdentifier = 'knowme';
  malformed.expo.android.package = 'com.example.app';
  const result = validateMobileStoreConfig(malformed);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('reverse-DNS')));
  assert.ok(result.errors.some((error) => error.includes('placeholder')));
});

test('rejects non-monotonic-compatible build identifiers and invalid semantic versions', () => {
  const config = validConfig();
  config.expo.version = '1.0';
  config.expo.ios.buildNumber = '0';
  config.expo.android.versionCode = 0;
  const result = validateMobileStoreConfig(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('MAJOR.MINOR.PATCH')));
  assert.ok(result.errors.some((error) => error.includes('positive integer string')));
  assert.ok(result.errors.some((error) => error.includes('positive integer')));
});

test('requires stable app naming and deep-link scheme metadata', () => {
  const config = validConfig();
  config.expo.name = '';
  config.expo.slug = '';
  config.expo.scheme = '';
  const result = validateMobileStoreConfig(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('expo.name')));
  assert.ok(result.errors.some((error) => error.includes('expo.slug')));
  assert.ok(result.errors.some((error) => error.includes('expo.scheme')));
});
