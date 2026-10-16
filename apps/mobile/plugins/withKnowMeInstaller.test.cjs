'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {injectInstallerPackage, injectUpdateWorkManager} = require('./withKnowMeInstaller');

test('native updater module is registered exactly once', () => {
  const generated = 'val packages = PackageList(this).packages\n    return packages';
  const once = injectInstallerPackage(generated);
  assert.match(once, /packages\.add\(com\.knowme\.app\.updates\.KnowMeInstallerPackage\(\)\)/);
  assert.equal(injectInstallerPackage(once), once);
});

test('native updater plugin preserves the existing story-player registration', () => {
  const generated = 'val packages = PackageList(this).packages\n    packages.add(com.knowme.app.video.KnowMeStoryVideoPackage())';
  const next = injectInstallerPackage(generated);
  assert.match(next, /KnowMeStoryVideoPackage/);
  assert.match(next, /KnowMeInstallerPackage/);
});

test('unsupported Expo structures fail rather than silently disabling updates', () => {
  assert.throws(()=>injectInstallerPackage('unsupported MainApplication'),/unsupported MainApplication/);
});

test('WorkManager dependency is injected once into the Android app Gradle file', () => {
  const gradle = 'plugins { id "com.android.application" }\n' +
    'dependencies {\n    implementation("com.facebook.react:react-android")\n}';
  const once = injectUpdateWorkManager(gradle);
  assert.match(once, /androidx\.work:work-runtime:2\.10\.2/);
  assert.equal(injectUpdateWorkManager(once), once);
});

test('no background notification worker can ship without Gradle registration', () => {
  assert.throws(() => injectUpdateWorkManager('plugins {}'), /dependencies section missing/);
});

test('self-hosted Android background checks notify without ever installing APKs silently', () => {
  const { readFileSync } = require('node:fs');
  const worker = readFileSync(require('node:path').join(__dirname, 'native/android/KnowMeUpdateWorker.java'), 'utf8');
  assert.match(worker, /PeriodicWorkRequest\.Builder/);
  assert.match(worker, /setContentIntent\(tap\)/);
  assert.match(worker, /31-56-85-53\.sslip\.io\/knowme-api\/mobile-updates\/android/);
  assert.doesNotMatch(worker, /installApk\(|ACTION_INSTALL_PACKAGE|PackageInstaller\.Session/);
});

test('in-app update downloads only from the KnowMe VPS origin', () => {
  const { readFileSync } = require('node:fs');
  const { join } = require('node:path');
  const screen = readFileSync(join(__dirname, '../src/updates/MobileUpdateNotice.tsx'), 'utf8');
  assert.match(screen, /31-56-85-53\.sslip\.io\/knowme-api\/mobile-updates\/android\/apk/);
  assert.match(screen, /trustedKnowMeApk\(next\)/);
  assert.doesNotMatch(screen, /fetch\(FIRST_PARTY_PREVIEW_FEED/);
  assert.doesNotMatch(screen, /https:\/\/github\.com\/Tresor562\/knowMe_mpv\/releases/);
});

test('no Firebase or GitHub dependency remains in the Android update path', () => {
  const { readFileSync } = require('node:fs');
  const { join } = require('node:path');
  const root = join(__dirname, '..');
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
  const worker = readFileSync(join(__dirname, 'native/android/KnowMeUpdateWorker.java'), 'utf8');
  const ui = readFileSync(join(root, 'src/updates/MobileUpdateNotice.tsx'), 'utf8');
  assert.ok(!app.expo.plugins.some(plugin => String(plugin).toLowerCase().includes('firebase')));
  assert.doesNotMatch(worker, /firebase|github\.com/i);
  assert.doesNotMatch(ui, /firebase|github\.com|FIRST_PARTY_PREVIEW_FEED/i);
  assert.match(ui, /getRealtimeSocket\(\)/);
  assert.match(worker, /knowme-api\/mobile-updates\/android/);
});
