import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  RevokeAchievementGrantDto,
  SelectAchievementTitleDto
} from './dto/achievement.dto';
import { AchievementsService } from './achievements.service';

@UseGuards(JwtAuthGuard)
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get('me')
  me(@Req() req: { user: { userId: string } }) {
    return this.achievements.summary(req.user.userId);
  }

  @Patch('title')
  selectTitle(
    @Req() req: { user: { userId: string } },
    @Body() dto: SelectAchievementTitleDto
  ) {
    return this.achievements.selectTitle(req.user.userId, dto.grantId);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.REWARDS_MANAGE)
@Controller('admin/achievements')
export class AdminAchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get('catalog')
  catalog() {
    return this.achievements.listCatalog();
  }

  @Get('grants')
  grants(@Query('userId') userId?: string) {
    return this.achievements.listGrants(userId?.trim());
  }

  @Patch('grants/:id/revoke')
  revoke(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: RevokeAchievementGrantDto
  ) {
    return this.achievements.revoke(req.user.userId, id, dto.reason);
  }
}
