import { Platform } from 'react-native';

export type NativeStoreProvider = 'GOOGLE_PLAY' | 'APPLE_APP_STORE';

export type NativePurchaseRequest = {
  provider: NativeStoreProvider;
  externalProductId: string;
  accountReference: string;
};

export type NativePurchaseProof =
  | {
      provider: 'GOOGLE_PLAY';
      externalProductId: string;
      purchaseToken: string;
    }
  | {
      provider: 'APPLE_APP_STORE';
      externalProductId: string;
      transactionId: string;
    };

export type NativePurchaseBridge = {
  isAvailable(): boolean | Promise<boolean>;
  purchase(request: NativePurchaseRequest): Promise<NativePurchaseProof>;
};

let activeBridge: NativePurchaseBridge | null = null;

export function registerNativePurchaseBridge(bridge: NativePurchaseBridge) {
  activeBridge = bridge;
  return () => {
    if (activeBridge === bridge) activeBridge = null;
  };
}

export function mobileStoreProvider(): NativeStoreProvider | null {
  if (Platform.OS === 'android') return 'GOOGLE_PLAY';
  if (Platform.OS === 'ios') return 'APPLE_APP_STORE';
  return null;
}

export async function nativePurchasesAvailable() {
  const bridge = activeBridge;
  if (!bridge || !mobileStoreProvider()) return false;
  return Boolean(await bridge.isAvailable());
}

export async function requestNativePurchase(
  request: NativePurchaseRequest
): Promise<NativePurchaseProof> {
  const bridge = activeBridge;
  if (!bridge || !(await bridge.isAvailable())) {
    throw new Error(
      'Le module d’achat natif signé n’est pas installé dans cette version de l’application.'
    );
  }
  if (request.provider !== mobileStoreProvider()) {
    throw new Error('Le fournisseur demandé ne correspond pas à la plateforme de cet appareil.');
  }
  const proof = await bridge.purchase(request);
  if (proof.provider !== request.provider) {
    throw new Error('La preuve retournée ne correspond pas au fournisseur demandé.');
  }
  if (proof.externalProductId !== request.externalProductId) {
    throw new Error('La preuve retournée ne correspond pas au produit demandé.');
  }
  return proof;
}
