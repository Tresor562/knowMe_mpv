import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileCircleTransportChannel } from './profile-circle-notification-endpoints.service';
import { ProfileCircleNotificationRuntimeConfigService } from './profile-circle-notification-runtime.config';

@Injectable()
export class ProfileCircleNotificationProviderStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeConfig: ProfileCircleNotificationRuntimeConfigService
  ) {}

  async canUse(
    provider: string,
    channel: ProfileCircleTransportChannel,
    now = new Date()
  ) {
    const state =
      await this.prisma.profileCircleNotificationProviderState.findUnique({
        where: { provider_channel: { provider, channel } }
      });
    if (!state || state.circuitStatus === 'CLOSED') return true;
    if (state.circuitStatus === 'HALF_OPEN') return false;
    if (!state.nextProbeAt || state.nextProbeAt > now) return false;

    const transitioned =
      await this.prisma.profileCircleNotificationProviderState.updateMany({
        where: {
          provider,
          channel,
          circuitStatus: 'OPEN',
          nextProbeAt: { lte: now }
        },
        data: {
          circuitStatus: 'HALF_OPEN',
          consecutiveSuccesses: 0
        }
      });
    return transitioned.count === 1;
  }

  async recordSuccess(
    provider: string,
    channel: ProfileCircleTransportChannel,
    now = new Date()
  ) {
    const config = this.runtimeConfig.get();
    return this.prisma.$transaction(async (tx) => {
      const current =
        await tx.profileCircleNotificationProviderState.findUnique({
          where: { provider_channel: { provider, channel } }
        });
      const successes = (current?.consecutiveSuccesses ?? 0) + 1;
      const closes =
        current?.circuitStatus !== 'HALF_OPEN' ||
        successes >= config.providerRecoverySuccesses;
      return tx.profileCircleNotificationProviderState.upsert({
        where: { provider_channel: { provider, channel } },
        create: {
          provider,
          channel,
          circuitStatus: 'CLOSED',
          consecutiveFailures: 0,
          consecutiveSuccesses: 1,
          lastSuccessAt: now
        },
        update: {
          circuitStatus: closes ? 'CLOSED' : 'HALF_OPEN',
          consecutiveFailures: 0,
          consecutiveSuccesses: successes,
          lastSuccessAt: now,
          lastErrorCode: null,
          ...(closes ? { openedAt: null, nextProbeAt: null } : {})
        }
      });
    });
  }

  async recordFailure(input: {
    provider: string;
    channel: ProfileCircleTransportChannel;
    errorCode: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const config = this.runtimeConfig.get();
    return this.prisma.$transaction(async (tx) => {
      const current =
        await tx.profileCircleNotificationProviderState.findUnique({
          where: {
            provider_channel: {
              provider: input.provider,
              channel: input.channel
            }
          }
        });
      const failures = (current?.consecutiveFailures ?? 0) + 1;
      const opens =
        current?.circuitStatus === 'HALF_OPEN' ||
        failures >= config.providerFailureThreshold;
      return tx.profileCircleNotificationProviderState.upsert({
        where: {
          provider_channel: {
            provider: input.provider,
            channel: input.channel
          }
        },
        create: {
          provider: input.provider,
          channel: input.channel,
          circuitStatus: opens ? 'OPEN' : 'CLOSED',
          consecutiveFailures: failures,
          consecutiveSuccesses: 0,
          lastFailureAt: now,
          lastErrorCode: input.errorCode,
          openedAt: opens ? now : null,
          nextProbeAt: opens
            ? new Date(now.getTime() + config.circuitCooldownMs)
            : null
        },
        update: {
          circuitStatus: opens ? 'OPEN' : current?.circuitStatus ?? 'CLOSED',
          consecutiveFailures: failures,
          consecutiveSuccesses: 0,
          lastFailureAt: now,
          lastErrorCode: input.errorCode,
          ...(opens
            ? {
                openedAt: current?.openedAt ?? now,
                nextProbeAt: new Date(now.getTime() + config.circuitCooldownMs)
              }
            : {})
        }
      });
    });
  }

  list() {
    return this.prisma.profileCircleNotificationProviderState.findMany({
      orderBy: [{ circuitStatus: 'desc' }, { provider: 'asc' }]
    });
  }
}
