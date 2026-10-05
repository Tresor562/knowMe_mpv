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
import { useAppearance } from './AppearanceProvider';
import { MessagesOrganizationExperience } from './MessagesOrganizationExperience';
import { Avatar, GlassSurface, KnowMeIcon } from './ui/KnowMeUI';

type UserSummary = {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
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
  const { colors } = useAppearance();
  const [section, setSection] = useState<Section>('friends');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setRefreshing(false);
    setSection('friends');
  }, [userId]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <GlassSurface strength="soft" borderRadius={24} style={styles.headerTop}>
          <View style={styles.headerTitleBlock}>
            <Text style={[styles.heading, { color: colors.text }]}>Messages</Text>
            <Text style={[styles.headerSub, { color: colors.muted }]}>Ton cercle, en direct.</Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: colors.backgroundAccent }]}>
            <KnowMeIcon name="messages" size={21} color={colors.accent} />
          </View>
        </GlassSurface>
        <GlassSurface strength="soft" borderRadius={22} style={styles.segmented}>
          {(['friends', 'messages', 'notifications'] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                setRefreshing(false);
                setSection(value);
              }}
              style={[
                styles.segment,
                section === value && {
                  backgroundColor: colors.backgroundAccent
                }
              ]}
            >
              <KnowMeIcon
                name={value === 'friends' ? 'profile' : value === 'messages' ? 'messages' : 'bell'}
                size={16}
                color={section === value ? colors.accent : colors.muted}
                strokeWidth={section === value ? 2 : 1.75}
              />
              <Text style={[
                styles.segmentText,
                { color: section === value ? colors.accent : colors.muted }
              ]}>
                {value === 'friends'
                  ? 'Amis'
                  : value === 'messages'
                    ? 'Messages'
                    : 'Alertes'}
              </Text>
            </Pressable>
          ))}
        </GlassSurface>
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
  const { colors } = useAppearance();
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
          tintColor={colors.accent}
          colors={[colors.accent]}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <GlassSurface strength="soft" borderRadius={20} style={styles.searchCard}>
        <Text style={[styles.searchLabel, { color: colors.muted }]}>Trouver une personne</Text>
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void search()}
            placeholder="Nom ou @username"
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            style={[
              styles.input,
              styles.searchInput,
              {
                backgroundColor: colors.backgroundAccent,
                borderColor: colors.border,
                color: colors.text
              }
            ]}
            autoCapitalize="none"
            returnKeyType="search"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rechercher"
            disabled={query.trim().length < 2}
            onPress={() => void search()}
            style={[
              styles.searchButton,
              {
                backgroundColor: query.trim().length >= 2 ? colors.accent : colors.backgroundAccent,
                borderColor: query.trim().length >= 2 ? colors.accent : colors.border
              },
              query.trim().length < 2 && styles.disabled
            ]}
          >
            <KnowMeIcon
              name="search"
              size={19}
              color={query.trim().length >= 2 ? colors.accentText : colors.muted}
            />
          </Pressable>
        </View>
      </GlassSurface>

      {requests.length > 0 && (
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Demandes reçues</Text>
      )}
      {requests.map(({ id, requester }) => (
        <View key={id} style={[styles.card, { backgroundColor: colors.surfaceGlass, borderColor: colors.border }]}>
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

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Mes amis ({friends.length})</Text>
      {friends.map(({ friendshipId, user }) => (
        <View key={friendshipId} style={[styles.card, { backgroundColor: colors.surfaceGlass, borderColor: colors.border }]}>
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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Résultats</Text>
      )}
      {results.map((user) => (
        <View key={user.id} style={[styles.card, { backgroundColor: colors.surfaceGlass, borderColor: colors.border }]}>
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
  const { colors } = useAppearance();
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
          tintColor={colors.accent}
          colors={[colors.accent]}
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
          style={[
            styles.card,
            {
              backgroundColor: item.readAt ? colors.surface : colors.surfaceRaised,
              borderColor: item.readAt ? colors.border : colors.accent
            }
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {item.title}
          </Text>
          <Text style={[styles.muted, { color: colors.muted }]}>{item.body}</Text>
          <Text style={[styles.date, { color: colors.muted }]}>
            {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </Text>
        </Pressable>
      )}
    />
  );
}

function Identity({ user }: { user: UserSummary }) {
  const { colors } = useAppearance();
  return (
    <View style={styles.identity}>
      <Avatar uri={user.avatarUrl} name={user.displayName} size={48} />
      <View style={styles.identityText}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{user.displayName}</Text>
        <Text style={[styles.muted, { color: colors.muted }]}>@{user.username}</Text>
        {user.bio ? (
          <Text style={[styles.bio, { color: colors.muted }]} numberOfLines={2}>{user.bio}</Text>
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
  const { colors } = useAppearance();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionButton,
        { backgroundColor: colors.accent },
        compact && styles.compactButton,
        disabled && styles.disabled
      ]}
    >
      <Text style={[styles.actionText, { color: colors.accentText }]}>{title}</Text>
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
  const { colors } = useAppearance();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.secondaryButton,
        {
          backgroundColor: colors.backgroundAccent,
          borderColor: colors.border
        },
        disabled && styles.disabled
      ]}
    >
      <Text style={[styles.secondaryText, { color: colors.text }]}>{title}</Text>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  const { colors } = useAppearance();
  return (
    <View style={[styles.empty, { backgroundColor: colors.surface }]}>
      <Text style={[styles.muted, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 14, paddingTop: 6, gap: 7 },
  headerTop: { minHeight: 52, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleBlock: { flex: 1 },
  headerSub: { fontSize: 10.5, marginTop: 0 },
  headerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  segmented: {
    flexDirection: 'row',
    borderRadius: 19,
    padding: 3
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 16
  },
  segmentActive: {},
  segmentText: { fontWeight: '700', fontSize: 9.5 },
  segmentTextActive: {},
  content: { padding: 14, paddingBottom: 28, gap: 9 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 19,
    padding: 12,
    gap: 8
  },
  unreadCard: {},
  cardTitle: { fontSize: 15, fontWeight: '800' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6
  },
  muted: { fontSize: 12, lineHeight: 17 },
  bio: { marginTop: 3, fontSize: 11.5, lineHeight: 16 },
  date: { fontSize: 11 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 10,
    minHeight: 44
  },
  searchCard: { padding: 10, gap: 6 },
  searchLabel: { fontSize: 11, fontWeight: '700', paddingHorizontal: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  searchInput: { flex: 1 },
  searchButton: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center'
  },
  compactButton: { flex: 1 },
  actionText: { fontSize: 12, fontWeight: '800' },
  secondaryButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  secondaryText: { fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  row: { flexDirection: 'row', gap: 10 },
  identity: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  identityText: { flex: 1 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#171E2C',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: { color: '#7A5CFF', fontSize: 18, fontWeight: '900' },
  empty: {
    borderRadius: 20,
    padding: 18,
    alignItems: 'center'
  }
});
