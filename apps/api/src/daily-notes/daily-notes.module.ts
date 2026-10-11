import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { DailyNotesController } from './daily-notes.controller';
import { DailyNotesService } from './daily-notes.service';

@Module({
  imports: [ModerationModule],
  providers: [DailyNotesService],
  controllers: [DailyNotesController]
})
export class DailyNotesModule {}
