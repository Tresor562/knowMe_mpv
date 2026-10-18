import { useState } from 'react';
import {
  Image, Modal, Pressable, ScrollView, StyleSheet, Text, View
} from 'react-native';
import { API_URL } from './api';
import { useAppearance } from './AppearanceProvider';
import { PublicPostVideo } from './PublicPostVideo';
import { KnowMeIcon } from './ui/KnowMeUI';

type PostMedium = {
  url: string;
  mimeType: string;
  position: number;
};

function safePostMediaUrl(url: string): string {
  if (/^\/media\/public\/post\/[a-zA-Z0-9_-]+$/.test(url)) return `${API_URL}${url}`;
  if (/^https:\/\//i.test(url)) return url;
  return '';
}

/**
 * On-demand media viewer for Android KnowMe posts.
 * Video downloads are delegated to the existing PublicPostVideo component,
 * which starts loading only after tapping Play in the full-screen viewer.
 */
export function PostMediaGallery({
  media, fallbackUrl, caption = ''
}: {
  media?: PostMedium[] | null;
  fallbackUrl?: string | null;
  caption?: string;
}) {
  const { colors } = useAppearance();
  const [active, setActive] = useState<number | null>(null);
  const items = media?.length
    ? [...media].sort((a,b)=>a.position-b.position)
      .filter(item=>Boolean(safePostMediaUrl(item.url)))
    : fallbackUrl && safePostMediaUrl(fallbackUrl)
      ? [{url:fallbackUrl,mimeType:'image/jpeg',position:0}]
      : [];
  const count = items.length;
  if (!count) return null;
  const activeItem = active === null ? null : items[active];
  const indexBound=(index:number)=>(index+count)%count;
  const open=(index:number)=>setActive(index);
  const getMediaSource=(url:string)=>safePostMediaUrl(url);
  return (
    <>
      <View style={styles.collage} accessibilityLabel={`Publication avec ${count} médias`}>
        {items.slice(0,5).map((item,index)=>{
          const isVideo=item.mimeType.startsWith('video/');
          return (
            <Pressable key={item.position+':'+item.url} accessibilityRole="button"
              accessibilityLabel={`Ouvrir le média ${index+1} sur ${count}`}
              onPress={event=>{
                event.stopPropagation();
                open(index);
              }}
              style={[styles.tile,{
                width:count===1?'100%':count===3&&index===0?'100%':
                  count===5&&index>1?'32.6%':'49.5%',
                height:count===1?290:count===3&&index===0?235:
                  count===5&&index>1?125:195,
                backgroundColor:colors.surface
              }]}>
              {isVideo
                ? <View style={styles.videoTile}>
                    <Text style={{color:"#fff",fontSize:32}}>▶</Text>
                    <Text style={styles.videoLabel}>Vidéo</Text>
                  </View>
                : <Image source={{uri:getMediaSource(item.url)}} resizeMode={count===1?'contain':'cover'}
                    style={styles.mediaImage}/>}
              {index===4&&count>5&&
                <View pointerEvents="none" style={styles.moreOverlay}>
                  <Text style={styles.moreText}>+{count-5}</Text>
                </View>}
            </Pressable>
          );
        })}
      </View>
      <Modal visible={active!==null} animationType="fade" transparent statusBarTranslucent
        onRequestClose={()=>setActive(null)}>
        <View style={styles.modal}>
          <View style={styles.topbar}>
            <Text style={styles.counter}>{active===null?'':`${active+1} / ${count}`}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer la galerie"
              onPress={()=>setActive(null)} style={styles.closeButton}>
              <KnowMeIcon name="close" size={25} color="#fff"/>
            </Pressable>
          </View>
          <View style={styles.stage}>
            {count>1&&
              <Pressable accessibilityRole="button" accessibilityLabel="Média précédent"
                style={styles.chevron}
                onPress={()=>setActive(current=>current===null?null:indexBound(current-1))}>
                <Text style={styles.arrow}>‹</Text>
              </Pressable>}
            <View style={styles.activeMedia}>
              {activeItem && (activeItem.mimeType.startsWith('video/')
                ? <PublicPostVideo key={activeItem.url} url={activeItem.url}/>
                : <Image key={activeItem.url}
                    source={{uri:getMediaSource(activeItem.url)}}
                    style={styles.fullImage} resizeMode="contain"/>)}
            </View>
            {count>1&&
              <Pressable accessibilityRole="button" accessibilityLabel="Média suivant"
                style={styles.chevron}
                onPress={()=>setActive(current=>current===null?null:indexBound(current+1))}>
                <Text style={styles.arrow}>›</Text>
              </Pressable>}
          </View>
          {caption.trim()?<ScrollView style={styles.captionArea} nestedScrollEnabled>
            <Text style={styles.captionText}>{caption}</Text>
          </ScrollView>:null}
        </View>
      </Modal>
    </>
  );
}
const styles=StyleSheet.create({
  collage:{flexDirection:'row',flexWrap:'wrap',gap:3,marginVertical:9,width:'100%'},
  tile:{position:'relative',overflow:'hidden',borderRadius:5},
  mediaImage:{width:'100%',height:'100%'},
  videoTile:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#142436',gap:5},
  videoLabel:{color:'#fff',fontSize:12,fontWeight:'600'},
  moreOverlay:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.66)',
    alignItems:'center',justifyContent:'center'},
  moreText:{color:'#fff',fontSize:30,fontWeight:'800'},
  modal:{flex:1,backgroundColor:'#06070a',paddingTop:28,paddingBottom:28},
  topbar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    minHeight:49,paddingHorizontal:18},
  counter:{color:'#fff',fontSize:14,fontWeight:'700',fontVariant:['tabular-nums']},
  closeButton:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},
  stage:{flex:1,minHeight:0,flexDirection:'row',alignItems:'center',justifyContent:'center'},
  chevron:{width:38,minHeight:64,alignItems:'center',justifyContent:'center'},
  arrow:{color:'#fff',fontSize:44,fontWeight:'400'},
  activeMedia:{flex:1,minHeight:0,alignItems:'center',justifyContent:'center'},
  fullImage:{width:'100%',height:'100%'},
  captionArea:{flexGrow:0,maxHeight:150,paddingHorizontal:16},
  captionText:{color:'#fff',fontSize:14,lineHeight:21}
});
