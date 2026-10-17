'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {
  injectGallery,
  addMediaPermissions
} = require('./with-knowme-gallery.cjs');

test('injects gallery bridge into Expo Kotlin MainApplication only once', () => {
  const text = 'val packages = PackageList(this).packages\n';
  const modified = injectGallery(text);
  assert.match(modified, /packages\.add\(com\.knowme\.app\.gallery\.KnowMeGalleryPackage\(\)\)/);
  assert.equal(injectGallery(modified), modified);
});

test('supports Kotlin apply and Java variants of MainApplication', () => {
  assert.match(injectGallery('PackageList(this).packages.apply {'),
    /KnowMeGalleryPackage/);
  assert.match(injectGallery('List<ReactPackage> packages = new PackageList(this).getPackages();'),
    /new com\.knowme\.app\.gallery\.KnowMeGalleryPackage/);
});

test('fails closed if Expo MainApplication internals change', () => {
  assert.throws(() => injectGallery('class UnknownMainApplication {}'), /Unsupported Expo MainApplication/);
});

test('registers only read-media permissions, legacy permission capped at SDK 32', () => {
  const manifest = { 'uses-permission': [] };
  addMediaPermissions(manifest);
  assert.deepEqual(manifest['uses-permission'].map(item => item.$['android:name']), [
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
    'android.permission.READ_EXTERNAL_STORAGE'
  ]);
  assert.equal(manifest['uses-permission'][3].$['android:maxSdkVersion'], '32');
  addMediaPermissions(manifest);
  assert.equal(manifest['uses-permission'].length, 4);
});

test('native module requests only scoped MediaStore queries and Android file picker', () => {
  const java = fs.readFileSync(path.join(__dirname, 'native/android/KnowMeGalleryPackage.java'), 'utf8');
  assert.match(java, /MediaStore\.Files\.getContentUri/);
  assert.match(java, /Intent\.ACTION_OPEN_DOCUMENT/);
  assert.match(java, /FLAG_GRANT_READ_URI_PERMISSION/);
  assert.doesNotMatch(java, /MANAGE_EXTERNAL_STORAGE|ACTION_GET_CONTENT/);
});

test('gallery uses provider-compatible sorting and bounded Cursor pagination', () => {
  const java = fs.readFileSync(path.join(__dirname, 'native/android/KnowMeGalleryPackage.java'), 'utf8');
  assert.match(java, /String order = MediaStore\.MediaColumns\.DATE_ADDED/);
  assert.match(java, /cursor\.moveToPosition\(offset - 1\)/);
  assert.match(java, /while \(emitted < count && cursor\.moveToNext\(\)\)/);
  assert.doesNotMatch(java, /DESC LIMIT|DESC OFFSET/);
});
