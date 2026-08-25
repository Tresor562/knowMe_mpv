import { Module } from '@nestjs/common';
import { ExternalMediaScannerService } from './external-media-scanner.service';
import { MediaDownloadPreferenceController } from './media-download-preference.controller';
import { MediaDownloadPreferenceService } from './media-download-preference.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaStorageService } from './media-storage.service';

@Module({
  controllers: [MediaController, MediaDownloadPreferenceController],
  providers: [ExternalMediaScannerService, MediaStorageService, MediaService, MediaDownloadPreferenceService],
  exports: [ExternalMediaScannerService, MediaStorageService, MediaService, MediaDownloadPreferenceService]
})
export class MediaModule {}
