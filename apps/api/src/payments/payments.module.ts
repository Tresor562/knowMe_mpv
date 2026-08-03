import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import {
  AdminPaymentsController,
  PaymentsController,
  PaymentWebhookController
} from './payments.controller';
import { CommerceCatalogService } from './commerce-catalog.service';
import { PaymentAdminService } from './payment-admin.service';
import { PaymentFulfillmentService } from './payment-fulfillment.service';
import { PaymentOrchestrationService } from './payment-orchestration.service';
import { PaymentRefundService } from './payment-refund.service';
import { PaymentReversalService } from './payment-reversal.service';
import { PaymentSecretBoxService } from './payment-secret-box.service';
import { PaymentWebhookService } from './payment-webhook.service';
import { AppleStoreService } from './providers/apple-store.service';
import { CinetPayService } from './providers/cinetpay.service';
import { FlutterwaveService } from './providers/flutterwave.service';
import { GooglePlayService } from './providers/google-play.service';

@Module({
  imports: [AccessControlModule],
  controllers: [
    PaymentsController,
    PaymentWebhookController,
    AdminPaymentsController
  ],
  providers: [
    CommerceCatalogService,
    PaymentAdminService,
    PaymentFulfillmentService,
    PaymentOrchestrationService,
    PaymentRefundService,
    PaymentReversalService,
    PaymentSecretBoxService,
    PaymentWebhookService,
    FlutterwaveService,
    CinetPayService,
    GooglePlayService,
    AppleStoreService
  ],
  exports: [CommerceCatalogService, PaymentOrchestrationService]
})
export class PaymentsModule {}
