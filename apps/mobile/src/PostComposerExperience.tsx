import { useRef } from 'react';
import {
  Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View
} from 'react-native';
import type { SelectedAndroidMedia } from './AndroidMediaLibraryPicker';
import { useAppearance } from './AppearanceProvider';
import { Avatar, KnowMeIcon, PressScale } from './ui/KnowMeUI';

/** One dedicated, full-screen post editor.
 * It only exposes actions actually supported by the current posts API.
 * Photos are selected through the shared KnowMe gallery owned by the feed.
 * Keeping the draft in FeedExperience means backing out never silently deletes it. */
export function PostComposerExperience({
  visible,
  author,
  content,
  onChangeContent,
  media,
  canAttachPhoto,
  onChoosePhoto,
  onRemovePhoto,
  onPublish,
  publishing,
  onClose
}: {
  visible: boolean;
  author: { displayName: string; username: string; avatarUrl?: string | null };
  content: string;
  onChangeContent: (value: string) => void;
  media: SelectedAndroidMedia | null;
  canAttachPhoto: boolean;
  onChoosePhoto: () => void;
  onRemovePhoto: () => void;
  onPublish: () => void;
  publishing: boolean;
  onClose: () => void;
}) {
  const { colors } = useAppearance();
  const inputRef = useRef<TextInput>(null);
  const canPublish = content.trim().length > 0 && !publishing;

  function insertMention() {
    onChangeContent(content + (content && !content.endsWith(' ') ? ' ' : '') + '@');
    inputRef.current?.focus();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={false}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Retour au fil"
            disabled={publishing} onPress={onClose} style={styles.back}>
            <KnowMeIcon name="back" size={22} color={colors.text}/>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Créer une publication</Text>
          <PressScale accessibilityRole="button" accessibilityLabel="Publier"
            disabled={!canPublish} onPress={onPublish}
            style={[styles.publishTop, { backgroundColor: canPublish ? colors.accent : colors.backgroundAccent }]}>
            <Text style={{color:canPublish?colors.accentText:colors.muted,fontWeight:'800',fontSize:13}}>
              {publishing ? 'Envoi…' : 'Publier'}
            </Text>
          </PressScale>
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.inner}>
          <View style={styles.authorRow}>
            <Avatar uri={author.avatarUrl} name={author.displayName} size={47}/>
            <View style={styles.authorDetails}>
              <Text style={[styles.authorName,{color:colors.text}]} numberOfLines={1}>{author.displayName}</Text>
              <View style={[styles.audience,{backgroundColor:colors.backgroundAccent}]}>
                <Text style={{color:colors.muted,fontSize:12,fontWeight:'700'}}>Public</Text>
              </View>
            </View>
          </View>

          <TextInput
            ref={inputRef}
            multiline
            value={content}
            onChangeText={onChangeContent}
            placeholder="Qu’as-tu envie de partager ?"
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            autoFocus={false}
            textAlignVertical="top"
            style={[styles.bodyInput,{color:colors.text}]}
            accessibilityLabel="Texte de la publication"
          />

          {media ? (
            <View style={[styles.previewBox,{borderColor:colors.border}]}>
              <Image source={{uri:media.uri}} style={styles.preview} resizeMode="contain"/>
              <Pressable accessibilityRole="button" accessibilityLabel="Retirer la photo"
                disabled={publishing} onPress={onRemovePhoto}
                style={[styles.previewRemove,{backgroundColor:colors.surface}]}>
                <KnowMeIcon name="close" size={18} color={colors.text}/>
              </Pressable>
            </View>
          ) : null}
          <Text style={[styles.counter,{color:colors.muted}]}>{content.length} caractères</Text>

          <View style={[styles.actions,{borderTopColor:colors.border}]}>
            <Text style={[styles.actionsTitle,{color:colors.text}]}>Ajouter à ta publication</Text>
            {canAttachPhoto ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Choisir dans la Galerie KnowMe"
                disabled={publishing} onPress={onChoosePhoto}
                style={[styles.actionRow,{borderBottomColor:colors.border}]}>
                <View style={[styles.actionIcon,{backgroundColor:colors.backgroundAccent}]}>
                  <KnowMeIcon name="create" size={19} color={colors.accent}/>
                </View>
                <Text style={[styles.actionName,{color:colors.text}]}>Photo · Galerie KnowMe</Text>
                <KnowMeIcon name="arrow" size={17} color={colors.muted}/>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Mentionner une personne"
              disabled={publishing} onPress={insertMention}
              style={styles.actionRow}>
              <View style={[styles.actionIcon,{backgroundColor:colors.backgroundAccent}]}>
                <KnowMeIcon name="profile" size={19} color={colors.accent}/>
              </View>
              <Text style={[styles.actionName,{color:colors.text}]}>Mentionner une personne</Text>
              <KnowMeIcon name="arrow" size={17} color={colors.muted}/>
            </Pressable>
          </View>
        </ScrollView>
        <View style={[styles.footer,{borderTopColor:colors.border,backgroundColor:colors.background}]}>
          <Text numberOfLines={2} style={{color:colors.muted,fontSize:12,flex:1}}>
            Ta publication sera visible publiquement.
          </Text>
          <PressScale accessibilityRole="button" accessibilityLabel="Confirmer la publication"
            disabled={!canPublish} onPress={onPublish}
            style={[styles.footerButton,{backgroundColor:canPublish?colors.accent:colors.backgroundAccent}]}>
            <Text style={{color:canPublish?colors.accentText:colors.muted,fontWeight:'800'}}>
              {publishing ? 'Publication…' : 'Publier'}
            </Text>
          </PressScale>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles=StyleSheet.create({
  root:{flex:1},
  toolbar:{height:58,paddingHorizontal:12,borderBottomWidth:StyleSheet.hairlineWidth,
    flexDirection:'row',alignItems:'center',gap:10},
  back:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},
  title:{fontSize:17,fontWeight:'800',flex:1},
  publishTop:{minHeight:39,minWidth:78,paddingHorizontal:14,borderRadius:19,
    alignItems:'center',justifyContent:'center'},
  scroll:{flex:1},
  inner:{paddingHorizontal:16,paddingTop:14,paddingBottom:32},
  authorRow:{flexDirection:'row',alignItems:'center',gap:12},
  authorDetails:{flex:1,alignItems:'flex-start',gap:6},
  authorName:{fontWeight:'800',fontSize:15},
  audience:{borderRadius:12,minHeight:28,justifyContent:'center',paddingHorizontal:11},
  bodyInput:{minHeight:190,fontSize:19,lineHeight:27,paddingTop:20,paddingBottom:16},
  previewBox:{position:'relative',borderWidth:StyleSheet.hairlineWidth,borderRadius:16,overflow:'hidden'},
  preview:{height:240,width:'100%'},
  previewRemove:{position:'absolute',right:12,top:10,height:38,width:38,borderRadius:19,
    alignItems:'center',justifyContent:'center'},
  counter:{textAlign:'right',fontSize:11,marginTop:7,marginBottom:18},
  actions:{borderTopWidth:StyleSheet.hairlineWidth,paddingTop:15},
  actionsTitle:{fontSize:14,fontWeight:'800',marginBottom:4},
  actionRow:{flexDirection:'row',alignItems:'center',minHeight:58,gap:12,
    borderBottomWidth:StyleSheet.hairlineWidth},
  actionIcon:{height:36,width:36,borderRadius:13,alignItems:'center',justifyContent:'center'},
  actionName:{fontSize:14,fontWeight:'700',flex:1},
  footer:{minHeight:70,borderTopWidth:StyleSheet.hairlineWidth,
    paddingHorizontal:16,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:14},
  footerButton:{minHeight:44,borderRadius:20,paddingHorizontal:18,
    alignItems:'center',justifyContent:'center'}
});
