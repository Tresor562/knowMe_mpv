import { PostsService } from './posts.service';

describe('video-only KnowMe feed', () => {
  function setup() {
    const author = {
      id: 'creator-1', username:'creator', displayName:'Creator',
      email: 'private@example.test',avatarUrl:null,
      staffAccount:null,verificationRequests:[]
    };
    const prisma = {
      post: {findMany: jest.fn().mockResolvedValue([{
        id:'post-3',author,content:'My long clip',
        _count:{likes:12,comments:4},
        media:[{id:'attachment-1',assetId:'mp4-1',mimeType:'video/mp4',position:2}]
      }])}
    };
    return {service:new PostsService(prisma as any, {} as any, {} as any),prisma};
  }

  it('filters only video posts in SQL, with 20-post pagination', async()=>{
    const {service,prisma}=setup();
    await service.videos('post-4');
    expect(prisma.post.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where:{media:{some:{mimeType:'video/mp4'}}},
      cursor:{id:'post-4'},skip:1,take:20,
      orderBy:[{createdAt:'desc'},{id:'desc'}],
      include:expect.objectContaining({
        media:{where:{mimeType:'video/mp4'},orderBy:{position:'asc'}},
        _count:{select:{likes:true,comments:true}}
      })
    }));
  });

  it('returns playable public media URLs and never exposes the author email',async()=>{
    const {service}=setup();
    const clips=await service.videos();
    expect(clips).toHaveLength(1);
    expect(clips[0].media).toEqual([{
      url:'/media/public/post/mp4-1',mimeType:'video/mp4',position:2
    }]);
    expect(clips[0].author).toMatchObject({id:'creator-1',username:'creator'});
    expect(clips[0].author).not.toHaveProperty('email');
  });

  it('returns an empty page rather than attempting to invent videos',async()=>{
    const {service,prisma}=setup();
    prisma.post.findMany.mockResolvedValueOnce([]);
    await expect(service.videos()).resolves.toEqual([]);
  });
});
