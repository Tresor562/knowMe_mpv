import { BadRequestException } from '@nestjs/common';
import { PostsService } from './posts.service';

describe('multi-media publications without mandatory text', () => {
  const author = {
    id:'author-1',username:'author',displayName:'Author',email:'author@example.test',
    staffAccount:null,verificationRequests:[],avatarUrl:null
  };
  function setup() {
    const prisma = {post:{create:jest.fn().mockImplementation(async ({data}:any)=>({
      id:'post-1',content:data.content,imageUrl:data.imageUrl,
      author,media:(data.media?.create??[]).map((item:any)=>({...item}))
    }))}};
    const media={assertOwnedPostMedia:jest.fn().mockImplementation(async(_:string,id:string)=>({
      id,mimeType:id==='video-id'?'video/mp4':'image/png'
    }))};
    const service=new PostsService(prisma as any,{} as any,media as any);
    return {service,prisma,media};
  }
  it('rejects empty text when no assets are attached', async () => {
    const {service,prisma}=setup();
    await expect(service.create('author-1',{content:''})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });
  it('creates a text-free post with several ordered uploaded assets', async () => {
    const {service,prisma,media}=setup();
    const posted=await service.create('author-1',{
      content:'',mediaAssetIds:['photo-id','video-id']
    });
    expect(media.assertOwnedPostMedia).toHaveBeenCalledTimes(2);
    expect(prisma.post.create).toHaveBeenCalledWith({
      data:{
        authorId:'author-1',content:'',
        imageUrl:'/media/public/post/photo-id',
        media:{create:[
          {assetId:'photo-id',mimeType:'image/png',position:0},
          {assetId:'video-id',mimeType:'video/mp4',position:1}
        ]}
      },include:expect.any(Object)
    });
    expect(posted.media).toEqual([
      {url:'/media/public/post/photo-id',mimeType:'image/png',position:0},
      {url:'/media/public/post/video-id',mimeType:'video/mp4',position:1}
    ]);
  });
  it('does not allow the same uploaded asset twice',async()=>{
    const {service,prisma}=setup();
    await expect(service.create('author-1',{
      content:'Hello',mediaAssetIds:['photo-id','photo-id']
    })).rejects.toThrow();
    expect(prisma.post.create).not.toHaveBeenCalled();
  });
});
