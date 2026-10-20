import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, Share, StyleSheet,
  Text, TextInput, View
} from 'react-native';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { API_URL, apiFetch } from './api';
import { useI18n } from './I18nProvider';
import { chooseVisibleReel, reelsFeedState } from './reels-feed-state';
import { PublicPostVideo } from './PublicPostVideo';
import { ReelCaptionSheet } from './ReelCaptionSheet';
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
  const [feed,setFeed]=useState<ReelFeed>('all');
  const [searchOpen,setSearchOpen]=useState(false);
  const [filter,setFilter]=useState('');
  const [following,setFollowing]=useState<Record<string,FollowState|null>>({});
  const [busyFollow,setBusyFollow]=useState<string|null>(null);
  const [active,setActive]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [more,setMore]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [hasMore,setHasMore]=useState(true);
  const [failure,setFailure]=useState('');
  const [feedError,setFeedError]=useState(false);
  const [captionClip,setCaptionClip]=useState<VideoPost|null>(null);
  const [offlineLibraryOpen,setOfflineLibraryOpen]=useState(false);
  const [viewportHeight,setViewportHeight]=useState(600);
  const [likes,setLikes]=useState<Record<string,{count:number;liked:boolean}>>({});
  const requestEpoch=useRef(0);
  const pending=useRef(false);
  const fetching=useRef(false);
  const endReached=useRef(false);
  const cursorRef=useRef<string|null>(null);
  const listRef=useRef<FlatList<Clip>|null>(null);
  const viewability=useRef({itemVisiblePercentThreshold:72}).current;

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
      const endpoint=feed==='following'?'/posts/videos/following':'/posts/videos';
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
        '/posts/likes?ids='+ids.map(encodeURIComponent).join(',')
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

  const visibleClips=useMemo(()=>{
    const q=filter.trim().toLocaleLowerCase();
    return q?clips.filter(clip=>(clip.post.author.username+' '+clip.post.content)
      .toLocaleLowerCase().includes(q)):clips;
  },[clips,filter]);

  useEffect(()=>{
    const selected=chooseVisibleReel(visibleClips.map(clip=>clip.id),active);
    if(selected!==active)setActive(selected);
  },[visibleClips,active]);

  const emptyMode=reelsFeedState({clips:visibleClips.length,posts:posts.length,loading,failed:feedError,hasMore});

  const onViewableItemsChanged=useRef(
    ({viewableItems}:{viewableItems:Array<{item:Clip;isViewable?:boolean}>})=>{
      const found=viewableItems.find(token=>token.isViewable);
      if(found)setActive(found.item.id);
    }
  ).current;

  async function toggleLike(post:VideoPost){
    if(pending.current)return;
    pending.current=true;
    try{
      const response=await apiFetch<{liked:boolean}>(`/posts/${encodeURIComponent(post.id)}/like`,{
        method:'POST'
      });
      setLikes(current=>{
        const previous=current[post.id]??{count:post._count.likes,liked:false};
        return {...current,[post.id]:{
          liked:response.liked,
          count:Math.max(0,previous.count+(response.liked===previous.liked?0:response.liked?1:-1))
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

  async function sharePost(postId:string){
    try{
      await Share.share({message:buildKnowMePublicLink({kind:'post',id:postId})});
    }catch{
      setFailure('Partage indisponible.');
    }
  }

  function renderClip({item}: {item:Clip}){
    const post=item.post;
    // Unmount the active Reel while the local library is open. Otherwise
    // both players can emit sound behind the modal.
    const shown=item.id===active&&!offlineLibraryOpen;
    const liked=likes[post.id];
    return <View style={[styles.slide,{height:viewportHeight}]}>
      {shown ? <PublicPostVideo key={item.id} url={item.media.url}
        autoPlay externallyPaused={Boolean(captionClip)||refreshing}
        onDoubleTap={()=>{void ensureLike(post);}}/>
        : <View style={styles.inactive} accessible={false}>
          <KnowMeIcon name="video-call" size={48} color="#b7d5da"/>
        </View>}
      <View style={styles.information} pointerEvents="box-none">
        <View style={styles.description} pointerEvents="box-none">
          <Pressable accessibilityRole="button"
            accessibilityLabel={`Voir le profil de ${post.author.displayName}`}
            onPress={()=>onOpenProfile(post.author.username)}>
            <Text style={styles.creator}>@{post.author.username}</Text>
          </Pressable>
          {Boolean(post.content)&&<>
            <Text style={styles.caption} numberOfLines={4}>{post.content}</Text>
            <Pressable accessibilityRole="button"
              accessibilityLabel={'Lire toute la description de '+post.author.displayName}
              onPress={()=>setCaptionClip(post)} style={styles.readMore}>
              <Text style={styles.readMoreText}>Voir toute la description</Text>
              <KnowMeIcon name="arrow" color="#c5fff4" size={14}/>
            </Pressable>
          </>}
          <Pressable accessibilityRole="button" onPress={()=>onOpenPost(post.id)}
            style={styles.postLink}>
            <Text style={styles.postLinkText}>Voir la publication</Text>
          </Pressable>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Réagir à la vidéo"
            onPress={()=>void toggleLike(post)} style={styles.action}>
            <KnowMeIcon name="heart" size={25} color={liked?.liked?'#fb6e80':'#fff'}/>
            <Text style={styles.actionCount}>{liked?.count??post._count.likes}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Voir les commentaires"
            onPress={()=>onOpenPost(post.id)} style={styles.action}>
            <KnowMeIcon name="messages" size={25} color="#fff"/>
            <Text style={styles.actionCount}>{post._count.comments}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Partager la vidéo"
            onPress={()=>void sharePost(post.id)} style={styles.action}>
            <KnowMeIcon name="arrow" size={25} color="#fff"/>
          </Pressable>
        </View>
      </View>
    </View>;
  }

  return <View style={styles.root} onLayout={event=>{
    const height=event.nativeEvent.layout.height;
    if(height>0&&Math.abs(height-viewportHeight)>1)setViewportHeight(height);
  }}>
    <FlatList ref={listRef} data={clips} keyExtractor={item=>item.id}
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
              {emptyMode==='failed'
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
      <Pressable accessibilityRole="button" accessibilityLabel="Retour à l'accueil"
        onPress={onBack} style={styles.back}>
        <KnowMeIcon name="back" size={23} color="#fff"/>
      </Pressable>
      <Text style={styles.title}>KnowMe · Reels</Text>
      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" style={styles.back}
          accessibilityLabel={en?'Refresh Reels':'Actualiser les Réels'}
          accessibilityState={{disabled:refreshing||loading||more}}
          disabled={refreshing||loading||more}
          onPress={()=>void load(false,true)}>
          <KnowMeIcon name="refresh" size={21} color="#fff"/>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={en?'Saved videos':'Mes vidéos enregistrées'}
          onPress={()=>setOfflineLibraryOpen(true)} style={styles.back}>
          <KnowMeIcon name="download" size={22} color="#fff"/>
        </Pressable>
      </View>
    </View>
    <OfflineVideosLibrary visible={offlineLibraryOpen}
      onClose={()=>setOfflineLibraryOpen(false)}/>
    <ReelCaptionSheet clip={captionClip} onClose={()=>setCaptionClip(null)}
      onProfile={onOpenProfile}/>
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
  slide:{width:'100%',justifyContent:'center',alignItems:'center',
    backgroundColor:'#080c14'},
  inactive:{flex:1,width:'100%',alignItems:'center',justifyContent:'center'},
  information:{position:'absolute',left:0,right:0,bottom:0,
    paddingHorizontal:13,paddingBottom:23,paddingTop:25,
    flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',
    backgroundColor:'rgba(0,0,0,.48)'},
  description:{flex:1,minWidth:0,gap:8,marginRight:9},
  creator:{color:'#fff',fontSize:15,fontWeight:'800'},
  caption:{color:'#fff',fontSize:13,lineHeight:18},
  readMore:{minHeight:44,flexDirection:'row',alignItems:'center',gap:8,
    borderRadius:12,paddingHorizontal:6,alignSelf:'flex-start'},
  readMoreText:{color:'#c5fff4',fontSize:12,fontWeight:'800'},
  postLink:{alignSelf:'flex-start',minHeight:40,justifyContent:'center',
    borderRadius:11,backgroundColor:'rgba(24,74,80,.65)',paddingHorizontal:12},
  postLinkText:{color:'#b5fff1',fontSize:12,fontWeight:'700'},
  actions:{gap:10,alignItems:'center'},
  action:{width:51,minHeight:51,alignItems:'center',justifyContent:'center',
    gap:2,borderRadius:14,backgroundColor:'rgba(0,0,0,.38)'},
  actionCount:{color:'#fff',fontSize:12,fontWeight:'700'},
  header:{position:'absolute',top:0,left:0,right:0,
    paddingHorizontal:13,paddingTop:8,paddingBottom:15,
    flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    backgroundColor:'rgba(0,0,0,.38)'},
  back:{width:44,height:44,justifyContent:'center',alignItems:'center',
    backgroundColor:'rgba(255,255,255,.12)',borderRadius:17},
  title:{fontSize:16,color:'#fff',fontWeight:'800',flexShrink:1},
  headerActions:{flexDirection:'row',alignItems:'center',gap:6},
  empty:{alignItems:'center',justifyContent:'center',paddingHorizontal:24},
  emptyText:{color:'#bcd3d5',fontSize:14,textAlign:'center',lineHeight:21},
  emptyContent:{maxWidth:300,alignItems:'center',gap:18},
  retry:{minHeight:48,borderRadius:16,paddingHorizontal:22,alignItems:'center',
    justifyContent:'center',backgroundColor:'#83e9de'},
  retryText:{fontSize:14,fontWeight:'700',color:'#06332e'},
  error:{position:'absolute',top:65,left:20,right:20,borderRadius:13,
    padding:12,backgroundColor:'#55272b',flexDirection:'row',alignItems:'center',gap:8},
  errorText:{color:'#fff',fontSize:12,flex:1},
  errorAction:{minHeight:44,justifyContent:'center',paddingHorizontal:7},
  errorActionText:{color:'#fff',fontSize:13,fontWeight:'700'},
  errorDismiss:{width:44,height:44,alignItems:'center',justifyContent:'center'}
});
