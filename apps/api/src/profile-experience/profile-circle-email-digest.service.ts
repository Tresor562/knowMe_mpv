import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileCircleNotificationEndpointsService } from './profile-circle-notification-endpoints.service';
import { ProfileCircleNotificationRuntimeConfigService } from './profile-circle-notification-runtime.config';

export type ProfileCircleDigestItem = {
  title: string;
  body: string;
  occurredAt: Date;
  circleName?: string | null;
  type?: string | null;
};

@Injectable()
export class ProfileCircleHttpEmailProvider {
  constructor(private readonly config: ConfigService) {}

  async send(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }) {
    const endpoint = this.config.get<string>('PROFILE_NOTIFICATION_EMAIL_URL')?.trim();
    if (!endpoint) {
      return { accepted: false, errorCode: 'EMAIL_PROVIDER_NOT_CONFIGURED' };
    }
    const token = this.config.get<string>('PROFILE_NOTIFICATION_EMAIL_TOKEN')?.trim();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(input)
    });
    return response.ok
      ? { accepted: true, errorCode: null }
      : { accepted: false, errorCode: `EMAIL_HTTP_${response.status}` };
  }
}

@Injectable()
export class ProfileCircleEmailDigestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly endpoints: ProfileCircleNotificationEndpointsService,
    private readonly provider: ProfileCircleHttpEmailProvider,
    private readonly runtimeConfig: ProfileCircleNotificationRuntimeConfigService
  ) {}

  render(input: {
    displayName?: string | null;
    cadence: 'DAILY' | 'WEEKLY';
    items: ProfileCircleDigestItem[];
  }) {
    const label = input.cadence === 'WEEKLY' ? 'hebdomadaire' : 'quotidien';
    const subject = `Votre résumé ${label} KnowMe`;
    const greeting = input.displayName
      ? `Bonjour ${input.displayName},`
      : 'Bonjour,';
    const rows = input.items
      .slice(0, 100)
      .map((item) => {
        const context = item.circleName ? ` — ${item.circleName}` : '';
        return `${item.title}${context}\n${item.body}`;
      });
    const text = [
      greeting,
      '',
      `Voici votre résumé ${label}.`,
      '',
      ...rows.map((row, index) => `${index + 1}. ${row}`),
      '',
      'Vous pouvez modifier vos préférences de notification dans KnowMe.'
    ].join('\n');
    const htmlItems = input.items
      .slice(0, 100)
      .map(
        (item) =>
          `<li><strong>${this.escape(item.title)}</strong>${
            item.circleName ? ` — ${this.escape(item.circleName)}` : ''
          }<br>${this.escape(item.body)}</li>`
      )
      .join('');
    const html = `<p>${this.escape(greeting)}</p><p>Voici votre résumé ${label}.</p><ol>${htmlItems}</ol><p>Vous pouvez modifier vos préférences de notification dans KnowMe.</p>`;
    return { subject, text, html };
  }

  async send(input: {
    userId: string;
    idempotencyKey: string;
    displayName?: string | null;
    cadence: 'DAILY' | 'WEEKLY';
    items: ProfileCircleDigestItem[];
  }) {
    if (!this.runtimeConfig.get().emailEnabled || input.items.length === 0) {
      return { sent: 0, failed: 0, suppressed: true };
    }
    const content = this.render(input);
    const endpoints = await this.endpoints.activeForUser(input.userId, 'EMAIL');
    let sent = 0;
    let failed = 0;

    for (const endpoint of endpoints) {
      const key = `${input.idempotencyKey}:email:${endpoint.id}`;
      const attempt =
        await this.prisma.profileCircleNotificationTransportAttempt.upsert({
          where: { idempotencyKey: key },
          create: {
            userId: input.userId,
            channel: 'EMAIL',
            provider: 'HTTP_EMAIL',
            idempotencyKey: key,
            status: 'PENDING',
            metadata: { cadence: input.cadence, itemCount: input.items.length }
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
        const result = await this.provider.send({ to: endpoint.address, ...content });
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
            this.endpoints.recordFailure(endpoint.id, false)
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
              errorCode: 'EMAIL_PROVIDER_UNAVAILABLE'
            }
          }),
          this.endpoints.recordFailure(endpoint.id, false)
        ]);
        failed += 1;
      }
    }
    return { sent, failed, suppressed: false };
  }

  private escape(value: string) {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return entities[character] ?? character;
    });
  }
}
