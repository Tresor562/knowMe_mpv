import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { AppearanceExperience } from './AppearanceExperience';
import { AvatarStudioExperience } from './AvatarStudioExperience';
import { GamePlatformExperience } from './GamePlatformExperience';
import { LanguageSettingsExperience } from './LanguageSettingsExperience';
import { MobileGameCenterExperience } from './MobileGameCenterExperience';
import { PaymentsExperience } from './PaymentsExperience';
import { PrivacyExperience } from './PrivacyExperience';
import { SecurityExperience } from './SecurityExperience';
import { SocialGiftsExperience } from './SocialGiftsExperience';
import { Avatar, BrandMark, GlassSurface, KnowMeIcon, PressScale } from './ui/KnowMeUI';

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
  | 'avatar'
  | 'payments'
  | 'gifts'
  | 'games'
  | 'platform'
  | 'security'
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

export function ProfileExperience({ user, onUpdated, onLogout, onAccountDeleted, onOpenVerification }: {
  user: MobileUser;
  onUpdated: () => Promise<void>;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => Promise<void>;
  onOpenVerification: () => void;
}) {
  const { colors } = useAppearance();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [password, setPassword] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [panel, setPanel] = useState<ProfilePanel>('main');

  useEffect(() => {
    setDisplayName(user.displayName);
    setBio(user.bio ?? '');
    setAvatarUrl(user.avatarUrl ?? '');
  }, [user]);

  async function save() {
    if (saving || displayName.trim().length < 2) return;
    setSaving(true);
    try {
      await apiFetch('/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim(),
          ...(avatarUrl.trim() ? { avatarUrl: avatarUrl.trim() } : {})
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
      avatar: 'Avatar Studio',
      payments: 'KnowCoins & paiements',
      gifts: 'Cadeaux sociaux',
      games: 'PLAY',
      platform: 'Plateforme de jeux',
      security: 'Sécurité',
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
            <KnowMeIcon name="arrow" size={18} color={colors.text} />
            <Text style={[styles.backButtonText, { color: colors.text }]}>Profil</Text>
          </PressScale>
          <Text style={[styles.panelTitle, { color: colors.text }]}>{titleByPanel[panel]}</Text>
        </GlassSurface>

        {panel === 'appearance' ? <AppearanceExperience /> : null}
        {panel === 'language' ? <LanguageSettingsExperience /> : null}
        {panel === 'avatar' ? <AvatarStudioExperience /> : null}
        {panel === 'payments' ? <PaymentsExperience /> : null}
        {panel === 'gifts' ? <SocialGiftsExperience /> : null}
        {panel === 'games' ? <MobileGameCenterExperience /> : null}
        {panel === 'platform' ? <GamePlatformExperience /> : null}
        {panel === 'security' ? (
          <SecurityExperience onSessionClosed={onAccountDeleted} />
        ) : null}
        {panel === 'privacy' ? <PrivacyExperience /> : null}

        {panel === 'edit' ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Modifier mon profil</Text>
            <TextInput value={displayName} onChangeText={setDisplayName} maxLength={60} placeholder="Nom affiché" placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              style={[
                styles.input,
                {
                  backgroundColor: colors.backgroundAccent,
                  borderColor: colors.border,
                  color: colors.text
                }
              ]} />
            <TextInput value={bio}
              onChangeText={setBio}
              maxLength={500}
              multiline
              placeholder="Biographie"
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
              ]} />
            <TextInput value={avatarUrl} onChangeText={setAvatarUrl} autoCapitalize="none" keyboardType="url" placeholder="URL HTTPS de l’avatar" placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              style={[
                styles.input,
                {
                  backgroundColor: colors.backgroundAccent,
                  borderColor: colors.border,
                  color: colors.text
                }
              ]} />
            <Text style={[styles.helper, { color: colors.muted }]}>Le nom doit contenir au moins 2 caractères. L’avatar doit utiliser une URL valide.</Text>
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
      <View
        style={[
          styles.profileHero,
          { backgroundColor: colors.surface, borderColor: colors.border }
        ]}
      >
        <View style={[styles.cover, { backgroundColor: colors.backgroundAccent }]}>
          <View style={[styles.coverOrbOne, { backgroundColor: colors.accent }]} />
          <View style={[styles.coverOrbTwo, { backgroundColor: colors.secondary }]} />
          <View style={styles.coverBrand}>
            <BrandMark size={34} />
            <View>
              <Text style={[styles.coverBrandTitle, { color: colors.text }]}>KnowMe</Text>
              <Text style={[styles.coverBrandSub, { color: colors.muted }]}>Be Real. Belong.</Text>
            </View>
          </View>
        </View>

        <View style={styles.profileAvatarRow}>
          <Avatar
            uri={user.avatarUrl}
            name={user.displayName}
            size={96}
            ring
          />
          <PressScale
            onPress={onOpenVerification}
            style={[
              styles.profileTrustButton,
              {
                backgroundColor: colors.surfaceGlass,
                borderColor: colors.border
              }
            ]}
          >
            <KnowMeIcon name="check" size={20} color={colors.accent} />
            <Text style={[styles.profileTrustText, { color: colors.text }]}>Identité</Text>
          </PressScale>
        </View>

        <Text style={[styles.heading, { color: colors.text }]}>{user.displayName}</Text>
        <Text style={[styles.handle, { color: colors.accent }]}>@{user.username}</Text>

        {user.bio ? (
          <Text style={[styles.bio, { color: colors.text }]}>{user.bio}</Text>
        ) : (
          <Text style={[styles.bioMuted, { color: colors.muted }]}>Ajoute une bio pour raconter qui tu es.</Text>
        )}

        <View style={styles.badges}>
          {user.verification ? (
            <View style={styles.verificationBadge} accessibilityLabel={user.verification.label}>
              <Text style={styles.verificationBadgeText}>VERIFIED · {user.verification.label}</Text>
            </View>
          ) : null}
          {user.premium ? (
            <View style={styles.premiumBadge} accessibilityLabel={user.premium.label}>
              <Text style={styles.premiumBadgeText}>PREMIUM · {user.premium.label}</Text>
            </View>
          ) : null}
          {user.staff ? (
            <View style={styles.staffBadge} accessibilityLabel={user.staff.label + ', ' + user.staff.role}>
              <Text style={styles.staffBadgeText}>STAFF · {user.staff.label} · {user.staff.role}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.stat, { backgroundColor: colors.backgroundAccent, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{user.knowCoins ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>KnowCoins</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.backgroundAccent, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{user.verification ? 'Vérifié' : 'Actif'}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Identité</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.backgroundAccent, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>{user.role ?? 'Membre'}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Rôle</Text>
          </View>
        </View>

        <View style={styles.accountMeta}>
          <Text style={[styles.accountMetaText, { color: colors.muted }]}>{user.email}</Text>
          <Text style={[styles.accountMetaDot, { color: colors.border }]}>·</Text>
          <Text style={[styles.accountMetaText, { color: colors.muted }]} numberOfLines={1}>ID {user.accountId ?? user.id}</Text>
        </View>
      </View>

      <View style={styles.profileMenuSection}>
        <Text style={[styles.profileMenuHeading, { color: colors.text }]}>Mon espace</Text>
        <View style={styles.profileMenuGrid}>
          <PressScale onPress={onOpenVerification} style={[
              styles.profileMenuRow,
              { backgroundColor: colors.surface, borderColor: colors.border }
            ]}>
            <View style={[styles.profileMenuIcon, { backgroundColor: colors.backgroundAccent }]}><KnowMeIcon name="check" size={20} color={colors.accent} /></View>
            <View style={styles.flex}><Text style={[styles.profileMenuTitle, { color: colors.text }]}>Identité et confiance</Text><Text style={[styles.profileMenuText, { color: colors.muted }]}>Vérification et preuves de confiance.</Text></View>
            <KnowMeIcon name="arrow" size={17} color={colors.muted} />
          </PressScale>

          <PressScale onPress={() => setPanel('edit')} style={[
              styles.profileMenuRow,
              { backgroundColor: colors.surface, borderColor: colors.border }
            ]}>
            <View style={[styles.profileMenuIcon, { backgroundColor: colors.backgroundAccent }]}><KnowMeIcon name="profile" size={20} color={colors.secondary} /></View>
            <View style={styles.flex}><Text style={[styles.profileMenuTitle, { color: colors.text }]}>Modifier mon profil</Text><Text style={[styles.profileMenuText, { color: colors.muted }]}>Nom, bio et photo de profil.</Text></View>
            <KnowMeIcon name="arrow" size={17} color={colors.muted} />
          </PressScale>

          <PressScale onPress={() => setPanel('appearance')} style={[
              styles.profileMenuRow,
              { backgroundColor: colors.surface, borderColor: colors.border }
            ]}>
            <View style={[styles.profileMenuIcon, { backgroundColor: colors.backgroundAccent }]}><KnowMeIcon name="spark" size={20} color={colors.secondary} /></View>
            <View style={styles.flex}><Text style={[styles.profileMenuTitle, { color: colors.text }]}>Apparence</Text><Text style={[styles.profileMenuText, { color: colors.muted }]}>Thèmes, animations et personnalisation.</Text></View>
            <KnowMeIcon name="arrow" size={17} color={colors.muted} />
          </PressScale>

          <PressScale onPress={() => setPanel('language')} style={[
              styles.profileMenuRow,
              { backgroundColor: colors.surface, borderColor: colors.border }
            ]}>
            <View style={[styles.profileMenuIcon, { backgroundColor: colors.backgroundAccent }]}><KnowMeIcon name="discover" size={20} color={colors.accent} /></View>
            <View style={styles.flex}><Text style={[styles.profileMenuTitle, { color: colors.text }]}>Langue et région</Text><Text style={[styles.profileMenuText, { color: colors.muted }]}>Choisis la langue de toute l’interface.</Text></View>
            <KnowMeIcon name="arrow" size={17} color={colors.muted} />
          </PressScale>

          <PressScale onPress={() => setPanel('avatar')} style={[
              styles.profileMenuRow,
              { backgroundColor: colors.surface, borderColor: colors.border }
            ]}>
            <View style={[styles.profileMenuIcon, { backgroundColor: colors.backgroundAccent }]}><KnowMeIcon name="profile" size={20} color={colors.secondary} /></View>
            <View style={styles.flex}><Text style={[styles.profileMenuTitle, { color: colors.text }]}>Avatar Studio</Text><Text style={[styles.profileMenuText, { color: colors.muted }]}>Construis ton identité visuelle.</Text></View>
            <KnowMeIcon name="arrow" size={17} color={colors.muted} />
          </PressScale>

          <PressScale onPress={() => setPanel('payments')} style={[
              styles.profileMenuRow,
              { backgroundColor: colors.surface, borderColor: colors.border }
            ]}>
            <View style={[styles.profileMenuIcon, { backgroundColor: colors.backgroundAccent }]}><KnowMeIcon name="coins" size={20} color="#F7C85A" /></View>
            <View style={styles.flex}><Text style={[styles.profileMenuTitle, { color: colors.text }]}>KnowCoins & paiements</Text><Text style={[styles.profileMenuText, { color: colors.muted }]}>Solde, achats et avantages.</Text></View>
            <KnowMeIcon name="arrow" size={17} color={colors.muted} />
          </PressScale>

          <PressScale onPress={() => setPanel('gifts')} style={[
              styles.profileMenuRow,
              { backgroundColor: colors.surface, borderColor: colors.border }
            ]}>
            <View style={[styles.profileMenuIcon, { backgroundColor: colors.backgroundAccent }]}><KnowMeIcon name="spark" size={20} color={colors.secondary} /></View>
            <View style={styles.flex}><Text style={[styles.profileMenuTitle, { color: colors.text }]}>Cadeaux sociaux</Text><Text style={[styles.profileMenuText, { color: colors.muted }]}>Envoie et gère tes cadeaux.</Text></View>
            <KnowMeIcon name="arrow" size={17} color={colors.muted} />
          </PressScale>

          <PressScale onPress={() => setPanel('games')} style={[
              styles.profileMenuRow,
              { backgroundColor: colors.surface, borderColor: colors.border }
            ]}>
            <View style={[styles.profileMenuIcon, { backgroundColor: colors.backgroundAccent }]}><KnowMeIcon name="challenge" size={20} color={colors.accent} /></View>
            <View style={styles.flex}><Text style={[styles.profileMenuTitle, { color: colors.text }]}>PLAY</Text><Text style={[styles.profileMenuText, { color: colors.muted }]}>Jeux, récompenses et défis ludiques.</Text></View>
            <KnowMeIcon name="arrow" size={17} color={colors.muted} />
          </PressScale>

          <PressScale onPress={() => setPanel('security')} style={[
              styles.profileMenuRow,
              { backgroundColor: colors.surface, borderColor: colors.border }
            ]}>
            <View style={[styles.profileMenuIcon, { backgroundColor: colors.backgroundAccent }]}><KnowMeIcon name="settings" size={20} color={colors.secondary} /></View>
            <View style={styles.flex}><Text style={[styles.profileMenuTitle, { color: colors.text }]}>Sécurité</Text><Text style={[styles.profileMenuText, { color: colors.muted }]}>Sessions, 2FA et appareils de confiance.</Text></View>
            <KnowMeIcon name="arrow" size={17} color={colors.muted} />
          </PressScale>

          <PressScale onPress={() => setPanel('privacy')} style={[
              styles.profileMenuRow,
              { backgroundColor: colors.surface, borderColor: colors.border }
            ]}>
            <View style={[styles.profileMenuIcon, { backgroundColor: colors.backgroundAccent }]}><KnowMeIcon name="settings" size={20} color={colors.secondary} /></View>
            <View style={styles.flex}><Text style={[styles.profileMenuTitle, { color: colors.text }]}>Confidentialité</Text><Text style={[styles.profileMenuText, { color: colors.muted }]}>Contrôle ce que les autres peuvent voir.</Text></View>
            <KnowMeIcon name="arrow" size={17} color={colors.muted} />
          </PressScale>

          <PressScale onPress={() => setPanel('session')} style={[
              styles.profileMenuRow,
              { backgroundColor: colors.surface, borderColor: colors.border }
            ]}>
            <View style={[styles.profileMenuIcon, { backgroundColor: colors.backgroundAccent }]}><KnowMeIcon name="settings" size={20} color={colors.danger} /></View>
            <View style={styles.flex}><Text style={[styles.profileMenuTitle, { color: colors.text }]}>Session & compte</Text><Text style={[styles.profileMenuText, { color: colors.muted }]}>Déconnexion et gestion du compte.</Text></View>
            <KnowMeIcon name="arrow" size={17} color={colors.muted} />
          </PressScale>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  panelContent: { padding: 16, paddingBottom: 42, gap: 14 },
  panelHeader: { minHeight: 60, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backButton: { minHeight: 42, borderRadius: 21, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  backButtonText: { fontSize: 12, fontWeight: '800' },
  panelTitle: { fontSize: 22, fontWeight: '900', flex: 1 },
  content: { padding: 16, paddingBottom: 42, gap: 14 },
  profileHero: { overflow: 'hidden', borderWidth: 1, borderRadius: 28, paddingBottom: 18 },
  cover: { height: 132, position: 'relative', overflow: 'hidden', padding: 18, justifyContent: 'flex-end' },
  coverOrbOne: { position: 'absolute', width: 180, height: 180, borderRadius: 90, opacity: 0.22, right: -40, top: -72 },
  coverOrbTwo: { position: 'absolute', width: 130, height: 130, borderRadius: 65, opacity: 0.14, left: -30, bottom: -75 },
  coverBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coverBrandTitle: { fontSize: 17, fontWeight: '900' },
  coverBrandSub: { fontSize: 10.5, marginTop: 1 },
  profileAvatarRow: { marginTop: -43, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  profileTrustButton: { minHeight: 38, borderRadius: 19, paddingHorizontal: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  profileTrustText: { fontSize: 12, fontWeight: '800' },
  heading: { fontSize: 28, fontWeight: '900', paddingHorizontal: 18, marginTop: 12, letterSpacing: -0.6 },
  handle: { fontWeight: '800', paddingHorizontal: 18, marginTop: 3 },
  bio: { fontSize: 14, lineHeight: 20, paddingHorizontal: 18, marginTop: 11 },
  bioMuted: { fontSize: 13, lineHeight: 19, paddingHorizontal: 18, marginTop: 11 },
  muted: {},
  accountId: { fontSize: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 18, marginTop: 13 },
  verificationBadge: { borderColor: '#65b7ff', borderWidth: 1, borderRadius: 999, backgroundColor: 'rgba(101,183,255,0.08)', paddingHorizontal: 12, paddingVertical: 8 },
  verificationBadgeText: { color: '#65b7ff', fontWeight: '900', fontSize: 13 },
  premiumBadge: { borderColor: '#d8a7ff', borderWidth: 1, borderRadius: 999, backgroundColor: 'rgba(216,167,255,0.08)', paddingHorizontal: 12, paddingVertical: 8 },
  premiumBadgeText: { color: '#d8a7ff', fontWeight: '900', fontSize: 13 },
  staffBadge: { borderColor: '#f4c95d', borderWidth: 1, borderRadius: 999, backgroundColor: 'rgba(244,201,93,0.08)', paddingHorizontal: 12, paddingVertical: 8 },
  staffBadgeText: { color: '#f4c95d', fontWeight: '900', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 15 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 11, minWidth: 0 },
  statValue: { fontSize: 16, fontWeight: '900', marginBottom: 3 },
  statLabel: { fontSize: 9.5, fontWeight: '700' },
  accountMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, marginTop: 13 },
  accountMetaText: { fontSize: 10.5, flexShrink: 1 },
  accountMetaDot: { fontSize: 12 },
  profileMenuSection: { gap: 11 },
  profileMenuHeading: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  profileMenuGrid: { gap: 8 },
  profileMenuRow: { minHeight: 72, borderWidth: 1, borderRadius: 22, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  profileMenuIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  profileMenuTitle: { fontSize: 14, fontWeight: '900' },
  profileMenuText: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: 26, padding: 18, gap: 12 },
  cardTitle: { fontSize: 19, fontWeight: '900' },
  description: { fontSize: 15, lineHeight: 22 },
  helper: { fontSize: 12, lineHeight: 18 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 28, paddingHorizontal: 15, paddingVertical: 13, fontSize: 16, textAlignVertical: 'top' },
  multiline: { minHeight: 100 },
  button: { borderRadius: 22, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  buttonText: { fontWeight: '900' },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 1 },
  secondaryButtonText: {},
  buttonMuted: { opacity: 0.45 },
  dangerZone: {},
  dangerHeading: { fontSize: 19, fontWeight: '900' },
  dangerButton: { backgroundColor: 'transparent', borderWidth: 1 },
  dangerText: {}
});