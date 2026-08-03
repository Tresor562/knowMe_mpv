export const SENSITIVE_SCREEN_SCOPES = [
  'PROFILE',
  'PRIVATE_MESSAGES',
  'SECRET_MESSAGES',
  'VIEW_ONCE_MEDIA',
  'RARE_GIFTS',
  'SECRET_CONVERSATIONS',
  'PAYMENTS',
  'ADMIN',
  'SENSITIVE_DOCUMENTS'
] as const;

export type SensitiveScreenScope = (typeof SENSITIVE_SCREEN_SCOPES)[number];
export type GuardPlatform = 'ANDROID' | 'IOS';

export type ProfileGuardRuntimeDecision = {
  protect: boolean;
  key: string;
  scope: SensitiveScreenScope;
  warnViewer: boolean;
  notifyOwnerRequested: boolean;
  disclosure: string;
};

const BASELINE_SECURITY = new Set<SensitiveScreenScope>([
  'VIEW_ONCE_MEDIA',
  'PAYMENTS',
  'ADMIN',
  'SENSITIVE_DOCUMENTS'
]);

export function resolveMobileGuardDecision(input: {
  screenId: string;
  scope: SensitiveScreenScope;
  profileGuardEnabled: boolean;
  serverResolvedScopes: SensitiveScreenScope[];
  warnViewer: boolean;
  notifyOwnerRequested: boolean;
  platform: GuardPlatform;
}): ProfileGuardRuntimeDecision {
  const protect =
    BASELINE_SECURITY.has(input.scope) ||
    (input.profileGuardEnabled && input.serverResolvedScopes.includes(input.scope));

  return {
    protect,
    key: `knowme-guard:${input.scope}:${input.screenId}`,
    scope: input.scope,
    warnViewer: protect && input.warnViewer,
    notifyOwnerRequested: protect && input.notifyOwnerRequested,
    disclosure:
      input.platform === 'ANDROID'
        ? 'Android applique la protection native maximale disponible ; certains fabricants ou anciennes versions peuvent se comporter différemment.'
        : 'iOS applique les protections autorisées par le système. KnowMe ne promet pas un blocage absolu sur toutes les versions.'
  };
}

/**
 * Adaptateur attendu dans le bloc natif :
 *
 * - appeler expo-screen-capture.preventScreenCaptureAsync(decision.key)
 *   quand `decision.protect` devient vrai ;
 * - appeler allowScreenCaptureAsync avec la même clé au démontage ;
 * - utiliser le listener de capture uniquement comme signal local ;
 * - ne jamais notifier un propriétaire avant validation/attestation serveur ;
 * - activer la protection de l’aperçu du sélecteur d’applications sur iOS ;
 * - ne pas demander READ_MEDIA_IMAGES sur Android 13 ou inférieur uniquement
 *   pour espionner les captures : la politique Play et le consentement priment.
 */
export type NativeScreenCaptureAdapter = {
  protect(decision: ProfileGuardRuntimeDecision): Promise<void>;
  release(decision: ProfileGuardRuntimeDecision): Promise<void>;
  subscribeToCapture(
    listener: (event: {
      platform: GuardPlatform;
      occurredAt: string;
      nativeSignal: boolean;
    }) => void
  ): () => void;
};
