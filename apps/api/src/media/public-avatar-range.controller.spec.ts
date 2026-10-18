import { NotFoundException, StreamableFile } from '@nestjs/common';
import { PublicAvatarController } from './public-avatar.controller';

describe('public post video byte-range controller', () => {
  function setup(kind = 'video/mp4') {
    const media = {
      readPublicPostImage: jest.fn().mockResolvedValue({
        buffer:Buffer.from('abcdefghijklmnop'),mimeType:kind
      })
    };
    const response = {
      status: jest.fn(),
      setHeader: jest.fn()
    };
    const controller = new PublicAvatarController(media as any);
    return {controller,media,response};
  }

  it('returns 206 and a correctly bounded slice of an authorized MP4', async () => {
    const {controller,media,response}=setup();
    const returned=await controller.postImage('media-a','bytes=5-9',response);
    expect(returned).toBeInstanceOf(StreamableFile);
    expect(media.readPublicPostImage).toHaveBeenCalledWith('media-a');
    expect(response.status).toHaveBeenCalledWith(206);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Range','bytes 5-9/16');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Length','5');
    expect(response.setHeader).toHaveBeenCalledWith('Accept-Ranges','bytes');
  });

  it('returns 416 for an unsatisfiable range without exposing any bytes', async () => {
    const {controller,response}=setup();
    const returned=await controller.postImage('media-a','bytes=999-',response);
    expect(response.status).toHaveBeenCalledWith(416);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Range','bytes */16');
    expect(returned.getHeaders().length).toBe(0);
  });

  it('continues to serve full images even if Range was sent by the browser', async () => {
    const {controller,response}=setup('image/jpeg');
    const returned=await controller.postImage('image-a','bytes=0-3',response);
    expect(returned.getHeaders().length).toBe(16);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('never bypasses media ownership or scanner checks when Range is requested', async () => {
    const {controller,media,response}=setup();
    media.readPublicPostImage.mockRejectedValue(new NotFoundException('Missing'));
    await expect(controller.postImage('secret','bytes=0-3',response))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(response.status).not.toHaveBeenCalled();
  });
});
