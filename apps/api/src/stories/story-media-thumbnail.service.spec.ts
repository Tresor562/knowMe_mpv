import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StoryMediaService } from './story-media.service';

describe('StoryMediaService.readThumbnail', () => {
  function setup() {
    const stories = {
      get: jest.fn().mockResolvedValue({
        id: 'video-story', authorUserId: 'owner', thumbnailAssetId: 'owned-thumb'
      })
    };
    const prisma = { mediaAsset: { findFirst: jest.fn().mockResolvedValue({
      storageKey:'story-thumbnail-key', detectedMime:'image/webp', originalName:'poster.webp'
    }) } };
    const storage = { get: jest.fn().mockResolvedValue(Buffer.from('mock-thumbnail')) };
    const service=new StoryMediaService(prisma as any,storage as any,stories as any);
    return {service,stories,prisma,storage};
  }

  it('checks story visibility before looking up any private thumbnail bytes',async()=>{
    const {service,stories,prisma,storage}=setup();
    stories.get.mockRejectedValue(new ForbiddenException('private story'));
    await expect(service.readThumbnail('stranger','video-story'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.mediaAsset.findFirst).not.toHaveBeenCalled();
    expect(storage.get).not.toHaveBeenCalled();
  });

  it('only reads owner-matched small image thumbnails, never video bodies',async()=>{
    const {service,stories,prisma,storage}=setup();
    const value=await service.readThumbnail('friend','video-story');
    expect(stories.get).toHaveBeenCalledWith('friend','video-story');
    expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith({
      where:{
        id:'owned-thumb',ownerId:'owner',purpose:'STORY',
        deletedAt:null,status:'AVAILABLE',
        detectedMime:{in:['image/jpeg','image/png','image/webp']},
        size:{lte:5*1024*1024}
      },
      select:{storageKey:true,detectedMime:true,originalName:true}
    });
    expect(storage.get).toHaveBeenCalledWith('story-thumbnail-key');
    expect(value.mimeType).toBe('image/webp');
  });

  it('fails closed if thumbnail is absent or not owned by the story author',async()=>{
    const {service,prisma,storage}=setup();
    prisma.mediaAsset.findFirst.mockResolvedValue(null);
    await expect(service.readThumbnail('friend','video-story'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(storage.get).not.toHaveBeenCalled();
  });

  it('does not fetch media when the Story has no thumbnail identifier',async()=>{
    const {service,stories,prisma}=setup();
    stories.get.mockResolvedValue({
      id:'video-story',authorUserId:'owner',thumbnailAssetId:null
    });
    await expect(service.readThumbnail('friend','video-story'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.mediaAsset.findFirst).not.toHaveBeenCalled();
  });
});
