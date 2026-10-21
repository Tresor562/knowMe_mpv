import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet,
  Text, TextInput, View
} from 'react-native';
import { API_URL, apiFetch } from './api';
import { useI18n } from './I18nProvider';
import { consumeReelSelectionIntent } from './reel-selection-intent';
import { chooseVisibleReel, reelsFeedState } from './reels-feed-state';
import { PublicPostVideo } from './PublicPostVideo';
import { ReelCaptionSheet } from './ReelCaptionSheet';
import { ReelCaptionPreview } from './ReelCaptionPreview';
import { ReelQuickCommentSheet } from './ReelQuickCommentSheet';
import { ReelShareSheet } from './ReelShareSheet';
import { OfflineVideosLibrary } from './OfflineVideosLibrary';
import { Avatar, KnowMeIcon } from './ui/KnowMeUI';
import { BlueVerifiedBadge } from './ui/BlueVerifiedBadge';
import { GoldVerifiedBadge } from './ui/GoldVerifiedBadge';

type Author={id:string;username:string;displayName:string;avatarUrl?:string|null;
  verification?:{isVerified:true;label:string}|null;
  staff?:{isTeamMember:true;shield:string;label:string}|null};
type FollowState={following:boolean;isOwner:boolean};
type ReelFeed='all'|'following';
function avatarUri(value?:string|null){
  if(!value)return null;
  if(value.startsWith('/media/public/'))return API_URL+value;
  return /^https:\/\//.test(value)?value:null;
}
function shortCount(value:number){
  if(value<1000)return String(value);
  const compact=value>=1000000?(value/1000000).toFixed(1)+'M':(value/1000).toFixed(1)+'K';
  return compact.replace('.0','');
}
type Media={url:string;mimeType:string;position:number};
type VideoPost={
  id:string;content:string;author:Author;
  _count:{likes:number;comments:number};media:Media[];
};
type Clip={id:string;post:VideoPost;media:Media};

export function ReelsExperience({onBack,onOpenPost,onOpenProfile}:{
  onBack:()=>void;
  onOpenPost:(id:string)=>void;
  onOpenProfile:(username:string)=>void;
}){
  const {locale}=useI18n();
  const en=locale==='en';
  const [posts,setPosts]=useState<VideoPost[]>([]);
  const [initialSelection]=useState(()=>consumeReelSelectionIntent());
  const [feed,setFeed]=useState<ReelFeed>('all');
  const [viewer,setViewer]=useState<{username:string;displayName:string;avatarUrl?:string|null}|null>(null);
  const [searchOpen,setSearchOpen]=useState(false);
  const [filter,setFilter]=useState('');
  const [following,setFollowing]=useState<Record<string,FollowState|null>>({});
  const [busyFollow,setBusyFollow]=useState<string|null>(null);
  const [offlineRequests,setOfflineRequests]=useState<Record<string,number>>({});
  const [offlineStatus,setOfflineStatus]=useState<Record<string,boolean>>({});
  const [active,setActive]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [more,setMore]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [hasMore,setHasMore]=useState(true);
  const [failure,setFailure]=useState('');
  const [feedError,setFeedError]=useState(false);
  const [captionClip,setCaptionClip]=useState<VideoPost|null>(null);
  const [commentPost,setCommentPost]=useState<VideoPost|null>(null);
  const [commentCounts,setCommentCounts]=useState<Record<string,number>>({});
  const [offlineLibraryOpen,setOfflineLibraryOpen]=useState(false);
  const [sharingClip,setSharingClip]=useState<Clip|null>(null);
  const [viewportHeight,setViewportHeight]=useState(600);
  const [likes,setLikes]=useState<Record<string,{count:number;liked:boolean}>>({});
  const requestEpoch=useRef(0);
  const attemptedSelection=useRef<string|null>(null);
  const positionedSelection=useRef<string|null>(null);
  const pending=useRef(false);
  const fetching=useRef(false);
  const endReached=useRef(false);
  const cursorRef=useRef<string|null>(null);
  const listRef=useRef<FlatList<Clip>|null>(null);
  const viewability=useRef({itemVisiblePercentThreshold:72}).current;

  useEffect(()=>{
    let live=true;
    void apiFetch<{username:string;displayName:string;avatarUrl?:string|null}>('/users/me')
      .then(me=>{if(live)setViewer(me);})
      .catch(()=>undefined);
    return()=>{live=false;};
  },[]);

  const clips=useMemo<Clip[]>(()=>posts.flatMap(post=>
    (post.media??[]).filter(media=>media.mimeType==='video/mp4'&&
      /^\/media\/public\/post\/[a-zA-Z0-9_-]+$/.test(media.url))
      .sort((a,b)=>a.position-b.position)
      .map(media=>({id:post.id+':'+media.position,post,media}))
  ),[posts]);

  const load=useCallback(async(append:boolean,silent=false)=>{
    if(append&&(fetching.current||!hasMore))return;
    const epoch=++requestEpoch.current;
    fetching.current=true;
    if(append)setMore(true);
    else if(silent)setRefreshing(true);
    else setLoading(true);
    setFailure('');setFeedError(false);
    try{
      const cursor=append?cursorRef.current:null;
      const suffix=cursor?'?cursor='+encodeURIComponent(cursor):'';
      const endpoint=feed==='following'?'/reels/following':'/posts/videos';
      let data:VideoPost[];
      try{
        const response=await apiFetch<VideoPost[]>(endpoint+suffix);
        if(!Array.isArray(response))throw new Error('REELS_LEGACY_API');
        data=response;
      }catch(cause){
        if(feed==='following'||(cause as {status?:number})?.status!==404 &&
          !(cause instanceof Error&&cause.message==='REELS_LEGACY_API'))throw cause;
        const fallback=await apiFetch<VideoPost[]>('/posts/feed'+suffix);
        if(!Array.isArray(fallback))throw new Error('Fil vidéo indisponible.');
        data=fallback;
      }
      if(epoch!==requestEpoch.current)return;
      const nextCursor=data[data.length-1]?.id??null;
      // A broken/repeated cursor must not trap the Reels feed in an endless loop.
      cursorRef.current=nextCursor??cursorRef.current;
      setHasMore(data.length===20&&Boolean(nextCursor)&&(!append||nextCursor!==cursor));
      setPosts(previous=>{
        if(!append)return data;
        const known=new Set(previous.map(post=>post.id));
        return [...previous,...data.filter(post=>!known.has(post.id))];
      });
      if(!append){
        // The refreshed first Reel and the scroll offset must stay in sync.
        setActive(null);
        endReached.current=false;
        listRef.current?.scrollToOffset({offset:0,animated:false});
      }
      const ids=[...new Set(data.map(post=>post.id))].slice(0,30);
      if(ids.length)void apiFetch<{likedPostIds:string[]}>(
        '/reels/likes?ids='+ids.map(encodeURIComponent).join(',')
      ).then(snapshot=>{
        if(epoch!==requestEpoch.current)return;
        const yes=new Set(snapshot.likedPostIds);
        setLikes(current=>{
          const next={...current};
          for(const item of data)next[item.id]={
            count:current[item.id]?.count??item._count.likes,
            liked:yes.has(item.id)
          };
          return next;
        });
      }).catch(()=>undefined);
    }catch(cause){
      if(epoch!==requestEpoch.current)return;
      setFeedError(true);
      setFailure(cause instanceof Error?cause.message:'Impossible de charger les vidéos.');
    }finally{
      if(epoch===requestEpoch.current){
        fetching.current=false;
        setLoading(false);
        setMore(false);
        setRefreshing(false);
      }
    }
  },[hasMore,feed]);

  useEffect(()=>{
    cursorRef.current=null;
    setHasMore(true);
    setPosts([]);
    setActive(null);
    void load(false);
    return()=>{requestEpoch.current++;};
  // Switching tabs is a new feed request, not a continuation of old pagination.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[feed]);

  // Resolve the exact video with existing authorization when it isn't in the first page.
  useEffect(()=>{
    if(!initialSelection||feed!=='all'||loading)return;
    const key=initialSelection.postId+':'+initialSelection.position;
    if(posts.some(post=>post.id===initialSelection.postId))return;
    if(attemptedSelection.current===key)return;
    attemptedSelection.current=key;
    let alive=true;
    void apiFetch<VideoPost>('/posts/'+encodeURIComponent(initialSelection.postId))
      .then(post=>{
        if(!alive||post.id!==initialSelection.postId||
          !(post.media??[]).some(media=>media.position===initialSelection.position
            &&media.mimeType==='video/mp4'&&
            new RegExp('^/media/public/post/[A-Za-z0-9_-]+$').test(media.url)))return;
        setPosts(previous=>previous.some(value=>value.id===post.id)?previous:[post,...previous]);
      }).catch(()=>undefined);
    return()=>{alive=false;};
  },[initialSelection,loading,posts,feed]);

  const visibleClips=useMemo(()=>{
    const q=filter.trim().toLocaleLowerCase();
    return q?clips.filter(clip=>(clip.post.author.username+' '+clip.post.content)
      .toLocaleLowerCase().includes(q)):clips;
  },[clips,filter]);

  useEffect(()=>{
    const selected=chooseVisibleReel(visibleClips.map(clip=>clip.id),active);
    if(selected!==active)setActive(selected);
  },[visibleClips,active]);

  useEffect(()=>{
    if(!initialSelection||feed!=='all'||loading)return;
    const key=initialSelection.postId+':'+initialSelection.position;
    if(positionedSelection.current===key)return;
    const index=visibleClips.findIndex(clip=>clip.id===key);
    if(index<0)return;
    positionedSelection.current=key;
    setActive(key);
    listRef.current?.scrollToIndex({index,animated:false});
  },[initialSelection,visibleClips,loading,feed]);

  const emptyMode=reelsFeedState({clips:visibleClips.length,posts:posts.length,loading,failed:feedError,hasMore});

  const onViewableItemsChanged=useRef(
    ({viewableItems}:{viewableItems:Array<{item:Clip;isViewable?:boolean}>})=>{
      const found=viewableItems.find(token=>token.isViewable);
      if(found)setActive(found.item.id);
    }
  ).current;

  useEffect(()=>{
    const current=visibleClips.find(clip=>clip.id===active);
    if(!current)return;
    const username=current.post.author.username;
    if(Object.prototype.hasOwnProperty.call(following,username))return;
    let mounted=true;
    void apiFetch<FollowState>('/reels/creators/'+encodeURIComponent(current.post.author.id)+'/follow-status')
      .then(value=>{if(mounted)setFollowing(old=>({...old,[username]:value}));})
      .catch(()=>{if(mounted)setFollowing(old=>({...old,[username]:null}));});
    return()=>{mounted=false;};
  },[active,visibleClips,following]);

  async function toggleFollow(authorId:string,username:string){
    const current=following[username];
    if(!current){onOpenProfile(username);return;}
    if(current.isOwner||busyFollow)return;
    setBusyFollow(username);
    try{
      await apiFetch('/reels/creators/'+encodeURIComponent(authorId)+'/follow',{
        method:current.following?'DELETE':'PUT'
      });
      setFollowing(old=>({...old,[username]:{...current,following:!current.following}}));
      if(feed==='following'&&current.following)void load(false,true);
    }catch(cause){
      setFailure(cause instanceof Error?cause.message:(en?'Follow unavailable.':'Abonnement indisponible.'));
    }finally{setBusyFollow(null);}
  }

  async function openOwnProfile(){
    try{
      const me=viewer??await apiFetch<{username:string;displayName:string}>('/users/me');
      if(!me.username)throw new Error(en?'Profile unavailable.':'Profil indisponible.');
      onOpenProfile(me.username);
    }catch(cause){setFailure(cause instanceof Error?cause.message:'Profil indisponible.');}
  }

  async function toggleLike(post:VideoPost){
    if(pending.current)return;
    pending.current=true;
    try{
      const response=await apiFetch<{liked:boolean;count:number}>(`/reels/${encodeURIComponent(post.id)}/like`,{
        method:'POST'
      });
      setLikes(current=>{
        const previous=current[post.id]??{count:post._count.likes,liked:false};
        return {...current,[post.id]:{
          liked:response.liked,
          count:Number.isFinite(response.count)?response.count:Math.max(0,previous.count+(response.liked===previous.liked?0:response.liked?1:-1))
        }};
      });
    }catch(cause){
      setFailure(cause instanceof Error?cause.message:'Réaction impossible.');
    }finally{pending.current=false;}
  }

  async function ensureLike(post:VideoPost){
    if(pending.current || likes[post.id]?.liked === true)return;
    pending.current=true;
    try{
      // Idempotent: unlike the heart button, repeated double taps can never
      // remove an existing reaction, including likes made on another device.
      const response=await apiFetch<{liked:boolean;count:number}>(
        '/posts/'+encodeURIComponent(post.id)+'/like',{method:'PUT'}
      );
      setLikes(current=>({...current,[post.id]:{
        liked:response.liked,
        count:Math.max(0,response.count)
      }}));
    }catch(cause){
      setFailure(cause instanceof Error?cause.message:'Réaction indisponible.');
    }finally{pending.current=false;}
  }


  function renderClip({item}:{item:Clip}){
    const post=item.post;
    const shown=item.id===active&&!offlineLibraryOpen;
    const like=likes[post.id];
    const follow=following[post.author.username];
    const tags=(post.content.match(/#[\p{L}\p{N}_]+/gu)??[]).slice(0,4);
    return <View style={[styles.slide,{height:viewportHeight}]}>
      {shown?<PublicPostVideo key={item.id} url={item.media.url}
        autoPlay externallyPaused={Boolean(captionClip)||Boolean(commentPost)||refreshing||searchOpen||Boolean(sharingClip)}
        onDoubleTap={()=>{void ensureLike(post);}}
        offlineRequest={offlineRequests[item.id]??0}
        onOfflineStatus={saved=>setOfflineStatus(old=>
          old[item.id]===saved?old:{...old,[item.id]:saved})}/>
        :<View style={styles.inactive} accessible={false}>
          <KnowMeIcon name="video-call" size={42} color="#b7d5da"/>
        </View>}
      <View pointerEvents="none" style={styles.bottomScrim}/>
      <View style={styles.information} pointerEvents="box-none">
        <View style={styles.creatorLine}>
          <Pressable accessibilityRole="button" style={styles.creatorAvatar}
            accessibilityLabel={en?'View creator profile':'Voir le profil'}
            onPress={()=>onOpenProfile(post.author.username)}>
            <Avatar name={post.author.displayName} uri={avatarUri(post.author.avatarUrl)} size={44}/>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={()=>onOpenProfile(post.author.username)}>
            <Text style={styles.creator} numberOfLines={1}>@{post.author.username}</Text>
          </Pressable>
          {post.author.verification?.isVerified&&<BlueVerifiedBadge size={18}
            label={post.author.verification.label}/>}
          {post.author.staff?.shield==='GOLD'&&<GoldVerifiedBadge size={18}
            label={post.author.staff.label}/>}
          {follow!==undefined&&!follow?.isOwner&&
            <Pressable accessibilityRole="button" disabled={busyFollow===post.author.username}
              onPress={()=>void toggleFollow(post.author.id,post.author.username)}
              style={styles.followButton}>
              <Text style={styles.followText}>
                {busyFollow===post.author.username?'…'
                  :follow===null?(en?'Profile':'Profil')
                  :follow.following?(en?'Following':'Abonné'):(en?'Follow':'Suivre')}
              </Text>
            </Pressable>}
        </View>
        <ReelCaptionPreview content={post.content} en={en}
          onExpand={()=>setCaptionClip(post)}/>
        {tags.length>0&&<View style={styles.hashtags}>
          {tags.map(tag=><Pressable key={tag} accessibilityRole="button"
            onPress={()=>{setFilter(tag);setSearchOpen(true);}}>
            <Text style={styles.hashtag}>{tag}</Text>
          </Pressable>)}
        </View>}
      </View>
      <View style={styles.actions} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel={en?'Like video':'Aimer le réel'}
          accessibilityState={{selected:like?.liked??false,disabled:pending.current}}
          onPress={()=>void toggleLike(post)} style={styles.action}>
          {like?.liked?<Text style={styles.redHeart}>♥</Text>:
            <KnowMeIcon name="heart" size={33} color="#fff" strokeWidth={1.85}/>}
          <Text style={styles.actionCount}>{shortCount(like?.count??post._count.likes)}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={en?'Comments':'Commentaires'}
          onPress={()=>onOpenPost(post.id)} style={styles.action}>
          <KnowMeIcon name="messages" size={32} color="#fff" strokeWidth={1.85}/>
          <Text style={styles.actionCount}>{shortCount(commentCounts[post.id]??post._count.comments)}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={en?'Share video':'Partager le réel'}
          onPress={()=>setSharingClip(item)} style={styles.action}>
          <KnowMeIcon name="arrow" size={32} color="#fff" strokeWidth={1.85}/>
        </Pressable>
        <Pressable accessibilityRole="button"
          accessibilityLabel={offlineStatus[item.id]
            ?(en?'Remove offline copy':'Retirer la vidéo hors ligne')
            :(en?'Save video offline':'Enregistrer hors ligne')}
          accessibilityState={{selected:Boolean(offlineStatus[item.id])}}
          onPress={()=>setOfflineRequests(old=>({...old,[item.id]:(old[item.id]??0)+1}))}
          onLongPress={()=>setOfflineLibraryOpen(true)} style={styles.action}>
          <KnowMeIcon name={offlineStatus[item.id]?'check':'download'} size={29}
            color={offlineStatus[item.id]?'#56f0dc':'#fff'} strokeWidth={1.85}/>
          <Text style={styles.actionCount}>{en?'Offline':'Hors ligne'}</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={en?'Add comment':'Ajouter un commentaire'}
        style={styles.commentComposer} onPress={()=>setCommentPost(post)}>
        <Avatar name={viewer?.displayName??'KnowMe'} uri={avatarUri(viewer?.avatarUrl)} size={30}/>
        <Text style={styles.commentPlaceholder} numberOfLines={1}>
          {en?'Add a comment…':'Ajouter un commentaire…'}
        </Text>
        <Text style={styles.mentionIcon}>@</Text>
        <KnowMeIcon name="smile" size={24} color="#fff"/>
      </Pressable>
    </View>;
  }

  return <View style={styles.root} onLayout={event=>{
    const height=event.nativeEvent.layout.height;
    if(height>0&&Math.abs(height-viewportHeight)>1)setViewportHeight(height);
  }}>
    <FlatList ref={listRef} data={visibleClips} keyExtractor={item=>item.id}
      renderItem={renderClip} style={styles.list}
      refreshing={refreshing} onRefresh={()=>void load(false,true)}
      progressViewOffset={58}
      pagingEnabled decelerationRate="fast" showsVerticalScrollIndicator={false}
      viewabilityConfig={viewability} onViewableItemsChanged={onViewableItemsChanged}
      onEndReached={()=>{
        if(clips.length>0&&!endReached.current){endReached.current=true;void load(true);}
      }} onMomentumScrollBegin={()=>{endReached.current=false;}}
      onEndReachedThreshold={0.4}
      getItemLayout={(_data,index)=>({length:viewportHeight,offset:index*viewportHeight,index})}
      initialNumToRender={2} windowSize={3} maxToRenderPerBatch={2}
      ListEmptyComponent={<View style={[styles.empty,{height:viewportHeight}]}>
        {emptyMode==='loading'?<ActivityIndicator color="#88e9e3"/>:
          <View style={styles.emptyContent}>
            <KnowMeIcon name={emptyMode==='failed'?'refresh':'video-call'} size={48} color="#83e9de"/>
            <Text style={styles.emptyText}>
              {filter.trim()&&!visibleClips.length
                ?en?'No matching video in loaded clips.':'Aucune vidéo correspondante parmi les vidéos chargées.'
                :emptyMode==='failed'
                ?en?'Videos could not be loaded. Check your connection.':'Impossible de charger les vidéos. Vérifie ta connexion.'
                :emptyMode==='browse'
                  ?en?'Searching for playable Reels in older posts.':'Parcourir les publications précédentes pour trouver des Réels.'
                  :en?'No Reels available yet.':'Aucun Reel disponible pour le moment.'}
            </Text>
            {(emptyMode==='failed'||emptyMode==='browse')&&
              <Pressable accessibilityRole="button" style={styles.retry}
                onPress={()=>void load(emptyMode==='browse')}
                disabled={loading||more}>
                <Text style={styles.retryText}>
                  {emptyMode==='browse'?(en?'Find more videos':'Chercher d’autres vidéos'):(en?'Retry':'Réessayer')}
                </Text>
              </Pressable>}
          </View>}
      </View>}
      ListFooterComponent={more?<ActivityIndicator color="#88e9e3" style={{padding:16}}/>:null}/>

    <View style={styles.header} pointerEvents="box-none">
      <Pressable accessibilityRole="button" accessibilityLabel={en?'Back':'Retour'}
        onPress={onBack} style={styles.headerButton}>
        <KnowMeIcon name="back" size={29} color="#fff"/>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>KnowMe · Reels</Text>
      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" style={styles.headerButton}
          accessibilityLabel={en?'Search loaded Reels':'Rechercher dans les Réels chargés'}
          onPress={()=>setSearchOpen(open=>!open)}>
          <KnowMeIcon name="search" size={27} color="#fff"/>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.headerButton}
          accessibilityLabel={en?'My profile':'Mon profil'} onPress={()=>void openOwnProfile()}>
          <KnowMeIcon name="profile" size={27} color="#fff"/>
        </Pressable>
      </View>
    </View>
    <View style={styles.tabs} pointerEvents="box-none">
      <Pressable accessibilityRole="tab" accessibilityState={{selected:feed==='all'}}
        onPress={()=>{if(feed!=='all'){setFilter('');setFeed('all');}}}
        style={[styles.tab,feed==='all'&&styles.selectedTab]}>
        <Text style={[styles.tabText,feed==='all'&&styles.tabSelectedText]}>
          {en?'For you':'Pour toi'}
        </Text>
        {feed==='all'&&<View style={styles.tabUnderline}/>}
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityState={{selected:feed==='following'}}
        onPress={()=>{if(feed!=='following'){setFilter('');setFeed('following');}}}
        style={[styles.tab,feed==='following'&&styles.selectedTab]}>
        <Text style={[styles.tabText,feed==='following'&&styles.tabSelectedText]}>
          {en?'Following':'Abonnements'}
        </Text>
        {feed==='following'&&<View style={styles.tabUnderline}/>}
      </Pressable>
    </View>
    {searchOpen&&<View style={styles.searchPanel}>
      <KnowMeIcon name="search" size={20} color="#e8fff9"/>
      <TextInput style={styles.searchInput} value={filter} onChangeText={setFilter}
        placeholder={en?'Search loaded videos':'Rechercher dans les vidéos chargées'}
        placeholderTextColor="#a8b9be" autoCapitalize="none" autoCorrect={false}
        accessibilityLabel={en?'Video search':'Rechercher un réel'}/>
      <Pressable accessibilityRole="button" accessibilityLabel={en?'Close search':'Fermer la recherche'}
        onPress={()=>{setFilter('');setSearchOpen(false);}} style={styles.searchClose}>
        <KnowMeIcon name="close" size={20} color="#fff"/>
      </Pressable>
    </View>}
    <OfflineVideosLibrary visible={offlineLibraryOpen}
      onClose={()=>setOfflineLibraryOpen(false)}/>
    <ReelCaptionSheet clip={captionClip} onClose={()=>setCaptionClip(null)}
      onProfile={onOpenProfile}/>
    {commentPost&&<ReelQuickCommentSheet key={commentPost.id}
      postId={commentPost.id} en={en}
      viewer={{name:viewer?.displayName??'KnowMe',avatarUrl:avatarUri(viewer?.avatarUrl)}}
      onClose={()=>setCommentPost(null)}
      onSent={()=>{
        const id=commentPost.id;
        setCommentCounts(current=>({
          ...current,[id]:(current[id]??commentPost._count.comments)+1
        }));
        setCommentPost(null);
      }}
      onViewComments={()=>{
        const id=commentPost.id;
        setCommentPost(null);
        onOpenPost(id);
      }}/>}
    {sharingClip&&<ReelShareSheet post={sharingClip.post} videoUrl={sharingClip.media.url} en={en}
      onClose={()=>setSharingClip(null)}
      onOpenPost={()=>{
        const id=sharingClip.post.id;
        setSharingClip(null);
        onOpenPost(id);
      }}
      onOpenDownloads={()=>{
        setSharingClip(null);
        setOfflineLibraryOpen(true);
      }}
      onHide={()=>{
        const id=sharingClip.post.id;
        setSharingClip(null);
        setPosts(current=>current.filter(item=>item.id!==id));
        setActive(null);
        listRef.current?.scrollToOffset({offset:0,animated:false});
      }}/>}
    {Boolean(failure)&&emptyMode!=='failed'&&
      <View style={styles.error} accessibilityLiveRegion="polite">
        <Text style={styles.errorText}>{failure}</Text>
        {feedError&&<Pressable accessibilityRole="button" style={styles.errorAction}
          onPress={()=>void load(true)} disabled={more}>
          <Text style={styles.errorActionText}>{en?'Retry loading':'Réessayer le chargement'}</Text>
        </Pressable>}
        <Pressable accessibilityRole="button" onPress={()=>setFailure('')}
          style={styles.errorDismiss}
          accessibilityLabel={en?'Dismiss error':'Fermer le message d’erreur'}>
          <Text style={styles.errorActionText}>×</Text>
        </Pressable>
      </View>}
  </View>;
}


const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#03060b'},
  list:{flex:1},
  slide:{width:'100%',height:'100%',justifyContent:'center',alignItems:'center',backgroundColor:'#030609'},
  inactive:{flex:1,width:'100%',alignItems:'center',justifyContent:'center'},
  bottomScrim:{position:'absolute',left:0,right:0,bottom:0,height:335,
    backgroundColor:'rgba(0,0,0,.17)'},
  information:{position:'absolute',left:0,right:80,bottom:112,paddingHorizontal:14,
    gap:9,alignItems:'flex-start'},
  creatorLine:{flexDirection:'row',alignItems:'center',gap:7,maxWidth:'100%'},
  creatorAvatar:{width:51,height:51,borderWidth:2,borderColor:'transparent',borderRadius:26,
    justifyContent:'center',alignItems:'center'},
  creator:{color:'#fff',fontSize:16,fontWeight:'800',flexShrink:1,textShadowColor:'#000b',
    textShadowRadius:5},
  followButton:{minHeight:42,borderWidth:1.3,borderColor:'#fff',
    borderRadius:16,alignItems:'center',justifyContent:'center',paddingHorizontal:13,
    backgroundColor:'rgba(0,0,0,.22)'},
  followText:{fontSize:12,fontWeight:'700',color:'#fff'},
  captionContainer:{alignItems:'flex-start',gap:1,maxWidth:'100%'},
  caption:{color:'#fff',fontSize:15,lineHeight:21,textShadowColor:'#000c',textShadowRadius:4},
  moreText:{color:'#c9d8dc',fontSize:12},
  hashtags:{flexDirection:'row',flexWrap:'wrap',gap:11,maxWidth:'100%'},
  hashtag:{color:'#c9d5e2',fontSize:12,fontWeight:'500'},
  actions:{position:'absolute',right:7,bottom:132,gap:9,alignItems:'center',width:70},
  action:{width:64,minHeight:59,alignItems:'center',justifyContent:'center',gap:3},
  redHeart:{fontSize:39,lineHeight:42,color:'#ff3b57',includeFontPadding:false},
  actionCount:{color:'#fff',fontSize:12,fontWeight:'700',textShadowColor:'#000b',
    textShadowRadius:4},
  commentComposer:{position:'absolute',left:12,right:12,bottom:13,height:51,
    flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:9,
    borderRadius:28,borderWidth:1,borderColor:'rgba(255,255,255,.27)',
    backgroundColor:'rgba(25,29,36,.7)'},
  commentPlaceholder:{color:'#bbc3ca',fontSize:14,flex:1},
  mentionIcon:{color:'#fff',fontSize:28,fontWeight:'800',lineHeight:34},
  header:{position:'absolute',top:0,left:0,right:0,paddingHorizontal:10,
    height:56,flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    backgroundColor:'rgba(0,0,0,.17)'},
  headerButton:{width:48,height:48,justifyContent:'center',alignItems:'center'},
  title:{position:'absolute',left:62,right:111,fontSize:20,textAlign:'center',
    color:'#fff',fontWeight:'800'},
  headerActions:{flexDirection:'row',alignItems:'center',gap:2},
  tabs:{position:'absolute',top:59,left:0,right:0,flexDirection:'row',
    justifyContent:'center',alignItems:'center',gap:18},
  tab:{height:44,minWidth:0,paddingHorizontal:8,alignItems:'center',
    justifyContent:'center'},
  selectedTab:{},
  tabText:{fontSize:15,color:'#d0d7dd',fontWeight:'500'},
  tabSelectedText:{color:'#fff',fontWeight:'800'},
  tabUnderline:{position:'absolute',bottom:0,width:34,height:3,borderRadius:3,
    backgroundColor:'#49ede2'},
  searchPanel:{position:'absolute',top:110,left:14,right:14,height:52,borderRadius:22,
    backgroundColor:'rgba(18,29,38,.95)',flexDirection:'row',alignItems:'center',
    paddingHorizontal:12,gap:8},
  searchInput:{flex:1,height:47,color:'#fff',fontSize:14,paddingVertical:0},
  searchClose:{width:38,height:44,alignItems:'center',justifyContent:'center'},
  empty:{alignItems:'center',justifyContent:'center',paddingHorizontal:24},
  emptyText:{color:'#bcd3d5',fontSize:14,textAlign:'center',lineHeight:21},
  emptyContent:{maxWidth:300,alignItems:'center',gap:18},
  retry:{minHeight:48,borderRadius:16,paddingHorizontal:22,alignItems:'center',
    justifyContent:'center',backgroundColor:'#83e9de'},
  retryText:{fontSize:14,fontWeight:'700',color:'#06332e'},
  error:{position:'absolute',top:169,left:20,right:20,borderRadius:13,
    padding:12,backgroundColor:'#55272b',flexDirection:'row',alignItems:'center',gap:8},
  errorText:{color:'#fff',fontSize:12,flex:1},
  errorAction:{minHeight:44,justifyContent:'center',paddingHorizontal:7},
  errorActionText:{color:'#fff',fontSize:13,fontWeight:'700'},
  errorDismiss:{width:44,height:44,alignItems:'center',justifyContent:'center'}
});
