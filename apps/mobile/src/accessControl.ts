import { apiFetch } from './api';

export type MobileEffectiveAccess = {
  accountId: string;
  serverTime: string;
  isAdministrative: boolean;
  permissions: string[];
  roles: Array<{
    grantId: string;
    key: string;
    name: string;
    source: string;
    startsAt: string;
    expiresAt: string | null;
  }>;
};

export async function fetchEffectiveAccess() {
  return apiFetch<MobileEffectiveAccess>('/access/me');
}

export function hasPermission(
  access: MobileEffectiveAccess | null | undefined,
  permission: string
) {
  return Boolean(access?.permissions.includes(permission));
}
