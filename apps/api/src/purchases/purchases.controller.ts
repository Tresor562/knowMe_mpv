import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  UpsertStoreProductDto,
  VerifyPurchaseDto
} from './dto/purchase.dto';
import { PurchasesService } from './purchases.service';

type AuthenticatedRequest = {
  user: { userId: string; sessionId?: string };
};

@UseGuards(JwtAuthGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get('products')
  products() {
    return this.purchases.listProducts();
  }

  @Get('me')
  mine(@Req() req: AuthenticatedRequest) {
    return this.purchases.listMine(req.user.userId);
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('verify')
  async verify(
    @Req() req: AuthenticatedRequest,
    @Body() dto: VerifyPurchaseDto
  ) {
    let retryCount = 0;

    while (true) {
      try {
        return await this.purchases.verify(
          req.user.userId,
          req.user.sessionId,
          dto
        );
      } catch (error) {
        const isSerializableConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';

        if (!isSerializableConflict || retryCount >= 2) {
          throw error;
        }

        retryCount += 1;
        await new Promise((resolve) => setTimeout(resolve, retryCount * 20));
      }
    }
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.PURCHASES_MANAGE)
@Controller('admin/purchases')
export class AdminPurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Post('products')
  upsertProduct(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpsertStoreProductDto
  ) {
    return this.purchases.upsertProduct(req.user.userId, dto);
  }

  @Get('receipts')
  receipts(@Query('userId') userId?: string) {
    return this.purchases.listAdminReceipts(userId);
  }
}
