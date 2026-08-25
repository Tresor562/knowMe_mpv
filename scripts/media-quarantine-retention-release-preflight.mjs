const MAX_RETENTION_DAYS = 3650;

function parseCanonicalRetentionDays(env, name) {
  const raw = env[name];
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(`${name} is required for a market release.`);
  }
  const normalized = raw.trim();
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_RETENTION_DAYS || String(parsed) !== normalized) {
    throw new Error(`${name} must be a canonical integer between 1 and ${MAX_RETENTION_DAYS}.`);
  }
  return parsed;
}

export function validateMediaQuarantineRetentionReleaseEnv(env = process.env) {
  return {
    infectedRetentionDays: parseCanonicalRetentionDays(env, 'MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS'),
    unavailableRetentionDays: parseCanonicalRetentionDays(env, 'MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS')
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const policy = validateMediaQuarantineRetentionReleaseEnv(process.env);
    console.log(
      `Media quarantine retention preflight passed (infected=${policy.infectedRetentionDays}d, unavailable=${policy.unavailableRetentionDays}d).`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
