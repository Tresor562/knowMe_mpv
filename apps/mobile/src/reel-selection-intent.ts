/** Ephemeral navigation intent for the native Reels player.
 * Scoped to the process, consumed once, never written to disk or sent to analytics. */
export type ReelSelectionIntent={postId:string;position:number};
let pending:ReelSelectionIntent|null=null;

export function queueReelSelectionIntent(candidate:ReelSelectionIntent):boolean{
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(candidate.postId) ||
    !Number.isSafeInteger(candidate.position) ||
    candidate.position<0||candidate.position>100)return false;
  pending={postId:candidate.postId,position:candidate.position};
  return true;
}
export function consumeReelSelectionIntent():ReelSelectionIntent|null{
  const result=pending;
  pending=null;
  return result;
}
