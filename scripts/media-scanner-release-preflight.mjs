export function validateMediaScannerReleasePolicy() {
  throw new Error(
    'Market release blocked: production media scanning is not yet backed by a validated external scanner. Keep uploaded media quarantined until that integration is implemented and verified.'
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    validateMediaScannerReleasePolicy();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Media scanner release preflight failed.');
    process.exitCode = 1;
  }
}
