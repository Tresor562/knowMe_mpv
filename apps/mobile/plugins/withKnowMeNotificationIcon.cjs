'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

// Sets the brand silhouette for FCM notifications. In-app notifications are
// controlled separately by KnowMe, and this plugin does not enable push.
function withKnowMeNotificationIcon(config) {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) throw new Error('KnowMe branding: Android application is missing');
    application['meta-data'] ||= [];
    const key = 'com.google.firebase.messaging.default_notification_icon';
    const value = '@drawable/knowme_notification_icon';
    const entry = application['meta-data'].find((item) => item.$?.['android:name'] === key);
    if (entry) {
      entry.$['android:resource'] = value;
    } else {
      application['meta-data'].push({
        $: { 'android:name': key, 'android:resource': value }
      });
    }
    return mod;
  });

  config = withDangerousMod(config, ['android', async (mod) => {
    const source = path.join(mod.modRequest.projectRoot, 'assets/branding/knowme-notification.png');
    const directory = path.join(
      mod.modRequest.platformProjectRoot, 'app/src/main/res/drawable-nodpi'
    );
    await fs.mkdir(directory, { recursive: true });
    await fs.copyFile(source, path.join(directory, 'knowme_notification_icon.png'));
    return mod;
  }]);
  return config;
}

module.exports = withKnowMeNotificationIcon;
