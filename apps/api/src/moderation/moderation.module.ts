import { Global, Module } from '@nestjs/common';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Global()
@Module({
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService]
})
export class ModerationModule {}
