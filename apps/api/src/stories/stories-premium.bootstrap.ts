import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoriesPremiumBootstrap implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const plan = await this.prisma.billingPlan.upsert({
      where: { key: 'premium_monthly' },
      create: {
        key: 'premium_monthly',
        name: 'KnowMe Premium',
        description: 'Personnalisation avancée, fonctions exclusives et expérience KnowMe enrichie.',
        active: true,
        highlighted: true
      },
      update: {}
    });

    await this.prisma.billingPlanEntitlement.createMany({
      data: [{ planId: plan.id, key: 'premium.stories' }],
      skipDuplicates: true
    });

    const now = new Date();
    const activeCoreGrants = await this.prisma.entitlementGrant.findMany({
      where: {
        key: 'premium.core',
        startsAt: { lte: now },
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      },
      select: {
        userId: true,
        source: true,
        externalReference: true,
        startsAt: true,
        expiresAt: true
      },
      take: 10_000
    });

    for (const grant of activeCoreGrants) {
      const existing = await this.prisma.entitlementGrant.findFirst({
        where: {
          userId: grant.userId,
          key: 'premium.stories',
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        },
        select: { id: true }
      });
      if (existing) continue;

      await this.prisma.entitlementGrant.create({
        data: {
          userId: grant.userId,
          key: 'premium.stories',
          source: grant.source,
          externalReference: grant.externalReference,
          startsAt: grant.startsAt,
          expiresAt: grant.expiresAt,
          reason: 'Story Premium entitlement synchronized from premium.core.'
        }
      });
    }
  }
}
