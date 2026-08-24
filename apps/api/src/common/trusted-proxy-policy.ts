const MIN_TRUSTED_PROXY_HOPS = 0;
const MAX_TRUSTED_PROXY_HOPS = 5;
const DEFAULT_DEVELOPMENT_TRUSTED_PROXY_HOPS = 0;

export type TrustedProxyEnvironment = Pick<NodeJS.ProcessEnv, 'NODE_ENV' | 'TRUSTED_PROXY_HOPS'>;

export function createTrustedProxySetting(env: TrustedProxyEnvironment = process.env): number {
  const raw = env.TRUSTED_PROXY_HOPS?.trim();

  if (!raw) {
    if (env.NODE_ENV === 'production') {
      throw new Error('TRUSTED_PROXY_HOPS must be explicitly configured in production.');
    }
    return DEFAULT_DEVELOPMENT_TRUSTED_PROXY_HOPS;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(
      `TRUSTED_PROXY_HOPS must be an integer between ${MIN_TRUSTED_PROXY_HOPS} and ${MAX_TRUSTED_PROXY_HOPS}.`
    );
  }

  const hops = Number(raw);
  if (!Number.isSafeInteger(hops) || hops < MIN_TRUSTED_PROXY_HOPS || hops > MAX_TRUSTED_PROXY_HOPS) {
    throw new Error(
      `TRUSTED_PROXY_HOPS must be an integer between ${MIN_TRUSTED_PROXY_HOPS} and ${MAX_TRUSTED_PROXY_HOPS}.`
    );
  }

  return hops;
}
