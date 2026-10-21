import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MediaService } from '../media/media.service';
import { PostsService } from './posts.service';

describe('SavedPost private account operations', () => {
  const prisma={
    post:{findUnique:jest.fn()},
    savedPost:{createMany:jest.fn(),deleteMany:jest.fn(),findUnique:jest.fn(),findMany:jest.fn()}
  };
  const service=new PostsService(prisma as unknown as PrismaService,
    {} as NotificationsService,{} as MediaService);
  beforeEach(()=>{
    jest.resetAllMocks();
    prisma.post.findUnique.mockResolvedValue({id:'p1'});
    prisma.savedPost.createMany.mockResolvedValue({count:1});
    prisma.savedPost.deleteMany.mockResolvedValue({count:1});
    prisma.savedPost.findMany.mockResolvedValue([]);
  });
  it('rejects nonexistent posts without writing bookmarks',async()=>{
    prisma.post.findUnique.mockResolvedValue(null);
    await expect(service.save('u1','unknown')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.savedPost.createMany).not.toHaveBeenCalled();
  });
  it('saves idempotently with uniqueness and user scope',async()=>{
    await expect(service.save('u1','p1')).resolves.toEqual({saved:true});
    expect(prisma.savedPost.createMany).toHaveBeenCalledWith({
      data:[{userId:'u1',postId:'p1'}],skipDuplicates:true
    });
  });
  it('removes only the caller bookmark, idempotently',async()=>{
    await expect(service.unsave('u1','p1')).resolves.toEqual({saved:false});
    expect(prisma.savedPost.deleteMany).toHaveBeenCalledWith({where:{userId:'u1',postId:'p1'}});
  });
  it('does not expose another account bookmark status',async()=>{
    prisma.savedPost.findUnique.mockResolvedValueOnce({id:'bookmark'}).mockResolvedValueOnce(null);
    await expect(service.isSaved('u1','p1')).resolves.toEqual({saved:true});
    await expect(service.isSaved('u2','p1')).resolves.toEqual({saved:false});
    expect(prisma.savedPost.findUnique).toHaveBeenNthCalledWith(1,{
      where:{userId_postId:{userId:'u1',postId:'p1'}},select:{id:true}
    });
    expect(prisma.savedPost.findUnique).toHaveBeenNthCalledWith(2,{
      where:{userId_postId:{userId:'u2',postId:'p1'}},select:{id:true}
    });
  });
  it('lists only own bookmarks, bounded in deterministic order',async()=>{
    await expect(service.saved('u2')).resolves.toEqual([]);
    expect(prisma.savedPost.findMany).toHaveBeenCalledWith({
      where:{userId:'u2'},take:40,
      orderBy:[{createdAt:'desc'},{id:'desc'}],
      select:{postId:true,createdAt:true}
    });
  });
});
