import { Body, Controller, Delete, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpsertDailyNoteDto } from './dto/upsert-daily-note.dto';
import { DailyNotesService } from './daily-notes.service';

@UseGuards(JwtAuthGuard)
@Controller('daily-notes')
export class DailyNotesController {
  constructor(private readonly notes: DailyNotesService) {}

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.notes.listVisible(req.user.userId);
  }

  @Get('mine')
  mine(@Req() req: { user: { userId: string } }) {
    return this.notes.mine(req.user.userId);
  }

  @Put('mine')
  upsert(@Req() req: { user: { userId: string } }, @Body() dto: UpsertDailyNoteDto) {
    return this.notes.upsert(req.user.userId, dto);
  }

  @Delete('mine')
  remove(@Req() req: { user: { userId: string } }) {
    return this.notes.remove(req.user.userId);
  }
}
