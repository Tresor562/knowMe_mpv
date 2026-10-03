import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  RegisterE2eeDeviceDto,
  ReplenishE2eePreKeysDto
} from './e2ee.dto';
import { E2eeService } from './e2ee.service';

@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  })
)
@Controller('e2ee')
export class E2eeController {
  constructor(private readonly e2ee: E2eeService) {}

  @Get('policy')
  policy() {
    return this.e2ee.policy();
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('devices')
  register(
    @Req() req: { user: { userId: string; sessionId?: string } },
    @Body() dto: RegisterE2eeDeviceDto
  ) {
    return this.e2ee.register(req.user.userId, req.user.sessionId, dto);
  }

  @Get('devices')
  devices(@Req() req: { user: { userId: string; sessionId?: string } }) {
    return this.e2ee.listMine(req.user.userId, req.user.sessionId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('devices/:id/prekeys')
  replenish(
    @Req() req: { user: { userId: string; sessionId?: string } },
    @Param('id') id: string,
    @Body() dto: ReplenishE2eePreKeysDto
  ) {
    return this.e2ee.replenish(
      req.user.userId,
      req.user.sessionId,
      id,
      dto
    );
  }

  @Delete('devices/:id')
  revoke(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.e2ee.revoke(req.user.userId, id);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('conversations/:conversationId/bundles/:targetUserId/claim')
  claim(
    @Req() req: { user: { userId: string } },
    @Param('conversationId') conversationId: string,
    @Param('targetUserId') targetUserId: string
  ) {
    return this.e2ee.claimConversationBundles(
      req.user.userId,
      conversationId,
      targetUserId
    );
  }
}
