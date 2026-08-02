import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApplyModerationActionDto } from './dto/apply-moderation-action.dto';
import { ModerationService } from './moderation.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/moderation')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @Get('events')
  events(
    @Query('actorId') actorId?: string,
    @Query('decision') decision?: string
  ) {
    return this.moderation.listEvents(actorId?.trim(), decision?.trim());
  }

  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @Get('actions')
  actions(@Query('targetId') targetId?: string) {
    return this.moderation.listActions(targetId?.trim());
  }

  @RequirePermissions(PERMISSIONS.REPORTS_RESOLVE)
  @Post('actions')
  apply(
    @Req() req: { user: { userId: string } },
    @Body() dto: ApplyModerationActionDto
  ) {
    return this.moderation.applyAction(req.user.userId, dto);
  }

  @RequirePermissions(PERMISSIONS.REPORTS_RESOLVE)
  @Patch('actions/:id/reverse')
  reverse(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.moderation.reverseAction(req.user.userId, id);
  }
}
