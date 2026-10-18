import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, Share, StyleSheet,
  Text, View
} from 'react-native';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { apiFetch } from './api';
import { PublicPostVideo } from './PublicPostVideo';
import { ReelCaptionSheet } from './ReelCaptionSheet';
import { KnowMeIcon } from './ui/KnowMeUI';

type Author={id:string;username:string;displayName:string};
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
  const [posts,setPosts]=useState<VideoPost[]>([]);
  const [active,setActive]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [more,setMore]=useState(false);
  const [hasMore,setHasMore]=useState(true);
  const [failure,setFailure]=useState('');
  const [captionClip,setCaptionClip]=useState<VideoPost|null>(null);
  const [viewportHeight,setViewportHeight]=useState(600);
  const [likes,setLikes]=useState<Record<string,{count:number;liked:boolean}>>({});
  const pending=useRef(false);
  const fetching=useRef(false);
  const endReached=useRef(false);
  const cursorRef=useRef<string|null>(null);
  const viewability=useRef({itemVisiblePercentThreshold:72}).current;

  const clips=useMemo<Clip[]>(()=>posts.flatMap(post=>
    (post.media??[]).filter(media=>media.mimeType==='video/mp4'&&
      /^\/media\/public\/post\/[a-zA-Z0-9_-]+$/.test(media.url))
      .sort((a,b)=>a.position-b.position)
      .map(media=>({id:post.id+':'+media.position,post,media}))
  ),[posts]);

  const load=useCallback(async(append:boolean)=>{
    if(fetching.current||append&&!hasMore)return;
    fetching.current=true;
    append?setMore(true):setLoading(true);
    setFailure('');
    try{
      const cursor=append?cursorRef.current:null;
      const suffix=cursor?'?cursor='+encodeURIComponent(cursor):'';
      let data:VideoPost[];
      try{
        const response=await apiFetch<VideoPost[]>('/posts/videos'+suffix);
        if(!Array.isArray(response))throw new Error('REELS_LEGACY_API');
        data=response;
      }catch(cause){
        if((cause as {status?:number})?.status!==404 &&
          !(cause instanceof Error&&cause.message==='REELS_LEGACY_API'))throw cause;
        const fallback=await apiFetch<VideoPost[]>('/posts/feed'+suffix);
        if(!Array.isArray(fallback))throw new Error('Fil vidéo indisponible.');
        data=fallback;
      }
      cursorRef.current=data[data.length-1]?.id??cursorRef.current;
      setHasMore(data.length===20);
      setPosts(previous=>{
        if(!append)return data;
        const known=new Set(previous.map(post=>post.id));
        return [...previous,...data.filter(post=>!known.has(post.id))];
      });
    }catch(cause){
      setFailure(cause instanceof Error?cause.message:'Impossible de charger les vidéos.');
    }finally{
      fetching.current=false;
      setLoading(false);
      setMore(false);
    }
  },[hasMore]);

  useEffect(()=>{void load(false);},[]);

  useEffect(()=>{
    if(!active&&clips[0])setActive(clips[0].id);
  },[clips,active]);

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
    const shown=item.id===active;
    const liked=likes[post.id];
    return <View style={[styles.slide,{height:viewportHeight}]}>
      {shown ? <PublicPostVideo key={item.id} url={item.media.url}
        externallyPaused={Boolean(captionClip)}
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
            {(post.content.length>160||post.content.includes('\n'))&&
              <Pressable accessibilityRole="button"
                accessibilityLabel={'Lire toute la description de '+post.author.displayName}
                onPress={()=>setCaptionClip(post)} style={styles.readMore}>
                <Text style={styles.readMoreText}>Voir toute la description</Text>
                <KnowMeIcon name="arrow" color="#c5fff4" size={14}/>
              </Pressable>}
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
    <FlatList data={clips} keyExtractor={item=>item.id}
      renderItem={renderClip} style={styles.list}
      pagingEnabled decelerationRate="fast" showsVerticalScrollIndicator={false}
      viewabilityConfig={viewability} onViewableItemsChanged={onViewableItemsChanged}
      onEndReached={()=>{
        if(!endReached.current){endReached.current=true;void load(true);}
      }} onMomentumScrollBegin={()=>{endReached.current=false;}}
      onEndReachedThreshold={0.4}
      getItemLayout={(_data,index)=>({length:viewportHeight,offset:index*viewportHeight,index})}
      initialNumToRender={2} windowSize={3} maxToRenderPerBatch={2}
      ListEmptyComponent={<View style={[styles.empty,{height:viewportHeight}]}>
        {loading?<ActivityIndicator color="#88e9e3"/>:
          <Text style={styles.emptyText}>Aucune vidéo disponible pour le moment.</Text>}
      </View>}
      ListFooterComponent={more?<ActivityIndicator color="#88e9e3" style={{padding:16}}/>:null}/>
    <View style={styles.header} pointerEvents="box-none">
      <Pressable accessibilityRole="button" accessibilityLabel="Retour à l'accueil"
        onPress={onBack} style={styles.back}>
        <KnowMeIcon name="back" size={23} color="#fff"/>
      </Pressable>
      <Text style={styles.title}>KnowMe · Reels</Text>
      <View style={{width:44}}/>
    </View>
    <ReelCaptionSheet clip={captionClip} onClose={()=>setCaptionClip(null)}
      onProfile={onOpenProfile}/>
    {Boolean(failure)&&<Pressable accessibilityRole="alert"
      onPress={()=>setFailure('')} style={styles.error}>
      <Text style={styles.errorText}>{failure}</Text>
    </Pressable>}
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
  title:{fontSize:16,color:'#fff',fontWeight:'800'},
  empty:{alignItems:'center',justifyContent:'center',paddingHorizontal:24},
  emptyText:{color:'#bcd3d5',fontSize:14,textAlign:'center'},
  error:{position:'absolute',top:65,left:20,right:20,borderRadius:13,
    padding:13,backgroundColor:'#55272b'},
  errorText:{color:'#fff',fontSize:12,textAlign:'center'}
});
