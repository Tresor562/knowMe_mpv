import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('payments/me/order-references')
export class PaymentClientLookupController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':reference')
  async resolve(
    @Req() req: { user: { userId: string } },
    @Param('reference') referenceValue: string
  ) {
    const reference = referenceValue.trim().toUpperCase();
    if (!/^KM-(FLW|CNP|GPL|APL)-[A-Z0-9]+-[A-F0-9]{16}$/.test(reference)) {
      throw new BadRequestException('Référence de paiement invalide.');
    }

    const order = await this.prisma.paymentOrder.findUnique({
      where: { reference },
      select: { id: true, userId: true, reference: true }
    });
    if (!order || order.userId !== req.user.userId) {
      throw new NotFoundException('Commande de paiement introuvable.');
    }

    return { id: order.id, reference: order.reference };
  }
}
