import {BadRequestException, ForbiddenException, NotFoundException} from '@nestjs/common';
import {PostsService} from './posts.service';

describe('PostsService.editPost',()=>{
  const author='owner-1';
  const postId='post-1';
  function setup(media:string[]=['asset-1']){
    const prisma={
      post:{
        findUnique:jest.fn().mockResolvedValue({
          id:postId,authorId:author,imageUrl:null,
          media:media.map(assetId=>({assetId}))
        }),
        updateMany:jest.fn().mockResolvedValue({count:1})
      }
    };
    const service=new PostsService(prisma as any,{} as any,{} as any);
    const result={id:postId,content:'Nouveau texte',media:[]};
    jest.spyOn(service,'getById').mockResolvedValue(result as any);
    return {service,prisma};
  }
  it('updates text on the authors post without changing media or original owner',async()=>{
    const {service,prisma}=setup();
    const result=await service.editPost(author,postId,'Nouveau texte');
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where:{id:postId,authorId:author},data:{content:'Nouveau texte'}
    });
    expect(result.content).toBe('Nouveau texte');
  });
  it('accepts an empty caption when the post still has a media attachment',async()=>{
    const {service,prisma}=setup();
    await service.editPost(author,postId,'');
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where:{id:postId,authorId:author},data:{content:''}
    });
  });
  it('never exposes or edits someone elses post',async()=>{
    const {service,prisma}=setup();
    await expect(service.editPost('stranger',postId,'Wrong')).rejects
      .toBeInstanceOf(ForbiddenException);
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
  });
  it('rejects empty text when the post has no media',async()=>{
    const {service,prisma}=setup([]);
    await expect(service.editPost(author,postId,'  ')).rejects
      .toBeInstanceOf(BadRequestException);
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
  });
  it('reports a missing or concurrently removed publication',async()=>{
    const {service,prisma}=setup();
    prisma.post.updateMany.mockResolvedValue({count:0});
    await expect(service.editPost(author,postId,'Update')).rejects
      .toBeInstanceOf(NotFoundException);
  });
  it('does not impose a new arbitrary publication character limit',async()=>{
    const {service,prisma}=setup([]);
    const text='A'.repeat(20000);
    await service.editPost(author,postId,text);
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where:{id:postId,authorId:author},data:{content:text}
    });
  });
});
