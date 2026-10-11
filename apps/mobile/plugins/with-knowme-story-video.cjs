'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {
  withMainApplication,
  withDangerousMod
} = require('expo/config-plugins');

function injectStoryPlayer(main) {
  if (main.includes('KnowMeStoryVideoPackage()')) return main;
  const kotlin = 'val packages = PackageList(this).packages';
  const kotlinAlt = 'PackageList(this).packages.apply {';
  const java = 'List<ReactPackage> packages = new PackageList(this).getPackages();';
  if (main.includes(kotlin)) {
    return main.replace(kotlin, kotlin +
      '\n    packages.add(com.knowme.app.video.KnowMeStoryVideoPackage())');
  }
  if (main.includes(kotlinAlt)) {
    return main.replace(kotlinAlt, kotlinAlt +
      '\n              add(com.knowme.app.video.KnowMeStoryVideoPackage())');
  }
  if (main.includes(java)) {
    return main.replace(java, java +
      '\n        packages.add(new com.knowme.app.video.KnowMeStoryVideoPackage());');
  }
  throw new Error('Unsupported Expo MainApplication; story video plugin not installed.');
}

module.exports = function withKnowMeStoryVideo(config) {
  config = withMainApplication(config, mod => {
    mod.modResults.contents=injectStoryPlayer(mod.modResults.contents);
    return mod;
  });
  return withDangerousMod(config, ['android', mod => {
    const root = mod.modRequest.projectRoot;
    const dest = path.join(mod.modRequest.platformProjectRoot,
      'app/src/main/java/com/knowme/app/video');
    fs.mkdirSync(dest, {recursive:true});
    fs.copyFileSync(path.join(root,'plugins/native/android/KnowMeStoryVideoPackage.java'),
      path.join(dest,'KnowMeStoryVideoPackage.java'));
    return mod;
  }]);
};
module.exports.injectStoryPlayer=injectStoryPlayer;
