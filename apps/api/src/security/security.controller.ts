import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ChangePasswordDto,
  ConfirmTwoFactorDto,
  DisableTwoFactorDto,
  PasswordProofDto,
  ReauthenticateDto,
  RegenerateRecoveryCodesDto,
  RenameDeviceDto
} from './dto/security.dto';
import { SecurityService } from './security.service';

@UseGuards(JwtAuthGuard)
@Controller('security')
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Get()
  status(
    @Req() req: { user: { userId: string; sessionId?: string } }
  ) {
    return this.security.status(req.user.userId, req.user.sessionId);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('2fa/setup')
  setup(
    @Req() req: { user: { userId: string } },
    @Body() dto: PasswordProofDto
  ) {
    return this.security.beginTwoFactorSetup(req.user.userId, dto.password);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('2fa/confirm')
  confirm(
    @Req() req: { user: { userId: string } },
    @Body() dto: ConfirmTwoFactorDto
  ) {
    return this.security.confirmTwoFactor(req.user.userId, dto.code);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('2fa/disable')
  disable(
    @Req() req: { user: { userId: string; sessionId?: string } },
    @Body() dto: DisableTwoFactorDto
  ) {
    return this.security.disableTwoFactor(
      req.user.userId,
      req.user.sessionId,
      dto
    );
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('recovery-codes/regenerate')
  regenerateRecoveryCodes(
    @Req() req: { user: { userId: string } },
    @Body() dto: RegenerateRecoveryCodesDto
  ) {
    return this.security.regenerateRecoveryCodes(req.user.userId, dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reauthenticate')
  reauthenticate(
    @Req() req: { user: { userId: string; sessionId?: string } },
    @Body() dto: ReauthenticateDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    if (!req.user.sessionId) {
      throw new Error('Session ID missing from authenticated request.');
    }
    return this.security.reauthenticate(
      req.user.userId,
      req.user.sessionId,
      dto,
      { userAgent, ipAddress }
    );
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Patch('password')
  changePassword(
    @Req() req: { user: { userId: string; sessionId?: string } },
    @Body() dto: ChangePasswordDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.security.changePassword(
      req.user.userId,
      req.user.sessionId,
      dto,
      { userAgent, ipAddress }
    );
  }

  @Patch('devices/:id')
  renameDevice(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: RenameDeviceDto
  ) {
    return this.security.renameDevice(req.user.userId, id, dto.label);
  }

  @Delete('devices/:id')
  revokeDevice(
    @Req() req: { user: { userId: string; sessionId?: string } },
    @Param('id') id: string
  ) {
    return this.security.revokeDevice(
      req.user.userId,
      req.user.sessionId,
      id
    );
  }
}
