import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DecideSocialMatchDto } from './dto/decide-social-match.dto';
import { JoinSocialMatchQueueDto } from './dto/join-social-match-queue.dto';
import { UpdateSocialMatchPreferenceDto } from './dto/update-social-match-preference.dto';
import { SocialMatchmakingService } from './social-matchmaking.service';

@UseGuards(JwtAuthGuard)
@Controller('social-matchmaking')
export class SocialMatchmakingController {
  constructor(private readonly matchmaking: SocialMatchmakingService) {}

  @Get('preferences')
  preferences(@Req() req: { user: { userId: string } }) {
    return this.matchmaking.getPreference(req.user.userId);
  }

  @Patch('preferences')
  updatePreferences(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpdateSocialMatchPreferenceDto
  ) {
    return this.matchmaking.updatePreference(req.user.userId, dto);
  }

  @Get('status')
  status(@Req() req: { user: { userId: string } }) {
    return this.matchmaking.status(req.user.userId);
  }

  @Post('queue')
  join(
    @Req() req: { user: { userId: string } },
    @Body() dto: JoinSocialMatchQueueDto
  ) {
    return this.matchmaking.join(req.user.userId, dto);
  }

  @Delete('queue')
  leave(@Req() req: { user: { userId: string } }) {
    return this.matchmaking.leave(req.user.userId);
  }

  @Post('proposals/:proposalId/decision')
  decide(
    @Req() req: { user: { userId: string } },
    @Param('proposalId') proposalId: string,
    @Body() dto: DecideSocialMatchDto
  ) {
    return this.matchmaking.decide(req.user.userId, proposalId, dto);
  }

  @Get('blocks')
  blocks(@Req() req: { user: { userId: string } }) {
    return this.matchmaking.listBlocks(req.user.userId);
  }

  @Delete('blocks/:blockedId')
  unblock(
    @Req() req: { user: { userId: string } },
    @Param('blockedId') blockedId: string
  ) {
    return this.matchmaking.unblock(req.user.userId, blockedId);
  }
}
