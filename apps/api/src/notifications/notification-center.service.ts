import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  defaultNotificationPreference,
  groupNotificationRows,
  normalizeCategorySettings,
  normalizeStringList,
  NotificationPreferencePolicy,
  resolveNotificationDelivery
} from './notification-center.domain';
import {
  NotificationStateActionDto,
  RegisterNotificationPushEndpointDto,
  UpdateNotificationPreferencesDto
} from './dto/notification-center.dto';

type StoredPreference = {
  userId: string;
  masterEnabled: boolean;
  realtimeEnabled: boolean;
  pushEnabled: boolean;
  digestMode: 'INSTANT' | 'HOURLY' | 'DAILY' | 'OFF';
  quietHoursEnabled: boolean;
  quietStartMinute: number;
  quietEndMinute: number;
  timezone: string;
  categorySettings: Prisma.JsonValue;
  mutedTypes: Prisma.JsonValue;
  mutedCircleIds: Prisma.JsonValue;
};

@Injectable()
export class NotificationCenterService {
  constructor(private readonly prisma: PrismaService) {}

  async center(userId: string) {
    const preference = await this.preferenceForUser(userId);
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 120
    });
    const states = rows.length
      ? await this.prisma.notificationUserState.findMany({
          where: { userId, notificationId: { in: rows.map((row) => row.id) } }
        })
      : [];
    const stateByNotification = new Map(states.map((state) => [state.notificationId, state]));
    const minuteOfDay = this.minuteOfDay(preference.timezone);
    const now = new Date();
    const visible = rows.filter((row) => {
      const state = stateByNotification.get(row.id);
      if (state?.dismissedAt || state?.archivedAt) return false;
      if (state?.snoozedUntil && state.snoozedUntil > now) return false;
      const data = this.jsonRecord(row.data);
      const circleId = typeof data.circleId === 'string' ? data.circleId : null;
      return resolveNotificationDelivery({
        type: row.type,
        circleId,
        minuteOfDay,
        preference
      }).visibleInCenter;
    });
    const groups = groupNotificationRows(visible);
    return {
      preferences: preference,
      groups,
      totals: {
        notifications: visible.length,
        groups: groups.length,
        unread: visible.filter((row) => !row.readAt).length,
        snoozed: states.filter((state) => state.snoozedUntil && state.snoozedUntil > now).length,
        archived: states.filter((state) => Boolean(state.archivedAt)).length
      },
      policy: {
        criticalCategoriesAlwaysVisible: ['SECURITY', 'SYSTEM'],
        pushProviderConfigured: false,
        rawPushTokensStored: false,
        groupingWindowMinutes: 60
      }
    };
  }

  async getPreferences(userId: string) {
    return this.preferenceForUser(userId);
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    const current = await this.ensurePreference(userId);
    const categorySettings = dto.categorySettings
      ? normalizeCategorySettings({
          ...this.jsonRecord(current.categorySettings),
          ...dto.categorySettings
        })
      : normalizeCategorySettings(current.categorySettings);
    const mutedTypes = dto.mutedTypes === undefined
      ? normalizeStringList(current.mutedTypes)
      : normalizeStringList(dto.mutedTypes);
    const mutedCircleIds = dto.mutedCircleIds === undefined
      ? normalizeStringList(current.mutedCircleIds)
      : normalizeStringList(dto.mutedCircleIds);
    const timezone = dto.timezone?.trim() || current.timezone;
    this.assertTimezone(timezone);
    const updated = await this.prisma.notificationPreference.update({
      where: { userId },
      data: {
        ...(dto.masterEnabled !== undefined ? { masterEnabled: dto.masterEnabled } : {}),
        ...(dto.realtimeEnabled !== undefined ? { realtimeEnabled: dto.realtimeEnabled } : {}),
        ...(dto.pushEnabled !== undefined ? { pushEnabled: dto.pushEnabled } : {}),
        ...(dto.digestMode !== undefined ? { digestMode: dto.digestMode } : {}),
        ...(dto.quietHoursEnabled !== undefined ? { quietHoursEnabled: dto.quietHoursEnabled } : {}),
        ...(dto.quietStartMinute !== undefined ? { quietStartMinute: dto.quietStartMinute } : {}),
        ...(dto.quietEndMinute !== undefined ? { quietEndMinute: dto.quietEndMinute } : {}),
        timezone,
        categorySettings: categorySettings as Prisma.InputJsonValue,
        mutedTypes: mutedTypes as Prisma.InputJsonValue,
        mutedCircleIds: mutedCircleIds as Prisma.InputJsonValue
      }
    });
    return this.toPolicy(updated as StoredPreference);
  }

  async applyState(userId: string, notificationId: string, dto: NotificationStateActionDto) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true }
    });
    if (!notification) throw new NotFoundException('Notification introuvable.');
    const existingReceipt = await this.prisma.notificationCenterActionReceipt.findUnique({
      where: { idempotencyKey: dto.idempotencyKey }
    });
    if (existingReceipt) {
      if (existingReceipt.userId !== userId) throw new ConflictException('Clé d’action déjà utilisée.');
      return { replayed: true, result: existingReceipt.result };
    }

    const now = new Date();
    const data = dto.action === 'DISMISS'
      ? { dismissedAt: now, archivedAt: null, snoozedUntil: null }
      : dto.action === 'ARCHIVE'
        ? { archivedAt: now, dismissedAt: null, snoozedUntil: null }
        : dto.action === 'SNOOZE'
          ? {
              snoozedUntil: new Date(now.getTime() + (dto.snoozeMinutes ?? 60) * 60_000),
              dismissedAt: null,
              archivedAt: null
            }
          : { dismissedAt: null, archivedAt: null, snoozedUntil: null };

    try {
      const state = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.notificationUserState.upsert({
          where: { notificationId_userId: { notificationId, userId } },
          create: { notificationId, userId, ...data },
          update: data
        });
        await tx.notificationCenterActionReceipt.create({
          data: {
            idempotencyKey: dto.idempotencyKey,
            userId,
            notificationId,
            action: dto.action,
            result: {
              notificationId,
              action: dto.action,
              dismissedAt: updated.dismissedAt,
              archivedAt: updated.archivedAt,
              snoozedUntil: updated.snoozedUntil
            } as Prisma.InputJsonValue
          }
        });
        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { replayed: false, state };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const receipt = await this.prisma.notificationCenterActionReceipt.findUnique({
          where: { idempotencyKey: dto.idempotencyKey }
        });
        return { replayed: true, result: receipt?.result ?? null };
      }
      throw error;
    }
  }

  async registerPushEndpoint(userId: string, dto: RegisterNotificationPushEndpointDto) {
    const reference = dto.tokenReference.trim();
    if (!/^(vault|expo|fcm|apns|webpush):\/\//.test(reference)) {
      throw new BadRequestException('Utilisez une référence de jeton sécurisée, jamais un jeton brut.');
    }
    const fingerprint = createHash('sha256').update(reference).digest('hex');
    const endpoint = await this.prisma.notificationPushEndpoint.upsert({
      where: { userId_tokenFingerprint: { userId, tokenFingerprint: fingerprint } },
      create: {
        userId,
        platform: dto.platform,
        tokenFingerprint: fingerprint,
        tokenReference: reference,
        appVersion: dto.appVersion?.trim() || null,
        deviceLabel: dto.deviceLabel?.trim() || null
      },
      update: {
        platform: dto.platform,
        tokenReference: reference,
        appVersion: dto.appVersion?.trim() || null,
        deviceLabel: dto.deviceLabel?.trim() || null,
        enabled: true,
        failedAt: null,
        lastSeenAt: new Date()
      }
    });
    return this.sanitizeEndpoint(endpoint);
  }

  async pushEndpoints(userId: string) {
    const endpoints = await this.prisma.notificationPushEndpoint.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });
    return endpoints.map((endpoint) => this.sanitizeEndpoint(endpoint));
  }

  async disablePushEndpoint(userId: string, endpointId: string) {
    const result = await this.prisma.notificationPushEndpoint.updateMany({
      where: { id: endpointId, userId },
      data: { enabled: false }
    });
    if (result.count !== 1) throw new NotFoundException('Appareil de notification introuvable.');
    return { disabled: true, endpointId };
  }

  async preferenceForUser(userId: string): Promise<NotificationPreferencePolicy> {
    const stored = await this.ensurePreference(userId);
    return this.toPolicy(stored as StoredPreference);
  }

  private ensurePreference(userId: string) {
    const defaults = defaultNotificationPreference();
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        masterEnabled: defaults.masterEnabled,
        realtimeEnabled: defaults.realtimeEnabled,
        pushEnabled: defaults.pushEnabled,
        digestMode: defaults.digestMode,
        quietHoursEnabled: defaults.quietHoursEnabled,
        quietStartMinute: defaults.quietStartMinute,
        quietEndMinute: defaults.quietEndMinute,
        timezone: defaults.timezone,
        categorySettings: defaults.categorySettings as Prisma.InputJsonValue,
        mutedTypes: defaults.mutedTypes as Prisma.InputJsonValue,
        mutedCircleIds: defaults.mutedCircleIds as Prisma.InputJsonValue
      },
      update: {}
    });
  }

  private toPolicy(stored: StoredPreference): NotificationPreferencePolicy {
    return {
      masterEnabled: stored.masterEnabled,
      realtimeEnabled: stored.realtimeEnabled,
      pushEnabled: stored.pushEnabled,
      digestMode: stored.digestMode,
      quietHoursEnabled: stored.quietHoursEnabled,
      quietStartMinute: stored.quietStartMinute,
      quietEndMinute: stored.quietEndMinute,
      timezone: stored.timezone,
      categorySettings: normalizeCategorySettings(stored.categorySettings),
      mutedTypes: normalizeStringList(stored.mutedTypes),
      mutedCircleIds: normalizeStringList(stored.mutedCircleIds)
    };
  }

  private minuteOfDay(timezone: string) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(new Date());
      const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
      const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
      return hour * 60 + minute;
    } catch {
      return new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
    }
  }

  private assertTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    } catch {
      throw new BadRequestException('Fuseau horaire invalide.');
    }
  }

  private jsonRecord(value: Prisma.JsonValue | null | undefined) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return {};
    return value as Record<string, Prisma.JsonValue>;
  }

  private sanitizeEndpoint(endpoint: {
    id: string;
    platform: string;
    tokenFingerprint: string;
    appVersion: string | null;
    deviceLabel: string | null;
    enabled: boolean;
    lastSeenAt: Date;
    failedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: endpoint.id,
      platform: endpoint.platform,
      fingerprintSuffix: endpoint.tokenFingerprint.slice(-10),
      appVersion: endpoint.appVersion,
      deviceLabel: endpoint.deviceLabel,
      enabled: endpoint.enabled,
      lastSeenAt: endpoint.lastSeenAt,
      failedAt: endpoint.failedAt,
      createdAt: endpoint.createdAt,
      updatedAt: endpoint.updatedAt,
      rawTokenExposed: false
    };
  }
}
