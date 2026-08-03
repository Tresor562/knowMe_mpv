import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileCircleNotificationPreferenceDto } from './dto/profile-circle-notification-preferences.dto';
import {
  defaultCircleNotificationPreference,
  normalizeMutedCircleIds,
  ProfileCircleNotificationPreferenceSnapshot,
  resolveCircleNotificationPreference
} from './profile-circle-notification-preferences.domain';
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
        mutedCircleIds: mutedCircleIds as Prisma.InputJsonValue
      },
      update: {
        enabled: dto.enabled,
        invitationsEnabled: dto.invitationsEnabled,
        membershipEnabled: dto.membershipEnabled,
        governanceEnabled: dto.governanceEnabled,
        contentEnabled: dto.contentEnabled,
        familyEnabled: dto.familyEnabled,
        realtimeEnabled: dto.realtimeEnabled,
        mutedCircleIds: mutedCircleIds as Prisma.InputJsonValue
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
        mutedCircleCount: mutedCircleIds.length
      }
    });
    return this.snapshot(preference);
  }

  async resolve(input: {
    type: ProfileCircleNotificationType;
    circleId?: string | null;
    recipients: string[];
  }) {
    const unique = [...new Set(input.recipients)].filter(Boolean);
    if (unique.length === 0) {
      return { inboxRecipients: [], realtimeRecipients: new Set<string>() };
    }

    const stored = await this.prisma.profileCircleNotificationPreference.findMany({
      where: { userId: { in: unique } }
    });
    const map = new Map(stored.map((preference) => [preference.userId, preference]));
    const inboxRecipients: string[] = [];
    const realtimeRecipients = new Set<string>();

    for (const userId of unique) {
      const preference = map.has(userId)
        ? this.snapshot(map.get(userId)!)
        : defaultCircleNotificationPreference();
      const decision = resolveCircleNotificationPreference({
        type: input.type,
        circleId: input.circleId,
        preference
      });
      if (decision.inboxAllowed) inboxRecipients.push(userId);
      if (decision.realtimeAllowed) realtimeRecipients.add(userId);
    }

    return { inboxRecipients, realtimeRecipients };
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
  }): ProfileCircleNotificationPreferenceSnapshot {
    return {
      enabled: input.enabled,
      invitationsEnabled: input.invitationsEnabled,
      membershipEnabled: input.membershipEnabled,
      governanceEnabled: input.governanceEnabled,
      contentEnabled: input.contentEnabled,
      familyEnabled: input.familyEnabled,
      realtimeEnabled: input.realtimeEnabled,
      mutedCircleIds: normalizeMutedCircleIds(input.mutedCircleIds)
    };
  }
}
