const SHA40 = /^[0-9a-f]{40}$/;
const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export interface RuntimeReleaseIdentity {
  commit: string | null;
  version: string | null;
}

function canonicalCommit(value: string | undefined): string | null {
  if (typeof value !== 'string' || value !== value.trim() || !SHA40.test(value)) return null;
  return value;
}

function canonicalVersion(value: string | undefined): string | null {
  if (typeof value !== 'string' || value !== value.trim() || !RELEASE_VERSION.test(value)) return null;
  return value;
}

export function resolveRuntimeReleaseIdentity(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeReleaseIdentity {
  const commit = canonicalCommit(env.KNOWME_RELEASE_COMMIT);
  const version = canonicalVersion(env.KNOWME_RELEASE_VERSION);

  if (env.NODE_ENV === 'production') {
    if (commit === null) {
      throw new Error(
        'KNOWME_RELEASE_COMMIT must be an explicit lowercase 40-character Git commit SHA in production.',
      );
    }
    if (version === null) {
      throw new Error(
        'KNOWME_RELEASE_VERSION must be an explicit canonical SemVer version without build metadata in production.',
      );
    }
  }

  return { commit, version };
}
