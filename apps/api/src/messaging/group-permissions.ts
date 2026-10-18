/** Server-evaluated permissions. Null means legacy defaults (no regressions). */
export type MessagePermission='ALL'|'ADMINS';
export type GroupPermissions={sendMessages:MessagePermission};
export const DEFAULT_GROUP_PERMISSIONS:GroupPermissions={sendMessages:'ALL'};
export function readGroupPermissions(raw:unknown):GroupPermissions {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {...DEFAULT_GROUP_PERMISSIONS};
  const data=raw as Record<string,unknown>;
  return {sendMessages:data.sendMessages==='ADMINS'?'ADMINS':'ALL'};
}
export function maySendGroupMessage(role:'OWNER'|'ADMIN'|'MEMBER',raw:unknown) {
  return role!=='MEMBER'||readGroupPermissions(raw).sendMessages==='ALL';
}
