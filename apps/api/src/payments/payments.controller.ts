import {
  BadRequestException,
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
import { PermissionsGuard } from '../access-control/permissions.guard';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentAdminService } from './payment-admin.service';
import {
  ConfirmPaymentRefundDto,
  CreatePaymentOrderDto,
  RequestPaymentRefundDto,
  ResolvePaymentFraudDto,
  VerifyStorePurchaseDto
} from './dto/payments.dto';
import { VerifyWebPaymentDto } from './dto/payment-verification.dto';
import { PaymentOrchestrationService } from './payment-orchestration.service';
import { PaymentRefundService } from './payment-refund.service';
import { PaymentWebhookService } from './payment-webhook.service';

type AuthenticatedRequest = {
  user: { userId: string };
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
};

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentOrchestrationService) {}

  @Get('catalog')
  catalog(
    @Query('platform') platform = 'WEB',
    @Query('country') country?: string,
    @Query('currency') currency?: string
  ) {
    return this.payments.catalog(platform, country, currency);
  }

  @Get('providers')
  providers() {
    return this.payments.providerConfiguration();
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  checkout(
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreatePaymentOrderDto
  ) {
    return this.payments.createWebCheckout(
      req.user.userId,
      idempotencyKey,
      dto,
      {
        ipAddress: req.ip,
        userAgent: this.header(req.headers, 'user-agent')
      }
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/verify')
  verifyWebOrder(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: VerifyWebPaymentDto
  ) {
    return this.payments.verifyWebOrder(
      req.user.userId,
      id,
      dto.externalTransactionId
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('store/verify')
  verifyStore(
    @Req() req: AuthenticatedRequest,
    @Body() dto: VerifyStorePurchaseDto
  ) {
    return this.payments.verifyStorePurchase(req.user.userId, dto, {
      ipAddress: req.ip,
      userAgent: this.header(req.headers, 'user-agent')
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/orders')
  orders(
    @Req() req: AuthenticatedRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ) {
    return this.payments.ordersForUser(
      req.user.userId,
      cursor?.trim(),
      Number(limit ?? 30)
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/orders/:id')
  order(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.payments.orderForUser(req.user.userId, id);
  }

  private header(
    headers: Record<string, string | string[] | undefined>,
    name: string
  ) {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }
}

@Controller('api/webhooks')
export class PaymentWebhookController {
  constructor(private readonly webhooks: PaymentWebhookService) {}

  @Post('flutterwave')
  flutterwave(
    @Req() req: AuthenticatedRequest,
    @Body() _payload: Record<string, unknown>
  ) {
    return this.webhooks.flutterwaveWebhook(
      this.rawBody(req),
      req.headers
    );
  }

  @Post('cinetpay')
  cinetpay(
    @Req() req: AuthenticatedRequest,
    @Body() payload: Record<string, unknown>
  ) {
    return this.webhooks.cinetpayWebhook(
      this.rawBody(req),
      payload,
      req.headers
    );
  }

  @Post('google')
  google(
    @Req() req: AuthenticatedRequest,
    @Body() payload: Record<string, unknown>
  ) {
    return this.webhooks.googleWebhook(
      payload,
      this.rawBody(req),
      req.headers
    );
  }

  @Post('apple')
  apple(
    @Req() req: AuthenticatedRequest,
    @Body() payload: Record<string, unknown>
  ) {
    return this.webhooks.appleWebhook(
      payload,
      this.rawBody(req),
      req.headers
    );
  }

  private rawBody(req: AuthenticatedRequest) {
    if (!Buffer.isBuffer(req.rawBody)) {
      throw new BadRequestException(
        'Le corps brut du webhook est indisponible ; la signature ne peut pas être vérifiée.'
      );
    }
    return req.rawBody;
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.BILLING_MANAGE)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(
    private readonly admin: PaymentAdminService,
    private readonly refunds: PaymentRefundService
  ) {}

  @Get('summary')
  summary(@Query('period') period = 'MONTH') {
    return this.admin.summary(period);
  }

  @Get('products')
  products() {
    return this.admin.products();
  }

  @Get('orders')
  orders(
    @Query('status') status?: string,
    @Query('provider') provider?: string,
    @Query('userId') userId?: string,
    @Query('productKey') productKey?: string
  ) {
    return this.admin.orders({ status, provider, userId, productKey });
  }

  @Get('refunds')
  refundsList(
    @Query('status') status?: string,
    @Query('provider') provider?: string,
    @Query('userId') userId?: string
  ) {
    return this.refunds.listRefunds(status, provider, userId);
  }

  @Post('orders/:id/refunds')
  requestRefund(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RequestPaymentRefundDto
  ) {
    return this.refunds.requestRefund(req.user.userId, id, dto);
  }

  @Post('refunds/:id/confirm')
  confirmRefund(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ConfirmPaymentRefundDto
  ) {
    return this.refunds.confirmExternalRefund(req.user.userId, id, dto);
  }

  @Get('webhooks')
  webhookLogs(
    @Query('provider') provider?: string,
    @Query('status') status?: string
  ) {
    return this.admin.webhookLogs(provider, status);
  }

  @Get('fraud')
  fraud(
    @Query('status') status?: string,
    @Query('severity') severity?: string
  ) {
    return this.admin.fraudLogs(status, severity);
  }

  @Patch('fraud/:id')
  resolveFraud(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ResolvePaymentFraudDto
  ) {
    return this.admin.resolveFraud(req.user.userId, id, dto);
  }
}
