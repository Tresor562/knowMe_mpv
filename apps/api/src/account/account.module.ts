import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { SecurityModule } from '../security/security.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [SecurityModule, PrivacyModule, MediaModule],
  controllers: [AccountController],
  providers: [AccountService]
})
export class AccountModule {}
