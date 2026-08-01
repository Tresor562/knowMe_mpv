import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  AdminVerificationController,
  VerificationController
} from './verification.controller';
import { VerificationPrivacyService } from './verification-privacy.service';
import { VerificationService } from './verification.service';

@Module({
  imports: [AccessControlModule, NotificationsModule],
  controllers: [VerificationController, AdminVerificationController],
  providers: [VerificationService, VerificationPrivacyService],
  exports: [VerificationService, VerificationPrivacyService]
})
export class VerificationModule {}
