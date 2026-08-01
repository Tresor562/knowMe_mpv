import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  controllers: [SocialController],
  providers: [SocialService]
})
export class SocialModule {}
