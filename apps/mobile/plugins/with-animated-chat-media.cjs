'use strict';

// Expo SDK 53's generated Android Gradle project uses these properties to
// include Fresco's optional GIF and animated WebP decoders. Keeping this in
// a local config plugin avoids an unpinned native library or lockfile change.
const { withGradleProperties } = require('expo/config-plugins');

const ENABLED = [
  ['expo.gif.enabled', 'true'],
  ['expo.webp.enabled', 'true'],
  ['expo.webp.animated', 'true']
];

function upsertProperty(items, key, value) {
  let found = false;
  const next = items.map((item) => {
    if (item.type !== 'property' || item.key !== key) return item;
    if (found) return null;
    found = true;
    return { ...item, value };
  }).filter(Boolean);
  if (!found) next.push({ type: 'property', key, value });
  return next;
}

module.exports = function withKnowMeAnimatedChatMedia(config) {
  return withGradleProperties(config, (mod) => {
    for (const [key, value] of ENABLED) {
      mod.modResults = upsertProperty(mod.modResults, key, value);
    }
    return mod;
  });
};
