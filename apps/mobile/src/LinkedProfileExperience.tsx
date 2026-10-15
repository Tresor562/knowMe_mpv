import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { Avatar, GlassSurface } from './ui/KnowMeUI';

type PublicProfile = {
  header: { username: string; displayName: string; avatarUrl: string | null; bio: string | null; joinedYear: number | null };
  privacy: { profileLocked: boolean; lockedForViewer: boolean; lockMessage: string | null };
  viewer: { relation: string; owner: boolean };
};

type FriendshipRelation = {
  status: 'SELF' | 'NONE' | 'OUTGOING' | 'INCOMING' | 'FRIENDS' | 'BLOCKED';
  targetUserId: string;
  friendshipId: string | null;
};

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

/** Uses the existing public-profile authority, not private account fields. */
export function LinkedProfileExperience({ username, onBack }: { username: string; onBack: () => void }) {
  const { colors } = useAppearance();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [relation, setRelation] = useState<FriendshipRelation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmRemoval, setConfirmRemoval] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setProfile(null);
    setRelation(null);
    setError('');
    setNotice('');
    setConfirmRemoval(false);
    void Promise.allSettled([
      apiFetch<PublicProfile>(`/profile-experience/public/${encodeURIComponent(username)}`),
      apiFetch<FriendshipRelation>(`/social/friendships/by-username/${encodeURIComponent(username)}`)
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
        await apiFetch('/social/friend-requests', {
          method: 'POST', body: JSON.stringify({ addresseeId: current.targetUserId })
        });
      } else if (action === 'cancel' && current.status === 'OUTGOING' && current.friendshipId) {
        await apiFetch(`/social/friend-requests/${encodeURIComponent(current.friendshipId)}`, { method: 'DELETE' });
      } else if ((action === 'accept' || action === 'decline') && current.status === 'INCOMING' && current.friendshipId) {
        await apiFetch(`/social/friend-requests/${encodeURIComponent(current.friendshipId)}/${action}`, { method: 'PATCH' });
      } else if (action === 'remove' && current.status === 'FRIENDS' && current.friendshipId) {
        await apiFetch(`/social/friends/${encodeURIComponent(current.friendshipId)}`, { method: 'DELETE' });
      } else {
        return;
      }

      const latest = await apiFetch<FriendshipRelation>(
        `/social/friendships/by-username/${encodeURIComponent(profile.header.username)}`
      );
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <Pressable accessibilityRole="button" onPress={onBack} style={{ paddingVertical: 10, minHeight: 44 }}>
        <Text style={{ color: colors.accent, fontSize: 16 }}>‹ Retour</Text>
      </Pressable>

      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
      {profile && !loading ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 36, gap: 14 }} showsVerticalScrollIndicator={false}>
          <GlassSurface strength="medium" borderRadius={26} style={{ padding: 20, gap: 12 }}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Avatar uri={profile.header.avatarUrl} name={profile.header.displayName} size={90} />
              <Text style={{ color: colors.text, fontSize: 23, fontWeight: '800', textAlign: 'center' }}>
                {profile.header.displayName}
              </Text>
              <Text style={{ color: colors.accent, fontSize: 15 }}>@{profile.header.username}</Text>
              {profile.privacy.lockedForViewer ? (
                <Text style={{ color: colors.muted, textAlign: 'center' }}>
                  {profile.privacy.lockMessage ?? 'Profil privé.'}
                </Text>
              ) : (
                <>
                  {profile.header.bio ? <Text style={{ color: colors.text, textAlign: 'center' }}>{profile.header.bio}</Text> : null}
                  {profile.header.joinedYear ? <Text style={{ color: colors.muted }}>Membre depuis {profile.header.joinedYear}</Text> : null}
                </>
              )}
            </View>

            {!profile.viewer.owner && relation?.status === 'NONE' ? (
              <FriendButton label="+ Ajouter en ami" disabled={busy} onPress={() => void updateFriendship('send')} />
            ) : null}
            {!profile.viewer.owner && relation?.status === 'OUTGOING' ? (
              <FriendButton label="Demande envoyée · Annuler" secondary disabled={busy} onPress={() => void updateFriendship('cancel')} />
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
            <FriendButton
              label="Partager le profil"
              secondary
              onPress={() => {
                void Share.share({ message: buildKnowMePublicLink({ kind: 'profile', id: profile.header.username }) });
              }}
            />
          </GlassSurface>
        </ScrollView>
      ) : null}
    </View>
  );
}
