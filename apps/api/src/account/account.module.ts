import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [SecurityModule],
  controllers: [AccountController],
  providers: [AccountService]
})
export class AccountModule {}
