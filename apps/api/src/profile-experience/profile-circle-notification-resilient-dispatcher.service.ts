import { Injectable } from '@nestjs/common';
import { ProfileCircleEmailDigestService } from './profile-circle-email-digest.service';
import { ProfileCircleNotificationDeadLetterService } from './profile-circle-notification-dead-letter.service';
import { ProfileCircleNotificationProviderStateService } from './profile-circle-notification-provider-state.service';
import {
  normalizeProviderError,
  ProfileCircleNotificationPriority
} from './profile-circle-notification-resilience.domain';
import { ProfileCircleNotificationRouterService } from './profile-circle-notification-router.service';
import { ProfileCirclePushDeliveryService } from './profile-circle-push-delivery.service';

@Injectable()
export class ProfileCircleNotificationResilientDispatcherService {
  constructor(
    private readonly router: ProfileCircleNotificationRouterService,
    private readonly push: ProfileCirclePushDeliveryService,
    private readonly email: ProfileCircleEmailDigestService,
    private readonly providers: ProfileCircleNotificationProviderStateService,
    private readonly deadLetters: ProfileCircleNotificationDeadLetterService
  ) {}

  async dispatch(input: {
    userId: string;
    recipientId?: string;
    idempotencyKey: string;
    priority?: ProfileCircleNotificationPriority;
    title: string;
    body: string;
    data?: Record<string, string | number | boolean | null>;
    digest?: boolean;
    mandatory?: boolean;
    preferredChannels?: Array<'PUSH' | 'EMAIL'>;
  }) {
    const priority = input.priority ?? 'NORMAL';
    const channels = input.preferredChannels?.length
      ? input.preferredChannels
      : (['PUSH', 'EMAIL'] as const);
    const candidates = channels.map((channel) => ({
      channel,
      provider: channel === 'PUSH' ? 'HTTP_PUSH' : 'HTTP_EMAIL',
      priority
    }));
    const route = await this.router.select({
      userId: input.userId,
      priority,
      candidates,
      digest: input.digest,
      mandatory: input.mandatory
    });
    if (!route.selected) {
      return {
        delivered: false,
        suppressed: true,
        reason: 'NO_ELIGIBLE_ROUTE',
        rejected: route.rejected
      };
    }

    const selected = route.selected;
    try {
      const result =
        selected.channel === 'PUSH'
          ? await this.push.send({
              userId: input.userId,
              recipientId: input.recipientId,
              idempotencyKey: input.idempotencyKey,
              message: {
                title: input.title,
                body: input.body,
                data: input.data
              }
            })
          : await this.email.send({
              userId: input.userId,
              idempotencyKey: input.idempotencyKey,
              cadence: input.digest ? 'WEEKLY' : 'DAILY',
              items: [
                {
                  title: input.title,
                  body: input.body,
                  occurredAt: new Date(),
                  type: 'RESILIENT_NOTIFICATION'
                }
              ]
            });

      if (result.sent > 0 && result.failed === 0) {
        await this.providers.recordSuccess(selected.provider, selected.channel);
        return {
          delivered: true,
          suppressed: false,
          channel: selected.channel,
          provider: selected.provider,
          result
        };
      }

      if (result.failed > 0) {
        await this.providers.recordFailure({
          provider: selected.provider,
          channel: selected.channel,
          errorCode: 'TRANSPORT_DELIVERY_FAILED'
        });
      }
      return {
        delivered: result.sent > 0,
        suppressed: result.suppressed,
        channel: selected.channel,
        provider: selected.provider,
        result
      };
    } catch (error) {
      const errorCode = normalizeProviderError(error);
      await this.providers.recordFailure({
        provider: selected.provider,
        channel: selected.channel,
        errorCode
      });
      await this.deadLetters.capture({
        userId: input.userId,
        channel: selected.channel,
        provider: selected.provider,
        idempotencyKey: `dispatch:${input.idempotencyKey}:${selected.channel}`,
        priority,
        reasonCode: errorCode,
        payload: {
          recipientId: input.recipientId,
          title: input.title.slice(0, 180),
          body: input.body.slice(0, 1_000)
        }
      });
      return {
        delivered: false,
        suppressed: false,
        channel: selected.channel,
        provider: selected.provider,
        errorCode
      };
    }
  }
}
