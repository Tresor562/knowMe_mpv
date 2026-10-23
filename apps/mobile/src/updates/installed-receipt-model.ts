// Android verifies installation before returning "installed". Once verified,
// KnowMe must open normally without any confirmation screen or banner.
// Cleanup remains a best-effort, nonblocking background operation.
export function installedUpdateNoticeStorageKey(versionCode: number): string {
  return `knowme.android.installed-update-dismissed.v1.${versionCode}`;
}

export function shouldAutoAcknowledgeInstalledUpdate(
  versionCode: number,
  alreadyRequestedVersion: number
): boolean {
  return Number.isSafeInteger(versionCode) &&
    versionCode > 0 &&
    versionCode !== alreadyRequestedVersion;
}

export function shouldDisplayBackgroundUpdateStatus(
  status: 'none' | 'downloading' | 'ready' | 'failed' | 'installed',
  readyVersion: number
): boolean {
  return readyVersion === 0 && status !== 'none' && status !== 'installed';
}
