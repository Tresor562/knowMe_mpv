import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialGiftsController } from './social-gifts.controller';
import { SocialGiftsService } from './social-gifts.service';
import { SocialService } from './social.service';

@Module({
  controllers: [SocialController, SocialGiftsController],
  providers: [SocialService, SocialGiftsService],
  exports: [SocialGiftsService]
})
export class SocialModule {}
