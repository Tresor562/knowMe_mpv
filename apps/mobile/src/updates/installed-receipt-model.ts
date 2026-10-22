// A completed Android APK install has already been verified by the native
// status provider. Its confirmation dialog is informational, not an app gate.
// Keep the user's dismissal per installed version even if an older APK does
// not expose the native cleanup method or cleanup fails.
export function installedUpdateNoticeStorageKey(versionCode: number): string {
  return `knowme.android.installed-update-dismissed.v1.${versionCode}`;
}

export async function shouldHideInstalledUpdateNotice(
  versionCode: number,
  dismissedVersion: number,
  readPersisted: (key: string) => Promise<string | null>
): Promise<boolean> {
  if (!Number.isSafeInteger(versionCode) || versionCode < 1) return false;
  if (versionCode === dismissedVersion) return true;
  try {
    return (await readPersisted(installedUpdateNoticeStorageKey(versionCode))) === '1';
  } catch {
    // A storage outage must not erase a same-session dismissal, and must
    // never be treated as proof of installation.
    return false;
  }
}
