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
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.auth.register(dto, { userAgent, ipAddress });
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
    @Req() req: { user: { userId: string } }
  ) {
    return this.auth.listSessions(req.user.userId);
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
