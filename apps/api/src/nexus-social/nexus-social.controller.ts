import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NexusSocialPrivacyService } from './nexus-social-privacy.service';
import { NexusSocialService } from './nexus-social.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class NexusSocialController {
  constructor(
    private readonly nexusSocial: NexusSocialService,
    private readonly privacy: NexusSocialPrivacyService
  ) {}

  @Get('nexus-social/status')
  status() {
    return this.nexusSocial.status();
  }

  @Get('nexus-social/export')
  export(@Req() req: { user: { userId: string } }) {
    return this.privacy.exportForAccount(req.user.userId);
  }

  @Post('nexus-social/private-conversation')
  createPrivateConversation(@Req() req: { user: { userId: string } }) {
    return this.nexusSocial.createPrivateConversation(req.user.userId);
  }

  @Delete('nexus-social/private-conversation')
  deletePrivateConversation(@Req() req: { user: { userId: string } }) {
    return this.privacy.deletePrivateConversation(req.user.userId);
  }

  @Get('conversations/:id/nexus/replies')
  listReplies(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number
  ) {
    return this.nexusSocial.listReplies(req.user.userId, id, limit);
  }

  @Post('conversations/:id/nexus/reply')
  invoke(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.nexusSocial.invoke(
      req.user.userId,
      id,
      body && typeof body === 'object' && !Array.isArray(body)
        ? body as Record<string, unknown>
        : {}
    );
  }
}
