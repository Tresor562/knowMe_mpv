import { apiFetch } from './api';

export type KnowCoinWallet = {
  accountId: string;
  balance: number;
  version: number;
  updatedAt: string;
  serverTime: string;
};

export type KnowCoinLedgerEntry = {
  id: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  type: string;
  source: string;
  idempotencyKey: string;
  referenceType: string | null;
  referenceId: string | null;
  actorId: string | null;
  reason: string | null;
  createdAt: string;
};

export type KnowCoinHistory = {
  items: KnowCoinLedgerEntry[];
  nextCursor: string | null;
};

export function fetchKnowCoinWallet() {
  return apiFetch<KnowCoinWallet>('/wallet/me');
}

export function fetchKnowCoinHistory(cursor?: string, limit = 30) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  return apiFetch<KnowCoinHistory>(`/wallet/history?${query.toString()}`);
}
