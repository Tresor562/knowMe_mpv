import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiFetch, type ApiError } from './api';
import { KnowMeAlert as Alert } from './ui/KnowMeFeedback';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';
import {
  CREATOR_CATEGORIES, creatorDraftError, creatorUpdatePayload, normalizeCreatorSlug,
  type CreatorDraft, type CreatorStatus, type CreatorVisibility
} from './creator-profile-editor-model';
import { GlassSurface, KnowMeIcon } from './ui/KnowMeUI';

type CreatorProfile = {
  slug: string;
  title: string;
  bio?: string | null;
  category: string;
  visibility: CreatorVisibility;
  status: CreatorStatus | 'SUSPENDED';
  followerCount: number;
  version: number;
};

type Dashboard = {
  totals: {
    followers: number;
    posts: number;
    likes: number;
    comments: number;
    profileViews: number;
    postViews: number;
  };
  privacy: { rawViewerIdsStored: boolean; receiptRetentionDays: number };
};

const FR_CATEGORIES: Record<string, string> = {
  TECH: 'Tech', EDUCATION: 'Éducation', GAMING: 'Gaming',
  LIFESTYLE: 'Lifestyle', ART: 'Art', MUSIC: 'Musique',
  SPORT: 'Sport', COMMUNITY: 'Communauté', OTHER: 'Autre'
};
const EN_CATEGORIES: Record<string, string> = {
  TECH: 'Tech', EDUCATION: 'Education', GAMING: 'Gaming',
  LIFESTYLE: 'Lifestyle', ART: 'Art', MUSIC: 'Music',
  SPORT: 'Sports', COMMUNITY: 'Community', OTHER: 'Other'
};

const EMPTY_DRAFT: CreatorDraft = {
  slug: '', title: '', bio: '', category: 'TECH', visibility: 'PUBLIC', status: 'ACTIVE'
};

function draftFromProfile(profile: CreatorProfile): CreatorDraft {
  return {
    slug: profile.slug, title: profile.title, bio: profile.bio ?? '',
    category: profile.category, visibility: profile.visibility,
    status: profile.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE'
  };
}

export function CreatorSettingsExperience() {
  const { colors, visual } = useAppearance();
  const { locale } = useI18n();
  const en = locale === 'en';
  const tr = (fr: string, english: string) => en ? english : fr;
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [draft, setDraft] = useState<CreatorDraft>(EMPTY_DRAFT);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [versionConflict, setVersionConflict] = useState(false);

  function patchDraft(patch: Partial<CreatorDraft>) {
    setDraft(current => ({ ...current, ...patch }));
    setNotice('');
    setNoticeError(false);
  }

  async function load() {
    if (busy || loading && !loadFailed) return;
    setLoading(true);
    setLoadFailed(false);
    setNotice('');
    try {
      const current = await apiFetch<CreatorProfile | null>('/creators/me');
      setProfile(current);
      setDraft(current ? draftFromProfile(current) : EMPTY_DRAFT);
      setVersionConflict(false);
      setDashboard(null);
      setStatsError(false);
      if (current) {
        try {
          setDashboard(await apiFetch<Dashboard>('/creators/me/dashboard'));
        } catch {
          setStatsError(true);
        }
      }
    } catch (cause) {
      setLoadFailed(true);
      setNotice(cause instanceof Error ? cause.message :
        tr('Chargement du profil créateur impossible.', 'Could not load creator settings.'));
      setNoticeError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // The screen is mounted by the profile navigation only when selected.
    void (async () => {
      try {
        const current = await apiFetch<CreatorProfile | null>('/creators/me');
        setProfile(current);
        setDraft(current ? draftFromProfile(current) : EMPTY_DRAFT);
        if (current) {
          try {
            setDashboard(await apiFetch<Dashboard>('/creators/me/dashboard'));
          } catch {
            setStatsError(true);
          }
        }
      } catch (cause) {
        setLoadFailed(true);
        setNotice(cause instanceof Error ? cause.message :
          'Could not load creator settings.');
        setNoticeError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const suspended = profile?.status === 'SUSPENDED';
  const issue = creatorDraftError(draft);
  const invalid = Boolean(issue);
  const locked = busy || loading || loadFailed || suspended;

  async function save() {
    if (locked || invalid) return;
    setBusy(true);
    setNotice('');
    setNoticeError(false);
    try {
      const payload = creatorUpdatePayload(draft, profile?.version ?? 0);
      // Use the authoritative response: refresh of analytics must never be
      // treated as a failed profile mutation or replayed automatically.
      const updated = await apiFetch<CreatorProfile>('/creators/me', {
        method: 'PUT', body: JSON.stringify(payload)
      });
      setProfile(updated);
      setDraft(draftFromProfile(updated));
      setVersionConflict(false);
      setDashboard(null);
      setStatsError(false);
      try {
        setDashboard(await apiFetch<Dashboard>('/creators/me/dashboard'));
        setNotice(tr('Profil créateur enregistré.', 'Creator profile saved.'));
      } catch {
        setStatsError(true);
        setNotice(tr('Profil enregistré. Les statistiques sont temporairement indisponibles.',
          'Profile saved. Statistics are temporarily unavailable.'));
      }
    } catch (cause) {
      if ((cause as ApiError)?.code === 'CREATOR_VERSION_CONFLICT') {
        // Do not silently reload: that would destroy unsaved edits.
        setVersionConflict(true);
        setNotice(tr(
          'Ce profil a été modifié ailleurs. Vérifie tes changements, puis recharge la version serveur avant de réessayer.',
          'This profile changed elsewhere. Review your edits, then reload the server version before retrying.'
        ));
      } else {
        setNotice(cause instanceof Error ? cause.message :
          tr('Enregistrement impossible.', 'Could not save creator profile.'));
      }
      setNoticeError(true);
    } finally {
      setBusy(false);
    }
  }

  function confirmServerReload() {
    if (busy || loading) return;
    Alert.alert(
      tr('Recharger la version serveur ?', 'Reload the server version?'),
      tr('Tes modifications non enregistrées seront remplacées par les informations du serveur.',
        'Your unsaved changes will be replaced by the latest server values.'),
      [
        { text: tr('Annuler', 'Cancel'), style: 'cancel' },
        { text: tr('Recharger', 'Reload'), onPress: () => { void load(); } }
      ]
    );
  }

  const inputStyle = [
    styles.input,
    { color: colors.text, borderColor: colors.border,
      backgroundColor: colors.backgroundAccent, borderRadius: visual.inputRadius }
  ];
  const labelColor = { color: colors.text };

  function TogglePill({
    active, title, onPress, disabled = false
  }: {
    active: boolean;
    title: string;
    onPress: () => void;
    disabled?: boolean;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ selected: active, disabled: disabled || locked }}
        disabled={disabled || locked}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pill, {
            borderColor: active ? colors.accent : colors.border,
            backgroundColor: active ? colors.accent : colors.surfaceRaised,
            opacity: pressed ? .74 : disabled || locked ? .5 : 1
          }
        ]}
      >
        <Text style={{ color: active ? colors.accentText : colors.text, fontWeight: '700' }}>
          {title}
        </Text>
      </Pressable>
    );
  }

  return (
    <GlassSurface strength="soft" borderRadius={visual.cardRadius} style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon name="profile" size={20} color={colors.secondary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, labelColor]}>{tr('Mode créateur', 'Creator mode')}</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            {tr('Gère ton profil public et tes contenus sans changer ton compte principal.',
              'Manage your creator profile and content without changing your main account.')}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted }}>
            {tr('Chargement de ton profil…', 'Loading your creator profile…')}
          </Text>
        </View>
      ) : null}

      {notice ? (
        <Text accessibilityRole={noticeError ? 'alert' : undefined}
          style={[styles.notice, { color: noticeError ? colors.danger : colors.secondary }]}>
          {notice}
        </Text>
      ) : null}

      {versionConflict && !loading && !loadFailed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Recharger la version du serveur', 'Reload server profile')}
          style={[styles.retry, { borderColor: colors.border, backgroundColor: colors.backgroundAccent }]}
          onPress={confirmServerReload}
          disabled={busy}>
          <KnowMeIcon name="refresh" size={20} color={colors.accent} />
          <Text style={{ color: colors.text, fontWeight: '800' }}>
            {tr('Recharger depuis le serveur', 'Reload from server')}
          </Text>
        </Pressable>
      ) : null}

      {loadFailed && !loading ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Réessayer de charger le profil créateur', 'Retry loading creator profile')}
          style={[styles.retry, { borderColor: colors.border, backgroundColor: colors.backgroundAccent }]}
          onPress={() => { void load(); }}
        >
          <KnowMeIcon name="refresh" size={20} color={colors.accent} />
          <Text style={{ color: colors.text, fontWeight: '800' }}>
            {tr('Réessayer', 'Retry')}
          </Text>
        </Pressable>
      ) : null}

      {!loading && !loadFailed ? (
        <>
          {profile ? (
            <Text style={[styles.modeCaption, { color: colors.muted }]}>
              {tr('Profil créateur actif :', 'Creator profile:')} @{profile.slug}
            </Text>
          ) : null}

          {dashboard ? (
            <GlassSurface strength="soft" borderRadius={20} style={styles.metrics}>
              {([
                [tr('Abonnés', 'Followers'), dashboard.totals.followers],
                [tr('Posts', 'Posts'), dashboard.totals.posts],
                [tr('Profil', 'Profile'), dashboard.totals.profileViews],
                [tr('Contenus', 'Content'), dashboard.totals.postViews]
              ] as const).map(([label, value]) => (
                <View key={label} style={styles.metric}>
                  <Text style={[styles.metricValue, labelColor]}>{value}</Text>
                  <Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text>
                </View>
              ))}
            </GlassSurface>
          ) : null}

          {statsError ? (
            <Text style={[styles.hint, { color: colors.muted }]}>
              {tr('Statistiques indisponibles pour le moment.',
                'Statistics are temporarily unavailable.')}
            </Text>
          ) : null}

          <Text style={[styles.fieldLabel, labelColor]}>
            {tr('Identifiant public', 'Public identifier')}
          </Text>
          <TextInput
            accessibilityLabel={tr('Identifiant du profil créateur', 'Creator profile identifier')}
            editable={!locked}
            value={draft.slug}
            onChangeText={value => patchDraft({ slug: normalizeCreatorSlug(value) })}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={40}
            placeholder="identifiant-public"
            placeholderTextColor={colors.muted}
            style={inputStyle}
          />

          <Text style={[styles.fieldLabel, labelColor]}>
            {tr('Nom du profil', 'Profile title')}
          </Text>
          <TextInput
            accessibilityLabel={tr('Nom du profil créateur', 'Creator profile title')}
            editable={!locked}
            value={draft.title}
            onChangeText={title => patchDraft({ title })}
            maxLength={80}
            placeholder={tr('Titre du profil', 'Profile title')}
            placeholderTextColor={colors.muted}
            style={inputStyle}
          />

          <Text style={[styles.fieldLabel, labelColor]}>
            {tr('Présentation', 'About')}
          </Text>
          <TextInput
            accessibilityLabel={tr('Présentation du profil créateur', 'Creator profile description')}
            editable={!locked}
            value={draft.bio}
            onChangeText={bio => patchDraft({ bio })}
            maxLength={300}
            multiline
            placeholder={tr('Présentation', 'Description')}
            placeholderTextColor={colors.muted}
            style={[...inputStyle, styles.multiline]}
          />
          <Text style={[styles.hint, { color: colors.muted }]}>
            {draft.bio.length}/300
          </Text>

          <Text style={[styles.fieldLabel, labelColor]}>
            {tr('Catégorie', 'Category')}
          </Text>
          <View style={styles.wrap}>
            {CREATOR_CATEGORIES.map(item => (
              <TogglePill key={item}
                title={(en ? EN_CATEGORIES : FR_CATEGORIES)[item] ?? item}
                active={draft.category === item}
                onPress={() => patchDraft({ category: item })} />
            ))}
          </View>

          <Text style={[styles.fieldLabel, labelColor]}>
            {tr('Visibilité', 'Visibility')}
          </Text>
          <Text style={[styles.hint, { color: colors.muted }]}>
            {tr('Non répertorié : accessible avec son lien, sans apparaître dans les découvertes.',
              'Unlisted: accessible with its link, not listed in discovery.')}
          </Text>
          <View style={styles.wrap}>
            <TogglePill title={tr('Public', 'Public')}
              active={draft.visibility === 'PUBLIC'}
              onPress={() => patchDraft({ visibility: 'PUBLIC' })} />
            <TogglePill title={tr('Non répertorié', 'Unlisted')}
              active={draft.visibility === 'UNLISTED'}
              onPress={() => patchDraft({ visibility: 'UNLISTED' })} />
          </View>

          {profile ? (
            <>
              <Text style={[styles.fieldLabel, labelColor]}>
                {tr('Statut du profil', 'Profile status')}
              </Text>
              <View style={styles.wrap}>
                <TogglePill title={tr('Actif', 'Active')}
                  active={draft.status === 'ACTIVE'}
                  onPress={() => patchDraft({ status: 'ACTIVE' })} />
                <TogglePill title={tr('En pause', 'Paused')}
                  active={draft.status === 'PAUSED'}
                  onPress={() => patchDraft({ status: 'PAUSED' })} />
              </View>
            </>
          ) : null}
          {suspended ? (
            <Text accessibilityRole="alert" style={[styles.notice, { color: colors.danger }]}>
              {tr('Ce profil créateur est suspendu et ne peut pas être modifié.',
                'This creator profile is suspended and cannot be edited.')}
            </Text>
          ) : null}
          {issue && !suspended ? (
            <Text style={[styles.hint, { color: colors.danger }]}>
              {issue === 'slug'
                ? tr('L’identifiant doit contenir 3 à 40 caractères : lettres, chiffres, _ et -.',
                  'Identifier must be 3–40 characters: letters, digits, _ and -.')
                : issue === 'title'
                  ? tr('Le nom doit contenir entre 2 et 80 caractères.',
                    'The title must contain 2–80 characters.')
                  : tr('Vérifie les champs avant de continuer.', 'Check the fields before continuing.')}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={profile ? tr('Enregistrer le profil créateur', 'Save creator profile')
              : tr('Activer le mode créateur', 'Activate creator mode')}
            accessibilityState={{ disabled: locked || invalid }}
            disabled={locked || invalid}
            onPress={() => { void save(); }}
            style={({ pressed }) => [
              styles.button, { backgroundColor: colors.accent },
              (pressed || locked || invalid) && styles.muted
            ]}
          >
            {busy ? <ActivityIndicator size="small" color={colors.accentText} /> : null}
            <Text style={{ color: colors.accentText, fontWeight: '900' }}>
              {busy ? tr('Enregistrement…', 'Saving…')
                : profile ? tr('Enregistrer les changements', 'Save changes')
                  : tr('Activer le mode créateur', 'Activate creator mode')}
            </Text>
          </Pressable>

          {dashboard ? (
            <Text style={[styles.privacyNote, { color: colors.muted }]}>
              {tr('Les visites restent anonymisées. Les données techniques expirent après',
                'Visitors remain anonymous. Technical data expires after')}
              {' '}{dashboard.privacy.receiptRetentionDays}{' '}
              {tr('jours.', 'days.')}
            </Text>
          ) : null}
        </>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 11 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  description: { fontSize: 12.5, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  modeCaption: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  hint: { fontSize: 11.5, lineHeight: 17 },
  notice: { fontSize: 12.5, lineHeight: 19 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: StyleSheet.hairlineWidth, minHeight: 44, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 50, borderRadius: 20, padding: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  retry: { flexDirection: 'row', minHeight: 48, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 9 },
  loadingRow: { flexDirection: 'row', minHeight: 70, alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { opacity: 0.5 },
  metrics: { flexDirection: 'row', padding: 5 },
  metric: { flex: 1, minWidth: 0, minHeight: 58, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 3 },
  metricValue: { fontSize: 14, fontWeight: '800' },
  metricLabel: { fontSize: 10, marginTop: 4, textAlign: 'center' },
  privacyNote: { fontSize: 11, lineHeight: 16 }
});
