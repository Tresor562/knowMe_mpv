import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import {
  BillingProviderEventDto,
  CreateBillingPlanDto,
  CreateBillingPriceDto,
  UpdateBillingPlanDto
} from './dto/billing.dto';
import {
  billingPayloadHash,
  secureSignatureEquals,
  signBillingPayload
} from './billing-signature';

const PREMIUM_ENTITLEMENTS = [
  'premium.core',
  'premium.messaging',
  'premium.avatar',
  'premium.challenge',
  'premium.themes',
  'premium.app_icons',
  'premium.reactions',
  'premium.ai',
  'premium.storage'
] as const;

const ACCESS_STATUSES = new Set(['TRIALING', 'ACTIVE', 'PAST_DUE']);
const TERMINAL_STATUSES = new Set(['CANCELED', 'EXPIRED', 'REFUNDED']);

@Injectable()
export class BillingService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService
  ) {}

  async onModuleInit() {
    const plan = await this.prisma.billingPlan.upsert({
      where: { key: 'premium_monthly' },
      create: {
        key: 'premium_monthly',
        name: 'KnowMe Premium',
        description:
          'Personnalisation avancée, fonctions exclusives et expérience KnowMe enrichie.',
        active: true,
        highlighted: true
      },
      update: {
        name: 'KnowMe Premium',
        description:
          'Personnalisation avancée, fonctions exclusives et expérience KnowMe enrichie.'
      }
    });

    await this.prisma.billingPlanEntitlement.createMany({
      data: PREMIUM_ENTITLEMENTS.map((key) => ({ planId: plan.id, key })),
      skipDuplicates: true
    });

    await this.prisma.billingPrice.upsert({
      where: {
        provider_externalPriceId: {
          provider: 'CATALOG',
          externalPriceId: 'premium-monthly-usd-v1'
        }
      },
      create: {
        planId: plan.id,
        provider: 'CATALOG',
        externalPriceId: 'premium-monthly-usd-v1',
        platform: 'ALL',
        currency: 'USD',
        unitAmount: 2000,
        interval: 'MONTH',
        intervalCount: 1,
        active: true
      },
      update: {
        planId: plan.id,
        currency: 'USD',
        unitAmount: 2000,
        interval: 'MONTH',
        intervalCount: 1
      }
    });
  }

  async catalog(platform = 'ALL', countryCode?: string, currency?: string) {
    const plans = await this.prisma.billingPlan.findMany({
      where: { active: true },
      include: {
        entitlements: { orderBy: { key: 'asc' } },
        prices: {
          where: { active: true },
          orderBy: [{ countryCode: 'desc' }, { unitAmount: 'asc' }]
        }
      },
      orderBy: [{ highlighted: 'desc' }, { createdAt: 'asc' }]
    });

    const normalizedPlatform = platform.trim().toUpperCase();
    const normalizedCountry = countryCode?.trim().toUpperCase();
    const normalizedCurrency = currency?.trim().toUpperCase();

    return plans.map((plan) => ({
      id: plan.id,
      key: plan.key,
      name: plan.name,
      description: plan.description,
      highlighted: plan.highlighted,
      requiresVerification: plan.requiresVerification,
      requiresManualReview: plan.requiresManualReview,
      entitlements: plan.entitlements.map((item) => item.key),
      prices: plan.prices.filter(
        (price) =>
          (price.platform === 'ALL' || price.platform === normalizedPlatform) &&
          (!price.countryCode || price.countryCode === normalizedCountry) &&
          (!normalizedCurrency || price.currency === normalizedCurrency)
      ),
      checkoutAvailable: false
    }));
  }

  async me(userId: string) {
    const [subscriptions, entitlementState] = await Promise.all([
      this.prisma.billingSubscription.findMany({
        where: { userId },
        include: {
          plan: {
            include: { entitlements: { orderBy: { key: 'asc' } } }
          },
          price: true
        },
        orderBy: [{ currentPeriodEnd: 'desc' }, { updatedAt: 'desc' }]
      }),
      this.entitlements.listForUser(userId)
    ]);

    const now = new Date();
    return {
      accountId: userId,
      serverTime: now,
      subscriptions: subscriptions.map((subscription) => ({
        ...subscription,
        grantsAccess:
          ACCESS_STATUSES.has(subscription.status) &&
          subscription.currentPeriodEnd > now,
        entitlementKeys: subscription.plan.entitlements.map((item) => item.key)
      })),
      entitlements: entitlementState.entitlements
    };
  }

  listAdmin() {
    return this.prisma.billingPlan.findMany({
      include: {
        prices: { orderBy: { createdAt: 'desc' } },
        entitlements: { orderBy: { key: 'asc' } },
        _count: { select: { subscriptions: true } }
      },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }]
    });
  }

  subscriptionsAdmin(userId?: string) {
    return this.prisma.billingSubscription.findMany({
      where: userId ? { userId } : undefined,
      include: {
        user: {
          select: { id: true, username: true, displayName: true, email: true }
        },
        plan: true,
        price: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 200
    });
  }

  eventsAdmin(provider?: string) {
    return this.prisma.billingEvent.findMany({
      where: provider ? { provider: provider.trim().toUpperCase() } : undefined,
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        subscription: {
          select: {
            id: true,
            status: true,
            externalSubscriptionId: true
          }
        }
      },
      orderBy: { receivedAt: 'desc' },
      take: 200
    });
  }

  async createPlan(actorId: string, dto: CreateBillingPlanDto) {
    const key = dto.key.trim().toLowerCase();
    const entitlementKeys = this.normalizeEntitlements(dto.entitlements);

    try {
      const plan = await this.prisma.billingPlan.create({
        data: {
          key,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          active: dto.active ?? false,
          highlighted: dto.highlighted ?? false,
          requiresVerification: dto.requiresVerification ?? false,
          requiresManualReview: dto.requiresManualReview ?? false,
          entitlements: {
            create: entitlementKeys.map((entitlementKey) => ({
              key: entitlementKey
            }))
          }
        },
        include: { entitlements: true, prices: true }
      });

      await this.audit.record({
        actorId,
        action: 'BILLING_PLAN_CREATE',
        entity: 'BillingPlan',
        entityId: plan.id,
        metadata: { key, entitlements: entitlementKeys, active: plan.active }
      });
      return plan;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Cette clé de plan existe déjà.');
      }
      throw error;
    }
  }

  async updatePlan(actorId: string, planId: string, dto: UpdateBillingPlanDto) {
    const existing = await this.prisma.billingPlan.findUnique({
      where: { id: planId },
      include: { entitlements: true }
    });
    if (!existing) throw new NotFoundException('Plan introuvable.');

    const entitlementKeys = dto.entitlements
      ? this.normalizeEntitlements(dto.entitlements)
      : existing.entitlements.map((item) => item.key);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.entitlements) {
        await tx.billingPlanEntitlement.deleteMany({ where: { planId } });
        await tx.billingPlanEntitlement.createMany({
          data: entitlementKeys.map((key) => ({ planId, key }))
        });
      }

      return tx.billingPlan.update({
        where: { id: planId },
        data: {
          name: dto.name?.trim(),
          description:
            dto.description === undefined ? undefined : dto.description.trim() || null,
          active: dto.active,
          highlighted: dto.highlighted,
          requiresVerification: dto.requiresVerification,
          requiresManualReview: dto.requiresManualReview
        },
        include: { entitlements: true, prices: true }
      });
    });

    await this.audit.record({
      actorId,
      action: 'BILLING_PLAN_UPDATE',
      entity: 'BillingPlan',
      entityId: planId,
      metadata: {
        key: existing.key,
        reason: dto.reason.trim(),
        active: updated.active,
        entitlements: entitlementKeys
      }
    });
    return updated;
  }

  async createPrice(
    actorId: string,
    planId: string,
    dto: CreateBillingPriceDto
  ) {
    const plan = await this.prisma.billingPlan.findUnique({
      where: { id: planId },
      select: { id: true, key: true }
    });
    if (!plan) throw new NotFoundException('Plan introuvable.');

    try {
      const price = await this.prisma.billingPrice.create({
        data: {
          planId,
          provider: dto.provider.trim().toUpperCase(),
          externalPriceId: dto.externalPriceId?.trim() || null,
          platform: dto.platform ?? 'ALL',
          countryCode: dto.countryCode?.trim().toUpperCase() || null,
          currency: dto.currency.trim().toUpperCase(),
          unitAmount: dto.unitAmount,
          interval: dto.interval ?? 'MONTH',
          intervalCount: dto.intervalCount ?? 1,
          active: dto.active ?? true
        }
      });

      await this.audit.record({
        actorId,
        action: 'BILLING_PRICE_CREATE',
        entity: 'BillingPrice',
        entityId: price.id,
        metadata: {
          planKey: plan.key,
          provider: price.provider,
          currency: price.currency,
          unitAmount: price.unitAmount
        }
      });
      return price;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Cet identifiant de prix existe déjà chez ce prestataire.'
        );
      }
      throw error;
    }
  }

  async processSignedEvent(
    providerValue: string,
    timestampValue: string | undefined,
    signatureValue: string | undefined,
    dto: BillingProviderEventDto
  ) {
    const provider = providerValue.trim().toUpperCase();
    if (!/^[A-Z0-9_]{2,32}$/.test(provider)) {
      throw new UnauthorizedException('Prestataire de facturation invalide.');
    }

    const timestamp = Number(timestampValue);
    if (!Number.isInteger(timestamp)) {
      throw new UnauthorizedException('Horodatage de signature invalide.');
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestamp) > 300) {
      throw new UnauthorizedException('Signature expirée.');
    }

    const secret = this.config.get<string>(`BILLING_WEBHOOK_SECRET_${provider}`);
    if (!secret || secret.length < 24) {
      throw new UnauthorizedException('Prestataire de facturation non configuré.');
    }

    const expectedSignature = signBillingPayload(secret, String(timestamp), dto);
    if (
      !signatureValue ||
      !secureSignatureEquals(expectedSignature, signatureValue.trim())
    ) {
      throw new UnauthorizedException('Signature de facturation invalide.');
    }

    return this.processVerifiedEvent(provider, dto);
  }

  private async processVerifiedEvent(
    provider: string,
    dto: BillingProviderEventDto
  ) {
    const payloadHash = billingPayloadHash(dto);
    const duplicate = await this.prisma.billingEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider,
          externalEventId: dto.eventId
        }
      },
      include: { subscription: { include: { plan: true, price: true } } }
    });
    if (duplicate) {
      if (duplicate.payloadHash !== payloadHash) {
        throw new ConflictException(
          'Cet identifiant d’événement existe avec un contenu différent.'
        );
      }
      return { event: duplicate, subscription: duplicate.subscription, replayed: true };
    }

    const occurredAt = new Date(dto.occurredAt);
    const periodStart = new Date(dto.currentPeriodStart);
    const periodEnd = new Date(dto.currentPeriodEnd);
    const endedAt = dto.endedAt ? new Date(dto.endedAt) : null;

    if (periodEnd <= periodStart) {
      throw new BadRequestException(
        'La fin de période doit être postérieure à son début.'
      );
    }
    if (periodEnd.getTime() - periodStart.getTime() > 5 * 366 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Période de facturation anormalement longue.');
    }
    if (occurredAt.getTime() > Date.now() + 10 * 60 * 1000) {
      throw new BadRequestException('Événement daté dans le futur.');
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const [plan, user, existingSubscription] = await Promise.all([
              tx.billingPlan.findUnique({
                where: { key: dto.planKey.trim().toLowerCase() },
                include: { entitlements: true }
              }),
              tx.user.findUnique({
                where: { id: dto.accountId },
                select: { id: true }
              }),
              tx.billingSubscription.findUnique({
                where: {
                  provider_externalSubscriptionId: {
                    provider,
                    externalSubscriptionId: dto.externalSubscriptionId
                  }
                }
              })
            ]);

            if (!plan) throw new NotFoundException('Plan de facturation introuvable.');
            if (!user) throw new NotFoundException('Compte utilisateur introuvable.');
            if (
              existingSubscription &&
              existingSubscription.userId !== dto.accountId
            ) {
              throw new ConflictException(
                'Cet abonnement appartient déjà à un autre compte.'
              );
            }

            let priceId = existingSubscription?.priceId ?? null;
            if (dto.externalPriceId) {
              const price = await tx.billingPrice.findUnique({
                where: {
                  provider_externalPriceId: {
                    provider,
                    externalPriceId: dto.externalPriceId
                  }
                }
              });
              if (!price || price.planId !== plan.id) {
                throw new BadRequestException(
                  'Le prix externe ne correspond pas au plan indiqué.'
                );
              }
              priceId = price.id;
            }

            if (
              existingSubscription &&
              existingSubscription.latestEventTime >= occurredAt
            ) {
              const event = await tx.billingEvent.create({
                data: {
                  provider,
                  externalEventId: dto.eventId,
                  type: dto.type.trim().toUpperCase(),
                  occurredAt,
                  payloadHash,
                  status: 'IGNORED',
                  reason: 'OUT_OF_ORDER',
                  userId: existingSubscription.userId,
                  subscriptionId: existingSubscription.id,
                  payload: dto as unknown as Prisma.InputJsonValue,
                  processedAt: new Date()
                }
              });
              await tx.auditLog.create({
                data: {
                  action: 'BILLING_EVENT_IGNORED',
                  entity: 'BillingEvent',
                  entityId: event.id,
                  targetAccountId: existingSubscription.userId,
                  metadata: {
                    provider,
                    externalEventId: dto.eventId,
                    reason: 'OUT_OF_ORDER'
                  }
                }
              });
              return {
                event,
                subscription: existingSubscription,
                replayed: false
              };
            }

            const terminal = TERMINAL_STATUSES.has(dto.status);
            const subscription = await tx.billingSubscription.upsert({
              where: {
                provider_externalSubscriptionId: {
                  provider,
                  externalSubscriptionId: dto.externalSubscriptionId
                }
              },
              create: {
                userId: dto.accountId,
                planId: plan.id,
                priceId,
                provider,
                externalSubscriptionId: dto.externalSubscriptionId,
                status: dto.status,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: dto.cancelAtPeriodEnd ?? false,
                cancelledAt:
                  dto.cancelAtPeriodEnd || dto.status === 'CANCELED'
                    ? occurredAt
                    : null,
                endedAt: endedAt ?? (terminal ? occurredAt : null),
                latestEventTime: occurredAt,
                latestExternalEventId: dto.eventId,
                metadata: dto.metadata as Prisma.InputJsonValue | undefined
              },
              update: {
                planId: plan.id,
                priceId,
                status: dto.status,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: dto.cancelAtPeriodEnd ?? false,
                cancelledAt:
                  dto.cancelAtPeriodEnd || dto.status === 'CANCELED'
                    ? occurredAt
                    : existingSubscription?.cancelledAt,
                endedAt: endedAt ?? (terminal ? occurredAt : null),
                latestEventTime: occurredAt,
                latestExternalEventId: dto.eventId,
                metadata: dto.metadata as Prisma.InputJsonValue | undefined
              }
            });

            await this.syncSubscriptionEntitlements(
              tx,
              subscription.id,
              dto.accountId,
              plan.entitlements.map((item) => item.key),
              dto.status,
              periodStart,
              periodEnd
            );

            const event = await tx.billingEvent.create({
              data: {
                provider,
                externalEventId: dto.eventId,
                type: dto.type.trim().toUpperCase(),
                occurredAt,
                payloadHash,
                status: 'PROCESSED',
                userId: dto.accountId,
                subscriptionId: subscription.id,
                payload: dto as unknown as Prisma.InputJsonValue,
                processedAt: new Date()
              }
            });

            await tx.auditLog.create({
              data: {
                action: 'BILLING_EVENT_PROCESS',
                entity: 'BillingEvent',
                entityId: event.id,
                targetAccountId: dto.accountId,
                metadata: {
                  provider,
                  externalEventId: dto.eventId,
                  externalSubscriptionId: dto.externalSubscriptionId,
                  planKey: plan.key,
                  status: dto.status,
                  currentPeriodEnd: periodEnd.toISOString(),
                  cancelAtPeriodEnd: dto.cancelAtPeriodEnd ?? false
                }
              }
            });

            return {
              event,
              subscription: await tx.billingSubscription.findUniqueOrThrow({
                where: { id: subscription.id },
                include: { plan: true, price: true }
              }),
              replayed: false
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const concurrent = await this.prisma.billingEvent.findUnique({
            where: {
              provider_externalEventId: {
                provider,
                externalEventId: dto.eventId
              }
            },
            include: { subscription: { include: { plan: true, price: true } } }
          });
          if (concurrent) {
            if (concurrent.payloadHash !== payloadHash) {
              throw new ConflictException(
                'Cet identifiant d’événement existe avec un contenu différent.'
              );
            }
            return {
              event: concurrent,
              subscription: concurrent.subscription,
              replayed: true
            };
          }
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Événement de facturation temporairement indisponible.');
  }

  private async syncSubscriptionEntitlements(
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    userId: string,
    entitlementKeys: string[],
    status: string,
    periodStart: Date,
    periodEnd: Date
  ) {
    const now = new Date();
    const grantsAccess = ACCESS_STATUSES.has(status) && periodEnd > now;
    const activeGrants = await tx.entitlementGrant.findMany({
      where: {
        userId,
        source: 'SUBSCRIPTION',
        externalReference: subscriptionId,
        revokedAt: null
      }
    });

    const allowed = new Set(entitlementKeys);
    const grantsToRevoke = activeGrants.filter(
      (grant) => !grantsAccess || !allowed.has(grant.key)
    );
    if (grantsToRevoke.length) {
      await tx.entitlementGrant.updateMany({
        where: { id: { in: grantsToRevoke.map((grant) => grant.id) } },
        data: {
          revokedAt: now,
          reason: `Abonnement ${status.toLowerCase()}.`
        }
      });
    }

    if (!grantsAccess) return;

    for (const key of entitlementKeys) {
      const current = activeGrants.find((grant) => grant.key === key);
      if (current) {
        await tx.entitlementGrant.update({
          where: { id: current.id },
          data: {
            expiresAt: periodEnd,
            reason: 'Droit synchronisé depuis un abonnement vérifié.'
          }
        });
      } else {
        await tx.entitlementGrant.create({
          data: {
            userId,
            key,
            source: 'SUBSCRIPTION',
            externalReference: subscriptionId,
            startsAt: periodStart,
            expiresAt: periodEnd,
            reason: 'Droit synchronisé depuis un abonnement vérifié.',
            metadata: { subscriptionId, status }
          }
        });
      }
    }
  }

  private normalizeEntitlements(values: string[]) {
    return [...new Set(values.map((value) => value.trim().toLowerCase()))].sort();
  }
}
