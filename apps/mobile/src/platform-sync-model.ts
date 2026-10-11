/** Pure, testable platform identity comparison: never infer sync from the version number alone. */
export type PlatformName = 'api' | 'web';

export type PlatformIdentity = {
  platform: PlatformName;
  version: string;
  experienceRevision: string;
  commit: string | null;
};

export type SyncVerdict = 'unavailable' | 'outdated' | 'unverified' | 'synchronized';

export function parsePlatformIdentity(value: unknown, expected: PlatformName): PlatformIdentity {
  if (!value || typeof value !== 'object') throw new Error('Réponse de version invalide.');
  const candidate = value as Record<string, unknown>;
  if (candidate.platform !== expected
    || typeof candidate.version !== 'string' || !candidate.version.trim()
    || typeof candidate.experienceRevision !== 'string' || !candidate.experienceRevision.trim()
    || !(candidate.commit === null || typeof candidate.commit === 'string')
  ) throw new Error('Réponse de version incorrecte.');
  const commit = typeof candidate.commit === 'string' ? candidate.commit.trim().toLowerCase() : null;
  if (commit && !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Identifiant de build invalide.');
  return {
    platform: expected,
    version: candidate.version,
    experienceRevision: candidate.experienceRevision,
    commit: commit || null
  };
}

export function assessPlatformSync(
  android: { version: string; experienceRevision: string; commit: string | null },
  web: PlatformIdentity | null,
  api: PlatformIdentity | null
): SyncVerdict {
  if (!web || !api) return 'unavailable';
  if (
    android.version !== web.version || android.version !== api.version
    || android.experienceRevision !== web.experienceRevision
    || android.experienceRevision !== api.experienceRevision
  ) return 'outdated';
  if (!android.commit || !web.commit || !api.commit) return 'unverified';
  return android.commit.toLowerCase() === web.commit && web.commit === api.commit
    ? 'synchronized' : 'outdated';
}

export function probeErrorMessage(platform: PlatformName, error: unknown) {
  const prefix = platform === 'web' ? 'Site Web' : 'API';
  const details = error instanceof Error ? error.message : 'Erreur inconnue';
  if (typeof error === 'object' && error !== null && 'status' in error
    && (error as {status?: unknown}).status === 404) {
    return prefix + ' : route de version introuvable (HTTP 404). Vérifier le déploiement.';
  }
  return prefix + ' : ' + details;
}
