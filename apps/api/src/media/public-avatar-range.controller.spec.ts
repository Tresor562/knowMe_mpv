import { NotFoundException, StreamableFile } from '@nestjs/common';
import { PublicAvatarController } from './public-avatar.controller';

describe('public post video storage-backed ranges', () => {
  function setup(kind = 'video/mp4') {
    const media = {
      readPublicPostImage: jest.fn().mockResolvedValue({
        buffer: Buffer.from('abcdefghijklmnop'), mimeType: kind
      }),
      readPublicPostRange: jest.fn().mockResolvedValue(kind === 'video/mp4' ? {
        buffer:Buffer.from('fghij'),
        mimeType:kind,
        total:16,
        range:{start:5,end:9,total:16},
        unsatisfiable:false
      } : {
        buffer:Buffer.from('abcdefghijklmnop'),
        mimeType:kind,total:16,range:null,unsatisfiable:false
      })
    };
    const response = { status: jest.fn(), setHeader: jest.fn() };
    const controller = new PublicAvatarController(media as any);
    return {controller,media,response};
  }

  it('returns 206 and only the bytes provided by the authorized storage read',async()=>{
    const {controller,media,response}=setup();
    const returned=await controller.postImage('media-a','bytes=5-9',response);
    expect(returned).toBeInstanceOf(StreamableFile);
    expect(media.readPublicPostRange).toHaveBeenCalledWith('media-a','bytes=5-9');
    expect(media.readPublicPostImage).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(206);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Range','bytes 5-9/16');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Length','5');
  });

  it('returns 416 without reading or exposing invalid media bytes',async()=>{
    const {controller,media,response}=setup();
    media.readPublicPostRange.mockResolvedValueOnce({
      buffer:Buffer.alloc(0),mimeType:'video/mp4',total:16,range:null,unsatisfiable:true
    });
    const returned=await controller.postImage('media-a','bytes=999-',response);
    expect(response.status).toHaveBeenCalledWith(416);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Range','bytes */16');
    expect(returned.getHeaders().length).toBe(0);
  });

  it('keeps non-video assets as complete images despite a range header',async()=>{
    const {controller,response}=setup('image/jpeg');
    const returned=await controller.postImage('image-a','bytes=0-3',response);
    expect(returned.getHeaders().length).toBe(16);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('does not request byte ranges on normal requests',async()=>{
    const {controller,media,response}=setup();
    await controller.postImage('video-a',undefined,response);
    expect(media.readPublicPostImage).toHaveBeenCalledWith('video-a');
    expect(media.readPublicPostRange).not.toHaveBeenCalled();
  });

  it('does not convert an unauthorized media rejection into a partial response',async()=>{
    const {controller,media,response}=setup();
    media.readPublicPostRange.mockRejectedValueOnce(new NotFoundException());
    await expect(controller.postImage('secret','bytes=0-3',response))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(response.status).not.toHaveBeenCalled();
  });
});
