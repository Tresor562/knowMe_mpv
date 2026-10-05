export const E2EE_PROTOCOL = 'SIGNAL_LIBSIGNAL_V1' as const;

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export function assertPublicKeyMaterial(value: string, label: string) {
  const trimmed = value.trim();
  if (trimmed.length < 40 || trimmed.length > 4096 || !BASE64_PATTERN.test(trimmed)) {
    throw new Error(`${label} must be canonical base64 public key material.`);
  }

  let decoded: Buffer;
  try {
    decoded = Buffer.from(trimmed, 'base64');
  } catch {
    throw new Error(`${label} must be valid base64.`);
  }

  if (decoded.length < 24 || decoded.length > 2048) {
    throw new Error(`${label} has an invalid decoded size.`);
  }
  return trimmed;
}

export function e2eeKeyDirectoryPolicy() {
  return {
    schemaVersion: 1,
    protocol: E2EE_PROTOCOL,
    serverStoresPrivateKeys: false,
    sessionBoundDeviceRegistration: true,
    identityKeyReplacementInPlace: false,
    oneTimePreKeysConsumedAtMostOnce: true,
    bundleClaimsRequireConversationMembership: true,
    revokedOrExpiredSessionsExcluded: true,
    serverCanDecryptSecretChatPayloads: false,
    clientMustVerifyIdentityChanges: true,
    clientMustVerifySignedPreKeys: true,
    privateKeysMustUsePlatformSecureStorage: true,
    keyMaterialLoggingForbidden: true,
    note:
      'This directory distributes public key material only. Message E2EE requires reviewed client-side libsignal-compatible session establishment and ratcheting.'
  } as const;
}
