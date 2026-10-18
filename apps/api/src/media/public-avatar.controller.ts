import { Controller, Get, Header, Headers, Param, Res, StreamableFile } from '@nestjs/common';
import { MediaService } from './media.service';

type MediaResponse = {
  status(code: number): void;
  setHeader(name: string, value: string): void;
};

/**
 * Public profile photos only. Protected by purpose, scanner verdict and the
 * current owning user's avatar selection in MediaService.
 */
@Controller('media/public')
export class PublicAvatarController {
  constructor(private readonly media: MediaService) {}

  @Get('avatar-capabilities')
  capabilities() { return { upload: true, publicAvatar: true }; }

  @Get('post-capabilities')
  postCapabilities() { return { upload: true, publicPostImage: true }; }

  @Get('post/:id')
  @Header('Cache-Control', 'public, max-age=60')
  async postImage(
    @Param('id') id: string,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) response: MediaResponse
  ) {
    // MediaService verifies scanner status, owning user and that the
    // attachment belongs to a published post before any byte is returned.
    if (!range) {
      const complete = await this.media.readPublicPostImage(id);
      if (complete.mimeType === 'video/mp4') response.setHeader('Accept-Ranges', 'bytes');
      return new StreamableFile(complete.buffer, { type: complete.mimeType });
    }

    // Authorization is re-checked within the media service before the
    // storage driver receives a HEAD or bounded byte-range GET request.
    const content = await this.media.readPublicPostRange(id, range);
    if (content.mimeType !== 'video/mp4') {
      return new StreamableFile(content.buffer, { type: content.mimeType });
    }
    response.setHeader('Accept-Ranges', 'bytes');

    if (content.unsatisfiable || !content.range) {
      response.status(416);
      response.setHeader('Content-Range', `bytes */${content.total}`);
      return new StreamableFile(Buffer.alloc(0), { type: content.mimeType });
    }

    const { start, end, total } = content.range;
    response.status(206);
    response.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    response.setHeader('Content-Length', String(content.buffer.length));
    return new StreamableFile(content.buffer, { type: content.mimeType });
  }

  @Get('cover/:id')
  @Header('Cache-Control', 'public, max-age=60')
  async cover(@Param('id') id: string) {
    const content = await this.media.readPublicProfileCover(id);
    return new StreamableFile(content.buffer, { type: content.mimeType });
  }

  @Get('avatar/:id')
  @Header('Cache-Control', 'public, max-age=60')
  async avatar(@Param('id') id: string) {
    const content = await this.media.readPublicAvatar(id);
    return new StreamableFile(content.buffer, { type: content.mimeType });
  }
}
