import { Module } from '@nestjs/common';
import { MediaDownloadPreferenceController } from './media-download-preference.controller';
import { MediaDownloadPreferenceService } from './media-download-preference.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController, MediaDownloadPreferenceController],
  providers: [MediaService, MediaDownloadPreferenceService],
  exports: [MediaService, MediaDownloadPreferenceService]
})
export class MediaModule {}
