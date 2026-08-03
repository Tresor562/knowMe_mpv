import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAppearancePreferenceDto } from './dto/appearance.dto';

export const APP_THEMES = [
  {
    key: 'system',
    name: 'Automatique',
    description: 'Suit le réglage clair ou sombre de l’appareil.',
    mode: 'SYSTEM',
    premium: false,
    entitlementKey: null,
    palette: { background: 'adaptive', surface: 'adaptive', text: 'adaptive', accent: '#20c997' }
  },
  {
    key: 'light',
    name: 'Clair',
    description: 'Interface claire à contraste accessible.',
    mode: 'LIGHT',
    premium: false,
    entitlementKey: null,
    palette: { background: '#f6fbf8', surface: '#ffffff', text: '#102019', accent: '#087f5b' }
  },
  {
    key: 'dark',
    name: 'Sombre',
    description: 'Interface sombre KnowMe classique.',
    mode: 'DARK',
    premium: false,
    entitlementKey: null,
    palette: { background: '#071410', surface: '#10231d', text: '#f4fff9', accent: '#45e6bd' }
  },
  {
    key: 'midnight',
    name: 'Nuit polaire',
    description: 'Thème statique bleu nuit réservé aux comptes autorisés.',
    mode: 'DARK',
    premium: true,
    entitlementKey: 'theme.midnight',
    palette: { background: '#08111f', surface: '#111f35', text: '#f2f7ff', accent: '#78a9ff' }
  },
  {
    key: 'ivory',
    name: 'Ivoire',
    description: 'Thème statique chaud réservé aux comptes autorisés.',
    mode: 'LIGHT',
    premium: true,
    entitlementKey: 'theme.ivory',
    palette: { background: '#f7f1e5', surface: '#fffaf0', text: '#2d241a', accent: '#9b5c1f' }
  }
] as const;

type ThemeDefinition = (typeof APP_THEMES)[number];

@Injectable()
export class AppearanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService
  ) {}

  policy() {
    return {
      staticOnly: true,
      animatedThemesAllowed: false,
      functionalAdvantagesAllowed: false,
      serverAuthoritativePreference: true,
      localPreAuthFallbackAllowed: true,
      synchronizedVersioning: true,
      premiumThemesRequireEntitlement: true,
      safeFallbackThemeKey: 'system',
      supportedContrastModes: ['STANDARD', 'HIGH'],
      reduceTransparencySupported: true
    };
  }

  async getForUser(userId: string) {
    const [preference, entitlementState] = await Promise.all([
      this.prisma.userAppearancePreference.findUnique({ where: { userId } }),
      this.entitlements.listForUser(userId)
    ]);
    return this.resolveResponse(preference, new Set(entitlementState.entitlements.map((entry) => entry.key)));
  }

  async update(userId: string, dto: UpdateAppearancePreferenceDto) {
    if (!Object.keys(dto).some((key) => key !== 'expectedVersion')) {
      throw new BadRequestException('Aucune préférence d’apparence fournie.');
    }

    const theme = dto.themeKey ? this.requireTheme(dto.themeKey) : null;
    if (theme?.entitlementKey) {
      const allowed = await this.entitlements.hasAll(userId, [theme.entitlementKey]);
      if (!allowed) {
        throw new ForbiddenException('Ce thème nécessite un droit Premium actif.');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.userAppearancePreference.findUnique({ where: { userId } });
      const currentVersion = current?.version ?? 0;
      if (dto.expectedVersion !== undefined && dto.expectedVersion !== currentVersion) {
        throw new ConflictException({
          message: 'Les préférences ont été modifiées sur un autre appareil.',
          code: 'APPEARANCE_VERSION_CONFLICT',
          currentVersion
        });
      }

      if (!current) {
        return tx.userAppearancePreference.create({
          data: {
            userId,
            selectedThemeKey: theme?.key ?? 'system',
            contrast: dto.contrast ?? 'STANDARD',
            reduceTransparency: dto.reduceTransparency ?? false,
            version: 1
          }
        });
      }

      return tx.userAppearancePreference.update({
        where: { userId },
        data: {
          ...(theme ? { selectedThemeKey: theme.key } : {}),
          ...(dto.contrast ? { contrast: dto.contrast } : {}),
          ...(dto.reduceTransparency !== undefined
            ? { reduceTransparency: dto.reduceTransparency }
            : {}),
          version: { increment: 1 }
        }
      });
    });

    await this.audit.record({
      actorId: userId,
      action: 'APPEARANCE_PREFERENCE_UPDATED',
      entity: 'UserAppearancePreference',
      entityId: userId,
      targetAccountId: userId,
      metadata: {
        selectedThemeKey: updated.selectedThemeKey,
        contrast: updated.contrast,
        reduceTransparency: updated.reduceTransparency,
        version: updated.version,
        staticOnly: true
      }
    });

    const entitlementState = await this.entitlements.listForUser(userId);
    return this.resolveResponse(
      updated,
      new Set(entitlementState.entitlements.map((entry) => entry.key))
    );
  }

  async exportForAccount(userId: string) {
    return this.getForUser(userId);
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.userAppearancePreference.deleteMany({ where: { userId } });
  }

  private resolveResponse(
    preference: {
      userId: string;
      selectedThemeKey: string;
      contrast: string;
      reduceTransparency: boolean;
      version: number;
      createdAt: Date;
      updatedAt: Date;
    } | null,
    activeEntitlements: Set<string>
  ) {
    const selectedThemeKey = preference?.selectedThemeKey ?? 'system';
    const selectedTheme = APP_THEMES.find((entry) => entry.key === selectedThemeKey);
    const selectedAllowed =
      selectedTheme &&
      (!selectedTheme.entitlementKey || activeEntitlements.has(selectedTheme.entitlementKey));
    const effectiveTheme = selectedAllowed
      ? selectedTheme
      : APP_THEMES.find((entry) => entry.key === 'system')!;

    return {
      preference: {
        selectedThemeKey,
        effectiveThemeKey: effectiveTheme.key,
        contrast: preference?.contrast ?? 'STANDARD',
        reduceTransparency: preference?.reduceTransparency ?? false,
        version: preference?.version ?? 0,
        updatedAt: preference?.updatedAt ?? null,
        fallbackReason: selectedTheme
          ? selectedAllowed
            ? null
            : 'ENTITLEMENT_MISSING'
          : 'THEME_UNAVAILABLE'
      },
      themes: APP_THEMES.map((theme) => ({
        ...theme,
        locked: Boolean(
          theme.entitlementKey && !activeEntitlements.has(theme.entitlementKey)
        )
      })),
      rules: this.policy()
    };
  }

  private requireTheme(key: string): ThemeDefinition {
    const normalized = key.trim().toLowerCase();
    const theme = APP_THEMES.find((entry) => entry.key === normalized);
    if (!theme) throw new BadRequestException('Thème d’application inconnu.');
    return theme;
  }
}
