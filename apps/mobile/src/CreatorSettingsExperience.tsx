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

export function CreatorSettingsExperience() {
  const { colors } = useAppearance();
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
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Profil créateur</Text>
      <Text style={[styles.description, { color: colors.muted }]}>
        Volontaire, révocable et distinct de Premium, de la vérification et des rôles staff.
      </Text>
      {dashboard ? (
        <View style={styles.metrics}>
          {[
            ['Abonnés', dashboard.totals.followers],
            ['Publications', dashboard.totals.posts],
            ['Vues profil', dashboard.totals.profileViews],
            ['Vues contenus', dashboard.totals.postViews]
          ].map(([label, value]) => (
            <View key={String(label)} style={[styles.metric, { backgroundColor: colors.surfaceRaised }]}>
              <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <TextInput
        value={slug}
        onChangeText={(value) => setSlug(value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
        autoCapitalize="none"
        maxLength={40}
        placeholder="identifiant-public"
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />
      <TextInput
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        placeholder="Titre du profil"
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />
      <TextInput
        value={bio}
        onChangeText={setBio}
        maxLength={300}
        multiline
        placeholder="Présentation"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />
      <View style={styles.wrap}>
        {CATEGORIES.map((item) => (
          <Pressable
            key={item}
            disabled={busy}
            onPress={() => setCategory(item)}
            style={[styles.pill, { borderColor: colors.border, backgroundColor: category === item ? colors.accent : colors.surfaceRaised }]}
          >
            <Text style={{ color: category === item ? colors.accentText : colors.text, fontWeight: '800' }}>{item}</Text>
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
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          Les identités brutes des visiteurs ne sont pas stockées. Les reçus hachés expirent après {dashboard.privacy.receiptRetentionDays} jours.
        </Text>
      ) : null}
      {message ? <Text style={{ color: colors.secondary, fontWeight: '800' }}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  title: { fontSize: 19, fontWeight: '900' },
  description: { fontSize: 14, lineHeight: 21 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 12 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  button: { borderRadius: 15, padding: 13, alignItems: 'center' },
  muted: { opacity: 0.5 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '47%', borderRadius: 14, padding: 12 },
  metricValue: { fontSize: 22, fontWeight: '900' }
});
