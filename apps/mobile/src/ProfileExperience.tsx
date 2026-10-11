import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';
import { AppearanceExperience } from './AppearanceExperience';
import { AvatarStudioExperience } from './AvatarStudioExperience';
import { CreatorSettingsExperience } from './CreatorSettingsExperience';
import { GamePlatformExperience } from './GamePlatformExperience';
import { LanguageSettingsExperience } from './LanguageSettingsExperience';
import { MediaDownloadSettingsExperience } from './MediaDownloadSettingsExperience';
import { MobileAvatarQuickActions } from './MobileAvatarQuickActions';
import { MobilePlatformSyncStatus } from './MobilePlatformSyncStatus';
import { KNOWME_PRODUCT_VERSION } from '@knowme/link-contract';
import { MobileGameCenterExperience } from './MobileGameCenterExperience';
import { PaymentsExperience } from './PaymentsExperience';
import { PrivacyExperience } from './PrivacyExperience';
import { SecurityExperience } from './SecurityExperience';
import { SocialGiftsExperience } from './SocialGiftsExperience';
import {
  Avatar,
  FadeRise,
  GlassSurface,
  KnowMeIcon,
  KnowMeIconName,
  PressScale
} from './ui/KnowMeUI';

export type MobileUser = {
  id: string;
  accountId?: string;
  email: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  knowCoins?: number;
  role?: string;
  staff?: {
    isTeamMember: true;
    label: string;
    shield: string;
    role: string;
  } | null;
  verification?: {
    isVerified: true;
    label: string;
    level: string;
    verifiedAt: string;
    expiresAt: string;
    verificationId: string;
  } | null;
  premium?: {
    isPremium: true;
    label: string;
    expiresAt?: string | null;
  } | null;
};

type ProfilePanel =
  | 'main'
  | 'appearance'
  | 'language'
  | 'downloads'
  | 'creator'
  | 'avatar'
  | 'payments'
  | 'gifts'
  | 'games'
  | 'platform'
  | 'security'
  | 'sync'
  | 'privacy'
  | 'edit'
  | 'session';

type ReauthResult = {
  proofToken: string;
  assurance: string;
  expiresAt: string;
};

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function Button({ title, onPress, disabled = false, danger = false, secondary = false }: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  secondary?: boolean;
}) {
  const { colors } = useAppearance();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: danger || secondary ? 'transparent' : colors.accent,
          borderColor: danger ? colors.danger : secondary ? colors.accent : colors.accent
        },
        (danger || secondary) && { borderWidth: 1 },
        (pressed || disabled) && styles.buttonMuted
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          {
            color: danger
              ? colors.danger
              : secondary
                ? colors.accent
                : colors.accentText
          }
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function ProfileMenuRow({
  title,
  description,
  icon,
  tone = 'accent',
  onPress,
  last = false
}: {
  title: string;
  description: string;
  icon: KnowMeIconName;
  tone?: 'accent' | 'secondary' | 'danger';
  onPress: () => void;
  last?: boolean;
}) {
  const { colors } = useAppearance();
  const iconColor =
    tone === 'danger'
      ? colors.danger
      : tone === 'secondary'
        ? colors.secondary
        : colors.accent;

  return (
    <PressScale onPress={onPress} style={styles.profileMenuPress}>
      <View style={styles.profileMenuRow}>
        <View
          style={[
            styles.profileMenuIcon,
            { backgroundColor: colors.backgroundAccent }
          ]}
        >
          <KnowMeIcon name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.profileMenuTitle, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.profileMenuText, { color: colors.muted }]}>
            {description}
          </Text>
        </View>
        <KnowMeIcon name="arrow" size={17} color={colors.muted} />
      </View>
      {!last ? (
        <View
          pointerEvents="none"
          style={[
            styles.profileMenuDivider,
            { backgroundColor: colors.border }
          ]}
        />
      ) : null}
    </PressScale>
  );
}

// Keep related profile destinations inside one native glass section.
function ProfileMenuGroup({ children }: { children: ReactNode }) {
  const { visual } = useAppearance();
  return (
    <GlassSurface
      strength="soft"
      borderRadius={visual.cardRadius}
      style={styles.profileMenuGroup}
    >
      {children}
    </GlassSurface>
  );
}

export function ProfileExperience({ user, onUpdated, onLogout, onAccountDeleted, onOpenVerification, onCreateStory }: {
  user: MobileUser;
  onUpdated: () => Promise<void>;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => Promise<void>;
  onOpenVerification: () => void;
  onCreateStory: () => void;
}) {
  const { colors, visual } = useAppearance();
  const { locale } = useI18n();
  const en = locale === 'en';
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? '');
  const [password, setPassword] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [panel, setPanel] = useState<ProfilePanel>('main');

  useEffect(() => {
    setDisplayName(user.displayName);
    setBio(user.bio ?? '');
  }, [user]);

  async function save() {
    if (saving || displayName.trim().length < 2) return;
    setSaving(true);
    try {
      await apiFetch('/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim()
        })
      });
      await onUpdated();
      Alert.alert('Profil enregistré', 'Tes informations ont été mises à jour.');
    } catch (cause) {
      Alert.alert('Modification impossible', message(cause, 'Réessaie.'));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (password.length < 8 || deleting) return;
    Alert.alert(
      'Supprimer définitivement le compte ?',
      'KnowMe exigera une réauthentification serveur, puis supprimera toutes les données, décisions de confidentialité et appareils. Cette action ne peut pas être annulée.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => void deleteAccount() }
      ]
    );
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const proof = await apiFetch<ReauthResult>('/security/reauthenticate', {
        method: 'POST',
        body: JSON.stringify({
          password,
          code: deleteCode.trim() || undefined
        })
      });
      await apiFetch('/account', {
        method: 'DELETE',
        headers: { 'x-reauth-token': proof.proofToken },
        body: JSON.stringify({ password })
      });
      setPassword('');
      setDeleteCode('');
      await onAccountDeleted();
    } catch (cause) {
      Alert.alert('Suppression impossible', message(cause, 'Vérifie le mot de passe et le code 2FA.'));
    } finally {
      setDeleting(false);
    }
  }

  if (panel !== 'main') {
    const titleByPanel: Record<Exclude<ProfilePanel, 'main'>, string> = {
      appearance: 'Apparence',
      language: 'Langue et région',
      downloads: 'Téléchargements & stockage',
      creator: 'Mode créateur',
      avatar: 'Avatar Studio',
      payments: 'KnowCoins & paiements',
      gifts: 'Cadeaux sociaux',
      games: 'PLAY',
      platform: 'Plateforme de jeux',
      security: 'Sécurité',
      sync: 'Versions et synchronisation',
      privacy: 'Confidentialité',
      edit: 'Modifier mon profil',
      session: 'Session & compte'
    };

    return (
      <ScrollView
        style={[styles.root, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.panelContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <GlassSurface strength="soft" borderRadius={26} style={styles.panelHeader}>
          <PressScale
            onPress={() => setPanel('main')}
            style={[
              styles.backButton,
              {
                backgroundColor: colors.backgroundAccent,
                borderColor: colors.border
              }
            ]}
          >
            <KnowMeIcon name="back" size={18} color={colors.text} />
            <Text style={[styles.backButtonText, { color: colors.text }]}>Profil</Text>
          </PressScale>
          <Text style={[styles.panelTitle, { color: colors.text }]}>{titleByPanel[panel]}</Text>
        </GlassSurface>

        {panel === 'appearance' ? <AppearanceExperience /> : null}
        {panel === 'language' ? <LanguageSettingsExperience /> : null}
        {panel === 'downloads' ? <MediaDownloadSettingsExperience /> : null}
        {panel === 'creator' ? <CreatorSettingsExperience /> : null}
        {panel === 'avatar' ? <AvatarStudioExperience /> : null}
        {panel === 'payments' ? <PaymentsExperience /> : null}
        {panel === 'gifts' ? <SocialGiftsExperience /> : null}
        {panel === 'games' ? <MobileGameCenterExperience /> : null}
        {panel === 'platform' ? <GamePlatformExperience /> : null}
        {panel === 'security' ? (
          <SecurityExperience onSessionClosed={onAccountDeleted} />
        ) : null}
        {panel === 'privacy' ? <PrivacyExperience /> : null}
        {panel === 'sync' ? <MobilePlatformSyncStatus /> : null}

        {panel === 'edit' ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.editIdentityRow}>
              <Avatar uri={user.avatarUrl} name={displayName || user.displayName} size={50} />
              <View style={styles.flex}>
                <Text style={[styles.editIdentityName, { color: colors.text }]}>
                  {displayName || user.displayName}
                </Text>
                <Text style={[styles.editIdentityHandle, { color: colors.accent }]}>
                  @{user.username}
                </Text>
                <Text style={[styles.helper, { color: colors.muted }]}>
                  Nom d’utilisateur unique
                </Text>
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Nom affiché</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={60}
                placeholder="Ton nom visible"
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
              />
            </View>

            <View style={styles.fieldBlock}>
              <View style={styles.fieldLabelRow}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Biographie</Text>
                <Text style={[styles.fieldCounter, { color: colors.muted }]}>{bio.length}/500</Text>
              </View>
              <TextInput
                value={bio}
                onChangeText={setBio}
                maxLength={500}
                multiline
                placeholder="Parle un peu de toi"
                placeholderTextColor={colors.muted}
                selectionColor={colors.accent}
                style={[
                  styles.input,
                  styles.multiline,
                  {
                    backgroundColor: colors.backgroundAccent,
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
              />
            </View>

            <Text style={[styles.helper, { color: colors.muted }]}>
              Le nom affiché doit contenir au moins 2 caractères.
            </Text>
            <Button title={saving ? 'Enregistrement…' : 'Enregistrer'} disabled={saving || displayName.trim().length < 2} onPress={() => void save()} />
          </View>
        ) : null}

        {panel === 'session' ? (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Session</Text>
              <Text style={[styles.description, { color: colors.text }]}>Déconnecte cet appareil sans supprimer ton compte. L’autorisation d’appareil de confiance reste révocable séparément.</Text>
              <Button title="Se déconnecter" onPress={() => void onLogout()} />
            </View>

            <View style={[styles.card, styles.dangerZone, { backgroundColor: colors.surface, borderColor: colors.danger }]}>
              <Text style={[styles.dangerHeading, { color: colors.danger }]}>Zone dangereuse</Text>
              <Text style={[styles.description, { color: colors.text }]}>La suppression exige toujours le mot de passe, une preuve serveur récente et le second facteur lorsqu’il est actif.</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Mot de passe actuel"
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
              />
              <TextInput
                value={deleteCode}
                onChangeText={setDeleteCode}
                autoCapitalize="characters"
                placeholder="Code 2FA ou récupération, si activé"
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
              />
              <Button title={deleting ? 'Suppression…' : 'Supprimer mon compte'} disabled={deleting || password.length < 8} danger onPress={confirmDelete} />
            </View>
          </>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <FadeRise>
        <GlassSurface
          strength="medium"
          borderRadius={visual.cardRadius}
          style={styles.profileHero}
        >
        <View style={[styles.cover, { backgroundColor: colors.backgroundAccent }]}>
          <View style={[styles.coverOrbOne, { backgroundColor: colors.accent }]} />
          <View style={[styles.coverOrbTwo, { backgroundColor: colors.secondary }]} />
          <View style={[styles.coverGlassLine, { backgroundColor: colors.surfaceGlass }]} />
          <View style={[styles.coverGlassDot, { backgroundColor: colors.accent }]} />
        </View>

        <View style={styles.profileAvatarRow}>
          <View style={{width:96,height:96,position:'relative'}}>
            <Avatar
              uri={user.avatarUrl}
              name={user.displayName}
              size={96}
              ring
            />
            <MobileAvatarQuickActions
              avatarUrl={user.avatarUrl}
              displayName={user.displayName}
              onCreateStory={onCreateStory}
              onUpdated={onUpdated}
            />
          </View>
        </View>

        <View style={styles.profileTitleRow}>
          <View style={styles.profileTitleIdentity}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.heading, styles.headingCompact, { color: colors.text }]}>
              {user.displayName}
            </Text>
            {user.staff ? (
              <View accessible accessibilityLabel={user.staff.label + ', ' + user.staff.role}
                style={styles.staffSeal}>
                <KnowMeIcon name="check" size={13} color="#4A3108" strokeWidth={2.4}/>
              </View>
            ) : null}
            {user.verification ? (
              <KnowMeIcon name="check" size={18} color={colors.accent}/>
            ) : null}
          </View>
          <Pressable accessibilityRole="button"
            accessibilityLabel={en ? 'Profile options' : 'Options du profil'}
            onPress={() => setProfileMenuOpen(true)}
            style={[styles.profileMoreButton, { backgroundColor: colors.surfaceGlass, borderColor: colors.border }]}>
            <View style={styles.moreDots}>
              <View style={[styles.moreDot, { backgroundColor: colors.text }]}/>
              <View style={[styles.moreDot, { backgroundColor: colors.text }]}/>
              <View style={[styles.moreDot, { backgroundColor: colors.text }]}/>
            </View>
          </Pressable>
        </View>
        <Text style={[styles.handle, { color: colors.accent }]}>@{user.username}</Text>
        <Text style={{color:colors.muted,fontSize:11,paddingHorizontal:18,marginTop:4}}>KnowMe {KNOWME_PRODUCT_VERSION} · Android</Text>


        {user.bio?.trim() ? (
          <Text style={[styles.bio, { color: colors.text }]}>{user.bio}</Text>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setPanel('edit')} style={styles.addBioButton}>
            <KnowMeIcon name="edit" size={16} color={colors.muted}/>
            <Text style={[styles.bioMuted, { color: colors.muted }]}>
              {en ? 'Add a bio' : 'Ajouter une bio'}
            </Text>
          </Pressable>
        )}


        </GlassSurface>
      </FadeRise>

      <Modal visible={profileMenuOpen} transparent animationType="fade"
        onRequestClose={() => setProfileMenuOpen(false)}>
        <Pressable style={styles.profileMoreShade} onPress={() => setProfileMenuOpen(false)}>
          <Pressable onPress={event => event.stopPropagation()}
            style={[styles.profileMoreSheet, {backgroundColor:colors.surface,borderColor:colors.border}]}>
            <Text style={[styles.profileMoreTitle, {color:colors.text}]}>
              {en ? 'Profile options' : 'Options du profil'}
            </Text>
            {([
              {text:en ? 'Edit profile' : 'Modifier mon profil', action:() => setPanel('edit')},
              {text:en ? 'Avatar studio' : 'Studio avatar', action:() => setPanel('avatar')},
              {text:en ? 'Identity verification' : 'Vérifier mon identité', action:onOpenVerification},
              {text:en ? 'Appearance and themes' : 'Apparence et thèmes', action:() => setPanel('appearance')}
            ]).map(item => (
              <Pressable key={item.text} accessibilityRole="button"
                style={styles.profileMoreAction} onPress={() => {setProfileMenuOpen(false);item.action();}}>
                <Text style={{color:colors.text,fontSize:15,fontWeight:'600'}}>{item.text}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" style={styles.profileMoreDismiss}
              onPress={() => setProfileMenuOpen(false)}>
              <Text style={{color:colors.accent,fontWeight:'700'}}>
                {en ? 'Close' : 'Fermer'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <FadeRise delay={70} style={styles.profileMenuSection}>
        <Text style={[styles.profileGroupLabel, { color: colors.muted }]}>
          IDENTITÉ
        </Text>
        <ProfileMenuGroup>
          <ProfileMenuRow
            title="Identité et confiance"
            description="Vérification et preuves de confiance."
            icon="check"
            onPress={onOpenVerification}
          />
          <ProfileMenuRow
            title="Modifier mon profil"
            description="Nom et biographie."
            icon="profile"
            tone="secondary"
            onPress={() => setPanel('edit')}
          />
          <ProfileMenuRow
            title="Avatar Studio"
            description="Construis ton identité visuelle."
            icon="profile"
            tone="secondary"
            onPress={() => setPanel('avatar')}
            last
          />
        </ProfileMenuGroup>

        <Text style={[styles.profileGroupLabel, { color: colors.muted }]}>
          PERSONNALISATION
        </Text>
        <ProfileMenuGroup>
          <ProfileMenuRow
            title="Apparence"
            description="Thèmes, glass, animations et personnalisation."
            icon="spark"
            tone="secondary"
            onPress={() => setPanel('appearance')}
          />
          <ProfileMenuRow
            title="Langue et région"
            description="Choisis la langue de toute l’interface."
            icon="discover"
            onPress={() => setPanel('language')}
          />
          <ProfileMenuRow
            title="Téléchargements & stockage"
            description="Médias, données mobiles et cache local."
            icon="settings"
            onPress={() => setPanel('downloads')}
            last
          />
        </ProfileMenuGroup>

        <Text style={[styles.profileGroupLabel, { color: colors.muted }]}>
          UNIVERS
        </Text>
        <ProfileMenuGroup>
          <ProfileMenuRow
            title="Mode créateur"
            description="Profil public, catégorie et statistiques."
            icon="profile"
            tone="secondary"
            onPress={() => setPanel('creator')}
          />
          <ProfileMenuRow
            title="KnowCoins & paiements"
            description="Solde, achats et avantages."
            icon="coins"
            onPress={() => setPanel('payments')}
          />
          <ProfileMenuRow
            title="Cadeaux sociaux"
            description="Envoie et gère tes cadeaux."
            icon="spark"
            tone="secondary"
            onPress={() => setPanel('gifts')}
          />
          <ProfileMenuRow
            title="PLAY"
            description="Jeux, récompenses et défis ludiques."
            icon="challenge"
            onPress={() => setPanel('games')}
          />
          <ProfileMenuRow
            title="Plateforme de jeux"
            description="Réglages et expérience de la plateforme PLAY."
            icon="challenge"
            tone="secondary"
            onPress={() => setPanel('platform')}
            last
          />
        </ProfileMenuGroup>

        <Text style={[styles.profileGroupLabel, { color: colors.muted }]}>
          CONTRÔLES
        </Text>
        <ProfileMenuGroup>
          <ProfileMenuRow
            title="Sécurité"
            description="Sessions, 2FA et appareils de confiance."
            icon="settings"
            tone="secondary"
            onPress={() => setPanel('security')}
          />
          <ProfileMenuRow
            title="Confidentialité"
            description="Contrôle ce que les autres peuvent voir."
            icon="settings"
            tone="secondary"
            onPress={() => setPanel('privacy')}
          />
          <ProfileMenuRow
            title="Versions et synchronisation"
            description="Vérifier APK, site et API avec le commit réel."
            icon="refresh"
            onPress={() => setPanel('sync')}
          />
          <ProfileMenuRow
            title="Session & compte"
            description="Déconnexion et gestion du compte."
            icon="settings"
            tone="danger"
            onPress={() => setPanel('session')}
            last
          />
        </ProfileMenuGroup>
      </FadeRise>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  panelContent: { padding: 16, paddingBottom: 30, gap: 12 },
  panelHeader: { minHeight: 52, padding: 7, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  backButton: { minHeight: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  backButtonText: { fontSize: 11.5, fontWeight: '700' },
  panelTitle: { fontSize: 19, fontWeight: '800', flex: 1 },
  content: { padding: 16, paddingBottom: 30, gap: 12 },
  profileHero: { overflow: 'hidden', paddingBottom: 14 },
  cover: { height: 104, position: 'relative', overflow: 'hidden' },
  coverOrbOne: { position: 'absolute', width: 180, height: 180, borderRadius: 90, opacity: 0.22, right: -40, top: -72 },
  coverOrbTwo: { position: 'absolute', width: 130, height: 130, borderRadius: 65, opacity: 0.14, left: -30, bottom: -75 },
  coverGlassLine: { position: 'absolute', width: 170, height: 24, borderRadius: 12, right: -28, bottom: 16, opacity: 0.22, transform: [{ rotate: '-12deg' }] },
  coverGlassDot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, left: 22, top: 22, opacity: 0.34 },
  profileAvatarRow: { marginTop: -36, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end' },
  profileTitleRow: { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:16, marginTop:10 },
  profileTitleIdentity: {flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:5},
  headingCompact: {paddingHorizontal:0,marginTop:0,flexShrink:1},
  staffSeal: {width:19,height:19,borderRadius:10,backgroundColor:'#E8BB52',borderWidth:1,borderColor:'#A4771E',alignItems:'center',justifyContent:'center',flexShrink:0},
  profileMoreButton: {width:44,height:44,borderRadius:22,borderWidth:1,alignItems:'center',justifyContent:'center'},
  moreDots: {gap:3,alignItems:'center'},
  moreDot: {width:4,height:4,borderRadius:2},
  addBioButton: {flexDirection:'row',alignItems:'center',gap:6,minHeight:44,paddingHorizontal:18,marginTop:3,alignSelf:'flex-start'},
  profileMoreShade: {flex:1,backgroundColor:'rgba(0,0,0,.58)',justifyContent:'flex-end'},
  profileMoreSheet: {borderTopLeftRadius:26,borderTopRightRadius:26,borderWidth:1,paddingHorizontal:17,paddingTop:18,paddingBottom:30},
  profileMoreTitle: {fontSize:18,fontWeight:'800',marginBottom:12},
  profileMoreAction: {minHeight:51,justifyContent:'center',paddingHorizontal:10,borderRadius:13},
  profileMoreDismiss: {minHeight:47,alignItems:'center',justifyContent:'center',marginTop:8},
  profileActions: { flexDirection: 'row', gap: 7, paddingHorizontal: 16, marginTop: 11 },
  profileActionPress: { flex: 1, borderRadius: 18 },
  profileAction: { minHeight: 38, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  profileActionText: { fontSize: 10.5, fontWeight: '700' },
  heading: { fontSize: 24, fontWeight: '800', paddingHorizontal: 16, marginTop: 10, letterSpacing: -0.5 },
  handle: { fontWeight: '800', paddingHorizontal: 18, marginTop: 3 },
  bio: { fontSize: 14, lineHeight: 20, paddingHorizontal: 18, marginTop: 11 },
  bioMuted: { fontSize: 13, lineHeight: 19, paddingHorizontal: 18, marginTop: 11 },
  muted: {},
  accountId: { fontSize: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 18, marginTop: 13 },
  identityBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  identityBadgeText: { fontWeight: '900', fontSize: 11.5 },
  profileMenuSection: { gap: 9 },
  profileMenuHeading: { fontSize: 18, fontWeight: '800', marginTop: 3, marginBottom: 1 },
  profileGroupLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.15, marginTop: 8, marginLeft: 4 },
  profileMenuGroup: { overflow: 'hidden' },
  profileMenuPress: { width: '100%' },
  profileMenuRow: { minHeight: 60, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileMenuDivider: { height: StyleSheet.hairlineWidth, marginLeft: 58, marginRight: 11 },
  profileMenuIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  profileMenuTitle: { fontSize: 13.5, fontWeight: '800' },
  profileMenuText: { fontSize: 10, lineHeight: 14, marginTop: 1 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 15, gap: 11 },
  cardTitle: { fontSize: 17.5, fontWeight: '800' },
  description: { fontSize: 15, lineHeight: 22 },
  helper: { fontSize: 12, lineHeight: 18 },
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14.5, textAlignVertical: 'top' },
  multiline: { minHeight: 84 },
  editIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 3, marginBottom: 2 },
  editIdentityName: { fontSize: 15, fontWeight: '800' },
  editIdentityHandle: { fontSize: 12, fontWeight: '700', marginTop: 1 },
  fieldBlock: { gap: 6 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  fieldLabel: { fontSize: 11.5, fontWeight: '700', paddingHorizontal: 2 },
  fieldCounter: { fontSize: 10.5 },
  button: { borderRadius: 20, paddingVertical: 12, paddingHorizontal: 15, alignItems: 'center' },
  buttonText: { fontWeight: '900' },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 1 },
  secondaryButtonText: {},
  buttonMuted: { opacity: 0.45 },
  dangerZone: {},
  dangerHeading: { fontSize: 19, fontWeight: '900' },
  dangerButton: { backgroundColor: 'transparent', borderWidth: 1 },
  dangerText: {}
});