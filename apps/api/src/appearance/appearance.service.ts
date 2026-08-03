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
import {
  APP_ICONS,
  EVENT_ICON_PACKS,
  ICON_PACKS,
  isUnlocked,
  SEASONAL_THEMES,
  THEME_CATALOG,
  ThemeDefinition
} from './theme-catalog';

export const APP_THEMES = THEME_CATALOG;

const PREMIUM_THEMES_ENTITLEMENT = 'premium.themes';
const PREMIUM_APP_ICONS_ENTITLEMENT = 'premium.app_icons';
const LEGACY_PREMIUM_ALIAS = 'subscription.premium';
const DEFAULT_APP_ICON_KEY = 'classique-knowme';

type PreferenceRecord = {
  userId: string;
  selectedThemeKey: string;
  secondaryThemeKey: string | null;
  themeBlendMode: string;
  selectedIconPackKey: string | null;
  selectedAppIconKey: string | null;
  contrast: string;
  reduceTransparency: boolean;
  animationsEnabled: boolean;
  animatedIconsEnabled: boolean;
  uiSoundsEnabled: boolean;
  weatherEffectsEnabled: boolean;
  effectIntensity: string;
  automaticRotationMode: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AppearanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService
  ) {}

  policy() {
    return {
      catalogVersion: 1,
      themeCount: 100,
      freeThemeCount: 40,
      premiumThemeCount: 60,
      iconPackCount: ICON_PACKS.length,
      appIconCount: APP_ICONS.length,
      animatedThemesAllowed: true,
      animationsCanBeDisabled: true,
      animatedIconsCanBeDisabled: true,
      uiSoundsOptionalAndDisabledByDefault: true,
      functionalAdvantagesAllowed: false,
      serverAuthoritativePreference: true,
      serverAuthoritativeEntitlements: true,
      localPreAuthFallbackAllowed: true,
      synchronizedVersioning: true,
      premiumThemesCanBeIndividuallyOwned: true,
      premiumThemeEntitlementKey: PREMIUM_THEMES_ENTITLEMENT,
      premiumAppIconEntitlementKey: PREMIUM_APP_ICONS_ENTITLEMENT,
      safeFallbackThemeKey: 'system',
      defaultIconPackKey: 'soft-glass',
      defaultAppIconKey: DEFAULT_APP_ICON_KEY,
      supportedContrastModes: ['STANDARD', 'HIGH'],
      supportedEffectIntensity: ['LOW', 'BALANCED', 'HIGH'],
      supportedRotationModes: ['OFF', 'TIME', 'SEASON'],
      supportedBlendModes: ['OFF', 'ACCENT', 'EFFECTS', 'BALANCED'],
      reduceTransparencySupported: true,
      seasonalAvailabilityIsServerDriven: true,
      weatherEffectsRequirePermission: true,
      premiumCustomization: {
        synchronized: [
          'INDEPENDENT_ICON_PACK',
          'THEME_BLEND',
          'ROTATION_PREFERENCE',
          'APP_ICON_PREFERENCE',
          'EFFECT_CONTROLS'
        ],
        adapterRequired: [
          'NATIVE_APP_ICON',
          'LOCAL_UI_SOUNDS',
          'REAL_TIME_WEATHER_EFFECTS'
        ],
        planned: [
          'CUSTOM_THEME_EDITOR',
          'PERSONAL_WALLPAPER_IMPORT',
          'PER_TAB_ICON_PACKS',
          'ICON_GEOMETRY_EDITOR'
        ]
      }
    };
  }

  async getForUser(userId: string) {
    const [preference, entitlementState] = await Promise.all([
      this.prisma.userAppearancePreference.findUnique({ where: { userId } }),
      this.entitlements.listForUser(userId)
    ]);
    return this.resolveResponse(
      preference,
      new Set(entitlementState.entitlements.map((entry) => entry.key))
    );
  }

  async update(userId: string, dto: UpdateAppearancePreferenceDto) {
    if (!Object.keys(dto).some((key) => key !== 'expectedVersion')) {
      throw new BadRequestException('Aucune préférence d’apparence fournie.');
    }

    const [existing, entitlementState] = await Promise.all([
      this.prisma.userAppearancePreference.findUnique({ where: { userId } }),
      this.entitlements.listForUser(userId)
    ]);
    const activeEntitlements = new Set(
      entitlementState.entitlements.map((entry) => entry.key)
    );
    const themeEntitlements = this.themeEntitlements(activeEntitlements);
    const appIconEntitlements = this.appIconEntitlements(activeEntitlements);

    const primaryTheme = this.requireTheme(
      dto.themeKey ?? existing?.selectedThemeKey ?? 'system'
    );
    this.assertUnlocked('Ce thème', primaryTheme.entitlementKeys, themeEntitlements);

    const secondaryKey = dto.secondaryThemeKey === 'none'
      ? null
      : dto.secondaryThemeKey ?? existing?.secondaryThemeKey ?? null;
    const blendMode = dto.themeBlendMode ?? existing?.themeBlendMode ?? 'OFF';
    const secondaryTheme = secondaryKey ? this.requireTheme(secondaryKey) : null;
    if (blendMode !== 'OFF') {
      if (!secondaryTheme) {
        throw new BadRequestException('Un thème secondaire est requis pour activer la combinaison.');
      }
      this.assertPremiumThemes(activeEntitlements, 'La combinaison de thèmes');
      this.assertUnlocked('Le thème secondaire', secondaryTheme.entitlementKeys, themeEntitlements);
    }

    const iconPackKey = dto.iconPackKey === 'theme-default'
      ? null
      : dto.iconPackKey ?? existing?.selectedIconPackKey ?? null;
    const iconPack = iconPackKey ? this.requireIconPack(iconPackKey) : null;
    if (iconPack) {
      this.assertUnlocked('Ce pack d’icônes', iconPack.entitlementKeys, themeEntitlements);
    }

    const appIconKey = dto.appIconKey === 'theme-default'
      ? null
      : dto.appIconKey ?? existing?.selectedAppIconKey ?? null;
    const appIcon = appIconKey ? this.requireAppIcon(appIconKey) : null;
    if (appIcon) {
      this.assertUnlocked('Cette icône d’application', appIcon.entitlementKeys, appIconEntitlements);
    }

    const rotationMode = dto.automaticRotationMode
      ?? existing?.automaticRotationMode
      ?? 'OFF';
    if (rotationMode !== 'OFF') {
      this.assertPremiumThemes(activeEntitlements, 'La rotation automatique');
    }
    const weatherEffectsEnabled = dto.weatherEffectsEnabled
      ?? existing?.weatherEffectsEnabled
      ?? false;
    if (weatherEffectsEnabled) {
      this.assertPremiumThemes(activeEntitlements, 'Les effets météo en temps réel');
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

      const secondaryToPersist = blendMode === 'OFF' && dto.themeBlendMode === 'OFF'
        ? null
        : secondaryTheme?.key ?? null;

      if (!current) {
        return tx.userAppearancePreference.create({
          data: {
            userId,
            selectedThemeKey: primaryTheme.key,
            secondaryThemeKey: secondaryToPersist,
            themeBlendMode: blendMode,
            selectedIconPackKey: iconPack?.key ?? null,
            selectedAppIconKey: appIcon?.key ?? null,
            contrast: dto.contrast ?? 'STANDARD',
            reduceTransparency: dto.reduceTransparency ?? false,
            animationsEnabled: dto.animationsEnabled ?? true,
            animatedIconsEnabled: dto.animatedIconsEnabled ?? true,
            uiSoundsEnabled: dto.uiSoundsEnabled ?? false,
            weatherEffectsEnabled,
            effectIntensity: dto.effectIntensity ?? 'BALANCED',
            automaticRotationMode: rotationMode,
            version: 1
          }
        });
      }

      return tx.userAppearancePreference.update({
        where: { userId },
        data: {
          ...(dto.themeKey !== undefined ? { selectedThemeKey: primaryTheme.key } : {}),
          ...(dto.secondaryThemeKey !== undefined || dto.themeBlendMode !== undefined
            ? { secondaryThemeKey: secondaryToPersist }
            : {}),
          ...(dto.themeBlendMode !== undefined ? { themeBlendMode: blendMode } : {}),
          ...(dto.iconPackKey !== undefined ? { selectedIconPackKey: iconPack?.key ?? null } : {}),
          ...(dto.appIconKey !== undefined ? { selectedAppIconKey: appIcon?.key ?? null } : {}),
          ...(dto.contrast ? { contrast: dto.contrast } : {}),
          ...(dto.reduceTransparency !== undefined
            ? { reduceTransparency: dto.reduceTransparency }
            : {}),
          ...(dto.animationsEnabled !== undefined
            ? { animationsEnabled: dto.animationsEnabled }
            : {}),
          ...(dto.animatedIconsEnabled !== undefined
            ? { animatedIconsEnabled: dto.animatedIconsEnabled }
            : {}),
          ...(dto.uiSoundsEnabled !== undefined
            ? { uiSoundsEnabled: dto.uiSoundsEnabled }
            : {}),
          ...(dto.weatherEffectsEnabled !== undefined
            ? { weatherEffectsEnabled }
            : {}),
          ...(dto.effectIntensity ? { effectIntensity: dto.effectIntensity } : {}),
          ...(dto.automaticRotationMode ? { automaticRotationMode: rotationMode } : {}),
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
        secondaryThemeKey: updated.secondaryThemeKey,
        themeBlendMode: updated.themeBlendMode,
        selectedIconPackKey: updated.selectedIconPackKey,
        selectedAppIconKey: updated.selectedAppIconKey,
        contrast: updated.contrast,
        reduceTransparency: updated.reduceTransparency,
        animationsEnabled: updated.animationsEnabled,
        animatedIconsEnabled: updated.animatedIconsEnabled,
        uiSoundsEnabled: updated.uiSoundsEnabled,
        weatherEffectsEnabled: updated.weatherEffectsEnabled,
        effectIntensity: updated.effectIntensity,
        automaticRotationMode: updated.automaticRotationMode,
        version: updated.version
      }
    });

    return this.resolveResponse(updated, activeEntitlements);
  }

  async exportForAccount(userId: string) {
    return this.getForUser(userId);
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.userAppearancePreference.deleteMany({ where: { userId } });
  }

  private resolveResponse(
    preference: PreferenceRecord | null,
    activeEntitlements: Set<string>
  ) {
    const themeEntitlements = this.themeEntitlements(activeEntitlements);
    const appIconEntitlements = this.appIconEntitlements(activeEntitlements);
    const fallbackTheme = THEME_CATALOG[0]!;
    const selectedThemeKey = preference?.selectedThemeKey ?? fallbackTheme.key;
    const selectedTheme = THEME_CATALOG.find((entry) => entry.key === selectedThemeKey);
    const selectedAllowed = Boolean(
      selectedTheme && isUnlocked(selectedTheme.entitlementKeys, themeEntitlements)
    );
    const effectiveTheme = selectedTheme && selectedAllowed ? selectedTheme : fallbackTheme;

    const secondaryTheme = preference?.secondaryThemeKey
      ? THEME_CATALOG.find((entry) => entry.key === preference.secondaryThemeKey) ?? null
      : null;
    const secondaryAllowed = Boolean(
      secondaryTheme &&
      activeEntitlements.has(PREMIUM_THEMES_ENTITLEMENT) &&
      isUnlocked(secondaryTheme.entitlementKeys, themeEntitlements)
    );
    const effectiveBlendMode = secondaryAllowed
      ? preference?.themeBlendMode ?? 'OFF'
      : 'OFF';

    const selectedIconPack = preference?.selectedIconPackKey
      ? ICON_PACKS.find((entry) => entry.key === preference.selectedIconPackKey) ?? null
      : null;
    const selectedIconPackAllowed = Boolean(
      selectedIconPack && isUnlocked(selectedIconPack.entitlementKeys, themeEntitlements)
    );
    const effectiveIconPackKey = selectedIconPackAllowed
      ? selectedIconPack!.key
      : effectiveTheme.key === 'system'
        ? 'soft-glass'
        : effectiveTheme.iconPackKey;

    const selectedAppIcon = preference?.selectedAppIconKey
      ? APP_ICONS.find((entry) => entry.key === preference.selectedAppIconKey) ?? null
      : null;
    const selectedAppIconAllowed = Boolean(
      selectedAppIcon && isUnlocked(selectedAppIcon.entitlementKeys, appIconEntitlements)
    );
    const themeAppIcon = effectiveTheme.appIconKey
      ? APP_ICONS.find((entry) => entry.key === effectiveTheme.appIconKey) ?? null
      : null;
    const themeAppIconAllowed = Boolean(
      themeAppIcon && isUnlocked(themeAppIcon.entitlementKeys, appIconEntitlements)
    );
    const effectiveAppIconKey = selectedAppIconAllowed
      ? selectedAppIcon!.key
      : themeAppIconAllowed
        ? themeAppIcon!.key
        : DEFAULT_APP_ICON_KEY;

    const premiumThemesActive = activeEntitlements.has(PREMIUM_THEMES_ENTITLEMENT);
    const activeSeasons = this.activeSeasonKeys();

    return {
      preference: {
        selectedThemeKey,
        effectiveThemeKey: effectiveTheme.key,
        secondaryThemeKey: preference?.secondaryThemeKey ?? null,
        effectiveSecondaryThemeKey: secondaryAllowed ? secondaryTheme!.key : null,
        themeBlendMode: preference?.themeBlendMode ?? 'OFF',
        effectiveThemeBlendMode: effectiveBlendMode,
        selectedIconPackKey: preference?.selectedIconPackKey ?? null,
        effectiveIconPackKey,
        selectedAppIconKey: preference?.selectedAppIconKey ?? null,
        effectiveAppIconKey,
        contrast: preference?.contrast ?? 'STANDARD',
        reduceTransparency: preference?.reduceTransparency ?? false,
        animationsEnabled: preference?.animationsEnabled ?? true,
        animatedIconsEnabled: preference?.animatedIconsEnabled ?? true,
        uiSoundsEnabled: preference?.uiSoundsEnabled ?? false,
        weatherEffectsEnabled:
          premiumThemesActive && (preference?.weatherEffectsEnabled ?? false),
        effectIntensity: preference?.effectIntensity ?? 'BALANCED',
        automaticRotationMode: premiumThemesActive
          ? preference?.automaticRotationMode ?? 'OFF'
          : 'OFF',
        version: preference?.version ?? 0,
        updatedAt: preference?.updatedAt ?? null,
        fallbackReason: selectedTheme
          ? selectedAllowed
            ? null
            : 'ENTITLEMENT_MISSING'
          : 'THEME_UNAVAILABLE'
      },
      themes: THEME_CATALOG.map((theme) => ({
        ...theme,
        iconPackKey: theme.key === 'system' ? 'soft-glass' : theme.iconPackKey,
        entitlementKeys: theme.premium
          ? [`theme.${theme.key}`, PREMIUM_THEMES_ENTITLEMENT]
          : [],
        locked: !isUnlocked(theme.entitlementKeys, themeEntitlements)
      })),
      iconPacks: ICON_PACKS.map((pack) => ({
        ...pack,
        entitlementKeys: pack.tier === 'PREMIUM'
          ? [`icon-pack.${pack.key}`, PREMIUM_THEMES_ENTITLEMENT]
          : [],
        locked: !isUnlocked(pack.entitlementKeys, themeEntitlements)
      })),
      appIcons: APP_ICONS.map((icon) => ({
        ...icon,
        entitlementKeys: icon.tier === 'PREMIUM'
          ? [`app-icon.${icon.key}`, PREMIUM_APP_ICONS_ENTITLEMENT]
          : [],
        locked: !isUnlocked(icon.entitlementKeys, appIconEntitlements)
      })),
      seasonalThemes: SEASONAL_THEMES.map((theme) => ({
        ...theme,
        available: activeSeasons.has(theme.key),
        unlockMethods: ['PREMIUM', 'KNOWCOINS', 'CHALLENGE']
      })),
      eventIconPacks: EVENT_ICON_PACKS,
      rules: this.policy()
    };
  }

  private requireTheme(key: string): ThemeDefinition {
    const normalized = key.trim().toLowerCase();
    const theme = THEME_CATALOG.find((entry) => entry.key === normalized);
    if (!theme) throw new BadRequestException('Thème d’application inconnu.');
    return theme;
  }

  private requireIconPack(key: string) {
    const normalized = key.trim().toLowerCase();
    const pack = ICON_PACKS.find((entry) => entry.key === normalized);
    if (!pack) throw new BadRequestException('Pack d’icônes inconnu.');
    return pack;
  }

  private requireAppIcon(key: string) {
    const normalized = key.trim().toLowerCase();
    const icon = APP_ICONS.find((entry) => entry.key === normalized);
    if (!icon) throw new BadRequestException('Icône d’application inconnue.');
    return icon;
  }

  private themeEntitlements(activeEntitlements: ReadonlySet<string>) {
    const normalized = new Set(activeEntitlements);
    if (activeEntitlements.has(PREMIUM_THEMES_ENTITLEMENT)) {
      normalized.add(LEGACY_PREMIUM_ALIAS);
    }
    return normalized;
  }

  private appIconEntitlements(activeEntitlements: ReadonlySet<string>) {
    const normalized = new Set(activeEntitlements);
    if (activeEntitlements.has(PREMIUM_APP_ICONS_ENTITLEMENT)) {
      normalized.add(LEGACY_PREMIUM_ALIAS);
    }
    return normalized;
  }

  private assertUnlocked(
    label: string,
    entitlementKeys: readonly string[],
    activeEntitlements: ReadonlySet<string>
  ) {
    if (!isUnlocked(entitlementKeys, activeEntitlements)) {
      throw new ForbiddenException(`${label} nécessite Premium ou un droit de possession actif.`);
    }
  }

  private assertPremiumThemes(
    activeEntitlements: ReadonlySet<string>,
    featureName: string
  ) {
    if (!activeEntitlements.has(PREMIUM_THEMES_ENTITLEMENT)) {
      throw new ForbiddenException(`${featureName} nécessite l’accès Premium aux thèmes.`);
    }
  }

  private activeSeasonKeys() {
    return new Set(
      String(process.env.KNOWME_ACTIVE_THEME_SEASONS ?? '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    );
  }
}
