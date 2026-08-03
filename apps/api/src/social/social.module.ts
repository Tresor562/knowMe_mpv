import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialGiftExportService } from './social-gift-export.service';
import { SocialGiftsController } from './social-gifts.controller';
import { SocialGiftsService } from './social-gifts.service';
import { SocialService } from './social.service';

@Module({
  controllers: [SocialController, SocialGiftsController],
  providers: [SocialService, SocialGiftsService, SocialGiftExportService],
  exports: [SocialGiftsService, SocialGiftExportService]
})
export class SocialModule {}
