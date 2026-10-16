import { KnowMeAlert as Alert } from './ui/KnowMeFeedback';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { API_URL, apiFetch } from './api';
import { AndroidMediaLibraryPicker, type SelectedAndroidMedia } from './AndroidMediaLibraryPicker';
import { uploadKnowMeMobileMedia } from './mobile-media-upload';
import { useAppearance } from './AppearanceProvider';
import type { DockPreferences } from './navigation-dock-preferences';
import { AppearanceExperience } from './AppearanceExperience';
import { AvatarStudioExperience } from './AvatarStudioExperience';
import { CreatorSettingsExperience } from './CreatorSettingsExperience';
import { GamePlatformExperience } from './GamePlatformExperience';
import { LanguageSettingsExperience } from './LanguageSettingsExperience';
import { MediaDownloadSettingsExperience } from './MediaDownloadSettingsExperience';
import { MobileAvatarQuickActions } from './MobileAvatarQuickActions';
import { MobilePlatformSyncStatus } from './MobilePlatformSyncStatus';
import { checkKnowMeUpdateNow } from './updates/MobileUpdateNotice';
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

type ProfilePublicContent = {
  header: { coverAssetId: string | null };
  statistics?: Record<string, number | string | boolean | null> | null;
  wall?: Array<{ id: string; text: string | null; createdAt: string }> | null;
};

const PROFILE_STAT_LABELS: Record<string, string> = {
  friends: 'Amis',
  followers: 'Abonnés',
  following: 'Abonnements',
  level: 'Niveau',
  xp: 'XP'
};

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

export function ProfileExperience({ user, onUpdated, onLogout, onAccountDeleted, onOpenVerification, onCreateStory, onSubscreenChange, dockPreferences, onDockPreferencesChange }: {
  user: MobileUser;
  onUpdated: () => Promise<void>;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => Promise<void>;
  onOpenVerification: () => void;
  onCreateStory: () => void;
  onSubscreenChange?: (active: boolean) => void;
  dockPreferences: DockPreferences;
  onDockPreferencesChange: (next: DockPreferences) => void;
}) {
  const { colors, visual } = useAppearance();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? '');
  const [password, setPassword] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [panel, setPanel] = useState<ProfilePanel>('main');

  useEffect(() => {
    onSubscreenChange?.(panel !== 'main');
    return () => onSubscreenChange?.(false);
  }, [panel, onSubscreenChange]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverAssetId, setCoverAssetId] = useState<string | null>(null);
  const [publicContent, setPublicContent] = useState<ProfilePublicContent | null>(null);
  const [coverImageFailed, setCoverImageFailed] = useState(false);

  useEffect(() => {
    setDisplayName(user.displayName);
    setBio(user.bio ?? '');
  }, [user]);

  useEffect(() => {
    let mounted = true;
    setCoverAssetId(null);
    setPublicContent(null);
    setCoverImageFailed(false);
    void apiFetch<ProfilePublicContent>(
      `/profile-experience/public/${encodeURIComponent(user.username)}`
    ).then(snapshot => {
      if (mounted) {
        setCoverAssetId(snapshot.header.coverAssetId);
        setPublicContent(snapshot);
        setCoverImageFailed(false);
      }
    }).catch(() => {
      // The profile remains usable without a public cover.
    });
    return () => { mounted = false; };
  }, [user.id, user.username]);

  async function changeCover(media: SelectedAndroidMedia) {
    setCoverPickerOpen(false);
    if (coverBusy) return;
    setCoverBusy(true);
    try {
      const assetId = await uploadKnowMeMobileMedia(media, 'COVER');
      await apiFetch('/profile-experience/me', {
        method: 'PATCH',
        body: JSON.stringify({ coverAssetId: assetId })
      });
      setCoverAssetId(assetId);
      setPublicContent(current => current ? {
        ...current, header: { ...current.header, coverAssetId: assetId }
      } : null);
      setCoverImageFailed(false);
      Alert.alert('Couverture mise à jour', 'Ta nouvelle couverture est enregistrée.');
    } catch (cause) {
      Alert.alert('Couverture non modifiée', message(cause, 'Réessaie plus tard.'));
    } finally {
      setCoverBusy(false);
    }
  }

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
      edit: 'Modifier mes informations',
      session: 'Comptes et déconnexion'
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

        {panel === 'appearance' ? (
          <>
            <GlassSurface strength="soft" borderRadius={20} style={styles.navSettingsPanel}>
              <Text style={[styles.cardTitle,{color:colors.text}]}>Barre de navigation</Text>
              <Text style={[styles.helper,{color:colors.muted}]}>
                Six actions, position et masquage pendant le défilement.
              </Text>
              <View style={styles.navPositionRow}>
                {(['bottom','top'] as const).map(position=>(
                  <PressScale key={position}
                    accessibilityRole="button"
                    accessibilityLabel={position==='bottom'?'Position en bas':'Position en haut'}
                    accessibilityState={{selected:dockPreferences.position===position}}
                    onPress={()=>onDockPreferencesChange({...dockPreferences,position})}
                    style={[styles.navPositionButton,{
                      backgroundColor:dockPreferences.position===position?colors.backgroundAccent:colors.surface,
                      borderColor:dockPreferences.position===position?colors.accent:colors.border
                    }]}>
                    <Text style={{color:dockPreferences.position===position?colors.accent:colors.text,fontWeight:'800'}}>
                      {position==='bottom'?'En bas':'En haut'}
                    </Text>
                  </PressScale>
                ))}
              </View>
              <PressScale accessibilityRole="switch"
                accessibilityState={{checked:dockPreferences.autoHide}}
                onPress={()=>onDockPreferencesChange({...dockPreferences,autoHide:!dockPreferences.autoHide})}
                style={styles.navAutohideRow}>
                <Text style={{color:colors.text,flex:1,fontSize:13,fontWeight:'700'}}>
                  Masquer pendant le défilement
                </Text>
                <Text style={{color:colors.accent,fontWeight:'800'}}>
                  {dockPreferences.autoHide?'Activé':'Désactivé'}
                </Text>
              </PressScale>
            </GlassSurface>
            <AppearanceExperience />
          </>
        ) : null}
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
              <Text style={[styles.cardTitle, { color: colors.text }]}>Mon compte</Text>
              <View style={styles.editIdentityRow}>
                <Avatar uri={user.avatarUrl} name={user.displayName} size={47}/>
                <View style={styles.flex}>
                  <Text style={[styles.editIdentityName,{color:colors.text}]}>{user.displayName}</Text>
                  <Text style={[styles.editIdentityHandle,{color:colors.muted}]}>@{user.username}</Text>
                </View>
              </View>
              <Text style={[styles.description,{color:colors.muted}]}>
                Pour utiliser un autre compte sur ce téléphone, déconnecte d'abord la session actuelle.
              </Text>
              <Button title="Se connecter avec un autre compte" secondary onPress={()=>{
                Alert.alert('Changer de compte',
                  'Ta session actuelle sera déconnectée. Tu pourras ensuite te connecter avec un autre compte KnowMe.',[
                    {text:'Annuler',style:'cancel'},
                    {text:'Continuer',onPress:()=>{void onLogout();}}
                  ]);
              }}/>
              <Button title="Se déconnecter" danger onPress={()=>{
                Alert.alert('Se déconnecter ?',
                  'Tu devras te reconnecter pour retrouver tes conversations.',[
                    {text:'Annuler',style:'cancel'},
                    {text:'Déconnexion',style:'destructive',onPress:()=>{void onLogout();}}
                  ]);
              }}/>
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
      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Ouvrir les versions de KnowMe et vérifier les mises à jour"
        onPress={() => setPanel('sync')}
        style={[
          styles.directUpdateAccess,
          { backgroundColor: colors.backgroundAccent, borderColor: colors.border }
        ]}
      >
        <KnowMeIcon name="refresh" size={20} color={colors.accent} />
        <View style={styles.flex}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
            Versions et mises à jour
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
            Vérifier KnowMe Android, le site et le serveur
          </Text>
        </View>
        <KnowMeIcon name="arrow" size={18} color={colors.accent} />
      </PressScale>
      <FadeRise>
        <GlassSurface
          strength="medium"
          borderRadius={visual.cardRadius}
          style={styles.profileHero}
        >
        <View style={[styles.cover, { backgroundColor: colors.backgroundAccent }]}>
          {coverAssetId && !coverImageFailed ? (
            <Image
              source={{ uri: /^https:\/\//i.test(coverAssetId)
                ? coverAssetId
                : `${API_URL}/media/public/cover/${encodeURIComponent(coverAssetId)}` }}
              resizeMode="cover"
              onError={() => setCoverImageFailed(true)}
              style={StyleSheet.absoluteFillObject}
              accessibilityLabel="Couverture de profil"
            />
          ) : (
            <>
              <View style={[styles.coverOrbOne, { backgroundColor: colors.accent }]} />
              <View style={[styles.coverOrbTwo, { backgroundColor: colors.secondary }]} />
            </>
          )}
          <PressScale
            onPress={() => setCoverPickerOpen(true)}
            disabled={coverBusy}
            accessibilityRole="button"
            accessibilityLabel="Changer ma couverture"
            style={[styles.coverEdit, { backgroundColor: colors.surfaceGlass, borderColor: colors.border }]}
          >
            <KnowMeIcon name="create" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>
              {coverBusy ? 'Envoi…' : 'Couverture'}
            </Text>
          </PressScale>
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

        <View style={styles.profileNameRow}>
          <View style={styles.flex}>
            <Text style={[styles.heading, { color: colors.text }]}>{user.displayName}</Text>
            <Text style={[styles.handle, { color: colors.accent }]}>@{user.username}</Text>
          </View>
          <PressScale
            onPress={() => setMoreOpen(true)}
            style={[styles.profileMoreButton, { borderColor: colors.border, backgroundColor: colors.surfaceGlass }]}
            accessibilityRole="button"
            accessibilityLabel="Options du profil"
          >
            <Text style={{ color: colors.text, fontSize: 23, fontWeight: '700' }}>⋮</Text>
          </PressScale>
        </View>

        <View style={styles.profileActions}>
          <PressScale
            onPress={() => setPanel('edit')}
            style={styles.profileActionPress}
          >
            <GlassSurface
              strength="soft"
              borderRadius={21}
              style={styles.profileAction}
            >
              <KnowMeIcon name="profile" size={19} color={colors.accent} />
              <Text style={[styles.profileActionText, { color: colors.text }]}>
                Modifier
              </Text>
            </GlassSurface>
          </PressScale>
          <PressScale
            onPress={onOpenVerification}
            style={styles.profileActionPress}
          >
            <GlassSurface
              strength="soft"
              borderRadius={21}
              style={styles.profileAction}
            >
              <KnowMeIcon name="check" size={19} color={colors.accent} />
              <Text style={[styles.profileActionText, { color: colors.text }]}>
                Identité
              </Text>
            </GlassSurface>
          </PressScale>
          <PressScale
            onPress={() => setPanel('appearance')}
            style={styles.profileActionPress}
          >
            <GlassSurface
              strength="soft"
              borderRadius={21}
              style={styles.profileAction}
            >
              <KnowMeIcon name="spark" size={19} color={colors.secondary} />
              <Text style={[styles.profileActionText, { color: colors.text }]}>
                Style
              </Text>
            </GlassSurface>
          </PressScale>
        </View>
        <PressScale accessibilityRole="button" accessibilityLabel="Comptes et déconnexion"
          onPress={()=>setPanel('session')}
          style={[styles.profileAccountAccess,{borderColor:colors.border}]}>
          <KnowMeIcon name="profile" size={18} color={colors.accent}/>
          <Text style={{flex:1,color:colors.text,fontSize:13,fontWeight:'700'}}>
            Comptes et déconnexion
          </Text>
          <KnowMeIcon name="arrow" size={17} color={colors.muted}/>
        </PressScale>

        <PressScale onPress={() => setPanel('edit')} accessibilityRole="button" accessibilityLabel={user.bio ? 'Modifier la biographie' : 'Ajouter une bio'}>
          <Text style={[user.bio ? styles.bio : styles.bioMuted, { color: user.bio ? colors.text : colors.muted }]}>
            {user.bio || '✎  Ajouter une bio'}
          </Text>
        </PressScale>

        <View style={styles.badges}>
          {user.verification ? (
            <View
              style={[
                styles.identityBadge,
                {
                  borderColor: colors.accent,
                  backgroundColor: colors.backgroundAccent
                }
              ]}
              accessibilityLabel={user.verification.label}
            >
              <Text style={[styles.identityBadgeText, { color: colors.accent }]}>
                VERIFIED · {user.verification.label}
              </Text>
            </View>
          ) : null}
          {user.premium ? (
            <View
              style={[
                styles.identityBadge,
                {
                  borderColor: colors.secondary,
                  backgroundColor: colors.backgroundAccent
                }
              ]}
              accessibilityLabel={user.premium.label}
            >
              <Text style={[styles.identityBadgeText, { color: colors.secondary }]}>
                PREMIUM · {user.premium.label}
              </Text>
            </View>
          ) : null}
          {user.staff ? (
            <View
              style={[
                styles.identityBadge,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundAccent
                }
              ]}
              accessibilityLabel={user.staff.label + ', ' + user.staff.role}
            >
              <Text style={[styles.identityBadgeText, { color: colors.text }]}>
                STAFF · {user.staff.label} · {user.staff.role}
              </Text>
            </View>
          ) : null}
        </View>

        </GlassSurface>
      </FadeRise>

      {publicContent ? (
        <View style={styles.profileSocialSections}>
          {publicContent.statistics ? (
            <View style={[styles.profileStatStrip, { borderColor: colors.border }]}>
              {Object.entries(publicContent.statistics)
                .filter(([key, value]) => key in PROFILE_STAT_LABELS && value != null && typeof value !== 'boolean')
                .slice(0, 4)
                .map(([key, value]) => (
                  <View key={key} style={styles.profileStat}>
                    <Text style={[styles.profileStatValue, { color: colors.text }]}>{String(value)}</Text>
                    <Text style={[styles.profileStatLabel, { color: colors.muted }]}>{PROFILE_STAT_LABELS[key]}</Text>
                  </View>
                ))}
            </View>
          ) : null}
          {publicContent.wall ? (
            <View style={{ gap: 9 }}>
              <Text style={[styles.profileSectionTitle, { color: colors.text }]}>Publications du mur</Text>
              {publicContent.wall.length > 0 ? publicContent.wall.slice(0, 5).map(entry => (
                <View key={entry.id} style={[styles.profileWallEntry, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {new Date(entry.createdAt).toLocaleDateString('fr-FR')}
                  </Text>
                  {entry.text ? <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>{entry.text}</Text> : null}
                </View>
              )) : (
                <Text style={{ color: colors.muted, fontSize: 13 }}>Aucune publication visible sur ton mur.</Text>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      <FadeRise delay={70} style={styles.profileMenuSection}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Afficher les paramètres du profil"
          onPress={() => setSettingsOpen(value => !value)}
          style={[styles.settingsToggle, { borderColor: colors.border, backgroundColor: colors.surfaceGlass }]}
        >
          <KnowMeIcon name="settings" size={21} color={colors.accent} />
          <Text style={[styles.profileMenuHeading, { color: colors.text }]}>Paramètres du profil</Text>
          <Text style={{ color: colors.muted, fontSize: 17 }}>{settingsOpen ? '⌃' : '⌄'}</Text>
        </PressScale>
        {settingsOpen ? <View style={{ gap: 9 }}>

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
            title="Modifier mes informations"
            description="Nom affiché, biographie et identité du compte."
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
            title="Vérifier les mises à jour"
            description="Chercher une nouvelle APK et l’installer depuis KnowMe."
            icon="refresh"
            tone="secondary"
            onPress={() => {
              void checkKnowMeUpdateNow().then((result) => {
                if (result === 'available') return; // The in-app update sheet opens automatically.
                Alert.alert(
                  'Mises à jour KnowMe',
                  result === 'current'
                    ? 'Aucune nouvelle version publiée pour cet appareil.'
                    : result === 'unsupported'
                      ? 'Cette APK ne dispose pas encore de la mise à jour intégrée. Installe une fois une version KnowMe compatible et signée.'
                      : 'Impossible de vérifier les mises à jour. Vérifie ta connexion puis réessaie.'
                );
              });
            }}
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
        </View> : null}
      </FadeRise>
      <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
        <Pressable onPress={() => setMoreOpen(false)} style={styles.moreBackdrop}>
          <Pressable onPress={event => event.stopPropagation()} style={[styles.moreSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.moreTitle, { color: colors.text }]}>Options du profil</Text>
            {([
              ['Modifier mon profil', 'edit'],
              ['Changer la couverture', 'cover'],
              ['Apparence et thèmes', 'appearance'],
              ['Confidentialité', 'privacy'],
              ['Sécurité du compte', 'security']
            ] as const).map(([label, target]) => (
              <Pressable key={target} accessibilityRole="button" style={styles.moreAction}
                onPress={() => {
                  setMoreOpen(false);
                  if (target === 'cover') setCoverPickerOpen(true);
                  else setPanel(target);
                }}>
                <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
                <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" style={styles.moreDismiss} onPress={() => setMoreOpen(false)}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Fermer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <AndroidMediaLibraryPicker
        visible={coverPickerOpen}
        purpose="cover"
        allowVideo={false}
        mediaFilter="photo"
        onClose={() => setCoverPickerOpen(false)}
        onPicked={media => { void changeCover(media); }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  directUpdateAccess: { minHeight: 64, borderWidth: 1, borderRadius: 21, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },
  panelContent: { padding: 16, paddingBottom: 30, gap: 12 },
  panelHeader: { minHeight: 52, padding: 7, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  backButton: { minHeight: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  backButtonText: { fontSize: 11.5, fontWeight: '700' },
  panelTitle: { fontSize: 19, fontWeight: '800', flex: 1 },
  content: { padding: 16, paddingBottom: 30, gap: 12 },
  profileHero: { overflow: 'hidden', paddingBottom: 14 },
  cover: { height: 152, position: 'relative', overflow: 'hidden' },
  coverEdit: { position: 'absolute', top: 10, right: 10, minHeight: 38, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, paddingHorizontal: 12 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 14, gap: 8 },
  profileMoreButton: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  settingsToggle: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, minHeight: 53, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth },
  moreBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.6)' },
  moreSheet: { padding: 16, paddingBottom: 28, borderWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  moreTitle: { fontSize: 18, fontWeight: '800', marginBottom: 9 },
  moreAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, minHeight: 50 },
  moreDismiss: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  coverOrbOne: { position: 'absolute', width: 180, height: 180, borderRadius: 90, opacity: 0.22, right: -40, top: -72 },
  coverOrbTwo: { position: 'absolute', width: 130, height: 130, borderRadius: 65, opacity: 0.14, left: -30, bottom: -75 },
  coverGlassLine: { position: 'absolute', width: 170, height: 24, borderRadius: 12, right: -28, bottom: 16, opacity: 0.22, transform: [{ rotate: '-12deg' }] },
  coverGlassDot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, left: 22, top: 22, opacity: 0.34 },
  profileAvatarRow: { marginTop: -36, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end' },
  profileActions: { flexDirection: 'row', gap: 7, paddingHorizontal: 16, marginTop: 11 },
  profileAccountAccess:{marginHorizontal:16,marginTop:9,minHeight:44,paddingHorizontal:12,
    flexDirection:'row',alignItems:'center',gap:9,borderTopWidth:StyleSheet.hairlineWidth},
  profileActionPress: { flex: 1, borderRadius: 18 },
  profileAction: { minHeight: 38, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  profileActionText: { fontSize: 10.5, fontWeight: '700' },
  navSettingsPanel: {padding:14,gap:10},
  navPositionRow: {flexDirection:'row',gap:9},
  navPositionButton: {flex:1,minHeight:44,borderRadius:14,borderWidth:1,
    alignItems:'center',justifyContent:'center'},
  navAutohideRow: {flexDirection:'row',minHeight:44,alignItems:'center',gap:9},
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
  profileSocialSections: { gap: 14, marginTop: 2 },
  profileStatStrip: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  profileStat: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5 },
  profileStatValue: { fontSize: 18, fontWeight: '800' },
  profileStatLabel: { fontSize: 11, textAlign: 'center' },
  profileSectionTitle: { fontSize: 17, fontWeight: '800' },
  profileWallEntry: { paddingVertical: 9, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth },
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