import { MediaService } from './media.service';

describe('MediaService production scan boundary', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  const scan = (buffer: Buffer) =>
    (MediaService.prototype as unknown as { scan(value: Buffer): { verdict: string; reference: string } }).scan(
      buffer,
    );

  it('keeps the local signature path available outside production', () => {
    process.env.NODE_ENV = 'test';
    expect(scan(Buffer.from('ordinary test payload'))).toEqual({
      verdict: 'CLEAN',
      reference: 'LOCAL_SIGNATURE_V1',
    });
  });

  it('quarantines ordinary uploads in production until a real scanner exists', () => {
    process.env.NODE_ENV = 'production';
    expect(scan(Buffer.from('ordinary production payload'))).toEqual({
      verdict: 'UNAVAILABLE',
      reference: 'EXTERNAL_SCANNER_REQUIRED',
    });
  });

  it('still recognizes the EICAR test signature before the production fallback', () => {
    process.env.NODE_ENV = 'production';
    expect(scan(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'))).toEqual({
      verdict: 'INFECTED',
      reference: 'LOCAL:EICAR',
    });
  });
});
