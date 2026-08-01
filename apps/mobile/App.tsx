import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { ChallengeExperience } from './src/ChallengeExperience';
import { FeedExperience } from './src/FeedExperience';
import { MobileUser, ProfileExperience } from './src/ProfileExperience';
import { disconnectRealtimeSocket, getRealtimeSocket } from './src/realtime';
import { SocialHub } from './src/SocialHub';

type Screen = 'home' | 'feed' | 'social' | 'challenges' | 'profile';
type ChallengeSummary = { id: string; status: string };
type NotificationCount = { count: number };
type MessageCount = { unread: number };

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
    } finally {
      setBusy(false);
    }
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

function HomeScreen({ user, openSocial, openFeed, openChallenges }: {
  user: MobileUser;
  openSocial: () => void;
  openFeed: () => void;
  openChallenges: () => void;
}) {
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [messageUnread, setMessageUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [items, notifications, messages] = await Promise.all([
        apiFetch<ChallengeSummary[]>('/challenges'),
        apiFetch<NotificationCount>('/notifications/unread-count'),
        apiFetch<MessageCount>('/conversations/unread-count')
      ]);
      setChallenges(items);
      setNotificationUnread(notifications.count);
      setMessageUnread(messages.unread);
    } catch (cause) {
      Alert.alert('Actualisation impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />} contentContainerStyle={styles.screenContent}>
      <Text style={styles.eyebrow}>BON RETOUR</Text>
      <Text style={styles.heading}>Salut, {user.displayName}</Text>
      <Text style={styles.muted}>Ton univers KnowMe est prêt.</Text>
      <View style={styles.statsGrid}>
        <Pressable onPress={openChallenges} style={styles.statCard}><Text style={styles.statValue}>{challenges.filter((item) => item.status === 'ACTIVE').length}</Text><Text style={styles.statLabel}>Défis actifs</Text></Pressable>
        <Pressable onPress={openSocial} style={styles.statCard}><Text style={styles.statValue}>{messageUnread}</Text><Text style={styles.statLabel}>Messages</Text></Pressable>
        <Pressable onPress={openSocial} style={styles.statCard}><Text style={styles.statValue}>{notificationUnread}</Text><Text style={styles.statLabel}>Alertes</Text></Pressable>
        <View style={styles.statCard}><Text style={styles.statValue}>{user.knowCoins ?? 0}</Text><Text style={styles.statLabel}>KnowCoins</Text></View>
      </View>
      <Pressable onPress={openSocial} style={styles.card}>
        <Text style={styles.cardTitle}>Mon cercle</Text>
        <Text style={styles.cardText}>{messageUnread > 0 ? `${messageUnread} message(s) t’attendent. ` : ''}Retrouve tes amis, tes messages et toutes tes alertes au même endroit.</Text>
      </Pressable>
      <Pressable onPress={openFeed} style={styles.card}><Text style={styles.cardTitle}>Discussions</Text><Text style={styles.cardText}>Explore le fil, ouvre une publication, réponds et gère tes commentaires.</Text></Pressable>
      <Pressable onPress={openChallenges} style={styles.card}><Text style={styles.cardTitle}>Défis en profondeur</Text><Text style={styles.cardText}>Réponds question par question, sauvegarde ta progression et suis les participants.</Text></Pressable>
    </ScrollView>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MobileUser | null>(null);
  const [screen, setScreen] = useState<Screen>('home');

  const loadSession = useCallback(async () => {
    try {
      if (!(await hasSession())) {
        disconnectRealtimeSocket();
        setUser(null);
        return;
      }
      const currentUser = await apiFetch<MobileUser>('/users/me');
      setUser(currentUser);
      void getRealtimeSocket();
    } catch {
      disconnectRealtimeSocket();
      await clearSession();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSession(); }, [loadSession]);

  async function resetLocalSession() {
    disconnectRealtimeSocket();
    await clearSession();
    setUser(null);
    setScreen('home');
  }

  async function logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // La suppression locale reste prioritaire lorsque le serveur est indisponible.
    }
    await resetLocalSession();
  }

  if (loading) {
    return <SafeAreaView style={styles.loadingRoot}><StatusBar style="light" /><ActivityIndicator size="large" color="#45e6bd" /></SafeAreaView>;
  }

  if (!user) {
    return <><StatusBar style="light" /><AuthScreen onAuthenticated={loadSession} /></>;
  }

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
        {screen === 'home' && (
          <HomeScreen
            user={user}
            openSocial={() => setScreen('social')}
            openFeed={() => setScreen('feed')}
            openChallenges={() => setScreen('challenges')}
          />
        )}
        {screen === 'feed' && <FeedExperience userId={user.id} />}
        {screen === 'social' && <SocialHub userId={user.id} />}
        {screen === 'challenges' && <ChallengeExperience userId={user.id} />}
        {screen === 'profile' && (
          <ProfileExperience
            user={user}
            onUpdated={loadSession}
            onLogout={logout}
            onAccountDeleted={resetLocalSession}
          />
        )}
      </View>
      <View style={styles.tabBar}>
        {tabs.map(([value, icon, label]) => (
          <Pressable key={value} onPress={() => setScreen(value)} style={styles.tab}>
            <Text style={[styles.tabIcon, screen === value && styles.tabActive]}>{icon}</Text>
            <Text style={[styles.tabLabel, screen === value && styles.tabActive]}>{label}</Text>
          </Pressable>
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
  input: { backgroundColor: '#091914', borderColor: '#25473b', borderWidth: 1, borderRadius: 16, color: '#f4fff9', fontSize: 16, paddingHorizontal: 15, paddingVertical: 13, minHeight: 50, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: '#45e6bd', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  primaryButtonText: { color: '#052017', fontWeight: '900', fontSize: 15 },
  buttonMuted: { opacity: 0.45 },
  error: { color: '#ff9d66', lineHeight: 20 },
  segmented: { flexDirection: 'row', backgroundColor: '#091914', borderRadius: 14, padding: 4, marginBottom: 4 },
  segment: { flex: 1, padding: 10, borderRadius: 11, alignItems: 'center' },
  segmentActive: { backgroundColor: '#1b3b31' },
  segmentText: { color: '#789187', fontWeight: '700' },
  segmentTextActive: { color: '#f4fff9' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '48%', minHeight: 86, backgroundColor: '#10231d', borderRadius: 20, padding: 14 },
  statValue: { color: '#f4fff9', fontSize: 25, fontWeight: '900' },
  statLabel: { color: '#91a79e', fontSize: 12, marginTop: 4 },
  tabBar: { flexDirection: 'row', backgroundColor: '#0b1d17', borderTopColor: '#1c3a31', borderTopWidth: 1, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 18 : 8 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { color: '#789187', fontSize: 20 },
  tabLabel: { color: '#789187', fontSize: 10, fontWeight: '700' },
  tabActive: { color: '#45e6bd' }
});
