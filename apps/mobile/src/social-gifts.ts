import { apiFetch } from './api';

export type MobileSocialGiftRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC';

export type MobileSocialGiftDefinition = {
  key: string;
  version: number;
  name: string;
  description: string;
  emoji: string;
  priceKnowCoins: number;
  rarity: MobileSocialGiftRarity;
  animationToken: string;
  active: boolean;
  visualOnly: true;
  redeemable: false;
  transferable: false;
  resaleAllowed: false;
  gameplayEffectsAllowed: false;
};

export type MobileSocialGiftUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type MobileFriend = {
  friendshipId: string;
  user: MobileSocialGiftUser;
};

export type MobileSocialGiftInboxItem = {
  id: string;
  gift: MobileSocialGiftDefinition;
  sender: MobileSocialGiftUser | null;
  message: string | null;
  sentAt: string;
  viewedAt: string | null;
};

export type MobileSocialGiftSentItem = {
  id: string;
  ledgerEntryId: string;
  gift: MobileSocialGiftDefinition;
  recipient: MobileSocialGiftUser | null;
  message: string | null;
  priceKnowCoins: number;
  senderBalanceAfter: number;
  sentAt: string;
};

export type MobileSocialGiftPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type MobileSocialGiftPolicy = {
  dailyGiftCountLimit: number;
  dailySpendLimitKnowCoins: number;
  acceptedFriendsOnly: true;
  recipientBalanceCredited: false;
  pricesAreServerAuthoritative: true;
};

export type MobileWallet = {
  balance: number;
};

export type MobileSocialGiftSendResult = {
  giftId: string;
  gift: MobileSocialGiftDefinition;
  recipientId: string;
  message: string | null;
  sentAt: string;
  viewedAt: string | null;
  senderBalance: number;
  replayed: boolean;
  recipientBalanceCredited: false;
  immutableReceipt: true;
};

export function getMobileSocialGiftCatalog() {
  return apiFetch<MobileSocialGiftDefinition[]>('/social/gifts/catalog');
}

export function getMobileSocialGiftPolicy() {
  return apiFetch<MobileSocialGiftPolicy>('/social/gifts/policy');
}

export function getMobileFriends() {
  return apiFetch<MobileFriend[]>('/social/friends');
}

export function getMobileSocialGiftInbox(limit = 20) {
  return apiFetch<MobileSocialGiftPage<MobileSocialGiftInboxItem>>(
    `/social/gifts/inbox?limit=${limit}`
  );
}

export function getMobileSocialGiftSent(limit = 20) {
  return apiFetch<MobileSocialGiftPage<MobileSocialGiftSentItem>>(
    `/social/gifts/sent?limit=${limit}`
  );
}

export function getMobileWallet() {
  return apiFetch<MobileWallet>('/wallet/me');
}

export function sendMobileSocialGift(
  input: { recipientId: string; giftKey: string; message?: string },
  idempotencyKey: string
) {
  return apiFetch<MobileSocialGiftSendResult>('/social/gifts', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input)
  });
}

export function markMobileSocialGiftViewed(giftId: string) {
  return apiFetch<{ id: string; viewedAt: string }>(
    `/social/gifts/${encodeURIComponent(giftId)}/viewed`,
    { method: 'PATCH' }
  );
}

export function mobileSocialGiftIdempotencyKey(
  recipientId: string,
  giftKey: string
) {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  return `gift:${recipientId}:${giftKey}:${nonce}`.slice(0, 160);
}

export function mobileSocialGiftRarity(rarity: MobileSocialGiftRarity) {
  const labels: Record<MobileSocialGiftRarity, string> = {
    COMMON: 'Commun',
    UNCOMMON: 'Peu commun',
    RARE: 'Rare',
    EPIC: 'Épique'
  };
  return labels[rarity];
}
