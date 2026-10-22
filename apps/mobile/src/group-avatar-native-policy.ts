/** Client-side avatar limits are deliberately no more permissive than the
 * server contract. The backend repeats all checks, including membership,
 * scanner status and ownership: this function never grants access. */
export const MAX_GROUP_AVATAR_BYTES = 5 * 1024 * 1024;

export type GroupAvatarCapabilities = {
  read:boolean;
  canEdit:boolean;
  maxBytes:number;
  allowedMime:string[];
};

export type GroupAvatarValidationFailure = 'FORMAT'|'SIZE'|'PERMISSION'|null;

export function validateGroupAvatarCandidate(
  mime:string,size:number,caps?:GroupAvatarCapabilities
):GroupAvatarValidationFailure {
  if(!['image/jpeg','image/png','image/webp'].includes(mime.toLowerCase()))
    return 'FORMAT';
  if(!Number.isSafeInteger(size)||size<1024||size>MAX_GROUP_AVATAR_BYTES)
    return 'SIZE';
  if(caps && (!caps.canEdit||!caps.allowedMime.includes(mime.toLowerCase())))
    return 'PERMISSION';
  if(caps && (!Number.isFinite(caps.maxBytes)||size>caps.maxBytes))
    return 'SIZE';
  return null;
}

export function privateGroupAvatarImageUrl(apiUrl:string,conversationId:string,revision=0):string {
  return apiUrl + '/conversations/' + encodeURIComponent(conversationId) +
    '/group/avatar?revision=' + Math.max(0,Math.floor(revision));
}
