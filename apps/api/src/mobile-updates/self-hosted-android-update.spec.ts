import { mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  openHostedAndroidApk, readHostedAndroidRelease, validateHostedManifest
} from './self-hosted-android-update';

const cert = 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c';
const filename = 'KnowMe-1.1.8-preview.apk';
const base = {
  versionCode: 10,
  version: '1.1.8',
  filename,
  size: 10_000_001,
  sha256: 'a'.repeat(64),
  signingCertSha256: cert,
  required: false
};

describe('KnowMe first-party Android APK distribution', () => {
  const priorDir = process.env.KNOWME_ANDROID_UPDATES_DIR;
  const priorBase = process.env.KNOWME_ANDROID_UPDATE_BASE_URL;
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'knowme-selfhost-apk-'));
    process.env.KNOWME_ANDROID_UPDATES_DIR = directory;
    process.env.KNOWME_ANDROID_UPDATE_BASE_URL =
      'https://31-56-85-53.sslip.io/knowme-api';
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
    if (priorDir === undefined) delete process.env.KNOWME_ANDROID_UPDATES_DIR;
    else process.env.KNOWME_ANDROID_UPDATES_DIR = priorDir;
    if (priorBase === undefined) delete process.env.KNOWME_ANDROID_UPDATE_BASE_URL;
    else process.env.KNOWME_ANDROID_UPDATE_BASE_URL = priorBase;
  });

  it('rejects manifest with incompatible signing certificate or release file', () => {
    expect(validateHostedManifest({ ...base, signingCertSha256: 'b'.repeat(64) })).toBeNull();
    expect(validateHostedManifest({ ...base, filename: '../outside.apk' })).toBeNull();
    expect(validateHostedManifest({ ...base, sha256: 'bad' })).toBeNull();
    expect(validateHostedManifest({ ...base, versionCode: 0 })).toBeNull();
    expect(validateHostedManifest({ ...base, url: 'https://attacker.invalid/evil.apk' }))
      .toEqual(expect.objectContaining({
        url: 'https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android/apk/' + filename
      }));
  });

  it('refuses missing or incomplete binaries', () => {
    writeFileSync(join(directory, 'android-preview.json'), JSON.stringify(base));
    expect(readHostedAndroidRelease()).toBeNull();
    writeFileSync(join(directory, filename), 'tiny');
    expect(readHostedAndroidRelease()).toBeNull();
  });

  it('serves only the exact advertised immutable artifact', () => {
    const apkPath = join(directory, filename);
    writeFileSync(apkPath, '');
    truncateSync(apkPath, base.size);
    writeFileSync(join(directory, 'android-preview.json'), JSON.stringify(base));
    const release = readHostedAndroidRelease();
    expect(release?.versionCode).toBe(10);
    expect(release?.url).toMatch(/sslip\.io\/knowme-api\/mobile-updates\/android\/apk\//);
    expect(openHostedAndroidApk('KnowMe-1.1.7-preview.apk')).toBeNull();
    expect(openHostedAndroidApk(filename)?.size).toBe(base.size);
    openHostedAndroidApk(filename)?.stream.destroy();
  });
});
