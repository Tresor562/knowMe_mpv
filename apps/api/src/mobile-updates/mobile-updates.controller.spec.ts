import { chooseAndroidRelease, readAndroidReleaseNotice } from './mobile-updates.controller';

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


  it('selects newer preview over pinned legacy preview without crossing signing channels', () => {
    const pinned = readAndroidReleaseNotice({
      ...valid,
      KNOWME_ANDROID_UPDATE_VERSION_CODE: '4',
      KNOWME_ANDROID_UPDATE_VERSION: '1.1.2',
      KNOWME_ANDROID_UPDATE_URL: 'https://github.com/Tresor562/knowMe_mpv/releases/download/v1.1.2-preview/KnowMe-1.1.2-preview.apk'
    });
    const newer = readAndroidReleaseNotice({
      ...valid,
      KNOWME_ANDROID_UPDATE_VERSION_CODE: '6',
      KNOWME_ANDROID_UPDATE_VERSION: '1.1.4',
      KNOWME_ANDROID_UPDATE_URL: 'https://github.com/Tresor562/knowMe_mpv/releases/download/v1.1.4-preview/KnowMe-1.1.4-preview.apk'
    });
    expect(chooseAndroidRelease(pinned, newer)).toEqual(newer);
    expect(chooseAndroidRelease(newer, pinned)).toEqual(newer);
    expect(chooseAndroidRelease(pinned, null)).toEqual(pinned);
    expect(chooseAndroidRelease(null, newer)).toEqual(newer);
    const signedProduction = readAndroidReleaseNotice(valid);
    expect(chooseAndroidRelease(signedProduction, newer)).toEqual(signedProduction);
    expect(chooseAndroidRelease(pinned, signedProduction)).toEqual(pinned);
  });

  it('rejects missing or malformed digest and invalid identifiers', () => {
    expect(readAndroidReleaseNotice({ ...valid, KNOWME_ANDROID_UPDATE_SHA256: '' })).toBeNull();
    expect(readAndroidReleaseNotice({ ...valid, KNOWME_ANDROID_UPDATE_SHA256: 'abc' })).toBeNull();
    expect(readAndroidReleaseNotice({ ...valid, KNOWME_ANDROID_UPDATE_VERSION_CODE: '0' })).toBeNull();
    expect(readAndroidReleaseNotice({ ...valid, KNOWME_ANDROID_UPDATE_VERSION: '1.1.0-preview' })).toBeNull();
  });
});
