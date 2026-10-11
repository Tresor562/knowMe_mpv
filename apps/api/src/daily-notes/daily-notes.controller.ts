import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpsertDailyNoteDto } from './daily-note.dto';
import { DailyNotesService } from './daily-notes.service';

@Controller('daily-notes')
@UseGuards(JwtAuthGuard)
export class DailyNotesController {
  constructor(private readonly dailyNotes: DailyNotesService) {}

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.dailyNotes.list(req.user.userId);
  }

  @Post()
  publish(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpsertDailyNoteDto
  ) {
    return this.dailyNotes.publish(req.user.userId, dto.content);
  }

  @Delete('me')
  remove(@Req() req: { user: { userId: string } }) {
    return this.dailyNotes.remove(req.user.userId);
  }
}
