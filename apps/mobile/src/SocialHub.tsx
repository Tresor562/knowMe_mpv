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

type UserSummary = {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
};

type Friend = { friendshipId: string; user: UserSummary };
type FriendRequest = { id: string; requester: UserSummary };
type ConversationMember = { user: UserSummary };
type ConversationMessage = { id: string; content: string; createdAt: string; senderId: string };
type Conversation = {
  id: string;
  title?: string | null;
  members: ConversationMember[];
  messages: ConversationMessage[];
};
type MessageHistory = { items: ConversationMessage[]; nextCursor?: string | null };
type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
};

type Section = 'friends' | 'messages' | 'notifications';

export function SocialHub({ userId }: { userId: string }) {
  const [section, setSection] = useState<Section>('friends');
  const [refreshing, setRefreshing] = useState(false);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CONNEXIONS</Text>
        <Text style={styles.heading}>Mon cercle</Text>
        <View style={styles.segmented}>
          {(['friends', 'messages', 'notifications'] as const).map((value) => (
            <Pressable key={value} onPress={() => setSection(value)} style={[styles.segment, section === value && styles.segmentActive]}>
              <Text style={[styles.segmentText, section === value && styles.segmentTextActive]}>
                {value === 'friends' ? 'Amis' : value === 'messages' ? 'Messages' : 'Alertes'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {section === 'friends' && <FriendsPanel refreshing={refreshing} setRefreshing={setRefreshing} />}
      {section === 'messages' && <MessagesPanel userId={userId} refreshing={refreshing} setRefreshing={setRefreshing} />}
      {section === 'notifications' && <NotificationsPanel refreshing={refreshing} setRefreshing={setRefreshing} />}
    </View>
  );
}

function FriendsPanel({ refreshing, setRefreshing }: { refreshing: boolean; setRefreshing: (value: boolean) => void }) {
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
      Alert.alert('Chargement impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setRefreshing(false);
    }
  }, [setRefreshing]);

  useEffect(() => { void load(); }, [load]);

  async function search() {
    if (query.trim().length < 2) return;
    try {
      setResults(await apiFetch<UserSummary[]>(`/social/search?q=${encodeURIComponent(query.trim())}`));
    } catch (cause) {
      Alert.alert('Recherche impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    }
  }

  async function addFriend(addresseeId: string) {
    setBusyId(addresseeId);
    try {
      await apiFetch('/social/friend-requests', { method: 'POST', body: JSON.stringify({ addresseeId }) });
      Alert.alert('Demande envoyée', 'La personne recevra une notification.');
    } catch (cause) {
      Alert.alert('Envoi impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally { setBusyId(null); }
  }

  async function respond(requestId: string, action: 'accept' | 'decline') {
    setBusyId(requestId);
    try {
      await apiFetch(`/social/friend-requests/${requestId}/${action}`, { method: 'PATCH' });
      await load();
    } catch (cause) {
      Alert.alert('Action impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally { setBusyId(null); }
  }

  async function remove(friendshipId: string) {
    setBusyId(friendshipId);
    try {
      await apiFetch(`/social/friends/${friendshipId}`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      Alert.alert('Suppression impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally { setBusyId(null); }
  }

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trouver une personne</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Nom ou pseudo" placeholderTextColor="#789187" style={styles.input} autoCapitalize="none" />
        <ActionButton title="Rechercher" disabled={query.trim().length < 2} onPress={() => void search()} />
      </View>

      {requests.length > 0 && <Text style={styles.sectionTitle}>Demandes reçues</Text>}
      {requests.map(({ id, requester }) => (
        <View key={id} style={styles.card}>
          <Identity user={requester} />
          <View style={styles.row}>
            <ActionButton title="Accepter" disabled={busyId === id} onPress={() => void respond(id, 'accept')} compact />
            <SecondaryButton title="Refuser" disabled={busyId === id} onPress={() => void respond(id, 'decline')} />
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Mes amis ({friends.length})</Text>
      {friends.map(({ friendshipId, user }) => (
        <View key={friendshipId} style={styles.card}>
          <Identity user={user} />
          <SecondaryButton title="Retirer" disabled={busyId === friendshipId} onPress={() => void remove(friendshipId)} />
        </View>
      ))}
      {!friends.length && <Empty text="Aucun ami pour le moment." />}

      {results.length > 0 && <Text style={styles.sectionTitle}>Résultats</Text>}
      {results.map((user) => (
        <View key={user.id} style={styles.card}>
          <Identity user={user} />
          <ActionButton title={busyId === user.id ? 'Envoi…' : 'Ajouter'} disabled={busyId === user.id} onPress={() => void addFriend(user.id)} />
        </View>
      ))}
    </ScrollView>
  );
}

function MessagesPanel({ userId, refreshing, setRefreshing }: { userId: string; refreshing: boolean; setRefreshing: (value: boolean) => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [active, setActive] = useState<Conversation | null>(null);
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [conversationData, friendData] = await Promise.all([
        apiFetch<Conversation[]>('/conversations'),
        apiFetch<Friend[]>('/social/friends')
      ]);
      setConversations(conversationData);
      setFriends(friendData);
    } catch (cause) {
      Alert.alert('Messages indisponibles', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally { setRefreshing(false); }
  }, [setRefreshing]);

  useEffect(() => { void load(); }, [load]);

  async function openConversation(conversation: Conversation) {
    try {
      const data = await apiFetch<MessageHistory>(`/conversations/${conversation.id}/messages?limit=50`);
      setHistory(data.items);
      setActive(conversation);
    } catch (cause) {
      Alert.alert('Conversation inaccessible', cause instanceof Error ? cause.message : 'Réessaie.');
    }
  }

  async function createConversation() {
    if (!selectedFriend) return;
    try {
      const conversation = await apiFetch<Conversation>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ memberIds: [selectedFriend] })
      });
      setSelectedFriend(null);
      await load();
      await openConversation(conversation);
    } catch (cause) {
      Alert.alert('Création impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    }
  }

  async function send() {
    if (!active || !draft.trim()) return;
    setSending(true);
    try {
      const created = await apiFetch<ConversationMessage>(`/conversations/${active.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: draft.trim() })
      });
      setHistory((current) => [...current, created]);
      setDraft('');
      await load();
    } catch (cause) {
      Alert.alert('Envoi impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally { setSending(false); }
  }

  if (active) {
    const name = active.title || active.members.filter((member) => member.user.id !== userId).map((member) => member.user.displayName).join(', ') || 'Conversation';
    return (
      <View style={styles.conversationRoot}>
        <View style={styles.conversationHeader}>
          <SecondaryButton title="Retour" onPress={() => setActive(null)} />
          <Text style={styles.cardTitle}>{name}</Text>
        </View>
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messages}
          renderItem={({ item }) => {
            const mine = item.senderId === userId;
            return <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}><Text style={mine ? styles.bubbleMineText : styles.bubbleText}>{item.content}</Text><Text style={styles.bubbleDate}>{new Date(item.createdAt).toLocaleString('fr-FR')}</Text></View>;
          }}
          ListEmptyComponent={<Empty text="Commence la conversation." />}
        />
        <View style={styles.composer}>
          <TextInput value={draft} onChangeText={setDraft} placeholder="Écris un message…" placeholderTextColor="#789187" style={[styles.input, styles.composerInput]} />
          <ActionButton title={sending ? '…' : 'Envoyer'} disabled={sending || !draft.trim()} onPress={() => void send()} compact />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      contentContainerStyle={styles.content}
    >
      {friends.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nouvelle discussion</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendChoices}>
            {friends.map(({ user }) => (
              <Pressable key={user.id} onPress={() => setSelectedFriend(user.id)} style={[styles.friendChoice, selectedFriend === user.id && styles.friendChoiceActive]}>
                <Text style={styles.avatarText}>{user.displayName.charAt(0).toUpperCase()}</Text>
                <Text style={styles.choiceLabel} numberOfLines={1}>{user.displayName}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ActionButton title="Créer la conversation" disabled={!selectedFriend} onPress={() => void createConversation()} />
        </View>
      )}
      <Text style={styles.sectionTitle}>Conversations</Text>
      {conversations.map((conversation) => {
        const others = conversation.members.filter((member) => member.user.id !== userId);
        const name = conversation.title || others.map((member) => member.user.displayName).join(', ') || 'Conversation';
        const last = conversation.messages[0];
        return (
          <Pressable key={conversation.id} onPress={() => void openConversation(conversation)} style={styles.card}>
            <Text style={styles.cardTitle}>{name}</Text>
            <Text style={styles.muted} numberOfLines={2}>{last?.content ?? 'Aucun message pour le moment.'}</Text>
            {last && <Text style={styles.date}>{new Date(last.createdAt).toLocaleString('fr-FR')}</Text>}
          </Pressable>
        );
      })}
      {!conversations.length && <Empty text="Aucune conversation." />}
    </ScrollView>
  );
}

function NotificationsPanel({ refreshing, setRefreshing }: { refreshing: boolean; setRefreshing: (value: boolean) => void }) {
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    try { setItems(await apiFetch<Notification[]>('/notifications')); }
    catch (cause) { Alert.alert('Notifications indisponibles', cause instanceof Error ? cause.message : 'Réessaie.'); }
    finally { setRefreshing(false); }
  }, [setRefreshing]);

  useEffect(() => { void load(); }, [load]);

  async function markRead(id: string) {
    await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
    setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
  }

  async function markAllRead() {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
  }

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      contentContainerStyle={styles.content}
      ListHeaderComponent={unread > 0 ? <ActionButton title={`Tout lire (${unread})`} onPress={() => void markAllRead()} /> : null}
      ListEmptyComponent={<Empty text="Aucune notification." />}
      renderItem={({ item }) => (
        <Pressable onPress={() => !item.readAt && void markRead(item.id)} style={[styles.card, !item.readAt && styles.unreadCard]}>
          <Text style={styles.cardTitle}>{notificationIcon(item.type)} {item.title}</Text>
          <Text style={styles.muted}>{item.body}</Text>
          <Text style={styles.date}>{new Date(item.createdAt).toLocaleString('fr-FR')}</Text>
        </Pressable>
      )}
    />
  );
}

function Identity({ user }: { user: UserSummary }) {
  return <View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>{user.displayName.charAt(0).toUpperCase()}</Text></View><View style={styles.identityText}><Text style={styles.cardTitle}>{user.displayName}</Text><Text style={styles.muted}>@{user.username}</Text>{user.bio ? <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text> : null}</View></View>;
}

function ActionButton({ title, onPress, disabled = false, compact = false }: { title: string; onPress: () => void; disabled?: boolean; compact?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.actionButton, compact && styles.compactButton, disabled && styles.disabled]}><Text style={styles.actionText}>{title}</Text></Pressable>;
}

function SecondaryButton({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.secondaryButton, disabled && styles.disabled]}><Text style={styles.secondaryText}>{title}</Text></Pressable>;
}

function Empty({ text }: { text: string }) { return <View style={styles.empty}><Text style={styles.muted}>{text}</Text></View>; }
function notificationIcon(type: string) { return ({ FRIEND_REQUEST: '👥', FRIEND_ACCEPTED: '🤝', MESSAGE: '💬', POST_LIKE: '♥', POST_COMMENT: '💬', CHALLENGE_JOINED: '🎯' } as Record<string, string>)[type] ?? '🔔'; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071410' },
  header: { paddingHorizontal: 20, paddingTop: 18, gap: 8 },
  eyebrow: { color: '#45e6bd', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heading: { color: '#f4fff9', fontSize: 30, fontWeight: '900' },
  segmented: { flexDirection: 'row', backgroundColor: '#0b1d17', borderRadius: 14, padding: 4 },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  segmentActive: { backgroundColor: '#1b3b31' },
  segmentText: { color: '#789187', fontWeight: '700', fontSize: 12 },
  segmentTextActive: { color: '#f4fff9' },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  card: { backgroundColor: '#10231d', borderColor: '#1c3a31', borderWidth: 1, borderRadius: 22, padding: 16, gap: 10 },
  unreadCard: { borderColor: '#45e6bd', backgroundColor: '#123027' },
  cardTitle: { color: '#f4fff9', fontSize: 17, fontWeight: '800' },
  sectionTitle: { color: '#f4fff9', fontSize: 20, fontWeight: '900', marginTop: 8 },
  muted: { color: '#91a79e', lineHeight: 20 },
  bio: { color: '#b6c8c0', marginTop: 4 },
  date: { color: '#789187', fontSize: 11 },
  input: { backgroundColor: '#091914', borderColor: '#25473b', borderWidth: 1, borderRadius: 15, color: '#f4fff9', paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  actionButton: { backgroundColor: '#45e6bd', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  compactButton: { flex: 1 },
  actionText: { color: '#052017', fontWeight: '900' },
  secondaryButton: { borderColor: '#315449', borderWidth: 1, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center' },
  secondaryText: { color: '#d9ebe4', fontWeight: '800' },
  disabled: { opacity: 0.45 },
  row: { flexDirection: 'row', gap: 10 },
  identity: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  identityText: { flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1b3b31', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#45e6bd', fontSize: 18, fontWeight: '900' },
  empty: { backgroundColor: '#10231d', borderRadius: 20, padding: 20, alignItems: 'center' },
  friendChoices: { gap: 10 },
  friendChoice: { width: 84, borderColor: '#25473b', borderWidth: 1, borderRadius: 18, padding: 10, alignItems: 'center', gap: 6 },
  friendChoiceActive: { borderColor: '#45e6bd', backgroundColor: '#123027' },
  choiceLabel: { color: '#d9ebe4', fontSize: 11, maxWidth: 70 },
  conversationRoot: { flex: 1, paddingTop: 12 },
  conversationHeader: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  messages: { padding: 16, gap: 10, flexGrow: 1, justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', padding: 12, borderRadius: 18, gap: 5 },
  bubbleMine: { backgroundColor: '#45e6bd', alignSelf: 'flex-end' },
  bubbleOther: { backgroundColor: '#10231d', alignSelf: 'flex-start' },
  bubbleText: { color: '#f4fff9' },
  bubbleMineText: { color: '#052017', fontWeight: '600' },
  bubbleDate: { color: '#607a70', fontSize: 9 },
  composer: { flexDirection: 'row', gap: 8, padding: 12, borderTopColor: '#1c3a31', borderTopWidth: 1 },
  composerInput: { flex: 1 }
});
