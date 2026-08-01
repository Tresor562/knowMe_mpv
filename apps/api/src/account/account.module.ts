import { Module } from '@nestjs/common';
import { VerificationModule } from '../verification/verification.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [VerificationModule],
  controllers: [AccountController],
  providers: [AccountService]
})
export class AccountModule {}
