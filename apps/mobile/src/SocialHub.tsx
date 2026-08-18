import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { MessagesOrganizationExperience } from './MessagesOrganizationExperience';

type UserSummary = {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
};

type Friend = { friendshipId: string; user: UserSummary };
type FriendRequest = { id: string; requester: UserSummary };
type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
};
type Section = 'friends' | 'messages' | 'notifications';

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export function SocialHub({ userId }: { userId: string }) {
  const [section, setSection] = useState<Section>('friends');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setRefreshing(false);
    setSection('friends');
  }, [userId]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CONNEXIONS</Text>
        <Text style={styles.heading}>Mon cercle</Text>
        <View style={styles.segmented}>
          {(['friends', 'messages', 'notifications'] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                setRefreshing(false);
                setSection(value);
              }}
              style={[styles.segment, section === value && styles.segmentActive]}
            >
              <Text style={[
                styles.segmentText,
                section === value && styles.segmentTextActive
              ]}>
                {value === 'friends'
                  ? 'Amis'
                  : value === 'messages'
                    ? 'Messages'
                    : 'Alertes'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {section === 'friends' && (
        <FriendsPanel
          key={`friends:${userId}`}
          refreshing={refreshing}
          setRefreshing={setRefreshing}
        />
      )}
      {section === 'messages' && (
        <MessagesOrganizationExperience
          key={`messages:${userId}`}
          userId={userId}
          refreshing={refreshing}
          setRefreshing={setRefreshing}
        />
      )}
      {section === 'notifications' && (
        <NotificationsPanel
          key={`notifications:${userId}`}
          refreshing={refreshing}
          setRefreshing={setRefreshing}
        />
      )}
    </View>
  );
}

function FriendsPanel({
  refreshing,
  setRefreshing
}: {
  refreshing: boolean;
  setRefreshing: (value: boolean) => void;
}) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [results, setResults] = useState<UserSummary[]>([]);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [friendData, requestData] = await Promise.all([
        apiFetch<Friend[]>('/social/friends'),
        apiFetch<FriendRequest[]>('/social/friend-requests/incoming')
      ]);
      setFriends(friendData);
      setRequests(requestData);
    } catch (cause) {
      Alert.alert('Chargement impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setRefreshing(false);
    }
  }, [setRefreshing]);

  useEffect(() => {
    void load();
  }, [load]);

  async function search() {
    if (query.trim().length < 2) return;
    try {
      setResults(await apiFetch<UserSummary[]>(
        `/social/search?q=${encodeURIComponent(query.trim())}`
      ));
    } catch (cause) {
      Alert.alert('Recherche impossible', errorMessage(cause, 'Réessaie.'));
    }
  }

  async function addFriend(addresseeId: string) {
    setBusyId(addresseeId);
    try {
      await apiFetch('/social/friend-requests', {
        method: 'POST',
        body: JSON.stringify({ addresseeId })
      });
      Alert.alert('Demande envoyée', 'La personne recevra une notification.');
    } catch (cause) {
      Alert.alert('Envoi impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setBusyId(null);
    }
  }

  async function respond(requestId: string, action: 'accept' | 'decline') {
    setBusyId(requestId);
    try {
      await apiFetch(`/social/friend-requests/${requestId}/${action}`, {
        method: 'PATCH'
      });
      await load();
    } catch (cause) {
      Alert.alert('Action impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(friendshipId: string) {
    setBusyId(friendshipId);
    try {
      await apiFetch(`/social/friends/${friendshipId}`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      Alert.alert('Suppression impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trouver une personne</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Nom ou pseudo"
          placeholderTextColor="#789187"
          style={styles.input}
          autoCapitalize="none"
        />
        <ActionButton
          title="Rechercher"
          disabled={query.trim().length < 2}
          onPress={() => void search()}
        />
      </View>

      {requests.length > 0 && (
        <Text style={styles.sectionTitle}>Demandes reçues</Text>
      )}
      {requests.map(({ id, requester }) => (
        <View key={id} style={styles.card}>
          <Identity user={requester} />
          <View style={styles.row}>
            <ActionButton
              title="Accepter"
              disabled={busyId === id}
              onPress={() => void respond(id, 'accept')}
              compact
            />
            <SecondaryButton
              title="Refuser"
              disabled={busyId === id}
              onPress={() => void respond(id, 'decline')}
            />
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Mes amis ({friends.length})</Text>
      {friends.map(({ friendshipId, user }) => (
        <View key={friendshipId} style={styles.card}>
          <Identity user={user} />
          <SecondaryButton
            title="Retirer"
            disabled={busyId === friendshipId}
            onPress={() => void remove(friendshipId)}
          />
        </View>
      ))}
      {!friends.length && <Empty text="Aucun ami pour le moment." />}

      {results.length > 0 && (
        <Text style={styles.sectionTitle}>Résultats</Text>
      )}
      {results.map((user) => (
        <View key={user.id} style={styles.card}>
          <Identity user={user} />
          <ActionButton
            title={busyId === user.id ? 'Envoi…' : 'Ajouter'}
            disabled={busyId === user.id}
            onPress={() => void addFriend(user.id)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

function NotificationsPanel({
  refreshing,
  setRefreshing
}: {
  refreshing: boolean;
  setRefreshing: (value: boolean) => void;
}) {
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    try {
      setItems(await apiFetch<Notification[]>('/notifications'));
    } catch (cause) {
      Alert.alert(
        'Notifications indisponibles',
        errorMessage(cause, 'Réessaie.')
      );
    } finally {
      setRefreshing(false);
    }
  }, [setRefreshing]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setItems((current) => current.map((item) =>
        item.id === id
          ? { ...item, readAt: new Date().toISOString() }
          : item
      ));
    } catch (cause) {
      Alert.alert('Action impossible', errorMessage(cause, 'Réessaie.'));
    }
  }

  async function markAllRead() {
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => ({
        ...item,
        readAt: item.readAt ?? now
      })));
    } catch (cause) {
      Alert.alert('Action impossible', errorMessage(cause, 'Réessaie.'));
    }
  }

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        unread > 0
          ? <ActionButton
              title={`Tout lire (${unread})`}
              onPress={() => void markAllRead()}
            />
          : null
      }
      ListEmptyComponent={<Empty text="Aucune notification." />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => !item.readAt && void markRead(item.id)}
          style={[styles.card, !item.readAt && styles.unreadCard]}
        >
          <Text style={styles.cardTitle}>
            {notificationIcon(item.type)} {item.title}
          </Text>
          <Text style={styles.muted}>{item.body}</Text>
          <Text style={styles.date}>
            {new Date(item.createdAt).toLocaleString('fr-FR')}
          </Text>
        </Pressable>
      )}
    />
  );
}

function Identity({ user }: { user: UserSummary }) {
  return (
    <View style={styles.identity}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {user.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.identityText}>
        <Text style={styles.cardTitle}>{user.displayName}</Text>
        <Text style={styles.muted}>@{user.username}</Text>
        {user.bio ? (
          <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text>
        ) : null}
      </View>
    </View>
  );
}

function ActionButton({
  title,
  onPress,
  disabled = false,
  compact = false
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionButton,
        compact && styles.compactButton,
        disabled && styles.disabled
      ]}
    >
      <Text style={styles.actionText}>{title}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  title,
  onPress,
  disabled = false
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.secondaryButton, disabled && styles.disabled]}
    >
      <Text style={styles.secondaryText}>{title}</Text>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

function notificationIcon(type: string) {
  return ({
    FRIEND_REQUEST: '👥',
    FRIEND_ACCEPTED: '🤝',
    MESSAGE: '💬',
    POST_LIKE: '♥',
    POST_LIKED: '♥',
    POST_COMMENT: '💬',
    POST_COMMENTED: '💬',
    CHALLENGE_JOIN: '🎯',
    CHALLENGE_JOINED: '🎯'
  } as Record<string, string>)[type] ?? '🔔';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071410' },
  header: { paddingHorizontal: 20, paddingTop: 18, gap: 8 },
  eyebrow: {
    color: '#45e6bd',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5
  },
  heading: { color: '#f4fff9', fontSize: 30, fontWeight: '900' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#0b1d17',
    borderRadius: 14,
    padding: 4
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11
  },
  segmentActive: { backgroundColor: '#1b3b31' },
  segmentText: { color: '#789187', fontWeight: '700', fontSize: 12 },
  segmentTextActive: { color: '#f4fff9' },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: '#10231d',
    borderColor: '#1c3a31',
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 10
  },
  unreadCard: { borderColor: '#45e6bd', backgroundColor: '#123027' },
  cardTitle: { color: '#f4fff9', fontSize: 17, fontWeight: '800' },
  sectionTitle: {
    color: '#f4fff9',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 8
  },
  muted: { color: '#91a79e', lineHeight: 20 },
  bio: { color: '#b6c8c0', marginTop: 4 },
  date: { color: '#789187', fontSize: 11 },
  input: {
    backgroundColor: '#091914',
    borderColor: '#25473b',
    borderWidth: 1,
    borderRadius: 15,
    color: '#f4fff9',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48
  },
  actionButton: {
    backgroundColor: '#45e6bd',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center'
  },
  compactButton: { flex: 1 },
  actionText: { color: '#052017', fontWeight: '900' },
  secondaryButton: {
    borderColor: '#315449',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center'
  },
  secondaryText: { color: '#d9ebe4', fontWeight: '800' },
  disabled: { opacity: 0.45 },
  row: { flexDirection: 'row', gap: 10 },
  identity: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  identityText: { flex: 1 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1b3b31',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: { color: '#45e6bd', fontSize: 18, fontWeight: '900' },
  empty: {
    backgroundColor: '#10231d',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center'
  }
});
