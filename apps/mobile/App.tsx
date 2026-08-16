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
import {
  apiFetch,
  clearSession,
  getTrustedDeviceToken,
  hasSession,
  saveSession,
  saveTrustedDeviceToken,
  SessionTokens
} from './src/api';
import { AppearanceProvider, useAppearance } from './src/AppearanceProvider';
import { CallPreparationExperience } from './src/CallPreparationExperience';
import { ChallengeExperience } from './src/ChallengeExperience';
import { FeedExperience } from './src/FeedExperience';
import { MobileUser, ProfileExperience } from './src/ProfileExperience';
import { disconnectRealtimeSocket, getRealtimeSocket } from './src/realtime';
import { SocialHub } from './src/SocialHub';
import { VerificationExperience } from './src/VerificationExperience';

type Screen =
  | 'home'
  | 'feed'
  | 'social'
  | 'challenges'
  | 'profile'
  | 'calls'
  | 'verification';
type ChallengeSummary = { id: string; status: string };
type NotificationCount = { count: number };
type MessageCount = { unread: number };
type TwoFactorChallenge = {
  requiresTwoFactor: true;
  challengeToken: string;
  expiresAt: string;
  expiresIn: number;
};
type LoginResult = SessionTokens | TwoFactorChallenge;

function Field(props: React.ComponentProps<typeof TextInput>) {
  const { colors } = useAppearance();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      style={[
        styles.input,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          color: colors.text
        }
      ]}
      {...props}
    />
  );
}

function PrimaryButton({
  title,
  onPress,
  disabled = false
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useAppearance();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: colors.accent },
        (pressed || disabled) && styles.buttonMuted
      ]}
    >
      <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>{title}</Text>
    </Pressable>
  );
}

function isTwoFactorChallenge(value: LoginResult): value is TwoFactorChallenge {
  return 'requiresTwoFactor' in value && value.requiresTwoFactor;
}

function AuthScreen({
  onAuthenticated
}: {
  onAuthenticated: () => Promise<void>;
}) {
  const { colors } = useAppearance();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function resetChallenge() {
    setChallengeToken('');
    setSecurityCode('');
    setTrustDevice(false);
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const trustedDeviceToken = mode === 'login'
        ? await getTrustedDeviceToken()
        : null;
      const result = await apiFetch<LoginResult>(
        mode === 'login' ? '/auth/login' : '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(
            mode === 'login'
              ? {
                  identifier: identifier.trim(),
                  password,
                  deviceToken: trustedDeviceToken ?? undefined
                }
              : {
                  displayName: displayName.trim(),
                  username: username.trim(),
                  email: email.trim(),
                  password
                }
          )
        }
      );

      if (isTwoFactorChallenge(result)) {
        setChallengeToken(result.challengeToken);
        setError('Entre le code de ton application d’authentification ou un code de récupération.');
        return;
      }

      await saveSession(result);
      await onAuthenticated();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Authentification impossible.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifySecondFactor() {
    if (!challengeToken) return;
    setBusy(true);
    setError('');
    try {
      const tokens = await apiFetch<SessionTokens>('/auth/login/2fa', {
        method: 'POST',
        body: JSON.stringify({
          challengeToken,
          code: securityCode.trim().toUpperCase(),
          trustDevice,
          deviceLabel: `${Platform.OS === 'ios' ? 'iPhone/iPad' : 'Android'} KnowMe`,
          platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID'
        })
      });
      await saveSession(tokens);
      if (tokens.trustedDeviceToken) {
        await saveTrustedDeviceToken(tokens.trustedDeviceToken);
      }
      resetChallenge();
      await onAuthenticated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Code de sécurité invalide.');
    } finally {
      setBusy(false);
    }
  }

  const valid =
    password.length >= 8 &&
    (mode === 'login'
      ? identifier.trim().length > 0
      : displayName.trim().length > 0 &&
        username.trim().length > 0 &&
        email.includes('@'));

  return (
    <KeyboardAvoidingView
      style={[styles.authRoot, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.authContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.brandMark, { backgroundColor: colors.accent }]}>
          <Text style={[styles.brandMarkText, { color: colors.accentText }]}>K</Text>
        </View>
        <Text style={[styles.logo, { color: colors.text }]}>KnowMe</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Mieux se connaître, vraiment.</Text>

        {!challengeToken ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.segmented, { backgroundColor: colors.background }]}>
              {(['login', 'register'] as const).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => {
                    setMode(value);
                    setError('');
                    resetChallenge();
                  }}
                  style={[
                    styles.segment,
                    mode === value && { backgroundColor: colors.surfaceRaised }
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: mode === value ? colors.text : colors.muted }
                    ]}
                  >
                    {value === 'login' ? 'Connexion' : 'Inscription'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {mode === 'register' && (
              <>
                <Field value={displayName} onChangeText={setDisplayName} placeholder="Nom affiché" />
                <Field value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Pseudo" />
                <Field value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" />
              </>
            )}
            {mode === 'login' && (
              <Field value={identifier} onChangeText={setIdentifier} autoCapitalize="none" placeholder="Email ou pseudo" />
            )}
            <Field value={password} onChangeText={setPassword} secureTextEntry placeholder="Mot de passe" />
            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
            <PrimaryButton
              disabled={!valid || busy}
              onPress={() => void submit()}
              title={busy ? 'Vérification…' : mode === 'login' ? 'Entrer dans KnowMe' : 'Créer mon profil'}
            />
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Deuxième preuve</Text>
            <Text style={[styles.cardText, { color: colors.muted }]}>
              Le mot de passe est correct, mais aucune session n’est encore ouverte.
            </Text>
            <Field
              value={securityCode}
              onChangeText={setSecurityCode}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="123456 ou XXXX-XXXX"
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: trustDevice }}
              onPress={() => setTrustDevice((current) => !current)}
              style={styles.checkboxRow}
            >
              <View
                style={[
                  styles.checkbox,
                  { borderColor: colors.accent },
                  trustDevice && { backgroundColor: colors.accent }
                ]}
              >
                <Text style={[styles.checkboxText, { color: colors.accentText }]}>{trustDevice ? '✓' : ''}</Text>
              </View>
              <Text style={[styles.checkboxLabel, { color: colors.muted }]}>
                Faire confiance à cet appareil pendant 30 jours. Cette autorisation reste révocable.
              </Text>
            </Pressable>
            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
            <PrimaryButton
              disabled={busy || securityCode.trim().length < 6}
              onPress={() => void verifySecondFactor()}
              title={busy ? 'Validation…' : 'Valider et ouvrir la session'}
            />
            <Pressable
              disabled={busy}
              onPress={resetChallenge}
              style={[styles.secondaryButton, { borderColor: colors.accent }]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>Recommencer la connexion</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HomeScreen({
  user,
  openSocial,
  openFeed,
  openChallenges,
  openCalls
}: {
  user: MobileUser;
  openSocial: () => void;
  openFeed: () => void;
  openChallenges: () => void;
  openCalls: () => void;
}) {
  const { colors } = useAppearance();
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
      Alert.alert(
        'Actualisation impossible',
        cause instanceof Error ? cause.message : 'Réessaie.'
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cardStyle = { backgroundColor: colors.surface, borderColor: colors.border };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.accent}
          colors={[colors.accent]}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
      contentContainerStyle={styles.screenContent}
    >
      <Text style={[styles.eyebrow, { color: colors.accent }]}>BON RETOUR</Text>
      <Text style={[styles.heading, { color: colors.text }]}>Salut, {user.displayName}</Text>
      <Text style={[styles.muted, { color: colors.muted }]}>Ton univers KnowMe est prêt.</Text>
      <View style={styles.statsGrid}>
        <Pressable onPress={openChallenges} style={[styles.statCard, cardStyle]}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {challenges.filter((item) => item.status === 'ACTIVE').length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Défis actifs</Text>
        </Pressable>
        <Pressable onPress={openSocial} style={[styles.statCard, cardStyle]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{messageUnread}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Messages</Text>
        </Pressable>
        <Pressable onPress={openSocial} style={[styles.statCard, cardStyle]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{notificationUnread}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Alertes</Text>
        </Pressable>
        <View style={[styles.statCard, cardStyle]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{user.knowCoins ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>KnowCoins</Text>
        </View>
      </View>
      <Pressable onPress={openSocial} style={[styles.card, cardStyle]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Mon cercle</Text>
        <Text style={[styles.cardText, { color: colors.muted }]}>
          {messageUnread > 0 ? `${messageUnread} message(s) t’attendent. ` : ''}
          Retrouve tes amis, tes messages et toutes tes alertes au même endroit.
        </Text>
      </Pressable>
      <Pressable onPress={openFeed} style={[styles.card, cardStyle]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Discussions</Text>
        <Text style={[styles.cardText, { color: colors.muted }]}>
          Explore le fil, ouvre une publication, réponds et gère tes commentaires.
        </Text>
      </Pressable>
      <Pressable onPress={openChallenges} style={[styles.card, cardStyle]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Défis en profondeur</Text>
        <Text style={[styles.cardText, { color: colors.muted }]}>
          Réponds question par question, sauvegarde ta progression et suis les participants.
        </Text>
      </Pressable>
      <Pressable onPress={openCalls} style={[styles.card, cardStyle]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Préparer mes appels</Text>
        <Text style={[styles.cardText, { color: colors.muted }]}>
          Règle ta disponibilité et vérifie volontairement le microphone et la caméra de ce téléphone.
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function AppContent() {
  const { colors, refresh: refreshAppearance } = useAppearance();
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
      void refreshAppearance();
      void getRealtimeSocket();
    } catch {
      disconnectRealtimeSocket();
      await clearSession();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshAppearance]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

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
    return (
      <SafeAreaView style={[styles.loadingRoot, { backgroundColor: colors.background }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <>
        <StatusBar style={colors.statusBar} />
        <AuthScreen onAuthenticated={loadSession} />
      </>
    );
  }

  const tabs: Array<[Screen, string, string]> = [
    ['home', '⌂', 'Accueil'],
    ['feed', '◉', 'Fil'],
    ['social', '✦', 'Cercle'],
    ['challenges', '◎', 'Défis'],
    ['profile', '●', 'Profil']
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.statusBar} />
      <View style={[styles.body, { backgroundColor: colors.background }]}>
        {screen === 'home' && (
          <HomeScreen
            user={user}
            openSocial={() => setScreen('social')}
            openFeed={() => setScreen('feed')}
            openChallenges={() => setScreen('challenges')}
            openCalls={() => setScreen('calls')}
          />
        )}
        {screen === 'feed' && <FeedExperience userId={user.id} />}
        {screen === 'social' && <SocialHub userId={user.id} />}
        {screen === 'challenges' && <ChallengeExperience userId={user.id} />}
        {screen === 'calls' && (
          <CallPreparationExperience onBack={() => setScreen('home')} />
        )}
        {screen === 'profile' && (
          <ProfileExperience
            user={user}
            onUpdated={loadSession}
            onLogout={logout}
            onAccountDeleted={resetLocalSession}
            onOpenVerification={() => setScreen('verification')}
          />
        )}
        {screen === 'verification' && (
          <VerificationExperience
            user={user}
            onUpdated={loadSession}
            onBack={() => setScreen('profile')}
          />
        )}
      </View>
      <View
        style={[
          styles.tabBar,
          { backgroundColor: colors.surface, borderTopColor: colors.border }
        ]}
      >
        {tabs.map(([value, icon, label]) => {
          const active =
            screen === value ||
            (value === 'home' && screen === 'calls') ||
            (value === 'profile' && screen === 'verification');
          return (
            <Pressable key={value} onPress={() => setScreen(value)} style={styles.tab}>
              <Text style={[styles.tabIcon, { color: active ? colors.accent : colors.muted }]}>
                {icon}
              </Text>
              <Text style={[styles.tabLabel, { color: active ? colors.accent : colors.muted }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AppearanceProvider>
      <AppContent />
    </AppearanceProvider>
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
  secondaryButton: { borderColor: '#45e6bd', borderWidth: 1, borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  secondaryButtonText: { color: '#45e6bd', fontWeight: '800' },
  buttonMuted: { opacity: 0.45 },
  error: { color: '#ff9d66', lineHeight: 20 },
  segmented: { flexDirection: 'row', backgroundColor: '#091914', borderRadius: 14, padding: 4, marginBottom: 4 },
  segment: { flex: 1, padding: 10, borderRadius: 11, alignItems: 'center' },
  segmentActive: { backgroundColor: '#1b3b31' },
  segmentText: { color: '#789187', fontWeight: '700' },
  segmentTextActive: { color: '#f4fff9' },
  checkboxRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderColor: '#45e6bd', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#45e6bd' },
  checkboxText: { color: '#052017', fontWeight: '900' },
  checkboxLabel: { flex: 1, color: '#b6c8c0', lineHeight: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '48%', minHeight: 86, backgroundColor: '#10231d', borderColor: '#1c3a31', borderWidth: 1, borderRadius: 20, padding: 14 },
  statValue: { color: '#f4fff9', fontSize: 25, fontWeight: '900' },
  statLabel: { color: '#91a79e', fontSize: 12, marginTop: 4 },
  tabBar: { flexDirection: 'row', backgroundColor: '#0b1d17', borderTopColor: '#1c3a31', borderTopWidth: 1, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 18 : 8 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { color: '#789187', fontSize: 20 },
  tabLabel: { color: '#789187', fontSize: 10, fontWeight: '700' },
  tabActive: { color: '#45e6bd' }
});
