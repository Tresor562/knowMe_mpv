import { useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_URL } from './api';
import { useAppearance } from './AppearanceProvider';

export type PostAsset = {
  position: number;
  asset: {
    id: string;
    originalName: string;
    detectedMime: string;
    size: number;
    status?: string;
    deletedAt?: string | null;
  };
};

function mediaUrl(postId: string, assetId: string) {
  return API_URL + '/posts/' + encodeURIComponent(postId) +
    '/media/' + encodeURIComponent(assetId);
}

/** The media URL is public ONLY when POST attachment ownership/scanning is validated by the API. */
export function PostAttachmentRail({ postId, attachments }: {
  postId: string;
  attachments?: PostAsset[];
}) {
  const { colors } = useAppearance();
  const [preview, setPreview] = useState<string | null>(null);
  const items = (attachments ?? []).filter(entry =>
    entry.asset.status !== 'QUARANTINED' && !entry.asset.deletedAt
  );
  if (!items.length) return null;

  async function open(asset: PostAsset['asset']) {
    const url = mediaUrl(postId, asset.id);
    if (asset.detectedMime.startsWith('image/')) {
      setPreview(url);
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('Aucune application compatible.');
      await Linking.openURL(url);
    } catch {
      Alert.alert('Lecture indisponible',
        'Impossible d’ouvrir ce média avec le lecteur installé.');
    }
  }

  return <>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail} nestedScrollEnabled>
      {items.map(item => {
        const mime = item.asset.detectedMime;
        const image = mime.startsWith('image/');
        const video = mime.startsWith('video/');
        const audio = mime.startsWith('audio/');
        const url = mediaUrl(postId, item.asset.id);
        return (
          <Pressable key={item.asset.id}
            accessibilityRole="button"
            accessibilityLabel={'Ouvrir ' + item.asset.originalName}
            onPress={event => { event.stopPropagation(); void open(item.asset); }}
            style={[styles.asset, {backgroundColor:colors.backgroundAccent,borderColor:colors.border}]}>
            {image ? <Image style={styles.preview} source={{uri:url}} resizeMode="cover"/> :
              <View style={styles.placeholder}>
                <Text style={{fontSize:28,color:colors.accent}}>{video?'▶':audio?'♫':'▤'}</Text>
                <Text style={[styles.type,{color:colors.muted}]}>
                  {video?'Vidéo':audio?'Musique':'Fichier'}
                </Text>
              </View>}
            <View style={styles.caption}>
              <Text numberOfLines={1} style={{fontSize:12,fontWeight:'600',color:colors.text}}>
                {item.asset.originalName}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
    <Modal visible={Boolean(preview)} animationType="fade"
      onRequestClose={() => setPreview(null)}>
      <View style={styles.viewer}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer l’image"
          onPress={() => setPreview(null)} style={styles.close}>
          <Text style={{color:'#fff',fontSize:18,fontWeight:'700'}}>✕</Text>
        </Pressable>
        {preview ? <Image source={{uri:preview}} resizeMode="contain"
          style={styles.fullImage}/> : null}
      </View>
    </Modal>
  </>;
}

const styles=StyleSheet.create({
  rail:{gap:7,paddingVertical:4},
  asset:{width:208,height:210,borderRadius:18,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth},
  preview:{width:'100%',height:174},
  placeholder:{height:174,alignItems:'center',justifyContent:'center',gap:5},
  type:{fontSize:13,fontWeight:'600'},
  caption:{paddingHorizontal:11,justifyContent:'center',height:34},
  viewer:{flex:1,backgroundColor:'#050609',justifyContent:'center'},
  fullImage:{flex:1,width:'100%'},
  close:{position:'absolute',right:17,top:42,zIndex:10,width:48,height:48,
    backgroundColor:'rgba(255,255,255,.15)',borderRadius:24,
    alignItems:'center',justifyContent:'center'}
});
