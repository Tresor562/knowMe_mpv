import { Controller, Get, Header, Headers, Param, Res, StreamableFile } from '@nestjs/common';
import { MediaService } from './media.service';
import { parseSingleByteRange } from './video-byte-range';

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
    const content = await this.media.readPublicPostImage(id);
    if (content.mimeType !== 'video/mp4') {
      return new StreamableFile(content.buffer, { type: content.mimeType });
    }

    const size = content.buffer.length;
    response.setHeader('Accept-Ranges', 'bytes');
    if (!range) {
      return new StreamableFile(content.buffer, { type: content.mimeType });
    }

    const requested = parseSingleByteRange(range, size);
    if (!requested) {
      response.status(416);
      response.setHeader('Content-Range', `bytes */${size}`);
      return new StreamableFile(Buffer.alloc(0), { type: content.mimeType });
    }

    const { start, end } = requested;
    response.status(206);
    response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    response.setHeader('Content-Length', String(end - start + 1));
    return new StreamableFile(content.buffer.subarray(start, end + 1), {
      type: content.mimeType
    });
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
