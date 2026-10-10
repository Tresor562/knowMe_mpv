import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import { MediaService } from './media.service';

/**
 * Public profile photos only. Protected by purpose, scanner verdict and the
 * current owning user's avatar selection in MediaService.
 */
@Controller('media/public')
export class PublicAvatarController {
  constructor(private readonly media: MediaService) {}

  @Get('avatar-capabilities')
  capabilities() { return { upload: true, publicAvatar: true }; }

  @Get('avatar/:id')
  @Header('Cache-Control', 'public, max-age=60')
  async avatar(@Param('id') id: string) {
    const content = await this.media.readPublicAvatar(id);
    return new StreamableFile(content.buffer, { type: content.mimeType });
  }
}
