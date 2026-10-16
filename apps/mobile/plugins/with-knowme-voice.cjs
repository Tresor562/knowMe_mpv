'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest, withMainApplication, withDangerousMod } = require('expo/config-plugins');

function injectVoice(main) {
  if (main.includes('KnowMeVoicePackage()')) return main;
  const kotlin = 'val packages = PackageList(this).packages';
  const kotlinAlt = 'PackageList(this).packages.apply {';
  const java = 'List<ReactPackage> packages = new PackageList(this).getPackages();';
  if (main.includes(kotlin)) return main.replace(kotlin, kotlin +
    '\n    packages.add(com.knowme.app.voice.KnowMeVoicePackage())');
  if (main.includes(kotlinAlt)) return main.replace(kotlinAlt, kotlinAlt +
    '\n              add(com.knowme.app.voice.KnowMeVoicePackage())');
  if (main.includes(java)) return main.replace(java, java +
    '\n        packages.add(new com.knowme.app.voice.KnowMeVoicePackage());');
  throw new Error('Unsupported Expo MainApplication: voice package not installed.');
}
function addVoicePermission(manifest) {
  manifest['uses-permission'] = manifest['uses-permission'] || [];
  const permission = 'android.permission.RECORD_AUDIO';
  if (!manifest['uses-permission'].some(item => item.$?.['android:name'] === permission)) {
    manifest['uses-permission'].push({$: {'android:name': permission}});
  }
  return manifest;
}
module.exports = function withKnowMeVoice(config) {
  config = withAndroidManifest(config, mod => {
    mod.modResults.manifest = addVoicePermission(mod.modResults.manifest);
    return mod;
  });
  config = withMainApplication(config, mod => {
    mod.modResults.contents = injectVoice(mod.modResults.contents);
    return mod;
  });
  return withDangerousMod(config, ['android', mod => {
    const dest = path.join(mod.modRequest.platformProjectRoot,'app/src/main/java/com/knowme/app/voice');
    fs.mkdirSync(dest,{recursive:true});
    fs.copyFileSync(path.join(mod.modRequest.projectRoot,'plugins/native/android/KnowMeVoicePackage.java'),
      path.join(dest,'KnowMeVoicePackage.java'));
    return mod;
  }]);
};
module.exports.injectVoice = injectVoice;
module.exports.addVoicePermission = addVoicePermission;
