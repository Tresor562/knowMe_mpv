export const GENERIC_ACCOUNT_RECOVERY_MESSAGE =
  'Si un compte correspond à cette adresse, un lien de récupération sera envoyé. Vérifie aussi les courriers indésirables.';

export function normalizeRecoveryEmail(value: string) {
  return value.trim();
}

export function isRecoveryEmailReady(value: string) {
  const normalized = normalizeRecoveryEmail(value);
  return normalized.includes('@') && normalized.length <= 320;
}
