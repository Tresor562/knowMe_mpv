import { Module } from '@nestjs/common';
import { DailyNotesController } from './daily-notes.controller';
import { DailyNotesService } from './daily-notes.service';

@Module({
  controllers: [DailyNotesController],
  providers: [DailyNotesService]
})
export class DailyNotesModule {}
