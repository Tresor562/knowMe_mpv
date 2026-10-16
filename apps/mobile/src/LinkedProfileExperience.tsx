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

type FriendshipRelation = {
  status: 'SELF' | 'NONE' | 'OUTGOING' | 'INCOMING' | 'FRIENDS' | 'BLOCKED';
  targetUserId: string;
  friendshipId: string | null;
  legacy?: boolean;
};

type ProfileConversation = { id: string; isGroup: boolean; members: Array<{ userId: string }> };
type SearchUser = { id: string; username: string };
type Incoming = { id: string; requester: { id: string } };
type Friend = { friendshipId: string; user: { id: string } };

async function readFriendship(username: string): Promise<FriendshipRelation> {
  try {
    return await apiFetch<FriendshipRelation>(
      `/social/friendships/by-username/${encodeURIComponent(username)}`
    );
  } catch (cause) {
    if ((cause as { status?: number })?.status !== 404) throw cause;
  }
  const results = await apiFetch<SearchUser[]>(`/social/search?q=${encodeURIComponent(username)}`);
  const target = results.find(user => user.username.toLowerCase() === username.toLowerCase());
  if (!target) throw new Error('Utilisateur introuvable.');
  const [friends, incoming] = await Promise.all([
    apiFetch<Friend[]>('/social/friends'),
    apiFetch<Incoming[]>('/social/friend-requests/incoming')
  ]);
  const friend = friends.find(item => item.user.id === target.id);
  const request = incoming.find(item => item.requester.id === target.id);
  return {
    status: friend ? 'FRIENDS' : request ? 'INCOMING' : 'NONE',
    targetUserId: target.id,
    friendshipId: friend?.friendshipId ?? request?.id ?? null,
    legacy: true
  };
}

function FriendButton({ label, onPress, disabled = false, secondary = false }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const { colors } = useAppearance();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 24,
        borderWidth: secondary ? 1 : 0,
        borderColor: colors.accent,
        backgroundColor: secondary ? colors.backgroundAccent : colors.accent,
        opacity: disabled ? 0.55 : pressed ? 0.78 : 1,
        justifyContent: 'center',
        alignItems: 'center'
      })}
    >
      <Text style={{ color: secondary ? colors.accent : colors.accentText, fontWeight: '700', fontSize: 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}

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
export function LinkedProfileExperience({ username, onBack, onOpenConversation }: {
  username: string;
  onBack: () => void;
  onOpenConversation: (conversationId: string) => void;
}) {
  const { colors } = useAppearance();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [relation, setRelation] = useState<FriendshipRelation | null>(null);
  const [busy, setBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setProfile(null);
    setCoverFailed(false);
    setRelation(null);
    setError('');
    setNotice('');
    setConfirmRemoval(false);
    void Promise.allSettled([
      apiFetch<PublicProfile>(`/profile-experience/public/${encodeURIComponent(username)}`),
      readFriendship(username)
    ]).then(([publicResult, friendResult]) => {
      if (!live) return;
      if (publicResult.status === 'fulfilled') setProfile(publicResult.value);
      else setError('Profil introuvable ou indisponible.');
      if (friendResult.status === 'fulfilled') setRelation(friendResult.value);
      else if (publicResult.status === 'fulfilled' && !publicResult.value.viewer.owner) {
        setNotice('Les actions d’amitié sont temporairement indisponibles.');
      }
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [username]);

  async function updateFriendship(action: 'send' | 'cancel' | 'accept' | 'decline' | 'remove') {
    if (busy || !relation || !profile) return;
    const current = relation;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (action === 'send' && current.status === 'NONE') {
        const sent = await apiFetch<{ id: string }>('/social/friend-requests', {
          method: 'POST', body: JSON.stringify({ addresseeId: current.targetUserId })
        });
        if (current.legacy) {
          setRelation({ ...current, status: 'OUTGOING', friendshipId: sent.id });
          setNotice('Demande d’amitié envoyée.');
          return;
        }
      } else if (action === 'cancel' && current.status === 'OUTGOING' && current.friendshipId) {
        await apiFetch(`/social/friend-requests/${encodeURIComponent(current.friendshipId)}`, { method: 'DELETE' });
      } else if ((action === 'accept' || action === 'decline') && current.status === 'INCOMING' && current.friendshipId) {
        await apiFetch(`/social/friend-requests/${encodeURIComponent(current.friendshipId)}/${action}`, { method: 'PATCH' });
      } else if (action === 'remove' && current.status === 'FRIENDS' && current.friendshipId) {
        await apiFetch(`/social/friends/${encodeURIComponent(current.friendshipId)}`, { method: 'DELETE' });
      } else {
        return;
      }

      const latest = await readFriendship(profile.header.username);
      setRelation(latest);
      setConfirmRemoval(false);
      setNotice(({
        send: 'Demande d’amitié envoyée.',
        cancel: 'Demande annulée.',
        accept: 'Demande acceptée.',
        decline: 'Demande refusée.',
        remove: 'Ami retiré.'
      })[action]);
    } catch (cause) {
      // The write may have succeeded: disable stale actions until fresh server authority.
      setRelation(null);
      setNotice(cause instanceof Error ? cause.message : 'Action impossible.');
      setError('Actualise ce profil pour retrouver les actions d’amitié.');
    } finally {
      setBusy(false);
    }
  }

  async function openPrivateConversation() {
    if (messageBusy || !profile || !relation || profile.viewer.owner ||
        relation.status === 'BLOCKED') return;
    setMessageBusy(true);
    setNotice('');
    try {
      const targetId = relation.targetUserId;
      const conversations = await apiFetch<ProfileConversation[]>('/conversations');
      const existing = conversations.find(chat =>
        !chat.isGroup && chat.members.length === 2 &&
        chat.members.some(member => member.userId === targetId)
      );
      const id = existing?.id ?? (await apiFetch<{ id: string }>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ memberIds: [targetId] })
      })).id;
      onOpenConversation(id);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Impossible d’ouvrir la conversation.');
    } finally {
      setMessageBusy(false);
    }
  }

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
          {!profile.viewer.owner && (
            <GlassSurface strength="soft" borderRadius={22} style={{padding:14,gap:10}}>
            {relation?.status !== 'BLOCKED' ? (
              <FriendButton label={messageBusy ? 'Ouverture…' : 'Message'}
                disabled={messageBusy || !relation}
                onPress={() => void openPrivateConversation()} />
            ) : null}
            {!profile.viewer.owner && relation?.status === 'NONE' ? (
              <FriendButton label="+ Ajouter en ami" disabled={busy} onPress={() => void updateFriendship('send')} />
            ) : null}
            {!profile.viewer.owner && relation?.status === 'OUTGOING' ? (
              relation.legacy
                ? <Text style={{ color: colors.accent, textAlign: 'center' }}>Demande envoyée</Text>
                : <FriendButton label="Demande envoyée · Annuler" secondary disabled={busy} onPress={() => void updateFriendship('cancel')} />
            ) : null}
            {!profile.viewer.owner && relation?.status === 'INCOMING' ? (
              <>
                <FriendButton label="Accepter la demande" disabled={busy} onPress={() => void updateFriendship('accept')} />
                <FriendButton label="Refuser" secondary disabled={busy} onPress={() => void updateFriendship('decline')} />
              </>
            ) : null}
            {!profile.viewer.owner && relation?.status === 'FRIENDS' ? (
              <>
                <Text accessibilityRole="text" style={{ color: colors.accent, textAlign: 'center', fontWeight: '700' }}>✓ Amis</Text>
                {!confirmRemoval ? (
                  <FriendButton label="Retirer des amis" secondary disabled={busy} onPress={() => setConfirmRemoval(true)} />
                ) : (
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: colors.text, textAlign: 'center' }}>Retirer cette personne de tes amis ?</Text>
                    <FriendButton label="Confirmer le retrait" secondary disabled={busy} onPress={() => void updateFriendship('remove')} />
                    <FriendButton label="Annuler" secondary disabled={busy} onPress={() => setConfirmRemoval(false)} />
                  </View>
                )}
              </>
            ) : null}
            {!profile.viewer.owner && relation?.status === 'BLOCKED' ? (
              <Text style={{ color: colors.muted, textAlign: 'center' }}>Relation indisponible</Text>
            ) : null}
            {notice ? <Text accessibilityRole="alert" style={{ color: colors.muted, textAlign: 'center' }}>{notice}</Text> : null}
            </GlassSurface>
          )}
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
