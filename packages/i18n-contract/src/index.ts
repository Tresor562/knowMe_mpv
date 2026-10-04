import {
  DEFAULT_LOCALE,
  META_NLLB_LOCALES,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  localeDisplayName,
  normalizeLocale,
  resolveSupportedLocale,
  resolveTextDirection,
  type SupportedLocale,
  type TextDirection
} from './meta-locales';

export {
  DEFAULT_LOCALE,
  META_NLLB_LOCALES,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  localeDisplayName,
  normalizeLocale,
  resolveSupportedLocale,
  resolveTextDirection
};
export type { SupportedLocale, TextDirection };

const FR_MESSAGES = {
  'app.name': 'KnowMe',
  'app.tagline': 'Mieux se connaître, vraiment.',
  'common.loading': 'Chargement…',
  'common.save': 'Enregistrer',
  'common.saving': 'Enregistrement…',
  'common.saved': 'Enregistré.',
  'common.cancel': 'Annuler',
  'common.retry': 'Réessayer',
  'common.language': 'Langue',
  'common.french': 'Français',
  'common.english': 'Anglais',
  'common.currentLanguage': 'Langue actuelle : {language}',
  'common.supportReference': 'Référence support : {requestId}',
  'nav.home': 'Accueil',
  'nav.feed': 'Discussions',
  'nav.social': 'Cercle',
  'nav.challenges': 'Défis',
  'nav.profile': 'Profil',
  'auth.signIn': 'Connexion',
  'auth.signUp': 'Inscription',
  'auth.identifier': 'Email ou nom d’utilisateur',
  'auth.displayName': 'Nom affiché',
  'auth.username': 'Nom d’utilisateur (username)',
  'auth.usernameHint': '3 à 24 caractères : lettres, chiffres ou _',
  'auth.email': 'Email',
  'auth.password': 'Mot de passe',
  'auth.enter': 'Entrer dans KnowMe',
  'auth.createProfile': 'Créer mon profil',
  'auth.verifying': 'Vérification…',
  'auth.secondFactorTitle': 'Deuxième preuve',
  'auth.secondFactorDescription':
    'Le mot de passe est correct, mais aucune session n’est encore ouverte.',
  'auth.securityCode': '123456 ou XXXX-XXXX',
  'auth.trustDevice':
    'Faire confiance à cet appareil pendant 30 jours. Cette autorisation reste révocable.',
  'auth.validating': 'Validation…',
  'auth.validateSession': 'Valider et ouvrir la session',
  'auth.restartSignIn': 'Recommencer la connexion',
  'auth.twoFactorPrompt':
    'Entre le code de ton application d’authentification ou un code de récupération.',
  'auth.failed': 'Authentification impossible.',
  'auth.invalidSecurityCode': 'Code de sécurité invalide.',
  'settings.title': 'Paramètres',
  'settings.languageTitle': 'Langue et région',
  'settings.languageDescription':
    'Choisis la langue de l’interface. La préférence est synchronisée sur tes appareils.',
  'settings.languageFallback':
    'Le français reste la langue de secours lorsqu’une traduction manque.',
  'settings.languageSaved': 'Ta langue a été synchronisée.',
  'settings.languageConflict':
    'La préférence a changé sur un autre appareil. La version la plus récente a été rechargée.',
  'notifications.one': '{count} alerte',
  'notifications.other': '{count} alertes',
  'messages.one': '{count} message',
  'messages.other': '{count} messages'
} as const;

export type MessageKey = keyof typeof FR_MESSAGES;

const EN_MESSAGES: Record<MessageKey, string> = {
  'app.name': 'KnowMe',
  'app.tagline': 'Get to know each other, for real.',
  'common.loading': 'Loading…',
  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.saved': 'Saved.',
  'common.cancel': 'Cancel',
  'common.retry': 'Try again',
  'common.language': 'Language',
  'common.french': 'French',
  'common.english': 'English',
  'common.currentLanguage': 'Current language: {language}',
  'common.supportReference': 'Support reference: {requestId}',
  'nav.home': 'Home',
  'nav.feed': 'Conversations',
  'nav.social': 'Circle',
  'nav.challenges': 'Challenges',
  'nav.profile': 'Profile',
  'auth.signIn': 'Sign in',
  'auth.signUp': 'Sign up',
  'auth.identifier': 'Email or username',
  'auth.displayName': 'Display name',
  'auth.username': 'Username',
  'auth.usernameHint': '3 to 24 characters: letters, numbers, or _',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.enter': 'Enter KnowMe',
  'auth.createProfile': 'Create my profile',
  'auth.verifying': 'Checking…',
  'auth.secondFactorTitle': 'Second verification',
  'auth.secondFactorDescription':
    'Your password is correct, but no session has been opened yet.',
  'auth.securityCode': '123456 or XXXX-XXXX',
  'auth.trustDevice':
    'Trust this device for 30 days. You can revoke this authorization at any time.',
  'auth.validating': 'Validating…',
  'auth.validateSession': 'Validate and open session',
  'auth.restartSignIn': 'Restart sign in',
  'auth.twoFactorPrompt':
    'Enter the code from your authenticator app or a recovery code.',
  'auth.failed': 'Authentication failed.',
  'auth.invalidSecurityCode': 'Invalid security code.',
  'settings.title': 'Settings',
  'settings.languageTitle': 'Language and region',
  'settings.languageDescription':
    'Choose the interface language. Your preference is synced across devices.',
  'settings.languageFallback':
    'French remains the fallback language when a translation is missing.',
  'settings.languageSaved': 'Your language has been synced.',
  'settings.languageConflict':
    'The preference changed on another device. The latest version has been reloaded.',
  'notifications.one': '{count} alert',
  'notifications.other': '{count} alerts',
  'messages.one': '{count} message',
  'messages.other': '{count} messages'
};

type MessageCatalog = Readonly<Record<MessageKey, string>>;

const STATIC_CATALOGS: Partial<Record<SupportedLocale, MessageCatalog>> = {
  fr: FR_MESSAGES,
  en: EN_MESSAGES
};

const RUNTIME_CATALOGS = new Map<SupportedLocale, MessageCatalog>();

export function registerCatalog(
  locale: SupportedLocale,
  catalog: Record<MessageKey, string>
) {
  RUNTIME_CATALOGS.set(locale, Object.freeze({ ...catalog }));
}

export function unregisterCatalog(locale: SupportedLocale) {
  RUNTIME_CATALOGS.delete(locale);
}

export const API_ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'UNPROCESSABLE_ENTITY',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  'I18N_VERSION_CONFLICT',
  'I18N_LOCALE_UNSUPPORTED'
] as const;

export type KnownApiErrorCode = (typeof API_ERROR_CODES)[number];

const ERROR_MESSAGES: Partial<Record<SupportedLocale, Record<KnownApiErrorCode, string>>> = {
  fr: {
    BAD_REQUEST: 'La requête contient des données invalides.',
    UNAUTHORIZED: 'Connecte-toi pour continuer.',
    FORBIDDEN: 'Tu n’as pas l’autorisation d’effectuer cette action.',
    NOT_FOUND: 'La ressource demandée est introuvable.',
    METHOD_NOT_ALLOWED: 'Cette action n’est pas disponible ici.',
    CONFLICT: 'Cette opération entre en conflit avec une modification récente.',
    PAYLOAD_TOO_LARGE: 'Le contenu envoyé est trop volumineux.',
    UNSUPPORTED_MEDIA_TYPE: 'Ce format de contenu n’est pas pris en charge.',
    UNPROCESSABLE_ENTITY: 'Les données envoyées ne peuvent pas être traitées.',
    RATE_LIMITED: 'Trop de tentatives. Réessaie dans un instant.',
    INTERNAL_ERROR: 'Une erreur interne est survenue.',
    SERVICE_UNAVAILABLE: 'Le service est momentanément indisponible.',
    I18N_VERSION_CONFLICT:
      'La préférence de langue a été modifiée sur un autre appareil.',
    I18N_LOCALE_UNSUPPORTED: 'Cette langue n’est pas encore prise en charge.'
  },
  en: {
    BAD_REQUEST: 'The request contains invalid data.',
    UNAUTHORIZED: 'Sign in to continue.',
    FORBIDDEN: 'You are not allowed to perform this action.',
    NOT_FOUND: 'The requested resource could not be found.',
    METHOD_NOT_ALLOWED: 'This action is not available here.',
    CONFLICT: 'This operation conflicts with a recent change.',
    PAYLOAD_TOO_LARGE: 'The submitted content is too large.',
    UNSUPPORTED_MEDIA_TYPE: 'This content format is not supported.',
    UNPROCESSABLE_ENTITY: 'The submitted data cannot be processed.',
    RATE_LIMITED: 'Too many attempts. Try again in a moment.',
    INTERNAL_ERROR: 'An internal error occurred.',
    SERVICE_UNAVAILABLE: 'The service is temporarily unavailable.',
    I18N_VERSION_CONFLICT:
      'The language preference was changed on another device.',
    I18N_LOCALE_UNSUPPORTED: 'This language is not supported yet.'
  }
};

export type TranslationValue = string | number | boolean | null | undefined;
export type TranslationParams = Record<string, TranslationValue>;
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string;
};

export function parseAcceptLanguage(
  header: string | null | undefined,
  fallback: SupportedLocale = DEFAULT_LOCALE
): SupportedLocale {
  if (!header) return fallback;
  const candidates = header
    .split(',')
    .map((entry, position) => {
      const [tag = '', ...parameters] = entry.trim().split(';');
      const qualityParameter = parameters.find((value) =>
        value.trim().toLowerCase().startsWith('q=')
      );
      const quality = qualityParameter
        ? Number.parseFloat(qualityParameter.split('=')[1] ?? '')
        : 1;
      return {
        tag,
        quality: Number.isFinite(quality) ? quality : 0,
        position
      };
    })
    .filter((entry) => entry.quality > 0)
    .sort((left, right) =>
      right.quality === left.quality
        ? left.position - right.position
        : right.quality - left.quality
    );

  for (const candidate of candidates) {
    const resolved = resolveSupportedLocale(candidate.tag);
    if (resolved) return resolved;
  }
  return fallback;
}

export function resolveLocale(
  ...candidates: Array<string | null | undefined>
): SupportedLocale {
  for (const candidate of candidates) {
    const resolved = resolveSupportedLocale(candidate);
    if (resolved) return resolved;
  }
  return DEFAULT_LOCALE;
}

export function getCatalog(locale: string | null | undefined): MessageCatalog {
  const resolved = normalizeLocale(locale);
  return (
    RUNTIME_CATALOGS.get(resolved) ??
    STATIC_CATALOGS[resolved] ??
    FR_MESSAGES
  );
}

export function translate(
  locale: string | null | undefined,
  key: MessageKey,
  params: TranslationParams = {}
): string {
  const template = getCatalog(locale)[key] ?? FR_MESSAGES[key] ?? key;
  return interpolate(template, params);
}

function safeIntlLocale(locale: string | null | undefined) {
  const resolved = normalizeLocale(locale);
  try {
    new Intl.Locale(resolved);
    return resolved;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function translatePlural(
  locale: string | null | undefined,
  count: number,
  forms: PluralForms,
  params: TranslationParams = {}
): string {
  let category: Intl.LDMLPluralRule = 'other';
  try {
    category = new Intl.PluralRules(safeIntlLocale(locale)).select(count);
  } catch {
    category = new Intl.PluralRules(DEFAULT_LOCALE).select(count);
  }
  const template = forms[category] ?? forms.other;
  return interpolate(template, { ...params, count });
}

export function translateCount(
  locale: string | null | undefined,
  count: number,
  singularKey: MessageKey,
  pluralKey: MessageKey
) {
  const catalog = getCatalog(locale);
  return translatePlural(locale, count, {
    one: catalog[singularKey],
    other: catalog[pluralKey]
  });
}

export function formatNumber(
  locale: string | null | undefined,
  value: number,
  options?: Intl.NumberFormatOptions
) {
  try {
    return new Intl.NumberFormat(safeIntlLocale(locale), options).format(value);
  } catch {
    return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(value);
  }
}

export function formatDate(
  locale: string | null | undefined,
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short'
  }
) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(safeIntlLocale(locale), options).format(date);
  } catch {
    return new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(date);
  }
}

export function formatRelativeTime(
  locale: string | null | undefined,
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' }
) {
  try {
    return new Intl.RelativeTimeFormat(safeIntlLocale(locale), options).format(
      value,
      unit
    );
  } catch {
    return new Intl.RelativeTimeFormat(DEFAULT_LOCALE, options).format(value, unit);
  }
}

export function translateApiError(
  locale: string | null | undefined,
  code: string | null | undefined,
  fallback?: string
) {
  const resolvedLocale = normalizeLocale(locale);
  const catalog =
    ERROR_MESSAGES[resolvedLocale] ??
    ERROR_MESSAGES[resolvedLocale === 'en' ? 'en' : 'fr'] ??
    ERROR_MESSAGES.fr!;
  if (code && API_ERROR_CODES.includes(code as KnownApiErrorCode)) {
    return catalog[code as KnownApiErrorCode];
  }
  return fallback?.trim() || catalog.INTERNAL_ERROR;
}

export function withSupportReference(
  locale: string | null | undefined,
  message: string,
  requestId?: string | null
) {
  if (!requestId) return message;
  return `${message} (${translate(locale, 'common.supportReference', { requestId })})`;
}

function interpolate(template: string, params: TranslationParams) {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === null || value === undefined ? match : String(value);
  });
}
