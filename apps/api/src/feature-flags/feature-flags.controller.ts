import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import {
  CreateFeatureFlagDto,
  CreateFeatureFlagRuleDto,
  SetFeatureFlagOverrideDto,
  UpdateFeatureFlagDto
} from './dto/feature-flag.dto';
import { FeatureFlagsService } from './feature-flags.service';

type AuthenticatedRequest = {
  user: {
    userId: string;
    role?: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Get()
  listClientFlags(
    @Req() req: AuthenticatedRequest,
    @Query('keys') keys?: string,
    @Headers('x-client-platform') platform?: string,
    @Headers('x-client-version') version?: string,
    @Headers('x-country-code') country?: string
  ) {
    return this.flags.clientFlags(
      {
        userId: req.user.userId,
        audience: req.user.role,
        platform,
        version,
        country
      },
      keys?.split(',').map((key) => key.trim()).filter(Boolean)
    );
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/feature-flags')
export class AdminFeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Get()
  list() {
    return this.flags.listAdmin();
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateFeatureFlagDto
  ) {
    return this.flags.create(req.user.userId, dto);
  }

  @Patch(':key')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto
  ) {
    return this.flags.update(req.user.userId, key, dto);
  }

  @Post(':key/rules')
  addRule(
    @Req() req: AuthenticatedRequest,
    @Param('key') key: string,
    @Body() dto: CreateFeatureFlagRuleDto
  ) {
    return this.flags.addRule(req.user.userId, key, dto);
  }

  @Delete(':key/rules/:ruleId')
  removeRule(
    @Req() req: AuthenticatedRequest,
    @Param('key') key: string,
    @Param('ruleId') ruleId: string
  ) {
    return this.flags.removeRule(req.user.userId, key, ruleId);
  }

  @Put(':key/overrides/:userId')
  setOverride(
    @Req() req: AuthenticatedRequest,
    @Param('key') key: string,
    @Param('userId') userId: string,
    @Body() dto: SetFeatureFlagOverrideDto
  ) {
    return this.flags.setOverride(req.user.userId, key, userId, dto);
  }

  @Delete(':key/overrides/:userId')
  removeOverride(
    @Req() req: AuthenticatedRequest,
    @Param('key') key: string,
    @Param('userId') userId: string
  ) {
    return this.flags.removeOverride(req.user.userId, key, userId);
  }
}
