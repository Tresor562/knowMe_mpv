import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationCenterPreferencesDto } from './dto/notification-center.dto';
import {
  defaultNotificationCenterPreference,
  localMinuteOfDay,
  normalizeNotificationCategories,
  normalizeNotificationStringList,
  notificationCircleId,
  NotificationCenterPreferencePolicy,
  resolveNotificationCenterDelivery
} from './notification-center.domain';

type StoredPreference = {
  userId: string;
  masterEnabled: boolean;
  realtimeEnabled: boolean;
  digestMode: 'INSTANT' | 'HOURLY' | 'DAILY' | 'CENTER_ONLY';
  dailyDigestMinute: number;
  quietHoursEnabled: boolean;
  quietStartMinute: number;
  quietEndMinute: number;
  timezone: string;
  categorySettings: Prisma.JsonValue;
  mutedTypes: Prisma.JsonValue;
  mutedCircleIds: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class NotificationCenterPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async preferenceForUser(userId: string) {
    const stored = await this.ensure(userId);
    return this.toPolicy(stored as StoredPreference);
  }

  async update(
    userId: string,
    dto: UpdateNotificationCenterPreferencesDto
  ) {
    const current = (await this.ensure(userId)) as StoredPreference;
    const timezone = dto.timezone?.trim() || current.timezone;
    this.assertTimezone(timezone);
    const categorySettings = normalizeNotificationCategories(
      dto.categorySettings
        ? {
            ...this.jsonRecord(current.categorySettings),
            ...dto.categorySettings
          }
        : current.categorySettings
    );
    const mutedTypes =
      dto.mutedTypes === undefined
        ? normalizeNotificationStringList(current.mutedTypes)
        : normalizeNotificationStringList(dto.mutedTypes);
    const mutedCircleIds =
      dto.mutedCircleIds === undefined
        ? normalizeNotificationStringList(current.mutedCircleIds)
        : normalizeNotificationStringList(dto.mutedCircleIds);

    const updated = await this.prisma.notificationCenterPreference.update({
      where: { userId },
      data: {
        ...(dto.masterEnabled !== undefined
          ? { masterEnabled: dto.masterEnabled }
          : {}),
        ...(dto.realtimeEnabled !== undefined
          ? { realtimeEnabled: dto.realtimeEnabled }
          : {}),
        ...(dto.digestMode !== undefined ? { digestMode: dto.digestMode } : {}),
        ...(dto.dailyDigestMinute !== undefined
          ? { dailyDigestMinute: dto.dailyDigestMinute }
          : {}),
        ...(dto.quietHoursEnabled !== undefined
          ? { quietHoursEnabled: dto.quietHoursEnabled }
          : {}),
        ...(dto.quietStartMinute !== undefined
          ? { quietStartMinute: dto.quietStartMinute }
          : {}),
        ...(dto.quietEndMinute !== undefined
          ? { quietEndMinute: dto.quietEndMinute }
          : {}),
        timezone,
        categorySettings: categorySettings as Prisma.InputJsonValue,
        mutedTypes: mutedTypes as Prisma.InputJsonValue,
        mutedCircleIds: mutedCircleIds as Prisma.InputJsonValue
      }
    });
    return this.toPolicy(updated as StoredPreference);
  }

  async deliveryFor(input: {
    userId: string;
    type: string;
    data?: Prisma.JsonValue | Prisma.InputJsonValue | null;
    now?: Date;
  }) {
    const preference = await this.preferenceForUser(input.userId);
    const now = input.now ?? new Date();
    return {
      preference,
      decision: resolveNotificationCenterDelivery({
        type: input.type,
        circleId: notificationCircleId(input.data),
        minuteOfDay: localMinuteOfDay(now, preference.timezone),
        preference
      })
    };
  }

  private ensure(userId: string) {
    const defaults = defaultNotificationCenterPreference();
    return this.prisma.notificationCenterPreference.upsert({
      where: { userId },
      create: {
        userId,
        masterEnabled: defaults.masterEnabled,
        realtimeEnabled: defaults.realtimeEnabled,
        digestMode: defaults.digestMode,
        dailyDigestMinute: defaults.dailyDigestMinute,
        quietHoursEnabled: defaults.quietHoursEnabled,
        quietStartMinute: defaults.quietStartMinute,
        quietEndMinute: defaults.quietEndMinute,
        timezone: defaults.timezone,
        categorySettings:
          defaults.categorySettings as unknown as Prisma.InputJsonValue,
        mutedTypes: defaults.mutedTypes as Prisma.InputJsonValue,
        mutedCircleIds: defaults.mutedCircleIds as Prisma.InputJsonValue
      },
      update: {}
    });
  }

  private toPolicy(
    stored: StoredPreference
  ): NotificationCenterPreferencePolicy {
    return {
      masterEnabled: stored.masterEnabled,
      realtimeEnabled: stored.realtimeEnabled,
      digestMode: stored.digestMode,
      dailyDigestMinute: stored.dailyDigestMinute,
      quietHoursEnabled: stored.quietHoursEnabled,
      quietStartMinute: stored.quietStartMinute,
      quietEndMinute: stored.quietEndMinute,
      timezone: stored.timezone,
      categorySettings: normalizeNotificationCategories(
        stored.categorySettings
      ),
      mutedTypes: normalizeNotificationStringList(stored.mutedTypes),
      mutedCircleIds: normalizeNotificationStringList(stored.mutedCircleIds)
    };
  }

  private assertTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(
        new Date()
      );
    } catch {
      throw new BadRequestException('Fuseau horaire invalide.');
    }
  }

  private jsonRecord(value: Prisma.JsonValue | null | undefined) {
    return value && !Array.isArray(value) && typeof value === 'object'
      ? (value as Record<string, Prisma.JsonValue>)
      : {};
  }
}
