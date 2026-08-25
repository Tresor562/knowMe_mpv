import { ExternalMediaScannerService } from './external-media-scanner.service';

describe('ExternalMediaScannerService', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.MEDIA_SCANNER_URL = 'https://scanner.example.test/v1/scan';
    process.env.MEDIA_SCANNER_TOKEN = 'scanner-token-with-at-least-32-characters';
    process.env.MEDIA_SCANNER_TIMEOUT_MS = '1000';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('fails closed when configuration is missing', async () => {
    delete process.env.MEDIA_SCANNER_URL;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(new ExternalMediaScannerService().scan(Buffer.from('payload'), { mimeType: 'image/png' })).resolves.toEqual({
      verdict: 'UNAVAILABLE',
      reference: 'EXTERNAL_SCANNER_NOT_CONFIGURED'
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['http://scanner.example.test/v1/scan', 'scanner-token-with-at-least-32-characters', '1000'],
    ['https://user:pass@scanner.example.test/v1/scan', 'scanner-token-with-at-least-32-characters', '1000'],
    ['https://scanner.example.test/v1/scan?secret=x', 'scanner-token-with-at-least-32-characters', '1000'],
    ['https://scanner.example.test/v1/scan', 'short', '1000'],
    ['https://scanner.example.test/v1/scan', 'scanner-token-with-at-least-32-characters', '01000'],
    ['https://scanner.example.test/v1/scan', 'scanner-token-with-at-least-32-characters', '499'],
    ['https://scanner.example.test/v1/scan', 'scanner-token-with-at-least-32-characters', '10001']
  ])('rejects unsafe scanner configuration', async (url, token, timeout) => {
    process.env.MEDIA_SCANNER_URL = url;
    process.env.MEDIA_SCANNER_TOKEN = token;
    process.env.MEDIA_SCANNER_TIMEOUT_MS = timeout;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(new ExternalMediaScannerService().scan(Buffer.from('payload'), { mimeType: 'image/png' })).resolves.toEqual({
      verdict: 'UNAVAILABLE',
      reference: 'EXTERNAL_SCANNER_NOT_CONFIGURED'
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends only bounded metadata and accepts a strict clean verdict', async () => {
    const fetchSpy = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ verdict: 'CLEAN', reference: 'provider:abc123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const payload = Buffer.from('payload');
    await expect(new ExternalMediaScannerService().scan(payload, { mimeType: 'image/png' })).resolves.toEqual({
      verdict: 'CLEAN',
      reference: 'provider:abc123'
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://scanner.example.test/v1/scan');
    expect(options.method).toBe('POST');
    expect(options.body).toBe(payload);
    expect(options.headers).toEqual(
      expect.objectContaining({
        authorization: 'Bearer scanner-token-with-at-least-32-characters',
        'content-type': 'application/octet-stream',
        'x-knowme-content-type': 'image/png'
      })
    );
    expect((options.headers as Record<string, string>)['x-knowme-content-sha256']).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    [{ verdict: 'UNKNOWN', reference: 'x' }, 'EXTERNAL_SCANNER_INVALID_RESPONSE'],
    [{ verdict: 'CLEAN', reference: 'x', extra: true }, 'EXTERNAL_SCANNER_INVALID_RESPONSE'],
    [{ verdict: 'CLEAN', reference: 'bad\nreference' }, 'EXTERNAL_SCANNER_INVALID_RESPONSE']
  ])('fails closed on invalid provider payloads', async (body, expectedReference) => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 })
    ) as unknown as typeof fetch;

    await expect(new ExternalMediaScannerService().scan(Buffer.from('payload'), { mimeType: 'image/png' })).resolves.toEqual({
      verdict: 'UNAVAILABLE',
      reference: expectedReference
    });
  });

  it('fails closed on provider HTTP errors', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('unavailable', { status: 503 })) as unknown as typeof fetch;

    await expect(new ExternalMediaScannerService().scan(Buffer.from('payload'), { mimeType: 'image/png' })).resolves.toEqual({
      verdict: 'UNAVAILABLE',
      reference: 'EXTERNAL_SCANNER_HTTP_ERROR'
    });
  });
});
