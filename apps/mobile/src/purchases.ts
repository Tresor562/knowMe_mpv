import { Platform } from 'react-native';
import { apiFetch } from './api';

export type MobileStoreProduct = {
  id: string;
  key: string;
  provider: 'APPLE' | 'GOOGLE';
  platform: 'ANDROID' | 'IOS';
  externalProductId: string;
  name: string;
  description?: string | null;
  kind: 'ENTITLEMENT' | 'KNOWCOINS';
  entitlementKey?: string | null;
  coinAmount?: number | null;
  durationDays?: number | null;
};

export type NativeIntegrityProvider = {
  deviceId(): Promise<string>;
  appIdentifier(): Promise<string>;
  requestToken(input: {
    nonce: string;
    action: string;
    platform: 'ANDROID' | 'IOS';
  }): Promise<{ token: string; keyIdentifier?: string }>;
};

export type NativePurchaseProvider = {
  purchase(externalProductId: string): Promise<{ receipt: string }>;
};

function mobilePlatform(): 'ANDROID' | 'IOS' {
  if (Platform.OS === 'android') return 'ANDROID';
  if (Platform.OS === 'ios') return 'IOS';
  throw new Error('Les achats natifs sont disponibles uniquement sur Android et iOS.');
}

export async function fetchMobileStoreProducts() {
  const products = await apiFetch<MobileStoreProduct[]>('/purchases/products');
  const platform = mobilePlatform();
  return products.filter((product) => product.platform === platform);
}

export async function createPurchaseAttestation(
  integrityProvider: NativeIntegrityProvider
) {
  const platform = mobilePlatform();
  const action = 'purchase.verify';
  const challenge = await apiFetch<{
    nonce: string;
    expiresAt: string;
  }>('/integrity/challenges', {
    method: 'POST',
    body: JSON.stringify({ platform, action })
  });
  const [deviceId, appIdentifier, proof] = await Promise.all([
    integrityProvider.deviceId(),
    integrityProvider.appIdentifier(),
    integrityProvider.requestToken({
      nonce: challenge.nonce,
      action,
      platform
    })
  ]);

  return apiFetch<{
    id: string;
    verdict: string;
    expiresAt: string;
  }>('/integrity/verify', {
    method: 'POST',
    body: JSON.stringify({
      nonce: challenge.nonce,
      token: proof.token,
      platform,
      action,
      deviceId,
      appIdentifier,
      ...(proof.keyIdentifier ? { keyIdentifier: proof.keyIdentifier } : {})
    })
  });
}

export async function purchaseStoreProduct(
  product: MobileStoreProduct,
  integrityProvider: NativeIntegrityProvider,
  purchaseProvider: NativePurchaseProvider
) {
  const platform = mobilePlatform();
  if (product.platform !== platform) {
    throw new Error('Ce produit ne correspond pas à la plateforme active.');
  }

  const attestation = await createPurchaseAttestation(integrityProvider);
  const purchase = await purchaseProvider.purchase(product.externalProductId);
  return apiFetch<{
    replayed: boolean;
    receipt: {
      id: string;
      status: string;
      entitlementGrantId?: string | null;
      ledgerEntryId?: string | null;
    };
  }>('/purchases/verify', {
    method: 'POST',
    body: JSON.stringify({
      productKey: product.key,
      provider: product.provider,
      platform,
      receipt: purchase.receipt,
      attestationId: attestation.id
    })
  });
}

export function fetchMobilePurchaseHistory() {
  return apiFetch('/purchases/me');
}
