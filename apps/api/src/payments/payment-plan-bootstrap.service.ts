import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentPlanBootstrapService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const plan = await this.prisma.billingPlan.upsert({
      where: { key: 'verified_monthly' },
      create: {
        key: 'verified_monthly',
        name: 'Badge Certifié',
        description:
          'Abonnement mensuel au badge Certifié, soumis à vérification d’identité et revue.',
        active: true,
        highlighted: false,
        requiresVerification: true,
        requiresManualReview: true
      },
      update: {
        name: 'Badge Certifié',
        description:
          'Abonnement mensuel au badge Certifié, soumis à vérification d’identité et revue.',
        active: true,
        requiresVerification: true,
        requiresManualReview: true
      }
    });
    await this.prisma.billingPlanEntitlement.createMany({
      data: [
        {
          planId: plan.id,
          key: 'badge.verified'
        }
      ],
      skipDuplicates: true
    });
  }
}
