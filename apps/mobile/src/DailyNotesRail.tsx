import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, Image, Modal, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';

type DailyNote = {
  userId: string;
  content: string;
  expiresAt: string;
  user: { id: string; displayName: string; username: string; avatarUrl?: string | null };
};

export function DailyNotesRail({ userId }: { userId: string }) {
  const { colors } = useAppearance();
  const { locale } = useI18n();
  const en = locale === 'en';
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const next = await apiFetch<DailyNote[]>('/daily-notes');
      setNotes(next.filter(note => Date.parse(note.expiresAt) > Date.now()));
      setError('');
    } catch (cause) {
      setNotes([]);
      setError(cause instanceof Error ? cause.message :
        (en ? 'Notes are unavailable.' : 'Pensées indisponibles.'));
    } finally { setLoading(false); }
  }, [en]);

  useEffect(() => {
    void reload();
  }, [reload, userId]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setNow(Date.now());
        void reload();
      }
    });
    return () => { clearInterval(tick); subscription.remove(); };
  }, [reload]);

  const freshNotes = notes.filter(note => Date.parse(note.expiresAt) > now);
  const mine = freshNotes.find(note => note.userId === userId);
  const visible = [mine, ...freshNotes.filter(note => note.userId !== userId)]
    .filter((item): item is DailyNote => Boolean(item));

  function openEditor() {
    setDraft(mine?.content ?? '');
    setEditorOpen(true);
  }

  async function save() {
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      await apiFetch('/daily-notes/mine', { method: 'PUT', body: JSON.stringify({ content }) });
      setEditorOpen(false);
      await reload();
    } catch (cause) {
      Alert.alert(en ? 'Unable to publish' : 'Publication impossible',
        cause instanceof Error ? cause.message : (en ? 'Try again.' : 'Réessaie.'));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch('/daily-notes/mine', { method: 'DELETE' });
      setDraft('');
      setEditorOpen(false);
      await reload();
    } catch (cause) {
      Alert.alert(en ? 'Unable to delete' : 'Suppression impossible',
        cause instanceof Error ? cause.message : (en ? 'Try again.' : 'Réessaie.'));
    } finally { setBusy(false); }
  }

  return <View style={styles.container}>
    <View style={styles.titleRow}>
      <Text style={[styles.sectionTitle, {color:colors.text}]}>
        {en ? 'Daily thoughts' : 'Pensées du jour'}
      </Text>
      <Text style={[styles.helper, {color:colors.muted}]}>24 h</Text>
    </View>
    {loading ? <ActivityIndicator size="small" color={colors.accent}/> : null}
    {!!error && <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void reload(); }}>
      <Text style={[styles.helper, {color:colors.danger}]}>
        {error} · {en ? 'Retry' : 'Réessayer'}
      </Text>
    </Pressable>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail} nestedScrollEnabled>
      <Pressable accessibilityRole="button"
        accessibilityLabel={en ? 'Add or edit your thought' : 'Ajouter ou modifier ma pensée'}
        onPress={openEditor}
        style={styles.item}>
        <View style={[styles.avatar,{backgroundColor:colors.backgroundAccent,borderColor:colors.accent}]}>
          <Text style={{color:colors.accent,fontSize:25,fontWeight:'400'}}>
            {mine ? '✎' : '+'}
          </Text>
        </View>
        <Text numberOfLines={1} style={[styles.name,{color:colors.text}]}>
          {en ? 'Your thought' : 'Ma pensée'}
        </Text>
        <Text numberOfLines={2} style={[styles.thought,{color:colors.muted}]}>
          {mine?.content ?? (en ? 'Add note' : 'Ajouter')}
        </Text>
      </Pressable>
      {visible.filter(item => item.userId !== userId).map(note =>
        <Pressable key={note.userId} accessibilityRole="button"
          accessibilityLabel={note.user.displayName + ' : ' + note.content}
          onPress={() => Alert.alert(note.user.displayName,note.content)}
          style={styles.item}>
          <View style={[styles.avatar,{backgroundColor:colors.surfaceGlass,borderColor:colors.border}]}>
            {note.user.avatarUrl ?
              <Image source={{uri:note.user.avatarUrl}} style={styles.avatarImage}/> :
              <Text style={[styles.initial,{color:colors.accent}]}>{note.user.displayName[0] || '?'}</Text>}
          </View>
          <Text numberOfLines={1} style={[styles.name,{color:colors.text}]}>
            {note.user.displayName}
          </Text>
          <Text numberOfLines={2} style={[styles.thought,{color:colors.muted}]}>
            {note.content}
          </Text>
        </Pressable>
      )}
    </ScrollView>
    <Modal visible={editorOpen} transparent animationType="fade"
      onRequestClose={() => { if (!busy) setEditorOpen(false); }}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <Text style={[styles.sheetTitle,{color:colors.text}]}>
            {en ? 'Your daily thought' : 'Ta pensée du jour'}
          </Text>
          <Text style={[styles.helper,{color:colors.muted}]}>
            {en ? 'Visible to accepted friends for 24 hours. Separate from stories.'
              : 'Visible par tes amis acceptés pendant 24 h. Distincte des stories.'}
          </Text>
          <TextInput autoFocus multiline maxLength={80} value={draft} onChangeText={setDraft}
            placeholder={en ? 'What is on your mind?' : 'À quoi penses-tu ?'}
            placeholderTextColor={colors.muted} selectionColor={colors.accent}
            style={[styles.input,{color:colors.text,borderColor:colors.border,backgroundColor:colors.backgroundAccent}]}/>
          <Text style={[styles.helper,{color:colors.muted,textAlign:'right'}]}>
            {draft.length}/80
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void save()}
            disabled={busy || !draft.trim()}
            style={[styles.save,{backgroundColor:colors.accent,opacity:busy || !draft.trim() ? .5 : 1}]}>
            <Text style={{fontWeight:'800',color:colors.accentText}}>
              {busy ? (en ? 'Saving…' : 'Enregistrement…') : (en ? 'Share' : 'Publier')}
            </Text>
          </Pressable>
          {mine && <Pressable accessibilityRole="button" disabled={busy}
            onPress={() => void remove()} style={styles.cancel}>
            <Text style={{color:colors.danger,fontWeight:'700'}}>
              {en ? 'Delete thought' : 'Supprimer la pensée'}
            </Text>
          </Pressable>}
          <Pressable accessibilityRole="button" disabled={busy}
            onPress={() => setEditorOpen(false)} style={styles.cancel}>
            <Text style={{color:colors.muted}}>{en ? 'Cancel' : 'Annuler'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  container:{gap:9,paddingVertical:7},
  titleRow:{flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:4},
  sectionTitle:{fontSize:15,fontWeight:'800'},
  helper:{fontSize:12,lineHeight:17},
  rail:{gap:12,paddingHorizontal:3,paddingBottom:4},
  item:{width:83,alignItems:'center',gap:4,minHeight:114},
  avatar:{width:61,height:61,borderRadius:31,borderWidth:1,
    alignItems:'center',justifyContent:'center',overflow:'hidden'},
  avatarImage:{width:'100%',height:'100%',borderRadius:31},
  initial:{fontSize:21,fontWeight:'800'},
  name:{fontSize:11,fontWeight:'700',maxWidth:83},
  thought:{fontSize:10,textAlign:'center',lineHeight:13,maxWidth:83},
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.48)'},
  sheet:{borderTopLeftRadius:26,borderTopRightRadius:26,borderWidth:1,
    paddingHorizontal:19,paddingTop:24,paddingBottom:28,gap:12},
  sheetTitle:{fontSize:19,fontWeight:'800'},
  input:{minHeight:100,borderWidth:1,borderRadius:18,padding:15,
    fontSize:17,textAlignVertical:'top'},
  save:{minHeight:49,borderRadius:15,alignItems:'center',justifyContent:'center'},
  cancel:{minHeight:42,alignItems:'center',justifyContent:'center'}
});
