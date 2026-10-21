import { useMemo, useState } from 'react';
import {
  Image, Modal, Pressable, ScrollView, StyleSheet, Text, View
} from 'react-native';
import { API_URL } from './api';
import { useAppearance } from './AppearanceProvider';
import { PublicPostVideo } from './PublicPostVideo';
import { NativeStoryVideo } from './NativeStoryVideo';
import { KnowMeIcon } from './ui/KnowMeUI';

type PostMedia = { url: string; mimeType: string; position: number };

function publicMediaUrl(url: string): string {
  if (url.startsWith('/media/public/post/')) return API_URL + url;
  if (url.startsWith('/') && !url.startsWith('//')) return API_URL + url;
  if (url.startsWith('https://')) return url;
  return '';
}

/**
 * Every attached photo/video remains reachable, even when only five tiles are
 * shown in the feed. Videos load only on explicit user interaction.
 */
export function PostMediaGallery({ media, fallbackUrl, caption }: {
  media?: PostMedia[] | null;
  fallbackUrl?: string | null;
  caption?: string;
}) {
  const { colors } = useAppearance();
  const [index, setIndex] = useState<number | null>(null);
  const items = useMemo(() => {
    const ordered = media?.length
      ? [...media].sort((a, b) => a.position - b.position)
      : fallbackUrl ? [{ url: fallbackUrl, mimeType: 'image/jpeg', position: 0 }] : [];
    return ordered.filter(item => Boolean(publicMediaUrl(item.url)));
  }, [media, fallbackUrl]);
  const total = items.length;
  const open = index !== null && index < total;
  const selected = open ? items[index] : null;
  const gallery = items.slice(0, 5);

  if (!total) return null;

  function next(delta: number) {
    setIndex(current => current === null ? null : (current + delta + total) % total);
  }

  return (
    <>
      <View style={[styles.tiles, total === 1 && styles.single]}>
        {gallery.map((item, tileIndex) => {
          const isVideo = item.mimeType.startsWith('video/');
          return (
            <Pressable
              key={item.position + ':' + item.url}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir le média ${tileIndex + 1} sur ${total}`}
              onPress={event => { event.stopPropagation(); setIndex(tileIndex); }}
              style={({ pressed }) => [
                styles.tile,
                total === 1 ? styles.one : total < 5
                  ? styles.two : tileIndex < 2 ? styles.two : styles.three,
                total === 1 && styles.singleTile,
                pressed && { opacity: 0.86 }
              ]}>
              {isVideo ? (
                <View pointerEvents="none" style={styles.videoPlaceholder}>
                  <NativeStoryVideo sourceUri={publicMediaUrl(item.url)} paused
                    seekToMs={120} style={styles.videoPoster} />
                  <View style={styles.playOverlay}>
                    <KnowMeIcon name="play" size={26} color="#fff"/>
                  </View>
                </View>
              ) : (
                <Image style={styles.image} source={{ uri: publicMediaUrl(item.url) }}
                  resizeMode={total === 1 ? 'contain' : 'cover'} />
              )}
              {tileIndex === 4 && total > 5 && (
                <View style={styles.more} pointerEvents="none">
                  <Text style={styles.moreText}>+{total - 5}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Modal visible={open} transparent statusBarTranslucent
        animationType="fade" onRequestClose={() => setIndex(null)}>
        <View style={styles.modal}>
          <View style={styles.top}>
            <Text style={styles.counter}>{index === null ? '' : `${index + 1} / ${total}`}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer la galerie"
              onPress={() => setIndex(null)} style={styles.close}>
              <KnowMeIcon name="close" size={25} color="#fff"/>
            </Pressable>
          </View>
          <View style={styles.stage}>
            {selected?.mimeType.startsWith('video/') ? (
              <View style={styles.media}>
                <PublicPostVideo key={selected.url} url={selected.url}/>
              </View>
            ) : selected && (
              <Image key={selected.url} source={{uri:publicMediaUrl(selected.url)}}
                style={styles.media} resizeMode="contain" />
            )}
          </View>
          {caption?.trim() ? (
            <ScrollView style={styles.captionArea} contentContainerStyle={styles.captionContent}>
              <Text style={styles.caption}>{caption}</Text>
            </ScrollView>
          ) : null}
          <View style={styles.nav}>
            <Pressable accessibilityRole="button" accessibilityLabel="Média précédent"
              disabled={total < 2} onPress={() => next(-1)} style={styles.navButton}>
              <Text style={styles.arrow}>‹</Text>
            </Pressable>
            <Text style={styles.counter}>{index === null ? '' : `${index + 1} / ${total}`}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Média suivant"
              disabled={total < 2} onPress={() => next(1)} style={styles.navButton}>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, overflow: 'hidden',borderRadius: 14 },
  single: { borderRadius: 17 },
  tile: { position:'relative', overflow:'hidden', borderRadius: 3, backgroundColor:'#111c2a',
    height: 132, flexGrow: 1 },
  one: { width:'100%', height:300 },
  two: { width:'49%', height:200 },
  three: { width:'32%', height:130 },
  singleTile: { borderRadius: 17 },
  image: { width:'100%', height:'100%' },
  videoPlaceholder: { flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#111923' },
  videoPoster: {position:'absolute',top:0,bottom:0,left:0,right:0,width:'100%',height:'100%'},
  playOverlay: {width:52,height:52,borderRadius:26,backgroundColor:'rgba(0,0,0,.5)',
    borderColor:'rgba(255,255,255,.66)',borderWidth:1,alignItems:'center',justifyContent:'center'},
  more: { position:'absolute',top:0,bottom:0,left:0,right:0,
    justifyContent:'center',alignItems:'center',backgroundColor:'rgba(0,0,0,.68)' },
  moreText: { fontSize:32,fontWeight:'800',color:'#fff' },
  modal: { flex:1,backgroundColor:'#050609',paddingTop:36,
    paddingBottom:20 },
  top: { height:53,flexDirection:'row',justifyContent:'space-between',
    alignItems:'center',paddingHorizontal:14 },
  counter: {color:'#fff',fontSize:14,fontWeight:'600'},
  close: { width:44,height:44,alignItems:'center',justifyContent:'center' },
  stage: {flex:1,minHeight:0,alignItems:'center',justifyContent:'center'},
  media: {width:'100%',height:'100%'},
  captionArea: {maxHeight:125,flexGrow:0},
  captionContent:{paddingVertical:9,paddingHorizontal:16},
  caption: {color:'#fff',fontSize:14,lineHeight:20},
  nav:{minHeight:66,flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    paddingHorizontal:16},
  navButton:{minHeight:48,minWidth:48,alignItems:'center',justifyContent:'center'},
  arrow:{fontSize:38,color:'#fff'}
});
