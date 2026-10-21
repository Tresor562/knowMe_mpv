import {useEffect,useState} from 'react';
import {FlatList,Pressable,StyleSheet,Text,View} from 'react-native';
import {apiFetch,API_URL} from './api';
import {NativeStoryVideo} from './NativeStoryVideo';
import {KnowMeIcon} from './ui/KnowMeUI';
import {useAppearance} from './AppearanceProvider';
import {queueReelSelectionIntent} from './reel-selection-intent';

type Media={url:string;mimeType:string;position:number};
type VideoPost={id:string;author?:{displayName?:string;username?:string};media?:Media[]};
type Preview={id:string;postId:string;position:number;url:string;creator:string};

function previews(posts:VideoPost[]):Preview[]{
  const found=new Set<string>();
  const result:Preview[]=[];
  for(const post of posts){
    for(const video of post.media??[]){
      if(video.mimeType!=='video/mp4'||!/^\/media\/public\/post\/[A-Za-z0-9_-]+$/.test(video.url))continue;
      const id=post.id+':'+video.position;
      if(found.has(id))continue;
      found.add(id);
      result.push({id,postId:post.id,position:video.position,url:video.url,
        creator:post.author?.displayName||post.author?.username||'KnowMe'});
    }
  }
  return result.slice(0,10);
}

/** Only true, published MP4s from the video API; never placeholder people or counters.
 * Horizontal virtualization caps the number of prepared native video surfaces. */
export function NativeFeedReelSuggestions({onOpenReels}:{
  onOpenReels:(postId?:string,position?:number)=>void;
}){
  const {colors}=useAppearance();
  const [items,setItems]=useState<Preview[]>([]);
  useEffect(()=>{
    let alive=true;
    void apiFetch<VideoPost[]>('/posts/videos')
      .then(data=>{if(alive)setItems(Array.isArray(data)?previews(data):[]);})
      .catch(()=>{if(alive)setItems([]);});
    return()=>{alive=false;};
  },[]);
  if(!items.length)return null;
  return (
    <View style={[styles.container,{borderBottomColor:colors.border}]}>
      <Pressable accessibilityRole="button" onPress={()=>onOpenReels()}
        style={styles.heading}>
        <View style={styles.titleRow}>
          <KnowMeIcon name="play" size={21} color={colors.text}/>
          <Text style={[styles.title,{color:colors.text}]}>Reels · Vidéos</Text>
        </View>
        <Text style={{color:colors.muted,fontSize:13}}>Voir tout ›</Text>
      </Pressable>
      <FlatList
        horizontal
        data={items}
        keyExtractor={item=>item.id}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        renderItem={({item})=>(
          <Pressable accessibilityRole="button"
            accessibilityLabel={'Voir le réel de '+item.creator}
            onPress={()=>{
              if(queueReelSelectionIntent({postId:item.postId,position:item.position})){
                onOpenReels();
              }
            }}
            style={[styles.card,{backgroundColor:colors.surface}]}>
            <View pointerEvents="none" style={styles.video}>
              <NativeStoryVideo sourceUri={API_URL+item.url} paused
                seekToMs={100} style={styles.videoContent}/>
            </View>
            <View pointerEvents="none" style={styles.play}>
              <KnowMeIcon name="play" size={23} color="#fff"/>
            </View>
            <View pointerEvents="none" style={styles.caption}>
              <Text numberOfLines={2} style={styles.creator}>{item.creator}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles=StyleSheet.create({
  container:{paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth},
  heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,paddingVertical:5,marginBottom:7},
  titleRow:{flexDirection:'row',alignItems:'center',gap:8},
  title:{fontSize:18,fontWeight:'800'},
  rail:{gap:10,paddingHorizontal:2,paddingBottom:4},
  card:{width:118,height:196,borderRadius:15,overflow:'hidden',justifyContent:'center'},
  video:{position:'absolute',left:0,right:0,top:0,bottom:0,width:'100%',height:'100%'},
  videoContent:{width:'100%',height:'100%'},
  play:{alignSelf:'center',width:46,height:46,borderRadius:23,borderWidth:1.5,
    borderColor:'rgba(255,255,255,.9)',backgroundColor:'rgba(0,0,0,.4)',
    alignItems:'center',justifyContent:'center'},
  caption:{position:'absolute',left:0,right:0,bottom:0,paddingHorizontal:9,paddingTop:24,paddingBottom:10,
    backgroundColor:'rgba(0,0,0,.49)'},
  creator:{color:'#fff',fontSize:12,fontWeight:'700',lineHeight:16}
});
