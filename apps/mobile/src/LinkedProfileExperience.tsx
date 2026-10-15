import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { API_URL, apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { Avatar, GlassSurface, KnowMeIcon } from './ui/KnowMeUI';

type PublicProfile = {
  header: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    joinedYear: number | null;
    coverAssetId?: string | null;
  };
  privacy: { profileLocked: boolean; lockedForViewer: boolean; lockMessage: string | null };
  viewer: { relation: string; owner: boolean };
  statistics?: Record<string, number | string | boolean | null> | null;
  wall?: Array<{ id: string; contentType: string; text: string | null; createdAt: string }> | null;
  timeline?: Array<{ id: string; title: string; description: string | null; happenedAt: string }> | null;
};

const STAT_LABELS: Record<string, string> = {
  friends: 'Amis',
  followers: 'Abonnés',
  following: 'Abonnements',
  level: 'Niveau',
  xp: 'XP',
  totalXp: 'XP total'
};

function coverSource(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^https:\/\//i.test(value)
    ? value
    : `${API_URL}/media/public/cover/${encodeURIComponent(value)}`;
}

/** Every section comes from the server-filtered public profile. Never request
 *  private owner data in order to render another person's profile. */
export function LinkedProfileExperience({ username, onBack }: { username: string; onBack: () => void }) {
  const { colors } = useAppearance();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setProfile(null);
    setCoverFailed(false);
    void apiFetch<PublicProfile>(`/profile-experience/public/${encodeURIComponent(username)}`)
      .then(data => { if (active) setProfile(data); })
      .catch(() => { if (active) setError('Ce profil est introuvable ou indisponible.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [username]);

  const accessible = profile ? !profile.privacy.lockedForViewer : false;
  const stats = accessible && profile?.statistics
    ? Object.entries(profile.statistics)
      .filter(([key, value]) => key in STAT_LABELS && value != null && typeof value !== 'boolean')
      .slice(0, 4)
    : [];
  const wall = accessible ? profile?.wall : null;
  const cover = coverSource(profile?.header.coverAssetId);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Pressable onPress={onBack} accessibilityRole="button"
        accessibilityLabel="Revenir à l'écran précédent"
        style={styles.back}>
        <KnowMeIcon name="back" size={21} color={colors.accent} />
        <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700' }}>Retour</Text>
      </Pressable>
      {loading ? <ActivityIndicator accessibilityLabel="Chargement du profil" color={colors.accent} /> : null}
      {error ? (
        <View style={styles.error}>
          <Text accessibilityRole="alert" style={{ color: colors.muted, textAlign: 'center' }}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.retry}>
            <Text style={{ color: colors.accent }}>Retour aux profils</Text>
          </Pressable>
        </View>
      ) : null}
      {profile && !loading ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={[styles.hero, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={[styles.cover, { backgroundColor: colors.backgroundAccent }]}>
              {cover && !coverFailed ? (
                <Image style={StyleSheet.absoluteFillObject} source={{ uri: cover }}
                  resizeMode="cover" onError={() => setCoverFailed(true)} accessibilityLabel="Couverture du profil" />
              ) : null}
            </View>
            <View style={styles.avatarOverlap}>
              <Avatar uri={profile.header.avatarUrl} name={profile.header.displayName} size={86} ring />
            </View>
            <View style={styles.identity}>
              <Text style={[styles.name, { color: colors.text }]}>{profile.header.displayName}</Text>
              <Text style={[styles.handle, { color: colors.accent }]}>@{profile.header.username}</Text>
              {profile.privacy.lockedForViewer ? (
                <Text style={[styles.bio, { color: colors.muted }]}>
                  {profile.privacy.lockMessage || 'Ce profil est privé.'}
                </Text>
              ) : (
                <>
                  {profile.header.bio ? (
                    <Text style={[styles.bio, { color: colors.text }]}>{profile.header.bio}</Text>
                  ) : null}
                  {profile.header.joinedYear ? (
                    <Text style={[styles.since, { color: colors.muted }]}>
                      Membre depuis {profile.header.joinedYear}
                    </Text>
                  ) : null}
                </>
              )}
              <Pressable accessibilityRole="button"
                accessibilityLabel="Partager le profil"
                style={[styles.share, { backgroundColor: colors.backgroundAccent, borderColor: colors.border }]}
                onPress={() => {
                  void Share.share({
                    message: buildKnowMePublicLink({ kind: 'profile', id: profile.header.username })
                  });
                }}>
                <Text style={{ color: colors.accent, fontWeight: '700' }}>Partager le profil</Text>
                <KnowMeIcon name="arrow" size={16} color={colors.accent} />
              </Pressable>
            </View>
          </View>
          {stats.length > 0 ? (
            <View style={[styles.stats, { borderColor: colors.border }]}>
              {stats.map(([key, value]) => (
                <View key={key} style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{String(value)}</Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>{STAT_LABELS[key]}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {wall !== null && wall !== undefined ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Publications du mur</Text>
              {wall.length ? wall.map(item => (
                <View key={item.id} style={[styles.wallPost, { borderColor: colors.border }]}>
                  <Text style={[styles.wallDate, { color: colors.muted }]}>
                    {new Date(item.createdAt).toLocaleDateString('fr-FR')}
                  </Text>
                  {item.text ? <Text style={[styles.wallText, { color: colors.text }]}>{item.text}</Text> : null}
                </View>
              )) : <Text style={{ color: colors.muted, fontSize: 13 }}>Aucune publication visible.</Text>}
            </View>
          ) : null}
          {accessible && profile.timeline?.length ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Souvenirs</Text>
              {profile.timeline.map(item => (
                <View key={item.id} style={[styles.wallPost, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
                  {item.description ? <Text style={{ color: colors.muted }}>{item.description}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 50, paddingHorizontal: 17 },
  content: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 105, gap: 15 },
  hero: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', borderRadius: 25 },
  cover: { height: 140, overflow: 'hidden' },
  avatarOverlap: { marginTop: -42, paddingHorizontal: 17 },
  identity: { paddingHorizontal: 17, paddingTop: 10, paddingBottom: 18, gap: 8 },
  name: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  handle: { fontSize: 14, fontWeight: '700' },
  bio: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  since: { fontSize: 12 },
  share: { flexDirection: 'row', gap: 8, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', alignSelf: 'flex-start', borderRadius: 18, minHeight: 43, paddingHorizontal: 16, marginTop: 5 },
  stats: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', paddingVertical: 12, justifyContent: 'space-around' },
  stat: { alignItems: 'center', flex: 1, minWidth: 0, gap: 5 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, textAlign: 'center' },
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  wallPost: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, gap: 6 },
  wallDate: { fontSize: 11 },
  wallText: { fontSize: 14.5, lineHeight: 21 },
  error: { alignItems: 'center', padding: 25, gap: 12 },
  retry: { paddingVertical: 10 },
});
