import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { useAppearance } from './AppearanceProvider';
import { getMobileStickerCatalog, MobileStickerCatalog } from './stickers';
import { GlassSurface } from './ui/KnowMeUI';

export function LinkedStickerExperience({
  packKey, stickerKey, onBack
}: { packKey: string; stickerKey?: string | null; onBack: () => void }) {
  const { colors } = useAppearance();
  const [catalog, setCatalog] = useState<MobileStickerCatalog | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setCatalog(null);
    setError('');
    void getMobileStickerCatalog()
      .then(data => { if (live) setCatalog(data); })
      .catch(() => { if (live) setError('Pack indisponible ou inaccessible.'); });
    return () => { live = false; };
  },[packKey]);

  const pack = catalog?.packs.find(item => item.key === packKey);
  return (
    <View style={{flex:1,backgroundColor:colors.background,padding:14}}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
        <Text style={{color:colors.accent,fontSize:16}}>‹ Retour</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text> : null}
      {!catalog && !error ? <ActivityIndicator color={colors.accent} /> : null}
      {catalog && !pack ? <Text style={{color:colors.text}}>Ce pack n’existe plus.</Text> : null}
      {pack ? (
        <ScrollView contentContainerStyle={{gap:14,paddingBottom:40}}>
          <Text style={{color:colors.text,fontSize:24,fontWeight:'800'}}>{pack.name}</Text>
          <Text style={{color:colors.muted}}>{pack.description}</Text>
          <Pressable accessibilityRole="button"
            onPress={() => { void Share.share({message:buildKnowMePublicLink({kind:'sticker-pack',id:pack.key})}); }}
            style={[styles.action,{backgroundColor:colors.backgroundAccent}]}>
            <Text style={{color:colors.accent}}>↗ Partager le pack</Text>
          </Pressable>
          {pack.stickers.map(sticker => (
            <GlassSurface key={sticker.key} strength="soft" borderRadius={20}
              style={{padding:14,borderWidth:stickerKey === sticker.key ? 2 : 0,borderColor:colors.accent}}>
              <Text accessibilityLabel={sticker.accessibilityLabel} style={{fontSize:46,textAlign:'center'}}>{sticker.glyph}</Text>
              <Text style={{color:colors.text,fontSize:16,textAlign:'center',fontWeight:'700'}}>{sticker.label}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Partager le sticker ${sticker.label}`}
                onPress={() => { void Share.share({message:buildKnowMePublicLink({kind:'sticker',id:`${pack.key}__${sticker.key}`})}); }}
                style={[styles.action,{backgroundColor:colors.backgroundAccent}]}>
                <Text style={{color:colors.accent,textAlign:'center'}}>↗ Lien du sticker</Text>
              </Pressable>
            </GlassSurface>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  back: {paddingVertical:9,paddingHorizontal:5,alignSelf:'flex-start'},
  action: {padding:12,borderRadius:16,alignSelf:'stretch'}
});
