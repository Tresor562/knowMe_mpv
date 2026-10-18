import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StoriesService } from './stories.service';

describe('StoriesService.visibleByAuthor', () => {
  function setup() {
    const prisma = {
      story: {
        updateMany: jest.fn().mockResolvedValue({count:0}),
        findMany: jest.fn(),
        findFirst: jest.fn()
      },
      user: { findUnique: jest.fn().mockResolvedValue({id:'author'}) },
      friendship: { findMany: jest.fn().mockResolvedValue([
        {requesterId:'viewer',addresseeId:'author'}
      ]) },
      creatorFollow: { findMany: jest.fn().mockResolvedValue([]) },
      storyAudienceGrant: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service=new StoriesService(prisma as any,{} as any,{} as any);
    jest.spyOn(service as any,'serialize').mockImplementation(async (story:any,viewer:string)=>({
      ...story,viewer:{own:viewer===story.authorUserId}
    }));
    return {prisma,service};
  }

  it('lists every visible creator Story beyond one page, with the same feed ACL',async()=>{
    const {prisma,service}=setup();
    const rows=Array.from({length:21},(_,index)=>({
      id:'story-'+index,authorUserId:'author',createdAt:new Date(1700000000000-index)
    }));
    prisma.story.findMany.mockResolvedValue(rows);
    const page=await service.visibleByAuthor('viewer','creator');
    expect(page.stories).toHaveLength(20);
    expect(page.nextCursor).toBe('story-19');
    expect(page.stories[0].viewer.own).toBe(false);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where:{username:'creator'},select:{id:true}
    });
    const query=prisma.story.findMany.mock.calls[0]?.[0];
    expect(query.take).toBe(21);
    expect(query.orderBy).toEqual([{createdAt:'desc'},{id:'desc'}]);
    expect(query.where.AND[1]).toEqual({authorUserId:'author'});
    expect(query.where.AND[0].AND[0].OR).toEqual(expect.arrayContaining([
      {authorUserId:'viewer'},
      {audience:'FRIENDS',authorUserId:{in:['author']}}
    ]));
  });

  it('paginates by allowed Story ID and never expands the author's audience',async()=>{
    const {prisma,service}=setup();
    prisma.story.findFirst.mockResolvedValue({id:'story-19'});
    prisma.story.findMany.mockResolvedValue([{id:'story-20',authorUserId:'author'}]);
    const page=await service.visibleByAuthor('viewer','creator','story-19');
    expect(page.nextCursor).toBeNull();
    expect(page.stories).toHaveLength(1);
    expect(prisma.story.findFirst.mock.calls[0]?.[0].where.AND[0].AND[1])
      .toEqual({authorUserId:'author'});
    expect(prisma.story.findMany).toHaveBeenCalledWith(expect.objectContaining({
      cursor:{id:'story-19'},skip:1,take:21
    }));
  });

  it('rejects a cursor from another creator or an invisible Story',async()=>{
    const {prisma,service}=setup();
    prisma.story.findFirst.mockResolvedValue(null);
    await expect(service.visibleByAuthor('viewer','creator','private-id'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.story.findMany).not.toHaveBeenCalled();
  });

  it('does not reveal nonexistent creator Stories',async()=>{
    const {prisma,service}=setup();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.visibleByAuthor('viewer','missing'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.story.findMany).not.toHaveBeenCalled();
  });
});
