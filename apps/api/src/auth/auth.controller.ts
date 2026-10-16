import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { VerifyLoginTwoFactorDto } from '../security/dto/security.dto';
import { AccountRecoveryService } from './account-recovery.service';
import { AuthService } from './auth.service';
import { EmailChallengeService } from './email-challenge.service';
import { EmailAddressDto, EmailCodeDto, EmailRecoveryResetDto, EmailChangeRequestDto, EmailChangeConfirmDto } from './dto/email-code.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordRecoveryDto, ResetPasswordDto } from './dto/account-recovery.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly recovery: AccountRecoveryService,
    private readonly emailCodes: EmailChallengeService
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.auth.register(dto, { userAgent, ipAddress });
  }


  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('email/confirm')
  confirmEmail(@Body() dto: EmailCodeDto, @Headers('user-agent') userAgent?: string, @Ip() ipAddress?: string) {
    return this.auth.confirmRegistration(dto.email, dto.code, { userAgent, ipAddress });
  }

  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @Post('email/resend')
  resendEmail(@Body() dto: EmailAddressDto, @Headers('user-agent') userAgent?: string, @Ip() ipAddress?: string) {
    return this.emailCodes.resendSignup(dto.email, { userAgent, ipAddress });
  }

  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @Post('password-recovery/code')
  recoverCode(@Body() dto: EmailAddressDto, @Headers('user-agent') userAgent?: string, @Ip() ipAddress?: string) {
    return this.emailCodes.requestRecovery(dto.email, { userAgent, ipAddress });
  }

  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('password-reset/code')
  resetCode(@Body() dto: EmailRecoveryResetDto, @Headers('user-agent') userAgent?: string, @Ip() ipAddress?: string) {
    return this.emailCodes.resetPassword(dto.email, dto.code, dto.password, { userAgent, ipAddress });
  }

  @UseGuards(JwtAuthGuard)
  @Get('email/status')
  emailStatus(@Req() req: { user: { userId: string } }) {
    return this.emailCodes.status(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @Post('email/change/request')
  requestChange(@Req() req: { user: { userId: string } }, @Body() dto: EmailChangeRequestDto, @Headers('user-agent') userAgent?: string, @Ip() ipAddress?: string) {
    return this.emailCodes.requestChange(req.user.userId, dto.newEmail, dto.password, { userAgent, ipAddress });
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('email/change/confirm')
  confirmChange(@Req() req: { user: { userId: string } }, @Body() dto: EmailChangeConfirmDto, @Headers('user-agent') userAgent?: string, @Ip() ipAddress?: string) {
    return this.emailCodes.confirmChange(req.user.userId, dto.code, { userAgent, ipAddress });
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.auth.login(dto, { userAgent, ipAddress });
  }

  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @Post('password-recovery')
  requestPasswordRecovery(
    @Body() dto: RequestPasswordRecoveryDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.recovery.request(dto.email, { userAgent, ipAddress });
  }

  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('password-reset')
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.recovery.reset(dto.token, dto.password, { userAgent, ipAddress });
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login/2fa')
  verifyTwoFactor(
    @Body() dto: VerifyLoginTwoFactorDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.auth.completeTwoFactorLogin(dto, { userAgent, ipAddress });
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  refresh(
    @Body() dto: RefreshTokenDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.auth.refresh(dto, { userAgent, ipAddress });
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(
    @Req() req: { user: { userId: string; sessionId?: string } }
  ) {
    return this.auth.logout(
      req.user.userId,
      req.user.sessionId
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  sessions(
    @Req() req: { user: { userId: string; sessionId?: string } }
  ) {
    return this.auth.listSessions(req.user.userId, req.user.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  revokeSession(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.auth.revokeSession(req.user.userId, id);
  }
}
