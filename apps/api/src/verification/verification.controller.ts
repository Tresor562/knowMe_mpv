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
import { PermissionsGuard } from '../access-control/permissions.guard';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  DecideIdentityVerificationDto,
  StartIdentityReviewDto,
  SubmitIdentityVerificationDto,
  WithdrawIdentityVerificationDto
} from './dto/verification.dto';
import { VerificationService } from './verification.service';

@UseGuards(JwtAuthGuard)
@Controller('verification')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Post('requests')
  submit(
    @Req() req: { user: { userId: string } },
    @Body() dto: SubmitIdentityVerificationDto
  ) {
    return this.verification.submit(req.user.userId, dto);
  }

  @Get('me')
  me(@Req() req: { user: { userId: string } }) {
    return this.verification.me(req.user.userId);
  }

  @Post('requests/:id/withdraw')
  withdraw(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: WithdrawIdentityVerificationDto
  ) {
    return this.verification.withdraw(req.user.userId, id, dto);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.VERIFICATION_MANAGE)
@Controller('admin/verification')
export class AdminVerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get('requests')
  list(@Query('status') status?: string) {
    return this.verification.listAdmin(status);
  }

  @Patch('requests/:id/start')
  start(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: StartIdentityReviewDto
  ) {
    return this.verification.startReview(req.user.userId, id, dto);
  }

  @Patch('requests/:id/approve')
  approve(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: DecideIdentityVerificationDto
  ) {
    return this.verification.approve(req.user.userId, id, dto);
  }

  @Patch('requests/:id/reject')
  reject(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: DecideIdentityVerificationDto
  ) {
    return this.verification.reject(req.user.userId, id, dto);
  }

  @Patch('requests/:id/revoke')
  revoke(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: DecideIdentityVerificationDto
  ) {
    return this.verification.revoke(req.user.userId, id, dto);
  }

  @Post('reconcile-expired')
  reconcile(@Req() req: { user: { userId: string } }) {
    return this.verification.expireDue(req.user.userId);
  }
}
