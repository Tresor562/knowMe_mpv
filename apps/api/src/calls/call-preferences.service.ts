import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_CALL_PREFERENCE,
  isQuietAt,
  normalizeCallPreference,
  type CallPreference
} from './call-preferences.domain';
import { UpdateCallPreferenceDto } from './dto/update-call-preference.dto';

type PreferenceRecord = CallPreference & {
  userId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type PreferenceClient = Pick<
  Prisma.TransactionClient | PrismaService,
  'userCallPreference'
>;

@Injectable()
export class CallPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async get(userId: string) {
    const record = await this.prisma.userCallPreference.findUnique({
      where: { userId }
    });
    return record ? this.serialize(record, true) : this.defaults(userId);
  }

  async update(userId: string, dto: UpdateCallPreferenceDto) {
    const normalized = normalizeCallPreference(dto);
    let record: PreferenceRecord;

    try {
      record = await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.userCallPreference.findUnique({
            where: { userId }
          });
          if ((current?.version ?? 0) !== dto.expectedVersion) {
            throw this.conflict(current);
          }
          if (!current) {
            return tx.userCallPreference.create({
              data: {
                userId,
                ...normalized,
                version: 1
              }
            });
          }
          const changed = await tx.userCallPreference.updateMany({
            where: { userId, version: dto.expectedVersion },
            data: {
              ...normalized,
              version: { increment: 1 }
            }
          });
          if (changed.count !== 1) {
            throw this.conflict(
              await tx.userCallPreference.findUnique({ where: { userId } })
            );
          }
          return tx.userCallPreference.findUniqueOrThrow({ where: { userId } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        throw this.conflict(
          await this.prisma.userCallPreference.findUnique({
            where: { userId }
          })
        );
      }
      throw error;
    }

    await this.audit.record({
      actorId: userId,
      action: 'CALL_PREFERENCE_UPDATED',
      entity: 'UserCallPreference',
      entityId: userId,
      metadata: {
        version: record.version,
        incomingCallsEnabled: record.incomingCallsEnabled,
        allowAudioCalls: record.allowAudioCalls,
        allowVideoCalls: record.allowVideoCalls,
        quietHoursEnabled: record.quietHoursEnabled,
        quietStartMinute: record.quietStartMinute,
        quietEndMinute: record.quietEndMinute,
        timezone: record.timezone,
        microphoneEnabledByDefault: record.microphoneEnabledByDefault,
        cameraEnabledByDefault: record.cameraEnabledByDefault,
        devicePreviewRequired: record.devicePreviewRequired
      }
    });
    return this.serialize(record, true);
  }

  async assertCanReceive(
    userId: string,
    media: 'audio' | 'video',
    at = new Date(),
    client: PreferenceClient = this.prisma
  ) {
    const record = await client.userCallPreference.findUnique({
      where: { userId }
    });
    const preference = normalizeCallPreference(record ?? {});
    const unavailable =
      !preference.incomingCallsEnabled ||
      (media === 'audio' && !preference.allowAudioCalls) ||
      (media === 'video' && !preference.allowVideoCalls) ||
      isQuietAt(preference, at);
    if (unavailable) {
      throw new ConflictException({
        code: 'CALL_RECIPIENT_UNAVAILABLE',
        message: 'Cette personne ne peut pas recevoir cet appel actuellement.'
      });
    }
  }

  async exportForAccount(userId: string) {
    const preference = await this.prisma.userCallPreference.findUnique({
      where: { userId }
    });
    return {
      formatVersion: 1,
      preference: preference ? this.serialize(preference, true) : null
    };
  }

  deleteForAccount(
    userId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    return tx.userCallPreference.deleteMany({ where: { userId } });
  }

  private defaults(userId: string) {
    return {
      userId,
      ...DEFAULT_CALL_PREFERENCE,
      version: 0,
      persisted: false,
      updatedAt: null
    };
  }

  private serialize(record: PreferenceRecord, persisted: boolean) {
    return {
      userId: record.userId,
      ...normalizeCallPreference(record),
      version: record.version,
      persisted,
      updatedAt: record.updatedAt
    };
  }

  private conflict(current: PreferenceRecord | null) {
    return new ConflictException({
      code: 'CALL_PREFERENCE_VERSION_CONFLICT',
      message: 'Les préférences d’appel ont changé sur un autre appareil.',
      details: {
        currentVersion: current?.version ?? 0,
        currentPreference: current ? this.serialize(current, true) : null
      }
    });
  }
}
