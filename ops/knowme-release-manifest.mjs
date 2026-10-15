/**
 * Resolve the release identity from the exact KnowMe source checkout.
 * Never preserve an old runtime version when deploying a newer commit.
 */
export function readCheckedOutKnowMeVersion(text) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw new Error('KnowMe deployment manifest is not valid JSON.');
  }
  if (manifest?.product !== 'KnowMe' ||
      !/^\d+\.\d+\.\d+$/.test(manifest?.productVersion ?? '') ||
      !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(manifest?.contractRevision ?? '')) {
    throw new Error('KnowMe source/version contract is missing or invalid.');
  }
  return manifest.productVersion;
}
