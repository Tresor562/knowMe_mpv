import { parseSingleByteRange } from './video-byte-range';

describe('public MP4 HTTP byte ranges', () => {
  it('accepts regular, open-ended and suffix ranges', () => {
    expect(parseSingleByteRange('bytes=0-99',1000)).toEqual({start:0,end:99});
    expect(parseSingleByteRange('bytes=900-',1000)).toEqual({start:900,end:999});
    expect(parseSingleByteRange('bytes=-100',1000)).toEqual({start:900,end:999});
    expect(parseSingleByteRange('bytes=-9999',1000)).toEqual({start:0,end:999});
    expect(parseSingleByteRange('bytes=990-9999',1000)).toEqual({start:990,end:999});
  });

  it('rejects multipart ranges, invalid offsets and unsafe values', () => {
    for (const header of [
      'bytes=0-100,200-300','bytes=','bytes=1000-','bytes=-0',
      'bytes=500-499','bytes=-9007199254740992','items=0-3',
      'bytes=0-9999999999999999999','bytes=-10,20-'
    ]) {
      expect(parseSingleByteRange(header,1000)).toBeNull();
    }
    expect(parseSingleByteRange('bytes=0-1',0)).toBeNull();
    expect(parseSingleByteRange('bytes=0-1',Number.MAX_SAFE_INTEGER + 1)).toBeNull();
  });
});
