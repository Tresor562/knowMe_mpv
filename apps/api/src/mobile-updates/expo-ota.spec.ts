import {
  getKnowMeExpoUpdate,
  isValidKnowMeExpoManifest,
  KNOWME_OTA_RUNTIME
} from './expo-ota';

const root = 'https://github.com/Tresor562/knowMe_mpv/releases/download/';
const tag = 'knowme-ota-preview-native7-test';
const file = root + tag + '/entry.abc.hbc';
const manifest = {
  id: 'd50e125e-88dd-4a69-a15c-a5a5b280b1da',
  createdAt: '2026-10-16T13:00:00.000Z',
  runtimeVersion: KNOWME_OTA_RUNTIME,
  launchAsset: {
    key: 'bundle-abc', hash: 'A'.repeat(43),
    contentType: 'application/javascript', url: file
  },
  assets: [],
  metadata: { channel: 'preview', platform: 'android' },
  extra: { expoClient: { name: 'KnowMe' } }
};

describe('Expo OTA feed', () => {
  it('accepts an immutable asset from the correct release and runtime', () => {
    expect(isValidKnowMeExpoManifest(manifest, tag)).toBe(true);
  });
  it('rejects cross-channel, runtime and untrusted/remote assets', () => {
    expect(isValidKnowMeExpoManifest({
      ...manifest, runtimeVersion: 'other'
    }, tag)).toBe(false);
    expect(isValidKnowMeExpoManifest({
      ...manifest, metadata: { channel: 'production', platform: 'android' }
    }, tag)).toBe(false);
    expect(isValidKnowMeExpoManifest({
      ...manifest, launchAsset: { ...manifest.launchAsset, url: 'https://evil.invalid/entry.hbc' }
    }, tag)).toBe(false);
    expect(isValidKnowMeExpoManifest({
      ...manifest, launchAsset: { ...manifest.launchAsset, url: root + 'other-tag/entry.hbc' }
    }, tag)).toBe(false);
  });
  it('refuses missing protocol header and non-Android builds', async () => {
    expect((await getKnowMeExpoUpdate({})).status).toBe(400);
    expect((await getKnowMeExpoUpdate({
      'expo-protocol-version': '1', 'expo-platform': 'ios',
      'expo-runtime-version': KNOWME_OTA_RUNTIME,
      'expo-channel-name': 'preview'
    })).status).toBe(204);
    expect((await getKnowMeExpoUpdate({
      'expo-protocol-version': '1', 'expo-platform': 'android',
      'expo-runtime-version': 'old-native-build',
      'expo-channel-name': 'preview'
    })).status).toBe(204);
  });
  it('defaults to disabled until API deployment is explicitly enabled', async () => {
    const previous = process.env.KNOWME_EXPO_OTA_ENABLED;
    delete process.env.KNOWME_EXPO_OTA_ENABLED;
    try {
      expect((await getKnowMeExpoUpdate({
        'expo-protocol-version': '1', 'expo-platform': 'android',
        'expo-runtime-version': KNOWME_OTA_RUNTIME,
        'expo-channel-name': 'preview'
      })).status).toBe(204);
    } finally {
      if (previous === undefined) delete process.env.KNOWME_EXPO_OTA_ENABLED;
      else process.env.KNOWME_EXPO_OTA_ENABLED = previous;
    }
  });
});
