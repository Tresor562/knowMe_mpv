'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  officialPngFromWeb,
  syncBrandAssets
} = require('./sync-brand-assets.cjs');

const ROOT = path.resolve(__dirname, '..');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

test('all native brand PNG assets come from the official KnowMe identity', () => {
  const files = syncBrandAssets();
  const names = [
    'knowme-icon.png',
    'knowme-splash.png',
    'knowme-adaptive-foreground.png',
    'knowme-monochrome.png',
    'knowme-notification.png'
  ];
  assert.deepEqual(Object.keys(files), names);
  const exactWebLogo = officialPngFromWeb();
  for (const name of names) {
    const bytes = fs.readFileSync(files[name].path);
    assert.ok(bytes.subarray(0, 8).equals(PNG_SIGNATURE), name);
    assert.equal(bytes.readUInt32BE(16), bytes.readUInt32BE(20), name);
    assert.ok(bytes.readUInt32BE(16) >= 192, name);
    if (name === 'knowme-icon.png' || name === 'knowme-splash.png' ||
      name === 'knowme-adaptive-foreground.png') {
      assert.ok(bytes.equals(exactWebLogo), name + ' must match approved logo');
    }
  }
});

test('Expo uses generated branding in Android launcher and splash', () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;
  assert.equal(config.icon, './assets/branding/knowme-icon.png');
  assert.equal(config.splash.image, './assets/branding/knowme-splash.png');
  assert.equal(config.android.adaptiveIcon.foregroundImage,
    './assets/branding/knowme-adaptive-foreground.png');
  assert.equal(config.android.adaptiveIcon.monochromeImage,
    './assets/branding/knowme-monochrome.png');
  assert.ok(config.plugins.includes('./plugins/withKnowMeNotificationIcon.cjs'));
});

test('Expo dynamic config always regenerates missing icon files', () => {
  const sourceConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;
  const loadedConfig = require('../app.config.js')({ config: sourceConfig });
  assert.equal(loadedConfig, sourceConfig);
  assert.ok(fs.existsSync(path.join(ROOT, sourceConfig.icon)));
});
