import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { StoriesModule } from '../stories/stories.module';
import { LinkTargetsController } from './link-targets.controller';
import { LinkTargetsService } from './link-targets.service';

@Module({
  imports: [StoriesModule, ChannelsModule],
  controllers: [LinkTargetsController],
  providers: [LinkTargetsService],
  exports: [LinkTargetsService]
})
export class LinkTargetsModule {}
