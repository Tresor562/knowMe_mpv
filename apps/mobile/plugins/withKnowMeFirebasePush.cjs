'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withProjectBuildGradle,
  withMainApplication,
  withDangerousMod
} = require('expo/config-plugins');

const PACKAGE = 'com.knowme.app';
const GOOGLE_PLUGIN = 'com.google.gms:google-services:4.5.0';
const FIREBASE_BOM = 'com.google.firebase:firebase-bom:34.19.0';

function parseFirebaseConfig(encoded) {
  if (!encoded) return null; // No Firebase connection yet: preserve the working preview APK.
  const trimmed = encoded.trim();
  if (trimmed.length > 65536 || !/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    throw new Error('Firebase Android config is not valid base64.');
  }
  const doc = JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
  if (!/^[a-z0-9][a-z0-9-]{3,}$/i.test(doc.project_info?.project_id || '') ||
      !Array.isArray(doc.client) ||
      !doc.client.some(client =>
        client.client_info?.android_client_info?.package_name === PACKAGE &&
        typeof client.client_info?.mobilesdk_app_id === 'string' &&
        Array.isArray(client.api_key) && client.api_key.length > 0)) {
    throw new Error('Firebase Android config does not match package com.knowme.app.');
  }
  return doc;
}

function injectRootGradle(contents) {
  if (contents.includes(GOOGLE_PLUGIN)) return contents;
  if (!/dependencies\s*\{/.test(contents)) {
    throw new Error('Firebase setup: root Android Gradle dependencies section missing.');
  }
  return contents.replace(/dependencies\s*\{/, m =>
    m + "\n        classpath('"+GOOGLE_PLUGIN+"')");
}

function injectAppGradle(contents) {
  if (!/dependencies\s*\{/.test(contents)) {
    throw new Error('Firebase setup: app Android Gradle dependencies section missing.');
  }
  let result = contents;
  if (!result.includes(FIREBASE_BOM)) {
    result = result.replace(/dependencies\s*\{/, m =>
      m + "\n    implementation platform('"+FIREBASE_BOM+"')" +
          "\n    implementation 'com.google.firebase:firebase-messaging'");
  }
  if (!result.includes('apply plugin: "com.google.gms.google-services"')) {
    result += '\napply plugin: "com.google.gms.google-services"\n';
  }
  return result;
}

function injectFirebasePackage(contents) {
  if (contents.includes('KnowMeFirebasePushPackage()')) return contents;
  const kotlin = 'val packages = PackageList(this).packages';
  const kotlinAlt = 'PackageList(this).packages.apply {';
  const java = 'List<ReactPackage> packages = new PackageList(this).getPackages();';
  if (contents.includes(kotlin)) {
    return contents.replace(kotlin,
      kotlin + '\n    packages.add(com.knowme.app.updates.KnowMeFirebasePushPackage())');
  }
  if (contents.includes(kotlinAlt)) {
    return contents.replace(kotlinAlt,
      kotlinAlt + '\n              add(com.knowme.app.updates.KnowMeFirebasePushPackage())');
  }
  if (contents.includes(java)) {
    return contents.replace(java,
      java + '\n        packages.add(new com.knowme.app.updates.KnowMeFirebasePushPackage());');
  }
  throw new Error('Firebase push: unsupported Expo MainApplication structure.');
}

function withKnowMeFirebasePush(config) {
  const firebaseConfig = parseFirebaseConfig(process.env.KNOWME_FIREBASE_ANDROID_GOOGLE_SERVICES_BASE64);
  if (!firebaseConfig) return config;

  config = withProjectBuildGradle(config, mod => {
    mod.modResults.contents = injectRootGradle(mod.modResults.contents);
    return mod;
  });
  config = withAppBuildGradle(config, mod => {
    mod.modResults.contents = injectAppGradle(mod.modResults.contents);
    return mod;
  });
  config = withMainApplication(config, mod => {
    mod.modResults.contents = injectFirebasePackage(mod.modResults.contents);
    return mod;
  });
  config = withAndroidManifest(config, mod => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) throw new Error('Firebase push: Android application missing.');
    application.service ||= [];
    const name = 'com.knowme.app.updates.KnowMeFirebaseMessagingService';
    if (!application.service.some(entry => entry.$?.['android:name'] === name)) {
      application.service.push({
        $: { 'android:name': name, 'android:exported': 'false' },
        'intent-filter': [{ action: [{ $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } }] }]
      });
    }
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const root = mod.modRequest.platformProjectRoot;
    const client = path.join(root, 'app/google-services.json');
    const output = path.join(root, 'app/src/main/java/com/knowme/app/updates');
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(client, JSON.stringify(firebaseConfig), { mode: 0o600 });
    for (const name of ['KnowMeFirebasePushPackage.java',
      'KnowMeFirebasePushModule.java','KnowMeFirebaseMessagingService.java']) {
      await fs.copyFile(path.join(mod.modRequest.projectRoot, 'plugins/native/android', name),
        path.join(output, name));
    }
    return mod;
  }]);
}

module.exports = withKnowMeFirebasePush;
module.exports.parseFirebaseConfig = parseFirebaseConfig;
module.exports.injectRootGradle = injectRootGradle;
module.exports.injectAppGradle = injectAppGradle;
module.exports.injectFirebasePackage = injectFirebasePackage;
