import {
  ConflictException,
  Injectable
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  parseAcceptLanguage,
  resolveTextDirection,
  type SupportedLocale
} from '@knowme/i18n-contract';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLocalePreferenceDto } from './dto/update-locale-preference.dto';

type LocaleRecord = {
  userId: string;
  locale: string;
  source: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class I18nService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  catalog() {
    return {
      contractVersion: 1,
      fallbackLocale: DEFAULT_LOCALE,
      supportedLocales: SUPPORTED_LOCALES.map((locale) => ({
        locale,
        nativeName: locale === 'fr' ? 'Français' : 'English',
        direction: resolveTextDirection(locale)
      })),
      serverMessagesAreFallbackOnly: true,
      clientErrorLocalizationByCode: true,
      userGeneratedContentTranslated: false
    };
  }

  async preference(userId: string, acceptLanguage?: string) {
    const record = await this.prisma.userLocalePreference.findUnique({
      where: { userId }
    });
    if (record) return this.serialize(record, true);

    const locale = parseAcceptLanguage(acceptLanguage);
    return {
      userId,
      locale,
      direction: resolveTextDirection(locale),
      source: 'DETECTED',
      version: 0,
      persisted: false,
      updatedAt: null
    };
  }

  async update(userId: string, dto: UpdateLocalePreferenceDto) {
    let previousLocale: string | null = null;
    let record: LocaleRecord;

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.userLocalePreference.findUnique({
            where: { userId }
          });
          const currentVersion = current?.version ?? 0;
          if (dto.expectedVersion !== currentVersion) {
            throw this.versionConflict(current);
          }

          if (!current) {
            const created = await tx.userLocalePreference.create({
              data: {
                userId,
                locale: dto.locale,
                source: 'USER',
                version: 1
              }
            });
            return { record: created, previousLocale: null };
          }

          const updated = await tx.userLocalePreference.updateMany({
            where: { userId, version: dto.expectedVersion },
            data: {
              locale: dto.locale,
              source: 'USER',
              version: { increment: 1 }
            }
          });
          if (updated.count !== 1) {
            const latest = await tx.userLocalePreference.findUnique({
              where: { userId }
            });
            throw this.versionConflict(latest);
          }

          const next = await tx.userLocalePreference.findUniqueOrThrow({
            where: { userId }
          });
          return { record: next, previousLocale: current.locale };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      record = result.record;
      previousLocale = result.previousLocale;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        const latest = await this.prisma.userLocalePreference.findUnique({
          where: { userId }
        });
        throw this.versionConflict(latest);
      }
      throw error;
    }

    await this.audit.record({
      actorId: userId,
      action: 'LOCALE_PREFERENCE_UPDATED',
      entity: 'UserLocalePreference',
      entityId: userId,
      metadata: {
        previousLocale,
        locale: record.locale,
        version: record.version,
        source: record.source
      }
    });

    return this.serialize(record, true);
  }

  async exportForAccount(userId: string) {
    const preference = await this.prisma.userLocalePreference.findUnique({
      where: { userId }
    });
    return {
      formatVersion: 1,
      preference,
      fallbackLocale: DEFAULT_LOCALE,
      supportedLocales: [...SUPPORTED_LOCALES]
    };
  }

  deleteForAccount(
    userId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    return tx.userLocalePreference.deleteMany({ where: { userId } });
  }

  private serialize(record: LocaleRecord, persisted: boolean) {
    const locale = record.locale as SupportedLocale;
    return {
      userId: record.userId,
      locale,
      direction: resolveTextDirection(locale),
      source: record.source,
      version: record.version,
      persisted,
      updatedAt: record.updatedAt
    };
  }

  private versionConflict(current: LocaleRecord | null) {
    return new ConflictException({
      code: 'I18N_VERSION_CONFLICT',
      message: 'La préférence de langue a été modifiée ailleurs.',
      details: {
        currentVersion: current?.version ?? 0,
        currentLocale: current?.locale ?? null
      }
    });
  }
}
