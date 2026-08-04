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
import { RevokeSocialConnectionIntentDto } from './dto/revoke-social-connection-intent.dto';
import { SetSocialConnectionIntentDto } from './dto/set-social-connection-intent.dto';
import { UpdateSocialMatchPreferenceDto } from './dto/update-social-match-preference.dto';
import { SocialConnectionService } from './social-connection.service';
import { SocialMatchmakingService } from './social-matchmaking.service';

@UseGuards(JwtAuthGuard)
@Controller('social-matchmaking')
export class SocialMatchmakingController {
  constructor(
    private readonly matchmaking: SocialMatchmakingService,
    private readonly connections: SocialConnectionService
  ) {}

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

  @Get('proposals/:proposalId/connection')
  connectionStatus(
    @Req() req: { user: { userId: string } },
    @Param('proposalId') proposalId: string
  ) {
    return this.connections.status(req.user.userId, proposalId);
  }

  @Post('proposals/:proposalId/connection/intent')
  setConnectionIntent(
    @Req() req: { user: { userId: string } },
    @Param('proposalId') proposalId: string,
    @Body() dto: SetSocialConnectionIntentDto
  ) {
    return this.connections.setIntent(req.user.userId, proposalId, dto);
  }

  @Post('proposals/:proposalId/connection/revoke')
  revokeConnectionIntent(
    @Req() req: { user: { userId: string } },
    @Param('proposalId') proposalId: string,
    @Body() dto: RevokeSocialConnectionIntentDto
  ) {
    return this.connections.revokeIntent(req.user.userId, proposalId, dto);
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
