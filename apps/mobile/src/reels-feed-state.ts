/** A failed network request must not masquerade as an empty Reel catalogue. */
export type ReelsFeedState='ready'|'loading'|'failed'|'browse'|'empty';
export function reelsFeedState({
  clips,posts,loading,failed,hasMore
}:{
  clips:number;posts:number;loading:boolean;failed:boolean;hasMore:boolean;
}):ReelsFeedState{
  if(clips>0)return 'ready';
  if(loading)return 'loading';
  if(failed)return 'failed';
  if(posts>0&&hasMore)return 'browse';
  return 'empty';
}
