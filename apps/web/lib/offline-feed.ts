/** Small, per-account snapshot of publicly visible feed text and metadata.
 * Private messages, tokens, auth data and full media binaries are never saved.
 * This enables reading previously loaded posts when the API is unavailable.
 */
export type OfflineFeedPost={
  id:string;content:string;createdAt:string;imageUrl?:string|null;
  author:{id:string;username:string;displayName:string;avatarUrl?:string|null;
    staff?:{shield?:string}|null;verification?:{isVerified:true;label:string}|null};
  media?:{url:string;mimeType:string;position:number}[];
  _count:{likes:number;comments:number};
};
type Snapshot={accountId:string;updatedAt:number;posts:OfflineFeedPost[]};
const DB='knowme-offline-feed-v1';
const STORE='snapshots';
function db():Promise<IDBDatabase>{
  if(typeof indexedDB==='undefined')return Promise.reject(Error('Stockage IndexedDB indisponible.'));
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE,{keyPath:'accountId'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error??Error('Stockage indisponible.'));
    req.onblocked=()=>reject(Error('Stockage bloqué.'));
  });
}
async function readWrite<T>(mode:IDBTransactionMode,operate:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const database=await db();
  try {
    return await new Promise<T>((resolve,reject)=>{
      const tx=database.transaction(STORE,mode);
      const req=operate(tx.objectStore(STORE));
      let result:T;
      req.onsuccess=()=>{result=req.result;};
      tx.oncomplete=()=>resolve(result);
      tx.onabort=()=>reject(tx.error??Error('Transaction locale annulée.'));
      tx.onerror=()=>reject(tx.error??Error('Erreur du cache.'));
    });
  }finally{database.close();}
}
function key(accountId:string){
  if(!accountId||accountId.length>128)throw Error('Compte invalide.');
  return accountId;
}
export async function saveOfflineFeed(accountId:string,posts:OfflineFeedPost[]):Promise<void>{
  const snapshot:Snapshot={
    accountId:key(accountId),updatedAt:Date.now(),
    posts:posts.slice(0,20).map(post=>({
      id:post.id,content:post.content,createdAt:post.createdAt,
      imageUrl:post.imageUrl??null,
      author:{
        id:post.author.id,
        username:post.author.username,
        displayName:post.author.displayName,
        avatarUrl:post.author.avatarUrl??null,
        staff:post.author.staff??null,
        verification:post.author.verification??null
      },
      media:(post.media??[]).map(item=>({
        url:item.url,mimeType:item.mimeType,position:item.position
      })),
      _count:{likes:post._count.likes,comments:post._count.comments}
    }))
  };
  await readWrite('readwrite',store=>store.put(snapshot));
}
export async function loadOfflineFeed(accountId:string):Promise<Snapshot|null>{
  const snapshot=await readWrite<Snapshot|undefined>('readonly',store=>store.get(key(accountId)));
  if(!snapshot||snapshot.accountId!==accountId||!Array.isArray(snapshot.posts))return null;
  return snapshot;
}
