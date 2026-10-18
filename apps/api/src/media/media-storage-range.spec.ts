import { MediaStorageService } from './media-storage.service';

const ENV={...process.env};
function s3Env(){
  process.env.NODE_ENV='production';
  process.env.MEDIA_STORAGE_DRIVER='s3';
  process.env.MEDIA_S3_ENDPOINT='https://objects.example.com/private';
  process.env.MEDIA_S3_BUCKET='knowme-private-media';
  process.env.MEDIA_S3_REGION='us-east-1';
  process.env.MEDIA_S3_ACCESS_KEY_ID='storage-access-id';
  process.env.MEDIA_S3_SECRET_ACCESS_KEY='storage-secret-not-to-expose';
  process.env.MEDIA_S3_MAX_ATTEMPTS='1';
}

describe('bounded private-media object reads',()=>{
  afterEach(()=>{
    process.env={...ENV};
    jest.restoreAllMocks();
  });

  it('obtains the S3 object size with an authenticated HEAD, no GET body',async()=>{
    s3Env();
    const fetchMock=jest.spyOn(global,'fetch').mockResolvedValue(
      new Response(null,{status:200,headers:{'content-length':'2500000000'}})
    );
    const storage=new MediaStorageService();
    await expect(storage.size('video-1.mp4')).resolves.toBe(2500000000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url,init]=fetchMock.mock.calls[0];
    expect(String(url)).not.toContain(process.env.MEDIA_S3_SECRET_ACCESS_KEY!);
    expect(init?.method).toBe('HEAD');
    const headers=init?.headers as Record<string,string>;
    expect(headers.authorization).toContain('AWS4-HMAC-SHA256');
    expect(headers['x-amz-content-sha256']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('signs bounded S3 GET Range and returns only the requested bytes',async()=>{
    s3Env();
    const fetchMock=jest.spyOn(global,'fetch').mockResolvedValue(
      new Response(new Uint8Array(Buffer.from('def')),{status:206,headers:{
        'content-range':'bytes 3-5/10'
      }})
    );
    const storage=new MediaStorageService();
    await expect(storage.getByteRange('video-1.mp4',3,5))
      .resolves.toEqual(Buffer.from('def'));
    const headers=fetchMock.mock.calls[0][1]?.headers as Record<string,string>;
    expect(headers.range).toBe('bytes=3-5');
    expect(headers.authorization).toContain('SignedHeaders=');
    expect(headers.authorization).toContain('range');
  });

  it('fails closed if the object storage disregards the Range request',async()=>{
    s3Env();
    jest.spyOn(global,'fetch').mockResolvedValue(
      new Response(new Uint8Array(Buffer.alloc(10)),{status:200})
    );
    await expect(new MediaStorageService().getByteRange('video-1.mp4',3,5))
      .rejects.toThrow('did not honor');
  });

  it('rejects oversized requests and invalid keys without network access',async()=>{
    s3Env();
    const spy=jest.spyOn(global,'fetch');
    const storage=new MediaStorageService();
    await expect(storage.getByteRange('video-1.mp4',0,4*1024*1024))
      .rejects.toThrow('oversized');
    await expect(storage.getByteRange('../key',0,5)).rejects.toThrow('Invalid');
    await expect(storage.getByteRange('video-1.mp4',10,9)).rejects.toThrow('Invalid');
    expect(spy).not.toHaveBeenCalled();
  });

  it('fails closed when the signed range has fewer bytes than expected',async()=>{
    s3Env();
    jest.spyOn(global,'fetch').mockResolvedValue(
      new Response(new Uint8Array(Buffer.from('ab')),{status:206})
    );
    await expect(new MediaStorageService().getByteRange('video-1.mp4',0,3))
      .rejects.toThrow('wrong byte range length');
  });
});
