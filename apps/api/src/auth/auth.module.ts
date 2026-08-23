import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SecurityModule } from '../security/security.module';
import { AccountRecoveryRetentionService } from './account-recovery-retention.service';
import { AccountRecoveryService } from './account-recovery.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    forwardRef(() => SecurityModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' }
      })
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, AccountRecoveryService, AccountRecoveryRetentionService, JwtStrategy],
  exports: [JwtModule, AuthService]
})
export class AuthModule {}
