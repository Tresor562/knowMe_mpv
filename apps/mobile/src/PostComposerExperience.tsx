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
  onRemoveMedia,
  onPublish,
  publishing,
  offline,
  draftNotice,
  onClose
}: {
  visible: boolean;
  author: { displayName: string; username: string; avatarUrl?: string | null };
  content: string;
  onChangeContent: (value: string) => void;
  media: SelectedAndroidMedia[];
  canAttachPhoto: boolean;
  onChoosePhoto: () => void;
  onRemovePhoto: () => void;
  onRemoveMedia: (index: number) => void;
  onPublish: () => void;
  publishing: boolean;
  offline?: boolean;
  draftNotice?: string;
  onClose: () => void;
}) {
  const { colors } = useAppearance();
  const inputRef = useRef<TextInput>(null);
  const canPublish = (content.trim().length > 0 || media.length > 0) && !publishing && !offline;

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

          {media.length>0 ? <View style={[styles.previewBox,{borderColor:colors.border}]}>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:3}}>
              {media.slice(0,5).map((item,index)=><View key={item.uri}
                style={{width:media.length===1?'100%':index<2?'49%':'32%',
                  height:media.length===1?235:index<2?175:112,position:'relative',
                  borderRadius:4,overflow:'hidden',backgroundColor:colors.surface}}>
                {item.mime.startsWith('video/')?
                  <View style={[styles.videoAttachment,{backgroundColor:colors.backgroundAccent}]}>
                    <KnowMeIcon name="video-call" size={36} color={colors.accent}/>
                    <Text numberOfLines={2} style={[styles.videoAttachmentName,{color:colors.text}]}>
                      {item.name}
                    </Text>
                    <Text style={{fontSize:11,color:colors.muted}}>Vidéo MP4</Text>
                  </View>:
                  <Image source={{uri:item.uri}} style={{width:'100%',height:'100%'}} resizeMode="cover"/>}
                {index===4&&media.length>5?<View style={{position:'absolute',top:0,bottom:0,left:0,
                  right:0,backgroundColor:'#0009',justifyContent:'center',alignItems:'center'}}>
                  <Text style={{color:'#fff',fontSize:26,fontWeight:'800'}}>+{media.length-5}</Text>
                </View>:null}
                <Pressable accessibilityRole="button"
                  accessibilityLabel={`Retirer le média ${index+1} : ${item.name}`}
                  disabled={publishing} onPress={()=>onRemoveMedia(index)}
                  style={[styles.tileRemove,{backgroundColor:'rgba(0,0,0,.65)'}]}>
                  <KnowMeIcon name="close" color="#fff" size={18}/>
                </Pressable>
              </View>)}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.attachmentList}
              accessibilityLabel="Médias joints à la publication">
              {media.map((item,index)=><View key={item.uri+':'+index}
                style={[styles.attachmentChip,{backgroundColor:colors.backgroundAccent}]}>
                <Text numberOfLines={1} style={{color:colors.text,maxWidth:180,fontSize:12}}>
                  {index+1}. {item.name}
                </Text>
                <Pressable accessibilityRole="button"
                  accessibilityLabel={`Retirer ${item.name}`} disabled={publishing}
                  onPress={()=>onRemoveMedia(index)} style={styles.attachmentRemove}>
                  <KnowMeIcon name="close" size={18} color={colors.muted}/>
                </Pressable>
              </View>)}
            </ScrollView>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginTop:8}}>
              <Text style={{color:colors.muted,fontSize:12}}>{media.length} média(s) sélectionné(s)</Text>
              <Pressable accessibilityRole="button" disabled={publishing} onPress={onRemovePhoto}
                style={[styles.previewRemove,{backgroundColor:colors.backgroundAccent}]}>
                <KnowMeIcon name="close" size={17} color={colors.text}/>
                <Text style={{color:colors.text}}>Retirer tout</Text>
              </Pressable>
            </View>
          </View> : null}
          <Text style={[styles.counter,{color:colors.muted}]}>{content.length} caractères</Text>
          {offline ? <Text accessibilityRole="alert" style={[styles.draftStatus,{color:colors.text,backgroundColor:colors.backgroundAccent}]}>
            Hors ligne : prépare ta publication. L'envoi nécessite une connexion.
          </Text> : null}
          {Boolean(draftNotice) ? <Text accessibilityRole="text"
            style={[styles.draftStatus,{color:colors.muted,backgroundColor:colors.backgroundAccent}]}>
            {draftNotice}
          </Text> : null}

          <View style={[styles.actions,{borderTopColor:colors.border}]}>
            <Text style={[styles.actionsTitle,{color:colors.text}]}>Ajouter à ta publication</Text>
            {canAttachPhoto ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Choisir dans la Galerie KnowMe"
                disabled={publishing} onPress={onChoosePhoto}
                style={[styles.actionRow,{borderBottomColor:colors.border}]}>
                <View style={[styles.actionIcon,{backgroundColor:colors.backgroundAccent}]}>
                  <KnowMeIcon name="create" size={19} color={colors.accent}/>
                </View>
                <Text style={[styles.actionName,{color:colors.text}]}>Photos et vidéos · Galerie KnowMe</Text>
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
  videoAttachment:{flex:1,alignItems:'center',justifyContent:'center',
    paddingHorizontal:12,paddingVertical:16,gap:8},
  videoAttachmentName:{fontSize:12,fontWeight:'700',textAlign:'center',maxWidth:'100%'},
  tileRemove:{position:'absolute',top:5,right:5,height:38,width:38,borderRadius:19,
    alignItems:'center',justifyContent:'center'},
  attachmentList:{paddingVertical:9,paddingHorizontal:8,gap:7},
  attachmentChip:{flexDirection:'row',alignItems:'center',minHeight:44,gap:5,
    borderRadius:14,paddingLeft:10,paddingRight:2},
  attachmentRemove:{width:42,height:44,alignItems:'center',justifyContent:'center'},
  preview:{height:240,width:'100%'},
  previewRemove:{position:'absolute',right:12,top:10,height:38,width:38,borderRadius:19,
    alignItems:'center',justifyContent:'center'},
  counter:{textAlign:'right',fontSize:11,marginTop:7,marginBottom:12},
  draftStatus:{fontSize:12,lineHeight:18,borderRadius:12,marginBottom:8,padding:10},
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
