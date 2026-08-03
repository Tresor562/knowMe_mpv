import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProfileCircleDigestItem,
  ProfileCircleEmailDigestService
} from './profile-circle-email-digest.service';
import { ProfileCirclePushDeliveryService } from './profile-circle-push-delivery.service';
import { ProfileCircleNotificationRuntimeConfigService } from './profile-circle-notification-runtime.config';

export type ProfileCircleDigestGroupingMode =
  | 'BY_CIRCLE'
  | 'BY_TYPE'
  | 'CHRONOLOGICAL';

export function groupProfileCircleDigestItems(
  items: ProfileCircleDigestItem[],
  mode: ProfileCircleDigestGroupingMode
) {
  if (mode === 'CHRONOLOGICAL') {
    return [...items].sort(
      (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime()
    );
  }
  const keyOf = (item: ProfileCircleDigestItem) =>
    mode === 'BY_CIRCLE'
      ? item.circleName || 'Sans cercle'
      : item.type || 'Autre';
  return [...items].sort((left, right) => {
    const group = keyOf(left).localeCompare(keyOf(right), 'fr');
    if (group !== 0) return group;
    return right.occurredAt.getTime() - left.occurredAt.getTime();
  });
}

export function localWeekdayAndMinute(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  const weekday = weekdays[value('weekday') || 'Mon'] ?? 1;
  const hour = Number.parseInt(value('hour') || '0', 10);
  const minute = Number.parseInt(value('minute') || '0', 10);
  return { weekday, minuteOfDay: hour * 60 + minute };
}

@Injectable()
export class ProfileCircleWeeklyDigestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: ProfileCircleEmailDigestService,
    private readonly push: ProfileCirclePushDeliveryService,
    private readonly runtimeConfig: ProfileCircleNotificationRuntimeConfigService
  ) {}

  async flushDue(input: { now?: Date; limit?: number } = {}) {
    const config = this.runtimeConfig.get();
    if (!config.weeklyDigestEnabled) {
      return { scanned: 0, delivered: 0, suppressed: true };
    }
    const now = input.now ?? new Date();
    const subscriptions =
      await this.prisma.profileCircleNotificationDigestSubscription.findMany({
        where: { weeklyEnabled: true },
        orderBy: [{ lastWeeklyAt: 'asc' }, { userId: 'asc' }],
        take: Math.min(500, Math.max(1, input.limit ?? 100))
      });
    let delivered = 0;
    let scanned = 0;

    for (const subscription of subscriptions) {
      const local = localWeekdayAndMinute(now, subscription.timezone);
      const alreadyDelivered =
        subscription.lastWeeklyAt &&
        now.getTime() - subscription.lastWeeklyAt.getTime() < 6 * 24 * 60 * 60_000;
      const due =
        !alreadyDelivered &&
        local.weekday === subscription.weeklyDay &&
        local.minuteOfDay >= subscription.minuteOfDay;
      if (!due) continue;
      scanned += 1;

      const recipients =
        await this.prisma.profileCircleNotificationRecipient.findMany({
          where: {
            userId: subscription.userId,
            status: 'DELIVERED',
            deliveredAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60_000) }
          },
          include: { dispatch: true },
          orderBy: { deliveredAt: 'desc' },
          take: 250
        });
      const items = groupProfileCircleDigestItems(
        recipients.map((recipient) => ({
          title: recipient.dispatch.title,
          body: recipient.dispatch.body,
          occurredAt: recipient.deliveredAt ?? recipient.createdAt,
          circleName: recipient.dispatch.circleId,
          type: recipient.dispatch.type
        })),
        subscription.groupingMode
      );
      const periodKey = this.periodKey(now, subscription.timezone);
      const key = `profile-weekly:${subscription.userId}:${periodKey}`;
      const [emailResult, pushResult] = await Promise.all([
        subscription.emailEnabled
          ? this.email.send({
              userId: subscription.userId,
              idempotencyKey: key,
              cadence: 'WEEKLY',
              items
            })
          : Promise.resolve({ sent: 0, failed: 0, suppressed: true }),
        subscription.pushEnabled && items.length > 0
          ? this.push.send({
              userId: subscription.userId,
              idempotencyKey: key,
              message: {
                title: 'Votre semaine sur KnowMe',
                body: `${items.length} activité${items.length > 1 ? 's' : ''} à retrouver`,
                data: { cadence: 'WEEKLY', count: items.length }
              }
            })
          : Promise.resolve({ sent: 0, failed: 0, suppressed: true })
      ]);
      await this.prisma.profileCircleNotificationDigestSubscription.update({
        where: { userId: subscription.userId },
        data: { lastWeeklyAt: now }
      });
      if (emailResult.sent > 0 || pushResult.sent > 0) delivered += 1;
    }

    return { scanned, delivered, suppressed: false };
  }

  private periodKey(now: Date, timezone: string) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
      .format(now)
      .replaceAll('/', '-');
  }
}
