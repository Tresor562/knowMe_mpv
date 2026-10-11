import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  Pressable, SafeAreaView, StyleSheet, Text, TextInput, View
} from 'react-native';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';
import { Avatar, KnowMeIcon } from './ui/KnowMeUI';

export function PostEditorModal({
  visible, mode, initialValue, author, busy, onClose, onSave
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  initialValue: string;
  author?: {displayName: string; avatarUrl?: string | null};
  busy: boolean;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}) {
  const { colors } = useAppearance();
  const { locale } = useI18n();
  const en = locale === 'en';
  const [content, setContent] = useState(initialValue);
  useEffect(() => {
    if (visible) setContent(initialValue);
  }, [initialValue, visible, mode]);
  const valid = content.trim().length > 0 && content.trim().length <= 2000;

  function dismiss() {
    if (busy) return;
    if (content !== initialValue) {
      Alert.alert(
        en ? 'Discard changes?' : 'Abandonner les modifications ?',
        en ? 'Your draft will not be published.' : 'Votre texte ne sera pas publié.',
        [
          {text:en?'Continue writing':'Continuer',style:'cancel'},
          {text:en?'Discard':'Abandonner',style:'destructive',onPress:onClose}
        ]
      );
    } else onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={dismiss}>
      <SafeAreaView style={[styles.root,{backgroundColor:colors.background}]}>
        <KeyboardAvoidingView style={styles.layout} behavior={Platform.OS === 'ios'?'padding':undefined}>
          <View style={[styles.header,{borderBottomColor:colors.border}]}>
            <Pressable accessibilityRole="button" accessibilityLabel={en?'Close':'Fermer'}
              onPress={dismiss} style={styles.iconButton}>
              <KnowMeIcon name="back" color={colors.text} size={22}/>
            </Pressable>
            <Text style={[styles.title,{color:colors.text}]}>
              {mode==='create'?(en?'Create post':'Créer une publication'):(en?'Edit post':'Modifier la publication')}
            </Text>
            <Pressable accessibilityRole="button" disabled={!valid||busy}
              accessibilityState={{disabled:!valid||busy}}
              onPress={()=>void onSave(content.trim())}
              style={[styles.saveButton,{backgroundColor:colors.accent},(!valid||busy)&&styles.disabled]}>
              {busy?<ActivityIndicator size="small" color={colors.accentText}/>:
                <Text style={[styles.saveText,{color:colors.accentText}]}>
                  {mode==='create'?(en?'Post':'Publier'):(en?'Save':'Enregistrer')}
                </Text>}
            </Pressable>
          </View>

          <View style={styles.identity}>
            <Avatar uri={author?.avatarUrl} name={author?.displayName??'KnowMe'} size={48}/>
            <View style={styles.identityCopy}>
              <Text numberOfLines={1} style={[styles.name,{color:colors.text}]}>
                {author?.displayName??'KnowMe'}
              </Text>
              <Text style={{color:colors.muted,fontSize:12}}>
                {en?'Public post':'Publication publique'}
              </Text>
            </View>
          </View>

          <TextInput
            style={[styles.editor,{color:colors.text}]}
            placeholder={en?'What is on your mind?':'Quoi de neuf ?'}
            placeholderTextColor={colors.muted}
            multiline
            value={content}
            onChangeText={setContent}
            maxLength={2000}
            autoFocus
            editable={!busy}
            textAlignVertical="top"
            accessibilityLabel={en?'Post content':'Contenu de la publication'}
          />
          <View style={[styles.footer,{borderTopColor:colors.border}]}>
            <Text style={{color:colors.muted,fontSize:12}}>
              {en?'Text posts are available; multimedia attachments require the media API.':
                'Publication texte disponible. Les fichiers multimédias nécessitent l’API médias.'}
            </Text>
            <Text style={[styles.counter,{color:colors.muted}]}>{content.length}/2000</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles=StyleSheet.create({
  root:{flex:1},
  layout:{flex:1},
  header:{minHeight:62,flexDirection:'row',alignItems:'center',gap:9,
    paddingHorizontal:13,paddingVertical:8,borderBottomWidth:1},
  iconButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  title:{flex:1,fontWeight:'800',fontSize:17},
  saveButton:{minHeight:44,minWidth:77,borderRadius:14,paddingHorizontal:12,alignItems:'center',justifyContent:'center'},
  saveText:{fontSize:13,fontWeight:'800'},
  disabled:{opacity:.45},
  identity:{flexDirection:'row',alignItems:'center',gap:12,padding:16},
  identityCopy:{minWidth:0,flex:1,gap:4},
  name:{fontSize:16,fontWeight:'800'},
  editor:{flex:1,paddingHorizontal:20,paddingTop:15,fontSize:22,lineHeight:31},
  footer:{borderTopWidth:1,paddingHorizontal:17,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:9},
  counter:{minWidth:54,textAlign:'right',fontSize:11}
});
