import { readAndroidReleaseNotice } from './mobile-updates.controller';

describe('Android release feed', () => {
  const valid = {
    KNOWME_ANDROID_UPDATE_VERSION_CODE: '2',
    KNOWME_ANDROID_UPDATE_VERSION: '1.1.0',
    KNOWME_ANDROID_UPDATE_URL: 'https://github.com/Tresor562/knowMe_mpv/releases/download/v1.1.0/KnowMe-1.1.0.apk',
    KNOWME_ANDROID_UPDATE_SHA256: 'a'.repeat(64),
    KNOWME_ANDROID_UPDATE_NOTES: 'Nouveautés',
    KNOWME_ANDROID_UPDATE_REQUIRED: 'false'
  };

  it('does not advertise unconfigured releases', () => {
    expect(readAndroidReleaseNotice({})).toBeNull();
  });

  it('advertises a verified GitHub release', () => {
    expect(readAndroidReleaseNotice(valid)).toEqual({
      versionCode: 2,
      version: '1.1.0',
      url: valid.KNOWME_ANDROID_UPDATE_URL,
      sha256: 'a'.repeat(64),
      notes: 'Nouveautés',
      required: false
    });
  });

  it.each([
    'http://example.com/knowme.apk',
    'https://github.com/attacker/app/releases/download/x/KnowMe.apk',
    'https://attacker@github.com/Tresor562/knowMe_mpv/releases/download/x/KnowMe.apk',
    'https://bad.example/KnowMe.apk'
  ])('rejects untrusted download address %s', (url) => {
    expect(readAndroidReleaseNotice({ ...valid, KNOWME_ANDROID_UPDATE_URL: url })).toBeNull();
  });

  it('supports only an explicit HTTPS self-hosted domain', () => {
    expect(readAndroidReleaseNotice({
      ...valid,
      KNOWME_ANDROID_UPDATE_URL: 'https://updates.knowme.example/KnowMe.apk'
    })).toBeNull();
    expect(readAndroidReleaseNotice({
      ...valid,
      KNOWME_ANDROID_UPDATE_URL: 'https://updates.knowme.example/KnowMe.apk',
      KNOWME_ANDROID_UPDATE_ALLOWED_HOST: 'updates.knowme.example'
    })?.url).toBe('https://updates.knowme.example/KnowMe.apk');
  });

  it('rejects missing or malformed digest and invalid identifiers', () => {
    expect(readAndroidReleaseNotice({ ...valid, KNOWME_ANDROID_UPDATE_SHA256: '' })).toBeNull();
    expect(readAndroidReleaseNotice({ ...valid, KNOWME_ANDROID_UPDATE_SHA256: 'abc' })).toBeNull();
    expect(readAndroidReleaseNotice({ ...valid, KNOWME_ANDROID_UPDATE_VERSION_CODE: '0' })).toBeNull();
    expect(readAndroidReleaseNotice({ ...valid, KNOWME_ANDROID_UPDATE_VERSION: '1.1.0-preview' })).toBeNull();
  });
});
