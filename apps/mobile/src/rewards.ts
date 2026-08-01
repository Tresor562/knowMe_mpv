import { apiFetch } from './api';

export type RewardPolicyPreview = {
  key: string;
  version: number;
  eventType: string;
  amount: number;
  dailyLimitPerUser: number;
  maxPerEntity: number;
  minQuestions: number;
  startsAt: string;
  endsAt: string | null;
} | null;

export type RewardEvent = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  status: 'AWARDED' | 'REJECTED' | 'IGNORED';
  amount: number;
  reasonCode: string | null;
  explanation: string | null;
  createdAt: string;
  policy: {
    key: string;
    version: number;
    eventType: string;
    amount: number;
  };
};

export type RewardHistory = {
  items: RewardEvent[];
  nextCursor: string | null;
};

export function fetchRewardPreview(eventType = 'CHALLENGE_COMPLETION') {
  return apiFetch<RewardPolicyPreview>(
    `/rewards/preview?eventType=${encodeURIComponent(eventType)}`
  );
}

export function fetchRewardHistory(cursor?: string, limit = 30) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  return apiFetch<RewardHistory>(`/rewards/me?${query.toString()}`);
}
