import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DEFAULT_MEDIA_DOWNLOAD_PREFERENCE,
  normalizeMediaDownloadPreference,
  type MediaDownloadPreference
} from '@knowme/media-cache-contract';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMediaDownloadPreferenceDto } from './dto/update-media-download-preference.dto';

type PreferenceRecord = {
  userId: string;
  wifiKinds: Prisma.JsonValue;
  cellularKinds: Prisma.JsonValue;
  roamingKinds: Prisma.JsonValue;
  backgroundDownloads: boolean;
  respectDataSaver: boolean;
  maxCacheMb: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class MediaDownloadPreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async get(userId: string) {
    const record = await this.prisma.userMediaDownloadPreference.findUnique({
      where: { userId }
    });
    return record ? this.serialize(record, true) : this.defaults(userId);
  }

  async update(userId: string, dto: UpdateMediaDownloadPreferenceDto) {
    const normalized = normalizeMediaDownloadPreference(dto);
    let record: PreferenceRecord;

    try {
      record = await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.userMediaDownloadPreference.findUnique({
            where: { userId }
          });
          const currentVersion = current?.version ?? 0;
          if (currentVersion !== dto.expectedVersion) {
            throw this.conflict(current);
          }

          if (!current) {
            return tx.userMediaDownloadPreference.create({
              data: {
                userId,
                ...this.toData(normalized),
                version: 1
              }
            });
          }

          const changed = await tx.userMediaDownloadPreference.updateMany({
            where: { userId, version: dto.expectedVersion },
            data: {
              ...this.toData(normalized),
              version: { increment: 1 }
            }
          });
          if (changed.count !== 1) {
            throw this.conflict(
              await tx.userMediaDownloadPreference.findUnique({ where: { userId } })
            );
          }
          return tx.userMediaDownloadPreference.findUniqueOrThrow({ where: { userId } });
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
          await this.prisma.userMediaDownloadPreference.findUnique({ where: { userId } })
        );
      }
      throw error;
    }

    await this.audit.record({
      actorId: userId,
      action: 'MEDIA_DOWNLOAD_PREFERENCE_UPDATED',
      entity: 'UserMediaDownloadPreference',
      entityId: userId,
      metadata: {
        version: record.version,
        wifiKinds: record.wifiKinds,
        cellularKinds: record.cellularKinds,
        roamingKinds: record.roamingKinds,
        backgroundDownloads: record.backgroundDownloads,
        respectDataSaver: record.respectDataSaver,
        maxCacheMb: record.maxCacheMb
      }
    });
    return this.serialize(record, true);
  }

  async exportForAccount(userId: string) {
    const preference = await this.prisma.userMediaDownloadPreference.findUnique({
      where: { userId }
    });
    return {
      formatVersion: 1,
      preference: preference ? this.serialize(preference, true) : null,
      localCacheInventoryIncluded: false,
      signedUrlsIncluded: false
    };
  }

  deleteForAccount(
    userId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    return tx.userMediaDownloadPreference.deleteMany({ where: { userId } });
  }

  private defaults(userId: string) {
    return {
      userId,
      ...DEFAULT_MEDIA_DOWNLOAD_PREFERENCE,
      version: 0,
      persisted: false,
      updatedAt: null
    };
  }

  private serialize(record: PreferenceRecord, persisted: boolean) {
    return {
      userId: record.userId,
      ...normalizeMediaDownloadPreference({
        wifiKinds: record.wifiKinds as string[],
        cellularKinds: record.cellularKinds as string[],
        roamingKinds: record.roamingKinds as string[],
        backgroundDownloads: record.backgroundDownloads,
        respectDataSaver: record.respectDataSaver,
        maxCacheMb: record.maxCacheMb
      } as Partial<MediaDownloadPreference>),
      version: record.version,
      persisted,
      updatedAt: record.updatedAt
    };
  }

  private toData(preference: MediaDownloadPreference) {
    return {
      wifiKinds: preference.wifiKinds as unknown as Prisma.InputJsonValue,
      cellularKinds: preference.cellularKinds as unknown as Prisma.InputJsonValue,
      roamingKinds: preference.roamingKinds as unknown as Prisma.InputJsonValue,
      backgroundDownloads: preference.backgroundDownloads,
      respectDataSaver: preference.respectDataSaver,
      maxCacheMb: preference.maxCacheMb
    };
  }

  private conflict(current: PreferenceRecord | null) {
    return new ConflictException({
      code: 'MEDIA_DOWNLOAD_VERSION_CONFLICT',
      message: 'La politique de téléchargement a changé sur un autre appareil.',
      details: {
        currentVersion: current?.version ?? 0,
        currentPreference: current ? this.serialize(current, true) : null
      }
    });
  }
}
