import AsyncStorage from '@react-native-async-storage/async-storage';

export type OfflinePublicPost={
  id:string;authorId:string;content:string;createdAt:string;
  imageUrl?:string|null;
  media?:Array<{url:string;mimeType:string;position:number}>;
  author:{id:string;displayName:string;username:string;avatarUrl?:string|null;
    staff?:{shield?:string}|null;verification?:{isVerified:true;label:string}|null};
  _count:{likes:number;comments:number};
};
export type PublicFeedSnapshot={accountId:string;updatedAt:number;posts:OfflinePublicPost[]};
const KEY='knowme-public-feed-v1:';
function accountKey(id:string){
  if(!id||id.length>128)throw new Error('Compte invalide.');
  return KEY+encodeURIComponent(id);
}
/** Never persist bearer tokens, private messages, full media or arbitrary API keys. */
export function snapshotPublicFeed(accountId:string,posts:OfflinePublicPost[]):PublicFeedSnapshot{
  return {accountId,updatedAt:Date.now(),posts:posts.slice(0,20).map(post=>({
    id:post.id,authorId:post.authorId,content:post.content,createdAt:post.createdAt,
    imageUrl:post.imageUrl??null,
    media:(post.media??[]).map(({url,mimeType,position})=>({url,mimeType,position})),
    author:{
      id:post.author.id,username:post.author.username,
      displayName:post.author.displayName,avatarUrl:post.author.avatarUrl??null,
      staff:post.author.staff??null,verification:post.author.verification??null
    },
    _count:{likes:post._count.likes,comments:post._count.comments}
  }))};
}
export async function saveCachedPublicFeed(accountId:string,posts:OfflinePublicPost[]):Promise<void>{
  const key=accountKey(accountId);
  await AsyncStorage.setItem(key,JSON.stringify(snapshotPublicFeed(accountId,posts)));
}
export async function readCachedPublicFeed(accountId:string):Promise<PublicFeedSnapshot|null>{
  const raw=await AsyncStorage.getItem(accountKey(accountId));
  if(!raw)return null;
  const data=JSON.parse(raw) as PublicFeedSnapshot;
  if(data?.accountId!==accountId||!Array.isArray(data.posts)||
     !data.posts.every(post=>typeof post.id==='string'&&
       typeof post.content==='string'&&typeof post.author?.username==='string'))
    return null;
  return data;
}
