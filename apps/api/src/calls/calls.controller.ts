import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallIceService } from './call-ice.service';
import { CallsService } from './calls.service';
import { CreateCallDto, EndCallDto } from './dto/call.dto';

@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallsController {
  constructor(
    private readonly calls: CallsService,
    private readonly ice: CallIceService
  ) {}

  @Post()
  create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateCallDto
  ) {
    return this.calls.create(req.user.userId, dto);
  }

  @Get('history')
  history(
    @Req() req: { user: { userId: string } },
    @Query('take') take?: string
  ) {
    const parsed = take ? Number.parseInt(take, 10) : 50;
    return this.calls.history(req.user.userId, Number.isFinite(parsed) ? parsed : 50);
  }

  @Get(':callId/ice-configuration')
  iceConfiguration(
    @Req() req: { user: { userId: string } },
    @Param('callId') callId: string
  ) {
    return this.ice.issue(req.user.userId, callId);
  }

  @Get(':callId')
  view(
    @Req() req: { user: { userId: string } },
    @Param('callId') callId: string
  ) {
    return this.calls.view(req.user.userId, callId);
  }

  @Post(':callId/end')
  end(
    @Req() req: { user: { userId: string } },
    @Param('callId') callId: string,
    @Body() dto: EndCallDto
  ) {
    return this.calls.end(req.user.userId, callId, dto.reason);
  }
}
