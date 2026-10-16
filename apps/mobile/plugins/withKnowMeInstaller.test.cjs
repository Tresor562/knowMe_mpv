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

test('background checks never install APKs silently and have a verified notification tap', () => {
  const { readFileSync } = require('node:fs');
  const worker = readFileSync(require('node:path').join(__dirname, 'native/android/KnowMeUpdateWorker.java'), 'utf8');
  assert.match(worker, /PeriodicWorkRequest\.Builder/);
  assert.match(worker, /setContentIntent\(tap\)/);
  assert.match(worker, /knowme-nextech\.vercel\.app\/api\/updates\/android/);
  assert.doesNotMatch(worker, /installApk\(|ACTION_INSTALL_PACKAGE|PackageInstaller\.Session/);
});
