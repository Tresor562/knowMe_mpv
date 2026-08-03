import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileCircleNotificationPreferenceDto } from './dto/profile-circle-notification-preferences.dto';
import {
  defaultCircleNotificationPreference,
  normalizeMutedCircleIds,
  ProfileCircleNotificationPreferenceSnapshot
} from './profile-circle-notification-preferences.domain';
import {
  ProfileCircleNotificationDeliveryDecision,
  resolveNotificationDeliverySchedule,
  validateNotificationSchedulePreference
} from './profile-circle-notification-schedule.domain';
import { ProfileCircleNotificationType } from './profile-circle-notifications.domain';

@Injectable()
export class ProfileCircleNotificationPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async get(userId: string) {
    const preference = await this.prisma.profileCircleNotificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {}
    });
    return this.snapshot(preference);
  }

  async update(
    userId: string,
    dto: UpdateProfileCircleNotificationPreferenceDto
  ) {
    try {
      validateNotificationSchedulePreference(dto);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Planification de notification invalide.'
      );
    }
    const mutedCircleIds = normalizeMutedCircleIds(dto.mutedCircleIds ?? []);
    const preference = await this.prisma.profileCircleNotificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        enabled: dto.enabled,
        invitationsEnabled: dto.invitationsEnabled,
        membershipEnabled: dto.membershipEnabled,
        governanceEnabled: dto.governanceEnabled,
        contentEnabled: dto.contentEnabled,
        familyEnabled: dto.familyEnabled,
        realtimeEnabled: dto.realtimeEnabled,
        mutedCircleIds: mutedCircleIds as Prisma.InputJsonValue,
        quietHoursEnabled: dto.quietHoursEnabled,
        quietStartMinute: dto.quietStartMinute,
        quietEndMinute: dto.quietEndMinute,
        timezone: dto.timezone.trim(),
        digestMode: dto.digestMode,
        digestMinuteOfDay: dto.digestMinuteOfDay
      },
      update: {
        enabled: dto.enabled,
        invitationsEnabled: dto.invitationsEnabled,
        membershipEnabled: dto.membershipEnabled,
        governanceEnabled: dto.governanceEnabled,
        contentEnabled: dto.contentEnabled,
        familyEnabled: dto.familyEnabled,
        realtimeEnabled: dto.realtimeEnabled,
        mutedCircleIds: mutedCircleIds as Prisma.InputJsonValue,
        quietHoursEnabled: dto.quietHoursEnabled,
        quietStartMinute: dto.quietStartMinute,
        quietEndMinute: dto.quietEndMinute,
        timezone: dto.timezone.trim(),
        digestMode: dto.digestMode,
        digestMinuteOfDay: dto.digestMinuteOfDay
      }
    });
    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_CIRCLE_NOTIFICATION_PREFERENCES_UPDATED',
      entity: 'ProfileCircleNotificationPreference',
      entityId: userId,
      targetAccountId: userId,
      metadata: {
        enabled: preference.enabled,
        invitationsEnabled: preference.invitationsEnabled,
        membershipEnabled: preference.membershipEnabled,
        governanceEnabled: preference.governanceEnabled,
        contentEnabled: preference.contentEnabled,
        familyEnabled: preference.familyEnabled,
        realtimeEnabled: preference.realtimeEnabled,
        mutedCircleCount: mutedCircleIds.length,
        quietHoursEnabled: preference.quietHoursEnabled,
        quietStartMinute: preference.quietStartMinute,
        quietEndMinute: preference.quietEndMinute,
        timezone: preference.timezone,
        digestMode: preference.digestMode,
        digestMinuteOfDay: preference.digestMinuteOfDay
      }
    });
    return this.snapshot(preference);
  }

  async resolve(input: {
    type: ProfileCircleNotificationType;
    circleId?: string | null;
    recipients: string[];
    now?: Date;
  }) {
    const unique = [...new Set(input.recipients)].filter(Boolean);
    if (unique.length === 0) {
      return {
        inboxRecipients: [],
        realtimeRecipients: new Set<string>(),
        decisions: new Map<string, ProfileCircleNotificationDeliveryDecision>()
      };
    }

    const stored = await this.prisma.profileCircleNotificationPreference.findMany({
      where: { userId: { in: unique } }
    });
    const map = new Map(stored.map((preference) => [preference.userId, preference]));
    const inboxRecipients: string[] = [];
    const realtimeRecipients = new Set<string>();
    const decisions = new Map<string, ProfileCircleNotificationDeliveryDecision>();

    for (const userId of unique) {
      const preference = map.has(userId)
        ? this.snapshot(map.get(userId)!)
        : defaultCircleNotificationPreference();
      const decision = resolveNotificationDeliverySchedule({
        type: input.type,
        circleId: input.circleId,
        preference,
        now: input.now
      });
      decisions.set(userId, decision);
      if (decision.inboxAllowed) inboxRecipients.push(userId);
      if (decision.realtimeAllowed && decision.deliveryMode === 'INSTANT') {
        realtimeRecipients.add(userId);
      }
    }

    return { inboxRecipients, realtimeRecipients, decisions };
  }

  async muteCircle(userId: string, circleId: string, muted: boolean) {
    const current = await this.get(userId);
    const ids = new Set(current.mutedCircleIds);
    if (muted) ids.add(circleId);
    else ids.delete(circleId);
    return this.update(userId, {
      ...current,
      mutedCircleIds: [...ids]
    });
  }

  private snapshot(input: {
    enabled: boolean;
    invitationsEnabled: boolean;
    membershipEnabled: boolean;
    governanceEnabled: boolean;
    contentEnabled: boolean;
    familyEnabled: boolean;
    realtimeEnabled: boolean;
    mutedCircleIds: Prisma.JsonValue;
    quietHoursEnabled: boolean;
    quietStartMinute: number;
    quietEndMinute: number;
    timezone: string;
    digestMode: 'OFF' | 'DAILY';
    digestMinuteOfDay: number;
  }): ProfileCircleNotificationPreferenceSnapshot {
    return {
      enabled: input.enabled,
      invitationsEnabled: input.invitationsEnabled,
      membershipEnabled: input.membershipEnabled,
      governanceEnabled: input.governanceEnabled,
      contentEnabled: input.contentEnabled,
      familyEnabled: input.familyEnabled,
      realtimeEnabled: input.realtimeEnabled,
      mutedCircleIds: normalizeMutedCircleIds(input.mutedCircleIds),
      quietHoursEnabled: input.quietHoursEnabled,
      quietStartMinute: input.quietStartMinute,
      quietEndMinute: input.quietEndMinute,
      timezone: input.timezone,
      digestMode: input.digestMode,
      digestMinuteOfDay: input.digestMinuteOfDay
    };
  }
}
