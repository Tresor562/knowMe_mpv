import { MediaService } from './media.service';

describe('MediaService production scan boundary', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  function setup() {
    const externalScanner = {
      scan: jest.fn().mockResolvedValue({ verdict: 'CLEAN', reference: 'provider:clean' })
    };
    const service = new MediaService({} as never, {} as never, {} as never, externalScanner as never);
    const scan = (buffer: Buffer, mimeType = 'image/png') =>
      (service as unknown as {
        scan(value: Buffer, mime: string): Promise<{ verdict: string; reference: string }>;
      }).scan(buffer, mimeType);
    return { externalScanner, scan };
  }

  it('keeps the local signature path available outside production', async () => {
    process.env.NODE_ENV = 'test';
    const { externalScanner, scan } = setup();

    await expect(scan(Buffer.from('ordinary test payload'))).resolves.toEqual({
      verdict: 'CLEAN',
      reference: 'LOCAL_SIGNATURE_V1'
    });
    expect(externalScanner.scan).not.toHaveBeenCalled();
  });

  it('routes ordinary production payloads through the external scanner', async () => {
    process.env.NODE_ENV = 'production';
    const { externalScanner, scan } = setup();

    await expect(scan(Buffer.from('ordinary production payload'), 'application/pdf')).resolves.toEqual({
      verdict: 'CLEAN',
      reference: 'provider:clean'
    });
    expect(externalScanner.scan).toHaveBeenCalledWith(
      Buffer.from('ordinary production payload'),
      { mimeType: 'application/pdf' }
    );
  });

  it('propagates unavailable external verdicts so uploads remain quarantined', async () => {
    process.env.NODE_ENV = 'production';
    const { externalScanner, scan } = setup();
    externalScanner.scan.mockResolvedValueOnce({
      verdict: 'UNAVAILABLE',
      reference: 'EXTERNAL_SCANNER_UNAVAILABLE'
    });

    await expect(scan(Buffer.from('ordinary production payload'))).resolves.toEqual({
      verdict: 'UNAVAILABLE',
      reference: 'EXTERNAL_SCANNER_UNAVAILABLE'
    });
  });

  it('still recognizes the EICAR test signature before contacting the provider', async () => {
    process.env.NODE_ENV = 'production';
    const { externalScanner, scan } = setup();

    await expect(scan(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'))).resolves.toEqual({
      verdict: 'INFECTED',
      reference: 'LOCAL:EICAR'
    });
    expect(externalScanner.scan).not.toHaveBeenCalled();
  });
});
