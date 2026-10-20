const fs = require('node:fs/promises');
const path = require('node:path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication
} = require('expo/config-plugins');

function injectInstallerPackage(contents) {
  if (contents.includes('KnowMeInstallerPackage()')) return contents;
  const kotlinAnchor = 'PackageList(this).packages.apply {';
  if (contents.includes(kotlinAnchor)) {
    return contents.replace(kotlinAnchor,
      kotlinAnchor + '\n              add(com.knowme.app.updates.KnowMeInstallerPackage())');
  }
  const kotlinSdk53Anchor = 'val packages = PackageList(this).packages';
  if (contents.includes(kotlinSdk53Anchor)) {
    return contents.replace(kotlinSdk53Anchor,
      kotlinSdk53Anchor + '\n    packages.add(com.knowme.app.updates.KnowMeInstallerPackage())');
  }
  const javaAnchor = 'List<ReactPackage> packages = new PackageList(this).getPackages();';
  if (contents.includes(javaAnchor)) {
    return contents.replace(javaAnchor,
      javaAnchor + '\n        packages.add(new com.knowme.app.updates.KnowMeInstallerPackage());');
  }
  throw new Error('KnowMe APK installer: unsupported MainApplication structure.');
}

function injectUpdateWorkManager(contents) {
  const runtime = 'implementation("androidx.work:work-runtime:2.10.2")';
  if (contents.includes(runtime)) return contents;
  if (!/dependencies\s*\{/.test(contents)) {
    throw new Error('KnowMe updater: Android Gradle dependencies section missing.');
  }
  return contents.replace(/dependencies\s*\{/, match => match + '\n    ' + runtime);
}

function withKnowMeInstaller(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest['uses-permission'] ||= [];
    for (const permission of [
      'android.permission.REQUEST_INSTALL_PACKAGES',
      'android.permission.POST_NOTIFICATIONS'
    ]) {
      if (!manifest['uses-permission'].some((value) => value.$?.['android:name'] === permission)) {
        manifest['uses-permission'].push({ $: { 'android:name': permission } });
      }
    }
    const app = manifest.application?.[0];
    if (!app) throw new Error('KnowMe installer: Android application missing.');
    app.receiver ||= [];
    if (!app.receiver.some(value => value.$?.['android:name'] ===
        'com.knowme.app.updates.KnowMeUpdateDownloadReceiver')) {
      app.receiver.push({
        $: {
          'android:name': 'com.knowme.app.updates.KnowMeUpdateDownloadReceiver',
          'android:exported': 'false'
        },
        'intent-filter': [{
          action: [{ $: { 'android:name': 'android.intent.action.DOWNLOAD_COMPLETE' } }]
        }]
      });
    }
    app.provider ||= [];
    const authority = '${applicationId}.knowme.updates';
    if (!app.provider.some((value) => value.$?.['android:authorities'] === authority)) {
      app.provider.push({
        $: {
          'android:name': 'androidx.core.content.FileProvider',
          'android:authorities': authority,
          'android:exported': 'false',
          'android:grantUriPermissions': 'true'
        },
        'meta-data': [{
          $: {
            'android:name': 'android.support.FILE_PROVIDER_PATHS',
            'android:resource': '@xml/knowme_update_paths'
          }
        }]
      });
    }
    return mod;
  });

  config = withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = injectUpdateWorkManager(mod.modResults.contents);
    return mod;
  });

  config = withMainApplication(config, (mod) => {
    mod.modResults.contents = injectInstallerPackage(mod.modResults.contents);
    return mod;
  });

  config = withDangerousMod(config, ['android', async (mod) => {
    const projectRoot = mod.modRequest.projectRoot;
    const androidRoot = mod.modRequest.platformProjectRoot;
    const javaTarget = path.join(androidRoot, 'app/src/main/java/com/knowme/app/updates');
    const resources = path.join(androidRoot, 'app/src/main/res/xml');
    await fs.mkdir(javaTarget, { recursive: true });
    await fs.mkdir(resources, { recursive: true });
    const root = path.join(projectRoot, 'plugins/native/android');
    await fs.copyFile(path.join(root, 'KnowMeInstallerModule.java'),
      path.join(javaTarget, 'KnowMeInstallerModule.java'));
    await fs.copyFile(path.join(root, 'KnowMeInstallerPackage.java'),
      path.join(javaTarget, 'KnowMeInstallerPackage.java'));
    await fs.copyFile(path.join(root, 'KnowMeUpdateWorker.java'),
      path.join(javaTarget, 'KnowMeUpdateWorker.java'));
    await fs.copyFile(path.join(root, 'KnowMeUpdateDownloadReceiver.java'),
      path.join(javaTarget, 'KnowMeUpdateDownloadReceiver.java'));
    await fs.copyFile(path.join(root, 'knowme_update_paths.xml'),
      path.join(resources, 'knowme_update_paths.xml'));
    return mod;
  }]);
  return config;
}

module.exports = withKnowMeInstaller;
module.exports.injectInstallerPackage = injectInstallerPackage;

module.exports.injectUpdateWorkManager = injectUpdateWorkManager;
