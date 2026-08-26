import { MediaPurgeAlertPayload, MediaPurgeAlertService } from './media-purge-alert.service';

describe('MediaPurgeAlertService', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  const payload: MediaPurgeAlertPayload = {
    event: 'MEDIA_QUARANTINE_PURGE_READINESS',
    readiness: 'BLOCKED_WORKER',
    observedAt: '2026-08-25T21:55:00.000Z',
    backlog: {
      expiredQuarantined: 2,
      retryDue: 1,
      retryScheduled: 3,
      maxBackoffRetries: 1,
      nextScheduledRetryAt: '2026-08-25T22:00:00.000Z'
    }
  };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.MEDIA_PURGE_ALERT_WEBHOOK_URL = 'https://ops.example.test/hooks/media-purge';
    process.env.MEDIA_PURGE_ALERT_WEBHOOK_TOKEN = 'media-purge-alert-token-with-32-characters';
    process.env.MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS = '1000';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('accepts valid alert configuration during production startup', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new MediaPurgeAlertService().onModuleInit()).not.toThrow();
  });

  it('fails production startup when alert configuration is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MEDIA_PURGE_ALERT_WEBHOOK_URL;

    expect(() => new MediaPurgeAlertService().onModuleInit()).toThrow(
      /Invalid production media purge alert configuration/
    );
  });

  it.each([
    ['http://ops.example.test/hooks/media-purge', 'media-purge-alert-token-with-32-characters', '1000'],
    ['https://user:pass@ops.example.test/hooks/media-purge', 'media-purge-alert-token-with-32-characters', '1000'],
    ['https://ops.example.test/hooks/media-purge?secret=x', 'media-purge-alert-token-with-32-characters', '1000'],
    ['https://ops.example.test/hooks/media-purge', 'short', '1000'],
    ['https://ops.example.test/hooks/media-purge', 'media-purge-alert-token-with-32-characters', '01000'],
    ['https://ops.example.test/hooks/media-purge', 'media-purge-alert-token-with-32-characters', '499'],
    ['https://ops.example.test/hooks/media-purge', 'media-purge-alert-token-with-32-characters', '10001']
  ])('fails production startup for unsafe alert configuration', (url, token, timeout) => {
    process.env.NODE_ENV = 'production';
    process.env.MEDIA_PURGE_ALERT_WEBHOOK_URL = url;
    process.env.MEDIA_PURGE_ALERT_WEBHOOK_TOKEN = token;
    process.env.MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS = timeout;

    expect(() => new MediaPurgeAlertService().onModuleInit()).toThrow(
      /Invalid production media purge alert configuration/
    );
  });

  it('does not require production alert configuration outside production', () => {
    delete process.env.MEDIA_PURGE_ALERT_WEBHOOK_URL;
    expect(() => new MediaPurgeAlertService().onModuleInit()).not.toThrow();
  });

  it('skips non-alertable readiness states without network access', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(new MediaPurgeAlertService().notify({ ...payload, readiness: 'CLEAR' })).resolves.toBe(
      'SKIPPED_NOT_CONFIGURED'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed when webhook configuration is missing', async () => {
    delete process.env.MEDIA_PURGE_ALERT_WEBHOOK_URL;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(new MediaPurgeAlertService().notify(payload)).resolves.toBe('SKIPPED_NOT_CONFIGURED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['http://ops.example.test/hooks/media-purge', 'media-purge-alert-token-with-32-characters', '1000'],
    ['https://user:pass@ops.example.test/hooks/media-purge', 'media-purge-alert-token-with-32-characters', '1000'],
    ['https://ops.example.test/hooks/media-purge?secret=x', 'media-purge-alert-token-with-32-characters', '1000'],
    ['https://ops.example.test/hooks/media-purge', 'short', '1000'],
    ['https://ops.example.test/hooks/media-purge', 'media-purge-alert-token-with-32-characters', '01000'],
    ['https://ops.example.test/hooks/media-purge', 'media-purge-alert-token-with-32-characters', '499'],
    ['https://ops.example.test/hooks/media-purge', 'media-purge-alert-token-with-32-characters', '10001']
  ])('rejects unsafe alert configuration', async (url, token, timeout) => {
    process.env.MEDIA_PURGE_ALERT_WEBHOOK_URL = url;
    process.env.MEDIA_PURGE_ALERT_WEBHOOK_TOKEN = token;
    process.env.MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS = timeout;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(new MediaPurgeAlertService().notify(payload)).resolves.toBe('SKIPPED_NOT_CONFIGURED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('delivers only the bounded aggregate payload', async () => {
    const fetchSpy = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(new MediaPurgeAlertService().notify(payload)).resolves.toBe('DELIVERED');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ops.example.test/hooks/media-purge');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      authorization: 'Bearer media-purge-alert-token-with-32-characters',
      'content-type': 'application/json'
    });
    expect(JSON.parse(String(options.body))).toEqual(payload);
    expect(String(options.body)).not.toMatch(/ownerId|storageKey|filename|hash|email|token/i);
  });

  it.each([500, 503])('reports failed delivery on HTTP %s', async (status) => {
    global.fetch = jest.fn().mockResolvedValue(new Response('failed', { status })) as unknown as typeof fetch;
    await expect(new MediaPurgeAlertService().notify(payload)).resolves.toBe('FAILED');
  });

  it('reports failed delivery when the provider is unavailable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    await expect(new MediaPurgeAlertService().notify(payload)).resolves.toBe('FAILED');
  });
});
