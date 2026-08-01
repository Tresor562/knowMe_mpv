import { Module } from '@nestjs/common';
import { PrivacyModule } from '../privacy/privacy.module';
import { SecurityModule } from '../security/security.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [SecurityModule, PrivacyModule],
  controllers: [AccountController],
  providers: [AccountService]
})
export class AccountModule {}
