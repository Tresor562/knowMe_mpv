import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch, type ApiError } from './api';
import { useAppearance } from './AppearanceProvider';
import { GlassSurface, KnowMeIcon } from './ui/KnowMeUI';

type CreatorProfile = {
  slug: string;
  title: string;
  bio?: string | null;
  category: string;
  visibility: 'PUBLIC' | 'UNLISTED';
  status: 'ACTIVE' | 'PAUSED' | 'SUSPENDED';
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
  privacy: {
    rawViewerIdsStored: boolean;
    receiptRetentionDays: number;
  };
};

const CATEGORIES = ['TECH', 'EDUCATION', 'GAMING', 'LIFESTYLE', 'ART', 'MUSIC', 'SPORT', 'COMMUNITY', 'OTHER'];

const CATEGORY_LABELS: Record<string, string> = {
  TECH: 'Tech',
  EDUCATION: 'Éducation',
  GAMING: 'Gaming',
  LIFESTYLE: 'Lifestyle',
  ART: 'Art',
  MUSIC: 'Musique',
  SPORT: 'Sport',
  COMMUNITY: 'Communauté',
  OTHER: 'Autre'
};

export function CreatorSettingsExperience() {
  const { colors, visual } = useAppearance();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [category, setCategory] = useState('TECH');
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED'>('ACTIVE');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    const current = await apiFetch<CreatorProfile | null>('/creators/me');
    setProfile(current);
    if (!current) {
      setDashboard(null);
      return;
    }
    setSlug(current.slug);
    setTitle(current.title);
    setBio(current.bio ?? '');
    setCategory(current.category);
    setStatus(current.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE');
    setDashboard(await apiFetch<Dashboard>('/creators/me/dashboard'));
  }

  useEffect(() => {
    void refresh().catch(() => setMessage('Chargement du profil créateur impossible.'));
  }, []);

  async function save() {
    if (busy || slug.length < 3 || title.trim().length < 2) return;
    setBusy(true);
    setMessage('');
    try {
      await apiFetch('/creators/me', {
        method: 'PUT',
        body: JSON.stringify({
          slug: slug.toLowerCase(),
          title: title.trim(),
          bio: bio.trim(),
          category,
          visibility: 'PUBLIC',
          status,
          expectedVersion: profile?.version ?? 0
        })
      });
      await refresh();
      setMessage('Profil créateur synchronisé.');
    } catch (cause) {
      if ((cause as ApiError)?.code === 'CREATOR_VERSION_CONFLICT') {
        await refresh().catch(() => undefined);
      }
      setMessage(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassSurface strength="soft" borderRadius={visual.cardRadius} style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon name="profile" size={20} color={colors.secondary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Mode créateur</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Gère ton profil public et tes contenus sans changer ton compte principal.
          </Text>
        </View>
      </View>
      {dashboard ? (
        <GlassSurface strength="soft" borderRadius={20} style={styles.metrics}>
          {[
            ['Abonnés', dashboard.totals.followers],
            ['Posts', dashboard.totals.posts],
            ['Profil', dashboard.totals.profileViews],
            ['Contenus', dashboard.totals.postViews]
          ].map(([label, value]) => (
            <View key={String(label)} style={styles.metric}>
              <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text>
            </View>
          ))}
        </GlassSurface>
      ) : null}
      <TextInput
        value={slug}
        onChangeText={(value) => setSlug(value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
        autoCapitalize="none"
        maxLength={40}
        placeholder="identifiant-public"
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundAccent, borderRadius: visual.inputRadius }]}
      />
      <TextInput
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        placeholder="Titre du profil"
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundAccent, borderRadius: visual.inputRadius }]}
      />
      <TextInput
        value={bio}
        onChangeText={setBio}
        maxLength={300}
        multiline
        placeholder="Présentation"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundAccent, borderRadius: visual.inputRadius }]}
      />
      <View style={styles.wrap}>
        {CATEGORIES.map((item) => (
          <Pressable
            key={item}
            disabled={busy}
            onPress={() => setCategory(item)}
            style={[styles.pill, { borderColor: colors.border, backgroundColor: category === item ? colors.accent : colors.surfaceRaised }]}
          >
            <Text style={{ color: category === item ? colors.accentText : colors.text, fontWeight: '700' }}>{CATEGORY_LABELS[item] ?? item}</Text>
          </Pressable>
        ))}
      </View>
      {profile ? (
        <View style={styles.wrap}>
          {(['ACTIVE', 'PAUSED'] as const).map((item) => (
            <Pressable
              key={item}
              disabled={busy || profile.status === 'SUSPENDED'}
              onPress={() => setStatus(item)}
              style={[styles.pill, { borderColor: colors.border, backgroundColor: status === item ? colors.accent : colors.surfaceRaised }]}
            >
              <Text style={{ color: status === item ? colors.accentText : colors.text, fontWeight: '800' }}>{item === 'ACTIVE' ? 'Actif' : 'En pause'}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Pressable
        disabled={busy || profile?.status === 'SUSPENDED'}
        onPress={() => void save()}
        style={({ pressed }) => [styles.button, { backgroundColor: colors.accent }, (pressed || busy) && styles.muted]}
      >
        <Text style={{ color: colors.accentText, fontWeight: '900' }}>
          {busy ? 'Enregistrement…' : profile ? 'Mettre à jour' : 'Activer le mode créateur'}
        </Text>
      </Pressable>
      {dashboard ? (
        <Text style={[styles.privacyNote, { color: colors.muted }]}>
          Les visiteurs restent anonymisés dans les statistiques. Les données techniques expirent après {dashboard.privacy.receiptRetentionDays} jours.
        </Text>
      ) : null}
      {message ? <Text style={{ color: colors.secondary, fontWeight: '800' }}>{message}</Text> : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 11 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  description: { fontSize: 12.5, lineHeight: 18 },
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  button: { minHeight: 46, borderRadius: 20, padding: 10, alignItems: 'center', justifyContent: 'center' },
  muted: { opacity: 0.5 },
  metrics: { flexDirection: 'row', padding: 5 },
  metric: { flex: 1, minWidth: 0, minHeight: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  metricValue: { fontSize: 14, fontWeight: '800' },
  metricLabel: { fontSize: 8.5, marginTop: 1, textAlign: 'center' },
  privacyNote: { fontSize: 11, lineHeight: 16 }
});
