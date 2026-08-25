import { applyHttpServerTimeoutPolicy, resolveHttpServerTimeoutPolicy } from './http-server-policy';

describe('HTTP server timeout policy', () => {
  it('uses bounded defaults outside production', () => {
    expect(resolveHttpServerTimeoutPolicy({ NODE_ENV: 'test' })).toEqual({
      requestTimeoutMs: 30_000,
      headersTimeoutMs: 15_000,
      keepAliveTimeoutMs: 5_000,
    });
  });

  it('requires all timeout values in production', () => {
    expect(() => resolveHttpServerTimeoutPolicy({ NODE_ENV: 'production' })).toThrow(
      'API_REQUEST_TIMEOUT_MS is required in production.',
    );
  });

  it('accepts a coherent production timeout policy', () => {
    expect(
      resolveHttpServerTimeoutPolicy({
        NODE_ENV: 'production',
        API_REQUEST_TIMEOUT_MS: '30000',
        API_HEADERS_TIMEOUT_MS: '15000',
        API_KEEP_ALIVE_TIMEOUT_MS: '5000',
      }),
    ).toEqual({ requestTimeoutMs: 30_000, headersTimeoutMs: 15_000, keepAliveTimeoutMs: 5_000 });
  });

  it.each([
    ['API_REQUEST_TIMEOUT_MS', '030000'],
    ['API_HEADERS_TIMEOUT_MS', '0'],
    ['API_KEEP_ALIVE_TIMEOUT_MS', '5.5'],
  ])('rejects non-canonical %s=%s', (name, value) => {
    expect(() =>
      resolveHttpServerTimeoutPolicy({
        NODE_ENV: 'production',
        API_REQUEST_TIMEOUT_MS: name === 'API_REQUEST_TIMEOUT_MS' ? value : '30000',
        API_HEADERS_TIMEOUT_MS: name === 'API_HEADERS_TIMEOUT_MS' ? value : '15000',
        API_KEEP_ALIVE_TIMEOUT_MS: name === 'API_KEEP_ALIVE_TIMEOUT_MS' ? value : '5000',
      }),
    ).toThrow();
  });

  it('rejects headers timeout above the request timeout', () => {
    expect(() =>
      resolveHttpServerTimeoutPolicy({
        NODE_ENV: 'production',
        API_REQUEST_TIMEOUT_MS: '10000',
        API_HEADERS_TIMEOUT_MS: '15000',
        API_KEEP_ALIVE_TIMEOUT_MS: '5000',
      }),
    ).toThrow('API_HEADERS_TIMEOUT_MS must be less than or equal to API_REQUEST_TIMEOUT_MS.');
  });

  it('rejects keep-alive timeout that can outlive the request timeout', () => {
    expect(() =>
      resolveHttpServerTimeoutPolicy({
        NODE_ENV: 'production',
        API_REQUEST_TIMEOUT_MS: '10000',
        API_HEADERS_TIMEOUT_MS: '8000',
        API_KEEP_ALIVE_TIMEOUT_MS: '10000',
      }),
    ).toThrow('API_KEEP_ALIVE_TIMEOUT_MS must be lower than API_REQUEST_TIMEOUT_MS.');
  });

  it('applies the resolved values to the Node HTTP server', () => {
    const server = { requestTimeout: 0, headersTimeout: 0, keepAliveTimeout: 0 };
    applyHttpServerTimeoutPolicy(server, {
      requestTimeoutMs: 40_000,
      headersTimeoutMs: 20_000,
      keepAliveTimeoutMs: 4_000,
    });

    expect(server).toEqual({ requestTimeout: 40_000, headersTimeout: 20_000, keepAliveTimeout: 4_000 });
  });
});
