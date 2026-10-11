import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import {
  getMobileStickerCatalog,
  MobileStickerCatalog,
  sendMobileSticker
} from './stickers';
import { useAppearance } from './AppearanceProvider';
import { apiFetch } from './api';
import { ChatMediaAttachment } from './ChatMediaAttachment';

type RecentAsset = {id:string; purpose:string; visibility:string;
  conversationId?:string|null;detectedMime:string;status:string;deletedAt?:string|null};
import { GlassSurface } from './ui/KnowMeUI';

export function StickerLibraryExperience<T>({
  conversationId,
  onSent,
  compact = false
}: {
  conversationId: string;
  onSent: (message: T) => void;
  compact?: boolean;
}) {
  const { colors, visual } = useAppearance();
  const [visible, setVisible] = useState(false);
  const [catalog, setCatalog] = useState<MobileStickerCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [recentMedia,setRecentMedia] = useState<RecentAsset[]|null>(null);

  useEffect(() => {
    if (!visible || catalog || loading) return;
    setLoading(true);
    void getMobileStickerCatalog()
      .then(setCatalog)
      .catch((cause) => {
        Alert.alert(
          'Stickers indisponibles',
          cause instanceof Error ? cause.message : 'Réessaie plus tard.'
        );
      })
      .finally(() => setLoading(false));
  }, [catalog, loading, visible]);

  useEffect(()=>{
    if(!visible||recentMedia!==null)return;
    let live=true;
    void apiFetch<RecentAsset[]>('/media/mine')
      .then(assets=>{if(live)setRecentMedia(assets);})
      .catch(()=>{if(live)setRecentMedia([]);});
    return ()=>{live=false;};
  },[visible,recentMedia]);

  const saved = (recentMedia??[]).filter(item=>item.purpose==='MESSAGE'&&
    item.visibility==='CONVERSATION'&&item.conversationId===conversationId&&
    item.status==='AVAILABLE'&&!item.deletedAt&&
    ['image/gif','image/webp','image/png'].includes(item.detectedMime)).slice(0,9);

  async function resend(asset:RecentAsset){
    if(sending)return;
    setSending(asset.id);
    try{
      const kind = asset.detectedMime==='image/gif'?'GIF':'STICKER_IMAGE';
      const message=await apiFetch<T>(`/conversations/${encodeURIComponent(conversationId)}/media-messages`,{
        method:'POST',body:JSON.stringify({assetId:asset.id,kind})
      });
      onSent(message);
      setVisible(false);
    }catch(cause){
      Alert.alert('Envoi impossible',cause instanceof Error?cause.message:'Réessaie.');
    }finally{setSending(null);}
  }

  async function send(packKey: string, stickerKey: string) {
    const operation = `${packKey}:${stickerKey}`;
    if (sending) return;
    setSending(operation);
    try {
      const message = await sendMobileSticker<T>({
        conversationId,
        packKey,
        stickerKey
      });
      onSent(message);
      setVisible(false);
    } catch (cause) {
      Alert.alert(
        'Envoi impossible',
        cause instanceof Error ? cause.message : 'Réessaie.'
      );
    } finally {
      setSending(null);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir la bibliothèque de stickers"
        onPress={() => setVisible(true)}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.backgroundAccent,
            borderColor: colors.border,
            borderRadius: compact ? 22 : 999
          },
          compact && styles.compactTrigger
        ]}
      >
        <Text style={[styles.triggerText, { color: colors.text }]}>{compact ? '✨' : '✨ Stickers'}</Text>
      </Pressable>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheetWrap}>
            <GlassSurface strength="strong" borderRadius={visual.cardRadius} style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.flex}>
                <Text style={[styles.title, { color: colors.text }]}>Stickers KnowMe</Text>
                <Text style={[styles.muted, { color: colors.muted }]}>
                  Catalogue original fermé, sans fichier externe.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer la bibliothèque de stickers"
                onPress={() => setVisible(false)}
                style={[styles.close, { backgroundColor: colors.backgroundAccent }]}
              >
                <Text style={[styles.closeText, { color: colors.text }]}>Fermer</Text>
              </Pressable>
            </View>

            {loading && <ActivityIndicator size="large" color={colors.accent} />}
            <ScrollView contentContainerStyle={styles.content}>
              {saved.length>0&&<View style={styles.pack}>
                <Text style={[styles.packTitle,{color:colors.accent}]}>GIFs et stickers images récents</Text>
                <View style={styles.grid}>{saved.map(asset=><View key={asset.id}
                  style={[styles.recentTile,{borderColor:colors.border,backgroundColor:colors.backgroundAccent}]}>
                  <ChatMediaAttachment assetId={asset.id} kind={asset.detectedMime==='image/gif'?'GIF':'STICKER_IMAGE'}/>
                  <Pressable accessibilityRole="button" accessibilityLabel="Renvoyer ce média"
                    onPress={()=>void resend(asset)} disabled={Boolean(sending)}
                    style={[styles.recentButton,{backgroundColor:colors.accent}]}>
                    <Text style={[styles.label,{color:colors.accentText}]}>Envoyer</Text>
                  </Pressable>
                </View>)}</View>
              </View>}
              {catalog?.packs.map((pack) => (
                <View key={`${pack.key}:${pack.version}`} style={styles.pack}>
                  <Text style={[styles.packTitle, { color: colors.accent }]}>{pack.name}</Text>
                  <Text style={[styles.muted, { color: colors.muted }]}>{pack.description}</Text>
                  <View style={styles.grid}>
                    {pack.stickers.map((sticker) => {
                      const operation = `${pack.key}:${sticker.key}`;
                      return (
                        <Pressable
                          key={`${sticker.key}:${sticker.version}`}
                          accessibilityRole="button"
                          accessibilityLabel={`Envoyer le sticker ${sticker.label}`}
                          disabled={Boolean(sending)}
                          onPress={() => void send(pack.key, sticker.key)}
                          style={({ pressed }) => [
                            styles.sticker,
                            {
                              backgroundColor: colors.backgroundAccent,
                              borderColor: colors.border,
                              borderRadius: visual.controlRadius
                            },
                            pressed && styles.pressed,
                            sending && sending !== operation && styles.disabled
                          ]}
                        >
                          <Text style={styles.glyph}>{sticker.glyph}</Text>
                          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
                            {sending === operation ? 'Envoi…' : sticker.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            </GlassSurface>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,.55)'
  },
  sheetWrap: { padding: 12, paddingBottom: 18 },
  sheet: {
    maxHeight: '82%',
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12
  },
  flex: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800' },
  muted: { marginTop: 4 },
  close: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    
  },
  closeText: { fontWeight: '700' },
  content: { paddingBottom: 28 },
  pack: { marginTop: 14 },
  packTitle: { fontWeight: '800', fontSize: 16 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10
  },
  sticker: {
    width: '30%',
    minWidth: 92,
    minHeight: 88,
        padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  glyph: { fontSize: 34 },
  recentTile:{width:'47%',minHeight:160,borderWidth:1,borderRadius:14,padding:6,
    alignItems:'center',justifyContent:'space-between',gap:6,overflow:'hidden'},
  recentButton:{minHeight:44,width:'100%',alignItems:'center',justifyContent:'center',borderRadius:10},
  label: { marginTop: 5, fontSize: 12 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  disabled: { opacity: 0.45 },
  trigger: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    
  },
  compactTrigger: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center'
  },
  triggerText: { fontWeight: '800' }
});
