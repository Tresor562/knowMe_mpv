'use client';

import { apiFetch } from './api';

export type SocialGiftRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC';

export type SocialGiftDefinition = {
  key: string;
  version: number;
  name: string;
  description: string;
  emoji: string;
  priceKnowCoins: number;
  rarity: SocialGiftRarity;
  animationToken: string;
  active: boolean;
  visualOnly: true;
  redeemable: false;
  transferable: false;
  resaleAllowed: false;
  gameplayEffectsAllowed: false;
};

export type SocialGiftPolicy = {
  acceptedFriendsOnly: true;
  recipientBalanceCredited: false;
  visualOnly: true;
  redeemable: false;
  transferable: false;
  resaleAllowed: false;
  gameplayEffectsAllowed: false;
  dailyGiftCountLimit: number;
  dailySpendLimitKnowCoins: number;
  pricesAreServerAuthoritative: true;
  idempotencyRequired: true;
};

export type SocialGiftUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  staff?: unknown;
  verification?: unknown;
  premium?: unknown;
};

export type SocialGiftInboxItem = {
  id: string;
  gift: SocialGiftDefinition;
  sender: SocialGiftUser | null;
  message: string | null;
  sentAt: string;
  viewedAt: string | null;
  visualOnly: true;
  redeemable: false;
  transferable: false;
};

export type SocialGiftSentItem = {
  id: string;
  ledgerEntryId: string;
  gift: SocialGiftDefinition;
  recipient: SocialGiftUser | null;
  message: string | null;
  priceKnowCoins: number;
  senderBalanceAfter: number;
  sentAt: string;
  visualOnly: true;
  redeemable: false;
  transferable: false;
};

export type SocialGiftPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type SocialGiftSendResult = {
  giftId: string;
  gift: SocialGiftDefinition;
  recipientId: string;
  message: string | null;
  sentAt: string;
  viewedAt: string | null;
  senderBalance: number;
  replayed: boolean;
  recipientBalanceCredited: false;
  immutableReceipt: true;
};

export function getSocialGiftCatalog() {
  return apiFetch<SocialGiftDefinition[]>('/social/gifts/catalog');
}

export function getSocialGiftPolicy() {
  return apiFetch<SocialGiftPolicy>('/social/gifts/policy');
}

export function getSocialGiftInbox(cursor?: string, limit = 30) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  return apiFetch<SocialGiftPage<SocialGiftInboxItem>>(
    `/social/gifts/inbox?${query.toString()}`
  );
}

export function getSocialGiftSent(cursor?: string, limit = 30) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  return apiFetch<SocialGiftPage<SocialGiftSentItem>>(
    `/social/gifts/sent?${query.toString()}`
  );
}

export function sendSocialGift(
  input: { recipientId: string; giftKey: string; message?: string },
  idempotencyKey: string
) {
  return apiFetch<SocialGiftSendResult>('/social/gifts', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input)
  });
}

export function markSocialGiftViewed(giftId: string) {
  return apiFetch<{ id: string; viewedAt: string }>(
    `/social/gifts/${encodeURIComponent(giftId)}/viewed`,
    { method: 'PATCH' }
  );
}

export function createSocialGiftIdempotencyKey(recipientId: string, giftKey: string) {
  const nonce = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  return `gift:${recipientId}:${giftKey}:${nonce}`.slice(0, 160);
}

export function socialGiftRarityLabel(rarity: SocialGiftRarity) {
  const labels: Record<SocialGiftRarity, string> = {
    COMMON: 'Commun',
    UNCOMMON: 'Peu commun',
    RARE: 'Rare',
    EPIC: 'Épique'
  };
  return labels[rarity];
}
