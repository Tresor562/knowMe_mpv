import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateMediaDownloadPreferenceDto } from './dto/update-media-download-preference.dto';
import { MediaDownloadPreferenceService } from './media-download-preference.service';

@UseGuards(JwtAuthGuard)
@Controller('media/download-preferences')
export class MediaDownloadPreferenceController {
  constructor(private readonly preferences: MediaDownloadPreferenceService) {}

  @Get()
  get(@Req() req: { user: { userId: string } }) {
    return this.preferences.get(req.user.userId);
  }

  @Put()
  update(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpdateMediaDownloadPreferenceDto
  ) {
    return this.preferences.update(req.user.userId, dto);
  }
}
