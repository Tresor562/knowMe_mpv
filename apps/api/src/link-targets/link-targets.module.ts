import { Module } from '@nestjs/common';
import { StoriesModule } from '../stories/stories.module';
import { LinkTargetsController } from './link-targets.controller';
import { LinkTargetsService } from './link-targets.service';

@Module({
  imports: [StoriesModule],
  controllers: [LinkTargetsController],
  providers: [LinkTargetsService],
  exports: [LinkTargetsService]
})
export class LinkTargetsModule {}
