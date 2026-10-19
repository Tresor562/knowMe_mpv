import { Module } from '@nestjs/common';
import { ExternalMediaScannerService } from './external-media-scanner.service';
import { MediaDownloadPreferenceController } from './media-download-preference.controller';
import { MediaDownloadPreferenceService } from './media-download-preference.service';
import { MediaController } from './media.controller';
import { GroupAvatarController } from '../messaging/group-avatar.controller';
import { GroupAvatarService } from '../messaging/group-avatar.service';
import { PublicAvatarController } from './public-avatar.controller';
import { MediaService } from './media.service';
import { MediaStorageService } from './media-storage.service';

@Module({
  controllers: [PublicAvatarController, MediaController, GroupAvatarController, MediaDownloadPreferenceController],
  providers: [ExternalMediaScannerService, MediaStorageService, MediaService, MediaDownloadPreferenceService, GroupAvatarService],
  exports: [ExternalMediaScannerService, MediaStorageService, MediaService, MediaDownloadPreferenceService]
})
export class MediaModule {}
