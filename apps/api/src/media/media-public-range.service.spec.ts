import { NotFoundException } from '@nestjs/common';
import { MediaService } from './media.service';

describe('public post storage-backed video ranges',()=>{
  const asset={id:'asset1',ownerId:'author1',storageKey:'private-video.mp4',detectedMime:'video/mp4'};
  function setup(attached=true){
    const prisma={
      mediaAsset:{findFirst:jest.fn().mockResolvedValue(asset)},
      post:{findFirst:jest.fn().mockResolvedValue(attached?{id:'post1'}:null)}
    };
    const storage={
      size:jest.fn().mockResolvedValue(20*1024*1024),
      getByteRange:jest.fn(async (_key:string,start:number,end:number)=>Buffer.alloc(end-start+1)),
      get:jest.fn().mockResolvedValue(Buffer.from('private full media'))
    };
    const service=new MediaService(prisma as any,{} as any,storage as any,{} as any);
    return {service,prisma,storage};
  }

  it('never opens storage for unattached private assets even when a Range is supplied',async()=>{
    const {service,storage}=setup(false);
    await expect(service.readPublicPostRange('asset1','bytes=0-1023'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(storage.size).not.toHaveBeenCalled();
    expect(storage.getByteRange).not.toHaveBeenCalled();
    expect(storage.get).not.toHaveBeenCalled();
  });

  it('limits huge requested ranges to a bounded 4 MiB response',async()=>{
    const {service,prisma,storage}=setup();
    const response=await service.readPublicPostRange('asset1','bytes=0-999999999');
    expect(response.mimeType).toBe('video/mp4');
    expect(response.total).toBe(20*1024*1024);
    expect(response.range).toEqual({start:0,end:4*1024*1024-1,total:20*1024*1024});
    expect(response.buffer.length).toBe(4*1024*1024);
    expect(storage.getByteRange).toHaveBeenCalledWith('private-video.mp4',0,4*1024*1024-1);
    expect(storage.get).not.toHaveBeenCalled();
    expect(prisma.post.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where:expect.objectContaining({authorId:'author1'})
    }));
  });

  it('returns 416 metadata for an invalid range without retrieving file bytes',async()=>{
    const {service,storage}=setup();
    const response=await service.readPublicPostRange('asset1','bytes=0-1,5-10');
    expect(response.unsatisfiable).toBe(true);
    expect(response.buffer.length).toBe(0);
    expect(storage.getByteRange).not.toHaveBeenCalled();
    expect(storage.get).not.toHaveBeenCalled();
  });

  it('keeps public photos compatible with full-file responses',async()=>{
    const {service,prisma,storage}=setup();
    prisma.mediaAsset.findFirst.mockResolvedValue({...asset,detectedMime:'image/jpeg'});
    const result=await service.readPublicPostRange('asset1','bytes=0-2');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.buffer).toEqual(Buffer.from('private full media'));
    expect(result.range).toBeNull();
    expect(storage.size).not.toHaveBeenCalled();
  });

  it('does not return any bytes for a quarantined or missing asset',async()=>{
    const {service,prisma,storage}=setup();
    prisma.mediaAsset.findFirst.mockResolvedValue(null);
    await expect(service.readPublicPostRange('asset1','bytes=0-3'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(storage.size).not.toHaveBeenCalled();
  });
});
