'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {injectInstallerPackage} = require('./withKnowMeInstaller');

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
