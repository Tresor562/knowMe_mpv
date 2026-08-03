import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileCircleNotificationEndpointsService } from './profile-circle-notification-endpoints.service';
import { ProfileCircleNotificationRuntimeConfigService } from './profile-circle-notification-runtime.config';

export type ProfileCirclePushMessage = {
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
};

@Injectable()
export class ProfileCircleHttpPushProvider {
  constructor(private readonly config: ConfigService) {}

  async send(address: string, message: ProfileCirclePushMessage) {
    const endpoint = this.config.get<string>('PROFILE_NOTIFICATION_PUSH_URL')?.trim();
    if (!endpoint) {
      return {
        accepted: false,
        permanentFailure: false,
        errorCode: 'PUSH_PROVIDER_NOT_CONFIGURED'
      };
    }
    const token = this.config.get<string>('PROFILE_NOTIFICATION_PUSH_TOKEN')?.trim();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ to: address, ...message })
    });
    if (response.ok) {
      return { accepted: true, permanentFailure: false, errorCode: null };
    }
    return {
      accepted: false,
      permanentFailure: [400, 404, 410].includes(response.status),
      errorCode: `PUSH_HTTP_${response.status}`
    };
  }
}

@Injectable()
export class ProfileCirclePushDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly endpoints: ProfileCircleNotificationEndpointsService,
    private readonly provider: ProfileCircleHttpPushProvider,
    private readonly runtimeConfig: ProfileCircleNotificationRuntimeConfigService
  ) {}

  async send(input: {
    userId: string;
    recipientId?: string;
    idempotencyKey: string;
    message: ProfileCirclePushMessage;
  }) {
    if (!this.runtimeConfig.get().pushEnabled) {
      return { sent: 0, failed: 0, suppressed: true };
    }

    const endpoints = await this.endpoints.activeForUser(input.userId, 'PUSH');
    let sent = 0;
    let failed = 0;

    for (const endpoint of endpoints) {
      const key = `${input.idempotencyKey}:push:${endpoint.id}`;
      const attempt =
        await this.prisma.profileCircleNotificationTransportAttempt.upsert({
          where: { idempotencyKey: key },
          create: {
            recipientId: input.recipientId,
            userId: input.userId,
            channel: 'PUSH',
            provider: 'HTTP_PUSH',
            idempotencyKey: key,
            status: 'PENDING'
          },
          update: {}
        });
      if (attempt.status === 'SENT') {
        sent += 1;
        continue;
      }

      await this.prisma.profileCircleNotificationTransportAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'PROCESSING',
          processingAt: new Date(),
          attempts: { increment: 1 },
          errorCode: null
        }
      });

      try {
        const result = await this.provider.send(endpoint.address, input.message);
        if (result.accepted) {
          await Promise.all([
            this.prisma.profileCircleNotificationTransportAttempt.update({
              where: { id: attempt.id },
              data: { status: 'SENT', sentAt: new Date(), processingAt: null }
            }),
            this.endpoints.recordSuccess(endpoint.id)
          ]);
          sent += 1;
        } else {
          await Promise.all([
            this.prisma.profileCircleNotificationTransportAttempt.update({
              where: { id: attempt.id },
              data: {
                status: 'FAILED',
                failedAt: new Date(),
                processingAt: null,
                errorCode: result.errorCode
              }
            }),
            this.endpoints.recordFailure(endpoint.id, result.permanentFailure)
          ]);
          failed += 1;
        }
      } catch {
        await Promise.all([
          this.prisma.profileCircleNotificationTransportAttempt.update({
            where: { id: attempt.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              processingAt: null,
              errorCode: 'PUSH_PROVIDER_UNAVAILABLE'
            }
          }),
          this.endpoints.recordFailure(endpoint.id, false)
        ]);
        failed += 1;
      }
    }

    return { sent, failed, suppressed: false };
  }
}
