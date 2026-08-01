import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch, clearSession, hasSession, saveSession, SessionTokens } from './src/api';
import { SocialHub } from './src/SocialHub';

type Screen = 'home' | 'feed' | 'social' | 'challenges' | 'profile';
type User = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio?: string | null;
  knowCoins?: number;
};
type Post = {
  id: string;
  content: string;
  createdAt: string;
  author: { displayName: string; username: string };
  _count: { likes: number; comments: number };
};
type Challenge = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  questions: Array<{ id: string }>;
  participants: Array<{ id: string; userId?: string }>;
};
type NotificationCount = { unread: number };

function Field(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor="#789187" style={styles.input} {...props} />;
}

function PrimaryButton({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, (pressed || disabled) && styles.buttonMuted]}>
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const tokens = await apiFetch<SessionTokens>(mode === 'login' ? '/auth/login' : '/auth/register', {
        method: 'POST',
        body: JSON.stringify(mode === 'login'
          ? { identifier: identifier.trim(), password }
          : { displayName: displayName.trim(), username: username.trim(), email: email.trim(), password })
      });
      await saveSession(tokens);
      await onAuthenticated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentification impossible.');
    } finally { setBusy(false); }
  }

  const valid = password.length >= 8 && (mode === 'login'
    ? identifier.trim().length > 0
    : displayName.trim().length > 0 && username.trim().length > 0 && email.includes('@'));

  return (
    <KeyboardAvoidingView style={styles.authRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>K</Text></View>
        <Text style={styles.logo}>KnowMe</Text>
        <Text style={styles.subtitle}>Mieux se connaître, vraiment.</Text>
        <View style={styles.card}>
          <View style={styles.segmented}>
            {(['login', 'register'] as const).map((value) => (
              <Pressable key={value} onPress={() => { setMode(value); setError(''); }} style={[styles.segment, mode === value && styles.segmentActive]}>
                <Text style={[styles.segmentText, mode === value && styles.segmentTextActive]}>{value === 'login' ? 'Connexion' : 'Inscription'}</Text>
              </Pressable>
            ))}
          </View>
          {mode === 'register' && <>
            <Field value={displayName} onChangeText={setDisplayName} placeholder="Nom affiché" />
            <Field value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Pseudo" />
            <Field value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" />
          </>}
          {mode === 'login' && <Field value={identifier} onChangeText={setIdentifier} autoCapitalize="none" placeholder="Email ou pseudo" />}
          <Field value={password} onChangeText={setPassword} secureTextEntry placeholder="Mot de passe" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton disabled={!valid || busy} onPress={() => void submit()} title={busy ? 'Chargement…' : mode === 'login' ? 'Entrer dans KnowMe' : 'Créer mon profil'} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HomeScreen({ user, openSocial }: { user: User; openSocial: () => void }) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [items, count] = await Promise.all([
        apiFetch<Challenge[]>('/challenges'),
        apiFetch<NotificationCount>('/notifications/unread-count')
      ]);
      setChallenges(items);
      setUnread(count.unread);
    } catch (cause) {
      Alert.alert('Actualisation impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />} contentContainerStyle={styles.screenContent}>
      <Text style={styles.eyebrow}>BON RETOUR</Text>
      <Text style={styles.heading}>Salut, {user.displayName}</Text>
      <Text style={styles.muted}>Ton univers KnowMe est prêt.</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}><Text style={styles.statValue}>{challenges.filter((item) => item.status === 'ACTIVE').length}</Text><Text style={styles.statLabel}>Défis actifs</Text></View>
        <Pressable onPress={openSocial} style={styles.statCard}><Text style={styles.statValue}>{unread}</Text><Text style={styles.statLabel}>Notifications</Text></Pressable>
        <View style={styles.statCard}><Text style={styles.statValue}>{user.knowCoins ?? 0}</Text><Text style={styles.statLabel}>KnowCoins</Text></View>
      </View>
      <Pressable onPress={openSocial} style={styles.card}><Text style={styles.cardTitle}>Mon cercle</Text><Text style={styles.cardText}>Retrouve tes amis, tes messages et toutes tes notifications au même endroit.</Text></Pressable>
      <View style={styles.card}><Text style={styles.cardTitle}>Objectif du jour</Text><Text style={styles.cardText}>Découvre un nouveau point commun avec une personne proche.</Text></View>
    </ScrollView>
  );
}

function FeedScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setPosts(await apiFetch<Post[]>('/posts/feed')); }
    catch (cause) { Alert.alert('Fil indisponible', cause instanceof Error ? cause.message : 'Réessaie.'); }
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function publish() {
    if (!content.trim()) return;
    setBusy(true);
    try {
      await apiFetch('/posts', { method: 'POST', body: JSON.stringify({ content: content.trim() }) });
      setContent('');
      await load();
    } catch (cause) { Alert.alert('Publication impossible', cause instanceof Error ? cause.message : 'Réessaie.'); }
    finally { setBusy(false); }
  }

  async function like(postId: string) {
    try {
      const result = await apiFetch<{ liked: boolean }>(`/posts/${postId}/like`, { method: 'POST' });
      setPosts((current) => current.map((post) => post.id === postId
        ? { ...post, _count: { ...post._count, likes: Math.max(0, post._count.likes + (result.liked ? 1 : -1)) } }
        : post));
    } catch (cause) { Alert.alert('Action impossible', cause instanceof Error ? cause.message : 'Réessaie.'); }
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      contentContainerStyle={styles.screenContent}
      ListHeaderComponent={<View><Text style={styles.eyebrow}>ACTIVITÉ</Text><Text style={styles.heading}>Fil KnowMe</Text><View style={styles.card}><Field multiline value={content} onChangeText={setContent} placeholder="Partage une découverte, une question ou un défi…" /><PrimaryButton disabled={!content.trim() || busy} onPress={() => void publish()} title={busy ? 'Publication…' : 'Publier'} /></View></View>}
      ListEmptyComponent={<View style={styles.card}><Text style={styles.cardTitle}>Le fil est calme</Text><Text style={styles.cardText}>Sois la première personne à partager quelque chose.</Text></View>}
      renderItem={({ item }) => <View style={styles.card}><Text style={styles.cardTitle}>{item.author.displayName}</Text><Text style={styles.handle}>@{item.author.username}</Text><Text style={styles.postText}>{item.content}</Text><View style={styles.row}><Pressable onPress={() => void like(item.id)} style={styles.smallButton}><Text style={styles.smallButtonText}>♥ {item._count.likes}</Text></Pressable><Text style={styles.muted}>💬 {item._count.comments}</Text></View></View>}
    />
  );
}

function ChallengesScreen({ user }: { user: User }) {
  const [items, setItems] = useState<Challenge[]>([]);
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState('');
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    try { setItems(await apiFetch<Challenge[]>('/challenges')); }
    catch (cause) { Alert.alert('Défis indisponibles', cause instanceof Error ? cause.message : 'Réessaie.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    const prompts = questions.split('\n').map((item) => item.trim()).filter(Boolean);
    if (!title.trim() || prompts.length === 0) return;
    setCreating(true);
    try {
      await apiFetch('/challenges', { method: 'POST', body: JSON.stringify({ title: title.trim(), questions: prompts }) });
      setTitle('');
      setQuestions('');
      await load();
    } catch (cause) { Alert.alert('Création impossible', cause instanceof Error ? cause.message : 'Réessaie.'); }
    finally { setCreating(false); }
  }

  async function join(item: Challenge) {
    if (item.participants.some((participant) => participant.userId === user.id)) return;
    try { await apiFetch(`/challenges/${item.id}/join`, { method: 'POST' }); await load(); }
    catch (cause) { Alert.alert('Participation impossible', cause instanceof Error ? cause.message : 'Réessaie.'); }
  }

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Text style={styles.eyebrow}>LE CŒUR DE KNOWME</Text><Text style={styles.heading}>Défis</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>Créer un défi</Text><Field value={title} onChangeText={setTitle} placeholder="Titre" /><Field multiline value={questions} onChangeText={setQuestions} placeholder={'Une question par ligne\nQuel est mon plus grand rêve ?'} /><PrimaryButton disabled={creating || !title.trim() || !questions.trim()} onPress={() => void create()} title={creating ? 'Création…' : 'Créer'} /></View>
      {items.map((item) => {
        const joined = item.participants.some((participant) => participant.userId === user.id);
        return <View key={item.id} style={styles.card}><Text style={styles.cardTitle}>🎯 {item.title}</Text>{item.description ? <Text style={styles.cardText}>{item.description}</Text> : null}<Text style={styles.muted}>{item.questions.length} question(s) · {item.participants.length} participant(s) · {item.status}</Text>{item.status === 'ACTIVE' && !joined ? <PrimaryButton onPress={() => void join(item)} title="Participer" /> : <Text style={styles.success}>{joined ? 'Tu participes à ce défi.' : 'Défi terminé.'}</Text>}</View>;
      })}
    </ScrollView>
  );
}

function ProfileScreen({ user, onLogout, onUpdated }: { user: User; onLogout: () => Promise<void>; onUpdated: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await apiFetch('/account/profile', { method: 'PATCH', body: JSON.stringify({ displayName: displayName.trim(), bio: bio.trim() }) });
      await onUpdated();
      Alert.alert('Profil enregistré', 'Tes informations ont été mises à jour.');
    } catch (cause) { Alert.alert('Modification impossible', cause instanceof Error ? cause.message : 'Réessaie.'); }
    finally { setBusy(false); }
  }

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{user.displayName.charAt(0).toUpperCase()}</Text></View>
      <Text style={styles.heading}>{user.displayName}</Text><Text style={styles.handle}>@{user.username}</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>Modifier mon profil</Text><Field value={displayName} onChangeText={setDisplayName} placeholder="Nom affiché" /><Field multiline value={bio} onChangeText={setBio} placeholder="Biographie" /><PrimaryButton disabled={busy || !displayName.trim()} onPress={() => void save()} title={busy ? 'Enregistrement…' : 'Enregistrer'} /></View>
      <Pressable style={styles.logoutButton} onPress={() => void onLogout()}><Text style={styles.logoutText}>Se déconnecter</Text></Pressable>
    </ScrollView>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [screen, setScreen] = useState<Screen>('home');

  const loadSession = useCallback(async () => {
    try {
      if (!(await hasSession())) { setUser(null); return; }
      setUser(await apiFetch<User>('/users/me'));
    } catch {
      await clearSession();
      setUser(null);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadSession(); }, [loadSession]);

  async function logout() {
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch { /* local logout remains authoritative */ }
    await clearSession();
    setUser(null);
    setScreen('home');
  }

  if (loading) return <SafeAreaView style={styles.loadingRoot}><StatusBar style="light" /><ActivityIndicator size="large" color="#45e6bd" /></SafeAreaView>;
  if (!user) return <><StatusBar style="light" /><AuthScreen onAuthenticated={loadSession} /></>;

  const tabs: Array<[Screen, string, string]> = [
    ['home', '⌂', 'Accueil'],
    ['feed', '◉', 'Fil'],
    ['social', '✦', 'Cercle'],
    ['challenges', '◎', 'Défis'],
    ['profile', '●', 'Profil']
  ];

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.body}>
        {screen === 'home' && <HomeScreen user={user} openSocial={() => setScreen('social')} />}
        {screen === 'feed' && <FeedScreen />}
        {screen === 'social' && <SocialHub userId={user.id} />}
        {screen === 'challenges' && <ChallengesScreen user={user} />}
        {screen === 'profile' && <ProfileScreen user={user} onLogout={logout} onUpdated={loadSession} />}
      </View>
      <View style={styles.tabBar}>
        {tabs.map(([value, icon, label]) => (
          <Pressable key={value} onPress={() => setScreen(value)} style={styles.tab}><Text style={[styles.tabIcon, screen === value && styles.tabActive]}>{icon}</Text><Text style={[styles.tabLabel, screen === value && styles.tabActive]}>{label}</Text></Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071410' },
  loadingRoot: { flex: 1, backgroundColor: '#071410', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  authRoot: { flex: 1, backgroundColor: '#071410' },
  authContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brandMark: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#45e6bd', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  brandMarkText: { color: '#052017', fontSize: 34, fontWeight: '900' },
  logo: { color: '#f4fff9', fontSize: 46, fontWeight: '900' },
  subtitle: { color: '#a7b9b1', fontSize: 18, marginTop: 4, marginBottom: 24 },
  screenContent: { padding: 20, paddingBottom: 36, gap: 14 },
  eyebrow: { color: '#45e6bd', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heading: { color: '#f4fff9', fontSize: 30, fontWeight: '900', marginTop: 4 },
  muted: { color: '#91a79e' },
  card: { backgroundColor: '#10231d', borderColor: '#1c3a31', borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  cardTitle: { color: '#f4fff9', fontSize: 19, fontWeight: '800' },
  cardText: { color: '#b6c8c0', fontSize: 15, lineHeight: 22 },
  input: { backgroundColor: '#091914', borderColor: '#25473b', borderWidth: 1, borderRadius: 16, color: '#f4fff9', fontSize: 16, paddingHorizontal: 15, paddingVertical: 13, minHeight: 50 },
  primaryButton: { backgroundColor: '#45e6bd', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  primaryButtonText: { color: '#052017', fontWeight: '900', fontSize: 15 },
  buttonMuted: { opacity: 0.45 },
  error: { color: '#ff9d66', lineHeight: 20 },
  success: { color: '#45e6bd', fontWeight: '700' },
  segmented: { flexDirection: 'row', backgroundColor: '#091914', borderRadius: 14, padding: 4, marginBottom: 4 },
  segment: { flex: 1, padding: 10, borderRadius: 11, alignItems: 'center' },
  segmentActive: { backgroundColor: '#1b3b31' },
  segmentText: { color: '#789187', fontWeight: '700' },
  segmentTextActive: { color: '#f4fff9' },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#10231d', borderRadius: 20, padding: 14 },
  statValue: { color: '#f4fff9', fontSize: 25, fontWeight: '900' },
  statLabel: { color: '#91a79e', fontSize: 12, marginTop: 4 },
  postText: { color: '#e4f2ec', fontSize: 17, lineHeight: 25 },
  handle: { color: '#91a79e', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallButton: { backgroundColor: '#1b3b31', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 12 },
  smallButtonText: { color: '#f4fff9', fontWeight: '700' },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#45e6bd', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#052017', fontSize: 38, fontWeight: '900' },
  logoutButton: { borderColor: '#ff9d66', borderWidth: 1, borderRadius: 16, padding: 14, alignItems: 'center' },
  logoutText: { color: '#ff9d66', fontWeight: '800' },
  tabBar: { flexDirection: 'row', backgroundColor: '#0b1d17', borderTopColor: '#1c3a31', borderTopWidth: 1, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 18 : 8 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { color: '#789187', fontSize: 20 },
  tabLabel: { color: '#789187', fontSize: 10, fontWeight: '700' },
  tabActive: { color: '#45e6bd' }
});
