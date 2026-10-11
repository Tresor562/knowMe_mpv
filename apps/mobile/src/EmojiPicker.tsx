import { useMemo, useState } from 'react';
import {
  Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View
} from 'react-native';
import { KNOWME_ANIMATED_EMOJIS, KNOWME_CUSTOM_EMOJIS, KNOWME_MOTION_PACK_KEY } from '@knowme/animation-contract';
import { AnimatedEmoji } from './AnimatedEmoji';
import { KnowMeCustomEmoji } from './KnowMeCustomEmoji';
import { sendMobileSticker } from './stickers';
import { useAppearance } from './AppearanceProvider';
import { GlassSurface } from './ui/KnowMeUI';

const KEYWORDS: Record<string, string> = {
  '😀':'sourire heureux smile happy', '😂':'rire joie laugh',
  '🥹':'émotion touché', '😍':'amour yeux love', '🥰':'amour tendresse love',
  '❤️':'coeur amour heart love', '💙':'coeur bleu blue heart',
  '💜':'coeur violet purple heart', '😘':'bisou kiss',
  '😭':'pleurs tristesse cry', '🥺':'mignon supplie cute',
  '😎':'cool lunettes', '🤔':'réflexion penser think',
  '😱':'surprise peur', '🤯':'choc explosion', '🔥':'feu fire',
  '✨':'étoiles brillant', '🎉':'fête party', '👍':'pouce bravo like',
  '👏':'applaudir clap', '🙏':'merci prière thanks',
  '👀':'yeux regard eyes', '🫶':'coeur mains love', '👋':'salut coucou hello',
  '🎁':'cadeau gift', '🚀':'fusée rocket', '⭐':'étoile star',
  '⚡':'éclair lightning'
};
const EMOJIS = KNOWME_ANIMATED_EMOJIS.map(item => item.glyph);

export function EmojiPicker<T>({
  onInsert, onSent, conversationId
}: { onInsert: (emoji: string) => void; onSent: (message: T) => void; conversationId: string }) {
  const { colors, visual } = useAppearance();
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [sendingCustom, setSendingCustom] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return EMOJIS.filter(emoji => !query ||
      emoji.includes(query) || (KEYWORDS[emoji] ?? '').includes(query));
  }, [search]);
  const filteredCustom = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return KNOWME_CUSTOM_EMOJIS.filter(item => !query ||
      (item.key + ' ' + item.label + ' ' + item.keywords).toLocaleLowerCase().includes(query));
  }, [search]);
  const sections = search.trim()
    ? [{ title: 'Résultats', glyphs: filtered }]
    : [
      { title: 'Favoris · appui long pour modifier', glyphs: favorites },
      { title: 'Récents', glyphs: recent },
      { title: 'Expressions', glyphs: EMOJIS.slice(0, 16) },
      { title: 'Effets et gestes', glyphs: EMOJIS.slice(16) }
    ];

  function choose(emoji: string) {
    onInsert(emoji);
    setRecent(current => [emoji, ...current.filter(item => item !== emoji)].slice(0, 16));
  }
  function favorite(emoji: string) {
    setFavorites(current => current.includes(emoji)
      ? current.filter(item => item !== emoji)
      : [emoji, ...current].slice(0, 16));
  }

  async function sendCustom(stickerKey: string) {
    if (sendingCustom) return;
    setSendingCustom(stickerKey);
    try {
      const message = await sendMobileSticker<T>({
        conversationId, packKey: KNOWME_MOTION_PACK_KEY, stickerKey
      });
      onSent(message);
      setOpen(false);
    } catch (cause) {
      Alert.alert('Envoi impossible',cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setSendingCustom(null);
    }
  }

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Choisir un emoji animé"
      onPress={() => setOpen(true)}
      style={[styles.trigger, { backgroundColor: colors.backgroundAccent }]}>
      <Text style={styles.triggerGlyph}>😊</Text>
    </Pressable>
    <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}
          accessibilityLabel="Fermer le sélecteur d’emojis"/>
        <View style={styles.sheetWrap}>
          <GlassSurface strength="strong" borderRadius={visual.cardRadius} style={styles.sheet}>
            <View style={styles.head}>
              <Text style={[styles.title, {color: colors.text}]}>Emojis animés</Text>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)}
                style={styles.close}><Text style={[styles.closeLabel, {color: colors.accent}]}>Fermer</Text></Pressable>
            </View>
            <TextInput value={search} onChangeText={setSearch} placeholder="Rechercher un emoji"
              accessibilityLabel="Rechercher des emojis"
              placeholderTextColor={colors.muted}
              style={[styles.search, {backgroundColor: colors.backgroundAccent,
                color: colors.text, borderColor: colors.border}]}/>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="always"
              contentContainerStyle={styles.content}>
              {filteredCustom.length > 0 && <View style={styles.section}>
                  <Text style={[styles.sectionTitle,{color:colors.muted}]}>KnowMe Motion · exclusifs</Text>
                  <View style={styles.grid}>
                    {filteredCustom.map(item=>
                      <View key={item.key} style={[styles.customTile,{backgroundColor:colors.backgroundAccent}]}>
                        <KnowMeCustomEmoji packKey={KNOWME_MOTION_PACK_KEY}
                          stickerKey={item.key} size={49} onPress={() => void sendCustom(item.key)}/>
                        <Text style={[styles.customLabel,{color:colors.text}]} numberOfLines={1}>
                          {sendingCustom === item.key ? 'Envoi…' : item.label}
                        </Text>
                      </View>)}
                  </View>
                </View>}
              {sections.map(section => section.glyphs.length ? <View key={section.title} style={styles.section}>
                <Text style={[styles.sectionTitle, {color: colors.muted}]}>{section.title}</Text>
                <View style={styles.grid}>
                  {section.glyphs.map(glyph => <View key={glyph}
                    style={[styles.tile, {backgroundColor: colors.backgroundAccent}]}>
                    <AnimatedEmoji glyph={glyph} size={28} autoPlay={false}
                      onPress={() => choose(glyph)} onLongPress={() => favorite(glyph)}/>
                    {favorites.includes(glyph) && <Text style={[styles.star, {color: colors.accent}]}>★</Text>}
                  </View>)}
                </View>
              </View> : null)}
              {!filtered.length && !filteredCustom.length && search.trim() ? <Text style={{ color: colors.muted }}>Aucun emoji trouvé.</Text> : null}
            </ScrollView>
          </GlassSurface>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  trigger: {width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},
  triggerGlyph: {fontSize:24},
  overlay: {flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.5)'},
  sheetWrap: {paddingHorizontal:8,paddingBottom:16},
  sheet: {maxHeight:'64%',padding:14},
  head: {flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10},
  title: {fontSize:17,fontWeight:'700'},
  close: {minHeight:44,justifyContent:'center',paddingHorizontal:8},
  closeLabel: {fontSize:14,fontWeight:'700'},
  search: {borderRadius:14,borderWidth:1,paddingHorizontal:13,minHeight:44,marginBottom:10},
  list: {flexGrow:0},
  content: {paddingBottom:18},
  section: {paddingTop:10},
  sectionTitle: {fontSize:12,fontWeight:'700',marginBottom:8},
  grid: {flexDirection:'row',flexWrap:'wrap',gap:6},
  tile: {width:48,height:49,borderRadius:13,alignItems:'center',justifyContent:'center'},
  customTile:{width:99,minHeight:99,borderRadius:15,alignItems:'center',justifyContent:'center',padding:6},
  customLabel:{fontSize:10,marginTop:2,maxWidth:88,textAlign:'center'},
  star: {fontSize:10,position:'absolute',top:0,right:2}
});
