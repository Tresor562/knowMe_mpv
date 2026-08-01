import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdjustKnowCoinsDto } from './dto/wallet.dto';
import { WalletService } from './wallet.service';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('me')
  me(@Req() req: { user: { userId: string } }) {
    return this.wallet.me(req.user.userId);
  }

  @Get('history')
  history(
    @Req() req: { user: { userId: string } },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ) {
    return this.wallet.history(
      req.user.userId,
      cursor?.trim(),
      Number.parseInt(limit ?? '30', 10) || 30
    );
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.WALLET_MANAGE)
@Controller('admin/wallet')
export class AdminWalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get(':userId')
  walletForUser(@Param('userId') userId: string) {
    return this.wallet.adminWallet(userId);
  }

  @Get(':userId/history')
  history(
    @Param('userId') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ) {
    return this.wallet.history(
      userId,
      cursor?.trim(),
      Number.parseInt(limit ?? '30', 10) || 30
    );
  }

  @Post('adjustments')
  adjust(
    @Req() req: { user: { userId: string } },
    @Body() dto: AdjustKnowCoinsDto
  ) {
    return this.wallet.adjust(req.user.userId, dto);
  }
}
