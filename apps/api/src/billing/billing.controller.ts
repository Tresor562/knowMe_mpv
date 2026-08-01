import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { BillingService } from './billing.service';
import {
  BillingProviderEventDto,
  CreateBillingPlanDto,
  CreateBillingPriceDto,
  UpdateBillingPlanDto
} from './dto/billing.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  plans(
    @Query('platform') platform = 'ALL',
    @Query('country') country?: string,
    @Query('currency') currency?: string
  ) {
    return this.billing.catalog(platform, country, currency);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: { user: { userId: string } }) {
    return this.billing.me(req.user.userId);
  }

  @Post('webhooks/:provider')
  webhook(
    @Param('provider') provider: string,
    @Headers('x-billing-timestamp') timestamp: string | undefined,
    @Headers('x-billing-signature') signature: string | undefined,
    @Body() dto: BillingProviderEventDto
  ) {
    return this.billing.processSignedEvent(provider, timestamp, signature, dto);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.BILLING_MANAGE)
@Controller('admin/billing')
export class AdminBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  plans() {
    return this.billing.listAdmin();
  }

  @Post('plans')
  createPlan(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateBillingPlanDto
  ) {
    return this.billing.createPlan(req.user.userId, dto);
  }

  @Patch('plans/:id')
  updatePlan(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateBillingPlanDto
  ) {
    return this.billing.updatePlan(req.user.userId, id, dto);
  }

  @Post('plans/:id/prices')
  createPrice(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: CreateBillingPriceDto
  ) {
    return this.billing.createPrice(req.user.userId, id, dto);
  }

  @Get('subscriptions')
  subscriptions(@Query('userId') userId?: string) {
    return this.billing.subscriptionsAdmin(userId?.trim());
  }

  @Get('events')
  events(@Query('provider') provider?: string) {
    return this.billing.eventsAdmin(provider?.trim());
  }
}
