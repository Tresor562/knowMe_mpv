import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  AdminVerificationController,
  VerificationController
} from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  imports: [AccessControlModule, NotificationsModule],
  controllers: [VerificationController, AdminVerificationController],
  providers: [VerificationService],
  exports: [VerificationService]
})
export class VerificationModule {}
