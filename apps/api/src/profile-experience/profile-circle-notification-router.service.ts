import { Injectable } from '@nestjs/common';
import { ProfileCircleNotificationChannelPreferencesService } from './profile-circle-notification-channel-preferences.service';
import { ProfileCircleTransportChannel } from './profile-circle-notification-endpoints.service';
import { ProfileCircleNotificationProviderStateService } from './profile-circle-notification-provider-state.service';
import { ProfileCircleNotificationRateLimitService } from './profile-circle-notification-rate-limit.service';
import {
  isMandatoryPriority,
  ProfileCircleNotificationPriority,
  ProfileCircleNotificationRoute
} from './profile-circle-notification-resilience.domain';
import { ProfileCircleNotificationRuntimeConfigService } from './profile-circle-notification-runtime.config';
import { ProfileCircleNotificationSuppressionService } from './profile-circle-notification-suppression.service';

export type ProfileCircleNotificationRouteCandidate =
  ProfileCircleNotificationRoute & {
    addressHash?: string;
  };

@Injectable()
export class ProfileCircleNotificationRouterService {
  constructor(
    private readonly preferences: ProfileCircleNotificationChannelPreferencesService,
    private readonly suppressions: ProfileCircleNotificationSuppressionService,
    private readonly providers: ProfileCircleNotificationProviderStateService,
    private readonly rateLimits: ProfileCircleNotificationRateLimitService,
    private readonly runtimeConfig: ProfileCircleNotificationRuntimeConfigService
  ) {}

  async select(input: {
    userId: string;
    priority: ProfileCircleNotificationPriority;
    candidates: ProfileCircleNotificationRouteCandidate[];
    digest?: boolean;
    mandatory?: boolean;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const config = this.runtimeConfig.get();
    const rejected: Array<{
      channel: ProfileCircleTransportChannel;
      provider: string;
      reason: string;
    }> = [];

    for (const candidate of input.candidates) {
      const mandatory = input.mandatory || isMandatoryPriority(input.priority);
      const allowedByPreference = await this.preferences.allows({
        userId: input.userId,
        channel: candidate.channel,
        priority: input.priority,
        digest: input.digest,
        mandatory
      });
      if (!allowedByPreference) {
        rejected.push({ ...candidate, reason: 'USER_PREFERENCE' });
        continue;
      }

      const suppression = await this.suppressions.isSuppressed({
        userId: input.userId,
        channel: candidate.channel,
        addressHash: candidate.addressHash,
        now
      });
      if (suppression.suppressed && !mandatory) {
        rejected.push({
          ...candidate,
          reason: `SUPPRESSED:${suppression.reason}`
        });
        continue;
      }

      if (
        !(await this.providers.canUse(
          candidate.provider,
          candidate.channel,
          now
        ))
      ) {
        rejected.push({ ...candidate, reason: 'PROVIDER_CIRCUIT_OPEN' });
        continue;
      }

      const userBudget = await this.rateLimits.consume({
        scope: `user:${input.userId}:${candidate.channel}`,
        limit: mandatory
          ? Math.max(config.userRatePerMinute, 120)
          : config.userRatePerMinute,
        now
      });
      if (!userBudget.allowed) {
        rejected.push({ ...candidate, reason: 'USER_RATE_LIMIT' });
        continue;
      }

      const providerBudget = await this.rateLimits.consume({
        scope: `provider:${candidate.provider}:${candidate.channel}`,
        limit: config.providerRatePerMinute,
        now
      });
      if (!providerBudget.allowed) {
        rejected.push({ ...candidate, reason: 'PROVIDER_RATE_LIMIT' });
        continue;
      }

      return {
        selected: candidate,
        rejected,
        retryAt:
          userBudget.retryAt > providerBudget.retryAt
            ? userBudget.retryAt
            : providerBudget.retryAt
      };
    }

    return { selected: null, rejected, retryAt: null };
  }
}
