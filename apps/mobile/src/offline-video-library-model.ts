import type {SavedPublicVideo} from './offline-public-video';

export type OfflineVideoSort='recent'|'oldest'|'largest';

/** Deterministic local-only ordering, without changing the underlying files. */
export function sortOfflineVideos(items:readonly SavedPublicVideo[],sort:OfflineVideoSort):SavedPublicVideo[]{
  const copy=[...items];
  return copy.sort((a,b)=>{
    const order=sort==='largest'?b.bytes-a.bytes:
      sort==='oldest'?a.modifiedAt-b.modifiedAt:b.modifiedAt-a.modifiedAt;
    return order||a.url.localeCompare(b.url);
  });
}

export function totalOfflineVideoBytes(items:readonly SavedPublicVideo[]):number{
  return items.reduce((sum,item)=>sum+(Number.isFinite(item.bytes)&&item.bytes>0?item.bytes:0),0);
}

