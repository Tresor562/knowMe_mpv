'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  withMainApplication,
  withDangerousMod,
  withAndroidManifest
} = require('expo/config-plugins');

function injectGallery(main) {
  if (main.includes('KnowMeGalleryPackage()')) return main;
  const kotlin = 'val packages = PackageList(this).packages';
  const kotlinAlt = 'PackageList(this).packages.apply {';
  const java = 'List<ReactPackage> packages = new PackageList(this).getPackages();';
  if (main.includes(kotlin)) {
    return main.replace(kotlin, kotlin +
      '\n    packages.add(com.knowme.app.gallery.KnowMeGalleryPackage())');
  }
  if (main.includes(kotlinAlt)) {
    return main.replace(kotlinAlt, kotlinAlt +
      '\n              add(com.knowme.app.gallery.KnowMeGalleryPackage())');
  }
  if (main.includes(java)) {
    return main.replace(java, java +
      '\n        packages.add(new com.knowme.app.gallery.KnowMeGalleryPackage());');
  }
  throw new Error('Unsupported Expo MainApplication: gallery package not installed.');
}

function addMediaPermissions(manifest) {
  const names = [
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
    'android.permission.READ_EXTERNAL_STORAGE'
  ];
  manifest['uses-permission'] = manifest['uses-permission'] || [];
  for (const name of names) {
    if (!manifest['uses-permission'].some(item => item.$?.['android:name'] === name)) {
      const item = { $: { 'android:name': name } };
      if (name === 'android.permission.READ_EXTERNAL_STORAGE') {
        item.$['android:maxSdkVersion'] = '32';
      }
      manifest['uses-permission'].push(item);
    }
  }
  return manifest;
}

module.exports = function withKnowMeGallery(config) {
  config = withAndroidManifest(config, mod => {
    mod.modResults.manifest = addMediaPermissions(mod.modResults.manifest);
    return mod;
  });
  config = withMainApplication(config, mod => {
    mod.modResults.contents = injectGallery(mod.modResults.contents);
    return mod;
  });
  return withDangerousMod(config, ['android', mod => {
    const root = mod.modRequest.projectRoot;
    const dest = path.join(mod.modRequest.platformProjectRoot,
      'app/src/main/java/com/knowme/app/gallery');
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(path.join(root, 'plugins/native/android/KnowMeGalleryPackage.java'),
      path.join(dest, 'KnowMeGalleryPackage.java'));
    return mod;
  }]);
};
module.exports.injectGallery = injectGallery;
module.exports.addMediaPermissions = addMediaPermissions;
