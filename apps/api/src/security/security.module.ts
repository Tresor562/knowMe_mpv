import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SecurityCryptoService } from './security-crypto.service';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { SensitiveActionGuard } from './sensitive-action.guard';

@Module({
  imports: [NotificationsModule],
  controllers: [SecurityController],
  providers: [SecurityCryptoService, SecurityService, SensitiveActionGuard],
  exports: [SecurityService, SensitiveActionGuard]
})
export class SecurityModule {}
