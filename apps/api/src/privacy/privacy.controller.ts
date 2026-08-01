import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateDataSubjectRequestDto,
  PublishPrivacyPolicyDto,
  RecordConsentDto,
  UpdatePrivacyPreferencesDto,
  UpsertRetentionPolicyDto
} from './dto/privacy.dto';
import { PrivacyService } from './privacy.service';

@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('policies')
  policies(@Query('locale') locale?: string) {
    return this.privacy.currentPolicies(locale?.trim().toLowerCase() || 'fr');
  }

  @UseGuards(JwtAuthGuard)
  @Get('center')
  center(
    @Req() req: { user: { userId: string } },
    @Query('locale') locale?: string
  ) {
    return this.privacy.center(
      req.user.userId,
      locale?.trim().toLowerCase() || 'fr'
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('consents')
  consent(
    @Req() req: { user: { userId: string } },
    @Body() dto: RecordConsentDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string
  ) {
    return this.privacy.recordConsent(req.user.userId, dto, {
      ipAddress,
      userAgent
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('preferences')
  preferences(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpdatePrivacyPreferencesDto
  ) {
    return this.privacy.updatePreferences(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('requests')
  request(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateDataSubjectRequestDto
  ) {
    return this.privacy.createRequest(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('requests/:id')
  cancelRequest(
    @Req() req: { user: { userId: string } },
    @Param('id') requestId: string
  ) {
    return this.privacy.cancelRequest(req.user.userId, requestId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('privacy.manage')
  @Get('admin/policies')
  adminPolicies() {
    return this.privacy.listPoliciesForAdmin();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('privacy.manage')
  @Post('admin/policies')
  publishPolicy(
    @Req() req: { user: { userId: string } },
    @Body() dto: PublishPrivacyPolicyDto
  ) {
    return this.privacy.publishPolicy(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('privacy.manage')
  @Get('admin/retention')
  retentionPolicies() {
    return this.privacy.listRetentionPolicies();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('privacy.manage')
  @Post('admin/retention')
  retentionPolicy(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpsertRetentionPolicyDto
  ) {
    return this.privacy.upsertRetentionPolicy(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('privacy.manage')
  @Post('admin/retention/:id/execute')
  executeRetention(
    @Req() req: { user: { userId: string } },
    @Param('id') policyId: string
  ) {
    return this.privacy.executeRetention(req.user.userId, policyId);
  }
}
