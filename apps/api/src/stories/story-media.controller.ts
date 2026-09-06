import { Controller, Get, Param, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StoryMediaService } from './story-media.service';

@UseGuards(JwtAuthGuard)
@Controller('stories')
export class StoryMediaController {
  constructor(private readonly media: StoryMediaService) {}

  @Get(':id/media')
  async read(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    const content = await this.media.read(req.user.userId, id);
    return new StreamableFile(content.buffer, {
      type: content.mimeType,
      disposition: `inline; filename="${content.fileName.replace(/["\r\n]/g, '_')}"`
    });
  }
}
