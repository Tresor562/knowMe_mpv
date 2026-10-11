import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';

type Note = {
  id: string;
  userId: string;
  content: string;
  updatedAt: string;
  expiresAt: string;
  user: {id:string;username:string;displayName:string;avatarUrl?:string|null};
};

export function DailyNotesRail({ userId }: {userId:string}) {
  const { colors } = useAppearance();
  const { locale } = useI18n();
  const en = locale === 'en';
  const [notes,setNotes] = useState<Note[]>([]);
  const [editorOpen,setEditorOpen] = useState(false);
  const [draft,setDraft] = useState('');
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const own = notes.find(note => note.userId === userId);
  const friends = notes.filter(note => note.userId !== userId);

  const load = useCallback(async () => {
    const response = await apiFetch<Note[]>('/daily-notes');
    const now = Date.now();
    setNotes(response.filter(note => new Date(note.expiresAt).getTime() > now));
  }, []);

  useEffect(() => {
    let alive = true;
    void apiFetch<Note[]>('/daily-notes')
      .then(response => {
        if (alive) setNotes(response.filter(note => new Date(note.expiresAt).getTime() > Date.now()));
      })
      .catch(cause => {
        if (alive) setError(cause instanceof Error ? cause.message : 'Pensées indisponibles.');
      })
      .finally(() => {if(alive)setLoading(false);});
    return () => {alive=false;};
  }, [userId]);

  async function publish() {
    const content=draft.trim();
    if (!content || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch('/daily-notes', {method:'POST',body:JSON.stringify({content})});
      await load();
      setEditorOpen(false);
      setDraft('');
    } catch (cause) {
      Alert.alert(en?'Unable to publish':'Publication impossible',
        cause instanceof Error?cause.message:(en?'Try again.':'Réessaie.'));
    } finally {setBusy(false);}
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch('/daily-notes/me',{method:'DELETE'});
      await load();
      setDraft('');
      setEditorOpen(false);
    } catch (cause) {
      Alert.alert(en?'Unable to delete':'Suppression impossible',
        cause instanceof Error?cause.message:(en?'Try again.':'Réessaie.'));
    } finally {setBusy(false);}
  }

  function openEditor() {
    setDraft(own?.content ?? '');
    setEditorOpen(true);
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.heading}>
        <Text style={[styles.title,{color:colors.text}]}>
          {en?'Daily thoughts':'Pensées du jour'}
        </Text>
        <Text style={[styles.caption,{color:colors.muted}]}>
          {en?'Friends · 24h':'Amis · 24 h'}
        </Text>
      </View>
      {loading && <ActivityIndicator size="small" color={colors.accent}/>}
      {!!error && <Pressable accessibilityRole="button" onPress={()=>{setError('');void load().catch(cause=>setError(String(cause)));}}>
        <Text numberOfLines={2} style={[styles.caption,{color:colors.danger}]}>{error} · {en?'Retry':'Réessayer'}</Text>
      </Pressable>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}>
        <Pressable style={styles.noteItem} accessibilityRole="button"
          accessibilityLabel={own
            ? en?'Edit your daily thought':'Modifier ta pensée du jour'
            : en?'Add a daily thought':'Ajouter une pensée du jour'}
          onPress={openEditor}>
          <View style={[styles.noteBubble,{borderColor:colors.border,backgroundColor:colors.surfaceGlass}]}>
            <Text numberOfLines={3} style={[styles.noteText,{color:colors.text}]}>
              {own?.content ?? '+'}
            </Text>
          </View>
          <View style={[styles.avatar,{backgroundColor:colors.backgroundAccent,borderColor:colors.accent}]}>
            <Text style={{color:colors.accent,fontSize:21,fontWeight:'700'}}>+</Text>
          </View>
          <Text numberOfLines={1} style={[styles.label,{color:colors.muted}]}>
            {en?'My thought':'Ma pensée'}
          </Text>
        </Pressable>
        {friends.map(note=><View key={note.id} style={styles.noteItem}>
          <View style={[styles.noteBubble,{borderColor:colors.border,backgroundColor:colors.surfaceGlass}]}>
            <Text numberOfLines={3} style={[styles.noteText,{color:colors.text}]}>
              {note.content}
            </Text>
          </View>
          <View style={[styles.avatar,{backgroundColor:colors.backgroundAccent,borderColor:colors.border}]}>
            {note.user.avatarUrl
              ? <Image source={{uri:note.user.avatarUrl}} style={styles.avatarImage}/>
              : <Text style={{color:colors.accent,fontSize:17,fontWeight:'800'}}>
                  {Array.from(note.user.displayName)[0] ?? '?'}
                </Text>}
          </View>
          <Text numberOfLines={1} style={[styles.label,{color:colors.muted}]}>
            {note.user.displayName}
          </Text>
        </View>)}
      </ScrollView>
      <Modal visible={editorOpen} transparent animationType="slide"
        onRequestClose={()=>{if(!busy)setEditorOpen(false);}}>
        <View style={styles.scrim}>
          <View style={[styles.sheet,{backgroundColor:colors.surface,borderColor:colors.border}]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle,{color:colors.text}]}>
                {en?'Your daily thought':'Ta pensée du jour'}
              </Text>
              <Pressable accessibilityRole="button"
                accessibilityLabel={en?'Close editor':'Fermer la rédaction'}
                disabled={busy} onPress={()=>setEditorOpen(false)}
                style={styles.close}>
                <Text style={{color:colors.text,fontSize:26}}>×</Text>
              </Pressable>
            </View>
            <Text style={[styles.explainer,{color:colors.muted}]}>
              {en?'Your friends can see this for 24 hours.':'Tes amis peuvent voir cette pensée pendant 24 heures.'}
            </Text>
            <TextInput multiline maxLength={100}
              accessibilityLabel={en?'Daily thought text':'Texte de la pensée'}
              placeholder={en?'What is on your mind?':'À quoi penses-tu ?'}
              placeholderTextColor={colors.muted}
              value={draft} onChangeText={setDraft}
              style={[styles.input,{color:colors.text,borderColor:colors.border,backgroundColor:colors.backgroundAccent}]}/>
            <Text style={[styles.caption,{color:colors.muted,textAlign:'right'}]}>
              {draft.length}/100
            </Text>
            <View style={styles.footer}>
              {own && <Pressable accessibilityRole="button" disabled={busy}
                onPress={()=>{void remove();}} style={styles.action}>
                <Text style={{color:colors.danger,fontWeight:'700'}}>
                  {en?'Delete':'Supprimer'}
                </Text>
              </Pressable>}
              <Pressable accessibilityRole="button"
                disabled={busy || !draft.trim()}
                onPress={()=>{void publish();}}
                style={[styles.action,styles.submit,{backgroundColor:colors.accent,opacity:draft.trim()?1:.5}]}>
                <Text style={{color:colors.accentText,fontWeight:'800'}}>
                  {busy?(en?'Saving…':'Enregistrement…'):(en?'Publish':'Publier')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles=StyleSheet.create({
  wrapper:{gap:8,marginTop:2},
  heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:1},
  title:{fontSize:15,fontWeight:'800'},
  caption:{fontSize:11,lineHeight:17},
  rail:{gap:10,paddingVertical:7},
  noteItem:{width:94,alignItems:'center',gap:5},
  noteBubble:{width:94,minHeight:48,maxHeight:60,paddingHorizontal:7,paddingVertical:7,
    borderWidth:1,borderRadius:17,justifyContent:'center'},
  noteText:{fontSize:10,lineHeight:14,textAlign:'center'},
  avatar:{width:43,height:43,borderRadius:22,borderWidth:2,alignItems:'center',justifyContent:'center',overflow:'hidden'},
  avatarImage:{width:'100%',height:'100%'},
  label:{fontSize:11,textAlign:'center',maxWidth:93},
  scrim:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.5)'},
  sheet:{borderWidth:1,borderTopLeftRadius:26,borderTopRightRadius:26,padding:18,paddingBottom:36,gap:12},
  sheetHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  sheetTitle:{fontSize:19,fontWeight:'800',flex:1},
  close:{minHeight:44,minWidth:44,alignItems:'center',justifyContent:'center'},
  explainer:{fontSize:12,lineHeight:18},
  input:{minHeight:108,borderWidth:1,borderRadius:17,padding:13,fontSize:17,textAlignVertical:'top'},
  footer:{flexDirection:'row',justifyContent:'flex-end',gap:11},
  action:{minHeight:44,paddingHorizontal:15,borderRadius:14,alignItems:'center',justifyContent:'center'},
  submit:{minWidth:105}
});
