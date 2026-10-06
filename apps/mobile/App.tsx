import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  StatusBar as NativeStatusBar,
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
import { ChallengeExperience } from './src/ChallengeExperience';
import { FeedExperience } from './src/FeedExperience';
import { useI18n } from './src/I18nProvider';
import { LanguagePicker } from './src/LanguagePicker';
import { MobileUser, ProfileExperience } from './src/ProfileExperience';
import { disconnectRealtimeSocket, getRealtimeSocket } from './src/realtime';
import { SocialHub } from './src/SocialHub';
import { StoriesRail } from './src/StoriesRail';
import {
  Avatar,
  BrandMark,
  FadeRise,
  GlassSurface,
  KnowMeIcon,
  PressScale,
  SoftSurface
} from './src/ui/KnowMeUI';
import { VerificationExperience } from './src/VerificationExperience';

type Screen =
  | 'home'
  | 'discover'
  | 'social'
  | 'challenges'
  | 'profile'
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

function isTwoFactorChallenge(value: LoginResult): value is TwoFactorChallenge {
  return 'requiresTwoFactor' in value && value.requiresTwoFactor;
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  const { colors } = useAppearance();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      selectionColor={colors.accent}
      style={[
        styles.input,
        {
          backgroundColor: colors.backgroundAccent,
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
    <PressScale
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.primaryButton,
        {
          backgroundColor: colors.accent,
          borderColor: colors.accent
        }
      ]}
    >
      <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>
        {title}
      </Text>
      <KnowMeIcon name="arrow" size={18} color={colors.accentText} />
    </PressScale>
  );
}

function AuthScreen({
  onAuthenticated,
  onBack
}: {
  onAuthenticated: () => Promise<void>;
  onBack?: () => void;
}) {
  const { colors } = useAppearance();
  const { locale, setLocalLocale, refresh: refreshLocale, syncLocale, t } = useI18n();
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
        setError(t('auth.twoFactorPrompt'));
        return;
      }

      await saveSession(result);
      if (mode === 'register') {
        await syncLocale(locale).catch(() => null);
      } else {
        await refreshLocale().catch(() => null);
      }
      await onAuthenticated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('auth.failed'));
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
          deviceLabel: (Platform.OS === 'ios' ? 'iPhone/iPad' : 'Android') + ' KnowMe',
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
      setError(cause instanceof Error ? cause.message : t('auth.invalidSecurityCode'));
    } finally {
      setBusy(false);
    }
  }

  const usernameValid = /^[A-Za-z0-9_]{3,24}$/.test(username.trim());
  const valid =
    password.length >= 8 &&
    (mode === 'login'
      ? identifier.trim().length > 0
      : displayName.trim().length >= 2 &&
        usernameValid &&
        email.includes('@'));

  return (
    <KeyboardAvoidingView
      style={[
        styles.authRoot,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 0 : 0
        }
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        pointerEvents="none"
        style={[styles.authGlowOne, { backgroundColor: colors.accent }]}
      />
      <View
        pointerEvents="none"
        style={[styles.authGlowTwo, { backgroundColor: colors.secondary }]}
      />

      <ScrollView
        contentContainerStyle={styles.authContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.authTopRow}>
          <View style={styles.authTopLeft}>
            {onBack ? (
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Retour"
                onPress={onBack}
                style={[
                  styles.authBack,
                  {
                    backgroundColor: colors.surfaceGlass,
                    borderColor: colors.border
                  }
                ]}
              >
                <KnowMeIcon name="back" size={19} color={colors.text} strokeWidth={1.9} />
              </PressScale>
            ) : null}
            <View style={styles.brandInline}>
              <BrandMark size={30} />
              <Text style={[styles.brandInlineText, { color: colors.text }]}>KnowMe</Text>
            </View>
          </View>
          <View style={styles.authLanguage}>
            <LanguagePicker
              compact
              value={locale}
              onChange={(nextLocale) => setLocalLocale(nextLocale)}
            />
          </View>
        </View>

        <FadeRise style={styles.authHero}>
          <GlassSurface
            strength="soft"
            borderRadius={32}
            style={styles.authLogoHalo}
          >
            <BrandMark size={50} />
          </GlassSurface>
          <Text style={[styles.authTitle, { color: colors.text }]}>
            {t('auth.welcome')}
          </Text>
          <Text style={[styles.authLead, { color: colors.muted }]}>
            {t('auth.welcomeBody')}
          </Text>
        </FadeRise>

        <FadeRise delay={70}>
          <GlassSurface style={styles.authCard} strength="medium" borderRadius={24}>
            {!challengeToken ? (
              <>
                <View
                  style={[
                    styles.segmented,
                    { backgroundColor: colors.background }
                  ]}
                >
                  {(['login', 'register'] as const).map((value) => {
                    const active = mode === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => {
                          setMode(value);
                          setError('');
                          resetChallenge();
                        }}
                        style={[
                          styles.segment,
                          active && { backgroundColor: colors.surfaceRaised }
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            { color: active ? colors.text : colors.muted }
                          ]}
                        >
                          {value === 'login' ? t('auth.signIn') : t('auth.signUp')}
                        </Text>
                        {active ? (
                          <View
                            style={[
                              styles.segmentIndicator,
                              { backgroundColor: colors.accent }
                            ]}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.formStack}>
                  {mode === 'register' ? (
                    <>
                      <Field
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder={t('auth.displayName')}
                      />
                      <Field
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={24}
                        placeholder={t('auth.username')}
                      />
                      <Text
                        style={[
                          styles.fieldHint,
                          {
                            color:
                              username.length > 0 && !usernameValid
                                ? colors.danger
                                : colors.muted
                          }
                        ]}
                      >
                        {t('auth.usernameHint')}
                      </Text>
                      <Field
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        placeholder={t('auth.email')}
                      />
                    </>
                  ) : (
                    <Field
                      value={identifier}
                      onChangeText={setIdentifier}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder={t('auth.identifier')}
                    />
                  )}

                  <Field
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder={t('auth.password')}
                  />
                </View>

                {error ? (
                  <View
                    style={[
                      styles.inlineError,
                      { borderColor: colors.danger }
                    ]}
                  >
                    <Text style={[styles.errorText, { color: colors.danger }]}>
                      {error}
                    </Text>
                  </View>
                ) : null}

                <PrimaryButton
                  disabled={!valid || busy}
                  onPress={() => void submit()}
                  title={
                    busy
                      ? t('auth.verifying')
                      : mode === 'login'
                        ? t('auth.enter')
                        : t('auth.createProfile')
                  }
                />
              </>
            ) : (
              <>
                <View style={styles.securityHeader}>
                  <View
                    style={[
                      styles.securityIcon,
                      { backgroundColor: colors.backgroundAccent }
                    ]}
                  >
                    <KnowMeIcon name="check" size={23} color={colors.accent} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      {t('auth.secondFactorTitle')}
                    </Text>
                    <Text style={[styles.cardText, { color: colors.muted }]}>
                      {t('auth.secondFactorDescription')}
                    </Text>
                  </View>
                </View>

                <Field
                  value={securityCode}
                  onChangeText={setSecurityCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder={t('auth.securityCode')}
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
                    {trustDevice ? (
                      <KnowMeIcon
                        name="check"
                        size={14}
                        color={colors.accentText}
                        strokeWidth={2.2}
                      />
                    ) : null}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: colors.muted }]}>
                    {t('auth.trustDevice')}
                  </Text>
                </Pressable>

                {error ? (
                  <Text style={[styles.errorText, { color: colors.danger }]}>
                    {error}
                  </Text>
                ) : null}

                <PrimaryButton
                  disabled={busy || securityCode.trim().length < 6}
                  onPress={() => void verifySecondFactor()}
                  title={
                    busy ? t('auth.validating') : t('auth.validateSession')
                  }
                />

                <Pressable
                  disabled={busy}
                  onPress={resetChallenge}
                  style={styles.linkButton}
                >
                  <Text style={[styles.linkButtonText, { color: colors.accent }]}>
                    {t('auth.restartSignIn')}
                  </Text>
                </Pressable>
              </>
            )}
          </GlassSurface>
        </FadeRise>

        <Text style={[styles.authFootnote, { color: colors.muted }]}>
          Be Real. Belong. Create. Play.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HomeScreen({
  user,
  openSocial,
  openDiscover,
  openChallenges,
  openCreate,
  openProfile
}: {
  user: MobileUser;
  openSocial: () => void;
  openDiscover: () => void;
  openChallenges: () => void;
  openCreate: () => void;
  openProfile: () => void;
}) {
  const { colors } = useAppearance();
  const { t } = useI18n();
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
        t('home.refreshFailed'),
        cause instanceof Error ? cause.message : t('home.retry')
      );
    } finally {
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeChallenges = challenges.filter((item) => item.status === 'ACTIVE').length;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
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
      contentContainerStyle={styles.homeContent}
    >
      <FadeRise>
        <GlassSurface strength="soft" borderRadius={28} style={styles.homeTopBar}>
          <View style={styles.brandInline}>
          <BrandMark size={34} />
          <View>
            <Text style={[styles.topBrandTitle, { color: colors.text }]}>KnowMe</Text>
            <Text style={[styles.topBrandTag, { color: colors.muted }]}>
              Be Real. Belong.
            </Text>
          </View>
        </View>
        <View style={styles.homeTopActions}>
          <PressScale
            onPress={openSocial}
            style={styles.iconButtonPress}
          >
            <GlassSurface
              strength="soft"
              borderRadius={21}
              style={styles.iconButton}
            >
              <KnowMeIcon name="bell" size={22} color={colors.text} />
              {notificationUnread > 0 ? (
                <View
                  style={[
                    styles.notificationBadge,
                    { backgroundColor: colors.secondary }
                  ]}
                >
                  <Text style={styles.notificationBadgeText}>
                    {notificationUnread > 9 ? '9+' : notificationUnread}
                  </Text>
                </View>
              ) : null}
            </GlassSurface>
          </PressScale>
          <PressScale onPress={openProfile} style={styles.headerAvatarButton}>
            <Avatar
              uri={user.avatarUrl}
              name={user.displayName}
              size={38}
            />
          </PressScale>
          </View>
        </GlassSurface>
      </FadeRise>

      <FadeRise delay={35} style={styles.greetingRow}>
        <View style={styles.flex}>
          <Text style={[styles.homeGreeting, { color: colors.text }]}>
            {t('home.hello', { name: user.displayName.split(' ')[0] || user.displayName })}
          </Text>
          <Text style={[styles.homeSubtitle, { color: colors.muted }]}>
            {t('home.subtitle')}
          </Text>
        </View>
      </FadeRise>

      <FadeRise delay={70}>
        <StoriesRail
          currentUser={{
            id: user.id,
            displayName: user.displayName,
            username: user.username,
            avatarUrl: user.avatarUrl
          }}
          onOpenDiscover={openDiscover}
        />
      </FadeRise>

      <FadeRise delay={105}>
        <PressScale onPress={openChallenges}>
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border
              }
            ]}
          >
            <View
              pointerEvents="none"
              style={[
                styles.heroAccent,
                { backgroundColor: colors.accent }
              ]}
            />
            <View style={styles.heroTopRow}>
              <View
                style={[
                  styles.heroIcon,
                  { backgroundColor: colors.backgroundAccent }
                ]}
              >
                <KnowMeIcon name="spark" size={24} color={colors.accent} />
              </View>
              <Text style={[styles.heroEyebrow, { color: colors.accent }]}>
                {t('home.daily')}
              </Text>
            </View>

            <Text style={[styles.heroTitle, { color: colors.text }]}>
              {t('home.challengeTitle')}
            </Text>
            <Text style={[styles.heroBody, { color: colors.muted }]}>
              {activeChallenges > 0
                ? t('home.challengeBody', { count: activeChallenges })
                : t('home.challengeEmpty')}
            </Text>

            <View style={styles.heroFooter}>
              <View style={styles.heroDots}>
                <View style={[styles.heroDot, { backgroundColor: colors.accent }]} />
                <View style={[styles.heroDot, { backgroundColor: colors.secondary }]} />
                <View style={[styles.heroDot, { backgroundColor: '#F46CF6' }]} />
              </View>
              <View
                style={[
                  styles.heroCta,
                  { backgroundColor: colors.accent }
                ]}
              >
                <Text style={[styles.heroCtaText, { color: colors.accentText }]}>
                  {t('home.continue')}
                </Text>
                <KnowMeIcon name="arrow" size={17} color={colors.accentText} />
              </View>
            </View>
          </View>
        </PressScale>
      </FadeRise>

      <FadeRise delay={130}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('home.quickAccess')}
          </Text>
        </View>

        <GlassSurface strength="soft" borderRadius={22} style={styles.quickGrid}>
          <PressScale onPress={openSocial} style={styles.quickCard}>
            <View style={[styles.quickIcon, { backgroundColor: colors.backgroundAccent }]}>
              <KnowMeIcon name="messages" size={19} color={colors.accent} />
            </View>
            <Text style={[styles.quickValue, { color: colors.text }]}>{messageUnread}</Text>
            <Text style={[styles.quickLabel, { color: colors.muted }]}>{t('home.messages')}</Text>
          </PressScale>

          <View style={[styles.quickDivider, { backgroundColor: colors.border }]} />

          <PressScale onPress={openSocial} style={styles.quickCard}>
            <View style={[styles.quickIcon, { backgroundColor: colors.backgroundAccent }]}>
              <KnowMeIcon name="bell" size={19} color={colors.secondary} />
            </View>
            <Text style={[styles.quickValue, { color: colors.text }]}>{notificationUnread}</Text>
            <Text style={[styles.quickLabel, { color: colors.muted }]}>{t('home.alerts')}</Text>
          </PressScale>

          <View style={[styles.quickDivider, { backgroundColor: colors.border }]} />

          <View style={styles.quickCard}>
            <View style={[styles.quickIcon, { backgroundColor: colors.backgroundAccent }]}>
              <KnowMeIcon name="coins" size={19} color="#F7C85A" />
            </View>
            <Text style={[styles.quickValue, { color: colors.text }]}>{user.knowCoins ?? 0}</Text>
            <Text style={[styles.quickLabel, { color: colors.muted }]}>{t('home.coins')}</Text>
          </View>
        </GlassSurface>
      </FadeRise>

      <FadeRise delay={155}>
        <PressScale onPress={openDiscover}>
          <SoftSurface style={styles.exploreCard} strong>
            <View style={styles.exploreTop}>
              <View
                style={[
                  styles.exploreIcon,
                  { backgroundColor: colors.backgroundAccent }
                ]}
              >
                <KnowMeIcon name="discover" size={24} color="#F46CF6" />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.exploreTitle, { color: colors.text }]}>
                  {t('home.explore')}
                </Text>
                <Text style={[styles.exploreBody, { color: colors.muted }]}>
                  {t('home.exploreBody')}
                </Text>
              </View>
            </View>
            <View style={styles.exploreFooter}>
              <Text style={[styles.exploreLink, { color: colors.accent }]}>
                {t('home.openDiscover')}
              </Text>
              <KnowMeIcon name="arrow" size={18} color={colors.accent} />
            </View>
          </SoftSurface>
        </PressScale>
      </FadeRise>
    </ScrollView>
  );
}

function CreateHub({
  visible,
  onClose,
  onPost,
  onChallenge
}: {
  visible: boolean;
  onClose: () => void;
  onPost: () => void;
  onChallenge: () => void;
}) {
  const { colors } = useAppearance();
  const { t } = useI18n();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.modalBackdrop}
        onPress={onClose}
      >
        <View style={styles.createSheetWrap}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
          >
            <GlassSurface
              strength="medium"
              borderRadius={28}
              style={styles.createSheet}
            >
            <View style={styles.sheetHandleWrap}>
              <View
                style={[
                  styles.sheetHandle,
                  { backgroundColor: colors.border }
                ]}
              />
            </View>
            <View style={styles.createSheetHeader}>
              <View style={styles.flex}>
                <Text style={[styles.createSheetTitle, { color: colors.text }]}>
                  {t('nav.create')}
                </Text>
                <Text style={[styles.createSheetSub, { color: colors.muted }]}>
                  Choisis ce que tu veux partager
                </Text>
              </View>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={onClose}
                style={[
                  styles.createSheetClose,
                  {
                    backgroundColor: colors.backgroundAccent,
                    borderColor: colors.border
                  }
                ]}
              >
                <KnowMeIcon name="close" size={18} color={colors.text} />
              </PressScale>
            </View>

            <View style={styles.createChoices}>
              <PressScale
                onPress={onPost}
                style={[
                  styles.createChoice,
                  {
                    backgroundColor: colors.backgroundAccent,
                    borderColor: colors.border
                  }
                ]}
              >
                <View
                  style={[
                    styles.createChoiceIcon,
                    { backgroundColor: colors.accent }
                  ]}
                >
                  <KnowMeIcon
                    name="create"
                    size={24}
                    color={colors.accentText}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.createChoiceTitle, { color: colors.text }]}>
                    Publication
                  </Text>
                  <Text style={[styles.createChoiceText, { color: colors.muted }]}>
                    Partage une idée avec ton réseau.
                  </Text>
                </View>
                <KnowMeIcon name="arrow" size={18} color={colors.muted} />
              </PressScale>

              <PressScale
                onPress={onChallenge}
                style={[
                  styles.createChoice,
                  {
                    backgroundColor: colors.backgroundAccent,
                    borderColor: colors.border
                  }
                ]}
              >
                <View
                  style={[
                    styles.createChoiceIcon,
                    { backgroundColor: colors.secondary }
                  ]}
                >
                  <KnowMeIcon
                    name="challenge"
                    size={24}
                    color="#17100A"
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.createChoiceTitle, { color: colors.text }]}>
                    {t('nav.challenges')}
                  </Text>
                  <Text style={[styles.createChoiceText, { color: colors.muted }]}>
                    Crée un défi à partager avec ton cercle.
                  </Text>
                </View>
                <KnowMeIcon name="arrow" size={18} color={colors.muted} />
              </PressScale>
            </View>
            </GlassSurface>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function BottomNavigation({
  screen,
  onNavigate,
  onCreate
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  onCreate: () => void;
}) {
  const { colors } = useAppearance();
  const { t } = useI18n();

  const items: Array<{
    key: 'home' | 'discover' | 'social' | 'profile';
    label: string;
    icon: 'home' | 'discover' | 'messages' | 'profile';
  }> = [
    { key: 'home', label: t('nav.home'), icon: 'home' },
    { key: 'discover', label: t('nav.discover'), icon: 'discover' },
    { key: 'social', label: t('nav.messages'), icon: 'messages' },
    { key: 'profile', label: t('nav.profile'), icon: 'profile' }
  ];

  function NavItem({
    item,
    active
  }: {
    item: (typeof items)[number];
    active: boolean;
  }) {
    return (
      <PressScale
        onPress={() => onNavigate(item.key)}
        style={[
          styles.bottomItem,
          active ? { backgroundColor: colors.backgroundAccent } : null
        ]}
      >
        <KnowMeIcon
          name={item.icon}
          size={23}
          color={active ? colors.accent : colors.muted}
          strokeWidth={active ? 2.05 : 1.8}
        />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          maxFontSizeMultiplier={1.08}
          style={[
            styles.bottomLabel,
            { color: active ? colors.accent : colors.muted }
          ]}
        >
          {item.label}
        </Text>
      </PressScale>
    );
  }

  return (
    <View pointerEvents="box-none" style={styles.bottomDockWrap}>
      <GlassSurface
        strength="medium"
        borderRadius={30}
        style={styles.bottomBar}
      >
        {items.slice(0, 2).map((item) => (
          <NavItem
            key={item.key}
            item={item}
            active={screen === item.key}
          />
        ))}

        <View style={styles.createSlot}>
          <PressScale
            onPress={onCreate}
            style={[
              styles.createNavButton,
              {
                backgroundColor: colors.accent,
                borderColor: colors.surfaceGlass
              }
            ]}
          >
            <KnowMeIcon
              name="create"
              size={27}
              color={colors.accentText}
              strokeWidth={2.1}
            />
          </PressScale>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            maxFontSizeMultiplier={1.08}
            style={[styles.createNavLabel, { color: colors.accent }]}
          >
            {t('nav.create')}
          </Text>
        </View>

        {items.slice(2).map((item) => (
          <NavItem
            key={item.key}
            item={item}
            active={
              screen === item.key ||
              (item.key === 'profile' && screen === 'verification')
            }
          />
        ))}
      </GlassSurface>
    </View>
  );
}

export function AppContent({ onExitAuth }: { onExitAuth?: () => void }) {
  const { colors, refresh: refreshAppearance } = useAppearance();
  const { ready: i18nReady } = useI18n();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MobileUser | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [createOpen, setCreateOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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

  useEffect(() => {
    setScreen('home');
  }, [user?.id]);

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
      // Local sign-out remains available if the network is unavailable.
    }
    await resetLocalSession();
  }

  if (loading || !i18nReady) {
    return (
      <SafeAreaView
        style={[
          styles.loadingRoot,
          { backgroundColor: colors.background }
        ]}
      >
        <StatusBar style={colors.statusBar} />
        <BrandMark size={62} />
        <ActivityIndicator
          size="small"
          color={colors.accent}
          style={styles.loadingSpinner}
        />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <>
        <StatusBar style={colors.statusBar} />
        <AuthScreen onAuthenticated={loadSession} onBack={onExitAuth} />
      </>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 0 : 0
        }
      ]}
    >
      <StatusBar style={colors.statusBar} />
      <View
        style={[
          styles.body,
          { backgroundColor: colors.background },
          screen !== 'challenges' && screen !== 'verification'
            ? styles.bodyWithDock
            : null
        ]}
      >
        {screen === 'home' ? (
          <HomeScreen
            key={'home:' + user.id}
            user={user}
            openSocial={() => setScreen('social')}
            openDiscover={() => setScreen('discover')}
            openChallenges={() => setScreen('challenges')}
            openCreate={() => setCreateOpen(true)}
            openProfile={() => setScreen('profile')}
          />
        ) : null}

        {screen === 'discover' ? (
          <FeedExperience
            key={'discover:' + user.id}
            userId={user.id}
          />
        ) : null}

        {screen === 'social' ? (
          <SocialHub
            key={'social:' + user.id}
            userId={user.id}
          />
        ) : null}

        {screen === 'challenges' ? (
          <ChallengeExperience
            key={'challenges:' + user.id}
            userId={user.id}
          />
        ) : null}

        {screen === 'profile' ? (
          <ProfileExperience
            key={'profile:' + user.id}
            user={user}
            onUpdated={loadSession}
            onLogout={logout}
            onAccountDeleted={resetLocalSession}
            onOpenVerification={() => setScreen('verification')}
          />
        ) : null}

        {screen === 'verification' ? (
          <VerificationExperience
            key={'verification:' + user.id}
            user={user}
            onUpdated={loadSession}
            onBack={() => setScreen('profile')}
          />
        ) : null}
      </View>

      {screen !== 'challenges' && screen !== 'verification' && !keyboardVisible ? (
        <BottomNavigation
          screen={screen}
          onNavigate={(next) => setScreen(next)}
          onCreate={() => setCreateOpen(true)}
        />
      ) : null}

      <CreateHub
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onPost={() => {
          setCreateOpen(false);
          setScreen('discover');
        }}
        onChallenge={() => {
          setCreateOpen(false);
          setScreen('challenges');
        }}
      />
    </SafeAreaView>
  );
}

export default function App({ onExitAuth }: { onExitAuth?: () => void } = {}) {
  return (
    <AppearanceProvider>
      <AppContent onExitAuth={onExitAuth} />
    </AppearanceProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  body: { flex: 1 },
  bodyWithDock: { paddingBottom: Platform.OS === 'ios' ? 72 : 66 },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingSpinner: { marginTop: 22 },

  authRoot: {
    flex: 1,
    overflow: 'hidden'
  },
  authGlowOne: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -140,
    right: -110,
    opacity: 0.12
  },
  authGlowTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: -120,
    left: -120,
    opacity: 0.1
  },
  authContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 24
  },
  authTopRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  brandInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9
  },
  brandInlineText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3
  },
  authTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9
  },
  authBack: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  authLanguage: {
    width: 120
  },
  authHero: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 18
  },
  authLogoHalo: {
    width: 78,
    height: 78,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  authTitle: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.65
  },
  authLead: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 7
  },
  authCard: {
    padding: 14,
    gap: 12,
    borderRadius: 24
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 3
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700'
  },
  segmentIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 24,
    height: 2.5,
    borderRadius: 3
  },
  formStack: {
    gap: 10
  },
  input: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14.5
  },
  fieldHint: {
    fontSize: 11.5,
    marginTop: -4,
    paddingHorizontal: 4
  },
  inlineError: {
    borderLeftWidth: 2,
    paddingLeft: 10
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18
  },
  primaryButton: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800'
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  securityIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900'
  },
  cardText: {
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 4
  },
  checkboxRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start'
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19
  },
  linkButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center'
  },
  linkButtonText: {
    fontSize: 13.5,
    fontWeight: '800'
  },
  authFootnote: {
    textAlign: 'center',
    fontSize: 10.5,
    marginTop: 14,
    letterSpacing: 0.2
  },

  homeContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 96
  },
  homeTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14
  },
  topBrandTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.25
  },
  topBrandTag: {
    fontSize: 9.5,
    marginTop: -1
  },
  homeTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  iconButtonPress: {
    borderRadius: 21
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  notificationBadge: {
    position: 'absolute',
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    top: -4,
    right: -4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  notificationBadgeText: {
    color: '#140A02',
    fontSize: 9,
    fontWeight: '900'
  },
  headerAvatarButton: {
    borderRadius: 19
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  homeGreeting: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.65
  },
  homeSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3
  },
  storyRail: {
    gap: 15,
    paddingBottom: 22
  },
  storyItem: {
    width: 68,
    alignItems: 'center'
  },
  storyCreateRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  storyPlus: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    right: -2,
    bottom: -1,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  storyShortcut: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  storyLabel: {
    marginTop: 7,
    fontSize: 10.5,
    maxWidth: 68,
    textAlign: 'center'
  },
  heroCard: {
    minHeight: 172,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    overflow: 'hidden',
    marginBottom: 20
  },
  heroAccent: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -65,
    top: -70,
    opacity: 0.12
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase'
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
    letterSpacing: -0.35,
    marginTop: 13,
    maxWidth: 290
  },
  heroBody: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 300
  },
  heroFooter: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  heroDots: {
    flexDirection: 'row',
    gap: 6
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  heroCta: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7
  },
  heroCtaText: {
    fontSize: 13,
    fontWeight: '900'
  },
  sectionHeader: {
    marginBottom: 11
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900'
  },
  quickGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 4,
    marginBottom: 20
  },
  quickCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 78,
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  quickDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 12
  },
  quickIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5
  },
  quickValue: {
    fontSize: 15.5,
    fontWeight: '800'
  },
  quickLabel: {
    fontSize: 9.5,
    marginTop: 1,
    textAlign: 'center'
  },
  exploreCard: {
    padding: 17,
    gap: 15,
    marginBottom: 14
  },
  exploreTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center'
  },
  exploreIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  exploreTitle: {
    fontSize: 17,
    fontWeight: '900'
  },
  exploreBody: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3
  },
  exploreFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  exploreLink: {
    fontSize: 12.5,
    fontWeight: '900'
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,4,9,0.68)',
    justifyContent: 'flex-end'
  },
  createSheetWrap: {
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 22 : 12
  },
  createSheet: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    paddingBottom: 16
  },
  sheetHandleWrap: {
    alignItems: 'center',
    marginBottom: 8
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 4
  },
  createSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 3,
    marginBottom: 12
  },
  createSheetClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  createSheetTitle: {
    fontSize: 20,
    fontWeight: '800'
  },
  createSheetSub: {
    fontSize: 10.5,
    marginTop: 1
  },
  createChoices: {
    gap: 8
  },
  createChoice: {
    minHeight: 68,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  createChoiceIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center'
  },
  createChoiceTitle: {
    fontSize: 14,
    fontWeight: '800'
  },
  createChoiceText: {
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 2
  },

  bottomDockWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: Platform.OS === 'ios' ? 9 : 8,
    zIndex: 50
  },
  bottomBar: {
    minHeight: 60,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 5
  },
  bottomItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2
  },
  bottomLabel: {
    width: '100%',
    textAlign: 'center',
    fontSize: 8.5,
    fontWeight: '700'
  },
  createSlot: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    marginTop: -14
  },
  createNavButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 9
  },
  createNavLabel: {
    width: '100%',
    textAlign: 'center',
    fontSize: 8.5,
    fontWeight: '800',
    marginTop: 2
  }
});
