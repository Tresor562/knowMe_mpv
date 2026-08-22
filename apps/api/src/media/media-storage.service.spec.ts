import { MediaStorageService } from './media-storage.service';

const ORIGINAL_ENV = { ...process.env };

function configureS3() {
  process.env.NODE_ENV = 'production';
  process.env.MEDIA_STORAGE_DRIVER = 's3';
  process.env.MEDIA_S3_ENDPOINT = 'https://objects.example.com/private';
  process.env.MEDIA_S3_BUCKET = 'knowme-private-media';
  process.env.MEDIA_S3_REGION = 'us-east-1';
  process.env.MEDIA_S3_ACCESS_KEY_ID = 'knowme-media-service';
  process.env.MEDIA_S3_SECRET_ACCESS_KEY = 'secret-value-that-is-long-and-never-public';
  process.env.MEDIA_S3_TIMEOUT_MS = '30000';
  process.env.MEDIA_S3_MAX_ATTEMPTS = '3';
  delete process.env.MEDIA_S3_SESSION_TOKEN;
}

describe('MediaStorageService', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  it('fails closed when local API disk is selected in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MEDIA_STORAGE_DRIVER = 'local';
    const storage = new MediaStorageService();

    await expect(storage.onModuleInit()).rejects.toThrow('forbidden in production');
  });

  it('signs private S3-compatible writes without putting credentials in the URL', async () => {
    configureS3();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const storage = new MediaStorageService();

    await storage.put('asset-123.webp', Buffer.from('private-media'), 'image/webp');

    expect(storage.storageDriver()).toBe('s3');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://objects.example.com/private/knowme-private-media/asset-123.webp');
    expect(String(url)).not.toContain(process.env.MEDIA_S3_SECRET_ACCESS_KEY!);
    expect(init?.method).toBe('PUT');
    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toContain('AWS4-HMAC-SHA256 Credential=knowme-media-service/');
    expect(headers.authorization).not.toContain(process.env.MEDIA_S3_SECRET_ACCESS_KEY!);
    expect(headers['x-amz-content-sha256']).toMatch(/^[a-f0-9]{64}$/);
    expect(headers['content-type']).toBe('image/webp');
  });

  it('reads object bytes only through the configured private storage endpoint', async () => {
    configureS3();
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(new Uint8Array(Buffer.from('stored-object')), { status: 200 })
    );
    const storage = new MediaStorageService();

    await expect(storage.get('asset-123.webp')).resolves.toEqual(Buffer.from('stored-object'));
  });

  it('retries bounded transient storage failures and then succeeds', async () => {
    configureS3();
    const fetchSpy = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    const storage = new MediaStorageService();

    await expect(storage.put('asset-retry.webp', Buffer.from('private-media'), 'image/webp')).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('does not retry permanent authorization failures', async () => {
    configureS3();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 403 }));
    const storage = new MediaStorageService();

    await expect(storage.get('asset-denied.webp')).rejects.toThrow('HTTP 403');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('stops after the configured maximum number of transient attempts', async () => {
    configureS3();
    process.env.MEDIA_S3_MAX_ATTEMPTS = '2';
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    const storage = new MediaStorageService();

    await expect(storage.delete('asset-failing.webp')).rejects.toThrow('HTTP 503');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('rejects unsafe retry and timeout configuration', () => {
    configureS3();
    process.env.MEDIA_S3_MAX_ATTEMPTS = '99';
    expect(() => new MediaStorageService()).toThrow('MEDIA_S3_MAX_ATTEMPTS');

    configureS3();
    process.env.MEDIA_S3_TIMEOUT_MS = '100';
    expect(() => new MediaStorageService()).toThrow('MEDIA_S3_TIMEOUT_MS');
  });

  it('rejects traversal and nested keys before any storage request', async () => {
    configureS3();
    const fetchSpy = jest.spyOn(global, 'fetch');
    const storage = new MediaStorageService();

    await expect(storage.get('../secret')).rejects.toThrow('Invalid private media storage key');
    await expect(storage.delete('folder/asset.webp')).rejects.toThrow('Invalid private media storage key');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requires HTTPS for S3-compatible storage in production', () => {
    configureS3();
    process.env.MEDIA_S3_ENDPOINT = 'http://objects.example.com';

    expect(() => new MediaStorageService()).toThrow('must use HTTPS in production');
  });
});
