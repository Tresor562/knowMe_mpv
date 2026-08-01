import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { Socket } from 'socket.io-client';
import { apiFetch } from './api';
import { getRealtimeSocket } from './realtime';

type UserSummary = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};

type Friend = { friendshipId: string; user: UserSummary };
type ConversationMember = {
  userId: string;
  lastReadAt: string;
  user: UserSummary;
};
type ConversationMessage = {
  id: string;
  conversationId: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender?: UserSummary;
};
type Conversation = {
  id: string;
  title?: string | null;
  members: ConversationMember[];
  messages: ConversationMessage[];
  unreadCount: number;
  lastReadAt?: string | null;
};
type MessageHistory = {
  items: ConversationMessage[];
  nextCursor?: string | null;
  readStates: ConversationMember[];
};
type MarkRead = { userId: string; lastReadAt: string; unread: number };
type ReadEvent = { conversationId: string; userId: string; lastReadAt: string };
type TypingEvent = {
  conversationId: string;
  userId: string;
  username?: string;
  typing: boolean;
};
type PresenceEvent = { userId: string; online: boolean };
type PresenceSnapshot = { onlineUserIds: string[] };

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function normalizeConversation(conversation: Partial<Conversation> & Pick<Conversation, 'id' | 'members'>): Conversation {
  return {
    id: conversation.id,
    title: conversation.title,
    members: conversation.members,
    messages: conversation.messages ?? [],
    unreadCount: conversation.unreadCount ?? 0,
    lastReadAt: conversation.lastReadAt ?? null
  };
}

export function RealtimeMessagesPanel({
  userId,
  refreshing,
  setRefreshing
}: {
  userId: string;
  refreshing: boolean;
  setRefreshing: (value: boolean) => void;
}) {
  const socketRef = useRef<Socket | null>(null);
  const activeRef = useRef<Conversation | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActive = useRef(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [active, setActive] = useState<Conversation | null>(null);
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [readStates, setReadStates] = useState<ConversationMember[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const mergeMessages = useCallback((
    current: ConversationMessage[],
    incoming: ConversationMessage[],
    prepend = false
  ) => {
    const known = new Set(current.map((item) => item.id));
    const fresh = incoming.filter((item) => !known.has(item.id));
    return prepend ? [...fresh, ...current] : [...current, ...fresh];
  }, []);

  const load = useCallback(async () => {
    try {
      const [conversationData, friendData] = await Promise.all([
        apiFetch<Conversation[]>('/conversations'),
        apiFetch<Friend[]>('/social/friends')
      ]);
      setConversations(conversationData.map(normalizeConversation));
      setFriends(friendData);
    } catch (cause) {
      Alert.alert('Messages indisponibles', errorMessage(cause, 'Réessaie.'));
    } finally {
      setRefreshing(false);
    }
  }, [setRefreshing]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = useCallback(async (conversationId: string) => {
    const marked = await apiFetch<MarkRead>(`/conversations/${conversationId}/read`, {
      method: 'PATCH'
    });

    setReadStates((current) => current.map((state) =>
      state.userId === marked.userId
        ? { ...state, lastReadAt: marked.lastReadAt }
        : state
    ));
    setConversations((current) => current.map((conversation) =>
      conversation.id === conversationId
        ? { ...conversation, unreadCount: 0, lastReadAt: marked.lastReadAt }
        : conversation
    ));
    return marked;
  }, []);

  useEffect(() => {
    let mounted = true;
    let socket: Socket | null = null;

    const onConnect = () => {
      setLive(true);
      const activeConversation = activeRef.current;
      if (activeConversation) {
        socket?.emit('conversation:join', { conversationId: activeConversation.id });
      }
    };
    const onDisconnect = () => setLive(false);
    const onConnectError = () => setLive(false);
    const onMessage = (created: ConversationMessage) => {
      setConversations((current) => {
        const index = current.findIndex((conversation) => conversation.id === created.conversationId);
        if (index < 0) {
          void load();
          return current;
        }

        const conversation = current[index];
        const alreadyKnown = conversation.messages[0]?.id === created.id;
        const isOpen = activeRef.current?.id === created.conversationId;
        const updated: Conversation = {
          ...conversation,
          messages: [created],
          unreadCount:
            created.senderId === userId || alreadyKnown || isOpen
              ? conversation.unreadCount
              : conversation.unreadCount + 1
        };
        return [updated, ...current.filter((item) => item.id !== updated.id)];
      });

      if (activeRef.current?.id === created.conversationId) {
        setHistory((current) => mergeMessages(current, [created]));
        if (created.senderId !== userId) {
          void markRead(created.conversationId).catch(() => undefined);
        }
      }
    };
    const onRead = (event: ReadEvent) => {
      setConversations((current) => current.map((conversation) =>
        conversation.id === event.conversationId && event.userId === userId
          ? { ...conversation, unreadCount: 0, lastReadAt: event.lastReadAt }
          : conversation
      ));

      if (activeRef.current?.id === event.conversationId) {
        setReadStates((current) => current.map((state) =>
          state.userId === event.userId
            ? { ...state, lastReadAt: event.lastReadAt }
            : state
        ));
      }
    };
    const onTyping = (event: TypingEvent) => {
      if (event.userId === userId || activeRef.current?.id !== event.conversationId) return;
      setTypingUsers((current) => {
        const next = { ...current };
        if (event.typing) next[event.userId] = event.username ?? 'Quelqu’un';
        else delete next[event.userId];
        return next;
      });
    };
    const onPresence = (event: PresenceEvent) => {
      setOnlineUserIds((current) => {
        const next = new Set(current);
        if (event.online) next.add(event.userId);
        else next.delete(event.userId);
        return next;
      });
    };
    const onPresenceSnapshot = (event: PresenceSnapshot) => {
      setOnlineUserIds(new Set(event.onlineUserIds));
    };
    const onConversationError = (event: { conversationId: string; message: string }) => {
      if (activeRef.current?.id === event.conversationId) {
        Alert.alert('Accès refusé', event.message);
      }
    };

    void getRealtimeSocket().then((connectedSocket) => {
      if (!mounted || !connectedSocket) return;
      socket = connectedSocket;
      socketRef.current = connectedSocket;
      connectedSocket.on('connect', onConnect);
      connectedSocket.on('disconnect', onDisconnect);
      connectedSocket.on('connect_error', onConnectError);
      connectedSocket.on('message:created', onMessage);
      connectedSocket.on('conversation:read', onRead);
      connectedSocket.on('typing:update', onTyping);
      connectedSocket.on('presence:update', onPresence);
      connectedSocket.on('presence:snapshot', onPresenceSnapshot);
      connectedSocket.on('conversation:error', onConversationError);
      if (connectedSocket.connected) onConnect();
    });

    return () => {
      mounted = false;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      const activeConversation = activeRef.current;
      if (activeConversation && socket) {
        socket.emit('typing:stop', { conversationId: activeConversation.id });
        socket.emit('conversation:leave', { conversationId: activeConversation.id });
      }
      socket?.off('connect', onConnect);
      socket?.off('disconnect', onDisconnect);
      socket?.off('connect_error', onConnectError);
      socket?.off('message:created', onMessage);
      socket?.off('conversation:read', onRead);
      socket?.off('typing:update', onTyping);
      socket?.off('presence:update', onPresence);
      socket?.off('presence:snapshot', onPresenceSnapshot);
      socket?.off('conversation:error', onConversationError);
    };
  }, [load, markRead, mergeMessages, userId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    const peerIds = [...new Set(
      conversations.flatMap((conversation) =>
        conversation.members.map((member) => member.user.id)
      ).filter((id) => id !== userId)
    )];
    if (peerIds.length) {
      socket.emit('presence:query', { userIds: peerIds });
    }
  }, [conversations, userId]);

  async function openConversation(conversation: Conversation) {
    try {
      const data = await apiFetch<MessageHistory>(
        `/conversations/${conversation.id}/messages?limit=50`
      );
      setHistory(data.items);
      setReadStates(data.readStates);
      setNextCursor(data.nextCursor ?? null);
      setTypingUsers({});
      setActive({ ...conversation, unreadCount: 0 });
      socketRef.current?.emit('conversation:join', {
        conversationId: conversation.id
      });
      const peerIds = data.readStates
        .map((state) => state.userId)
        .filter((id) => id !== userId);
      if (peerIds.length) {
        socketRef.current?.emit('presence:query', { userIds: peerIds });
      }
      await markRead(conversation.id);
    } catch (cause) {
      Alert.alert(
        'Conversation inaccessible',
        errorMessage(cause, 'Réessaie.')
      );
    }
  }

  async function loadOlder() {
    if (!active || !nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const data = await apiFetch<MessageHistory>(
        `/conversations/${active.id}/messages?limit=50&cursor=${encodeURIComponent(nextCursor)}`
      );
      setHistory((current) => mergeMessages(current, data.items, true));
      setReadStates(data.readStates);
      setNextCursor(data.nextCursor ?? null);
    } catch (cause) {
      Alert.alert('Chargement impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function createConversation() {
    if (!selectedFriend) return;
    try {
      const created = await apiFetch<Conversation>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ memberIds: [selectedFriend] })
      });
      const conversation = normalizeConversation(created);
      setSelectedFriend(null);
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id)
      ]);
      await openConversation(conversation);
    } catch (cause) {
      Alert.alert('Création impossible', errorMessage(cause, 'Réessaie.'));
    }
  }

  function changeDraft(value: string) {
    setDraft(value);
    if (!active) return;

    if (!typingActive.current) {
      typingActive.current = true;
      socketRef.current?.emit('typing:start', {
        conversationId: active.id
      });
    }

    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      typingActive.current = false;
      socketRef.current?.emit('typing:stop', {
        conversationId: active.id
      });
    }, 900);
  }

  function stopTyping() {
    if (!active) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typingActive.current) {
      socketRef.current?.emit('typing:stop', {
        conversationId: active.id
      });
    }
    typingActive.current = false;
  }

  async function send() {
    if (!active || !draft.trim() || sending) return;
    setSending(true);
    stopTyping();
    try {
      const created = await apiFetch<ConversationMessage>(
        `/conversations/${active.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content: draft.trim() })
        }
      );
      setHistory((current) => mergeMessages(current, [created]));
      setReadStates((current) => current.map((state) =>
        state.userId === userId
          ? { ...state, lastReadAt: created.createdAt }
          : state
      ));
      setDraft('');
    } catch (cause) {
      Alert.alert('Envoi impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setSending(false);
    }
  }

  function closeConversation() {
    stopTyping();
    if (active) {
      socketRef.current?.emit('conversation:leave', {
        conversationId: active.id
      });
    }
    setActive(null);
    setHistory([]);
    setReadStates([]);
    setTypingUsers({});
    setNextCursor(null);
    void load();
  }

  if (active) {
    const others = active.members.filter((member) => member.user.id !== userId);
    const name = active.title || others
      .map((member) => member.user.displayName)
      .join(', ') || 'Conversation';
    const online = others.some((member) => onlineUserIds.has(member.user.id));
    const typingNames = Object.values(typingUsers);

    return (
      <View style={styles.conversationRoot}>
        <View style={styles.conversationHeader}>
          <SecondaryButton title="Retour" onPress={closeConversation} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle} numberOfLines={1}>{name}</Text>
            <Text style={online ? styles.online : styles.muted}>
              {live ? (online ? '● En ligne' : '○ Hors ligne') : 'Temps réel déconnecté'}
            </Text>
          </View>
          <SecondaryButton title="Actualiser" onPress={() => void openConversation(active)} />
        </View>
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messages}
          ListHeaderComponent={
            nextCursor
              ? <SecondaryButton
                  title={loadingOlder ? 'Chargement…' : 'Messages précédents'}
                  disabled={loadingOlder}
                  onPress={() => void loadOlder()}
                />
              : null
          }
          renderItem={({ item }) => {
            const mine = item.senderId === userId;
            const readers = mine
              ? readStates.filter((state) =>
                  state.userId !== userId &&
                  new Date(state.lastReadAt).getTime() >=
                    new Date(item.createdAt).getTime()
                )
              : [];
            return (
              <View style={[
                styles.bubble,
                mine ? styles.bubbleMine : styles.bubbleOther
              ]}>
                {!mine && item.sender && (
                  <Text style={styles.senderName}>{item.sender.displayName}</Text>
                )}
                <Text style={mine ? styles.bubbleMineText : styles.bubbleText}>
                  {item.content}
                </Text>
                <Text style={styles.bubbleDate}>
                  {new Date(item.createdAt).toLocaleString('fr-FR')}
                </Text>
                {mine && readers.length > 0 && (
                  <Text style={styles.receipt}>
                    Lu par {readers.map((state) => state.user.displayName).join(', ')}
                  </Text>
                )}
              </View>
            );
          }}
          ListEmptyComponent={<Empty text="Commence la conversation." />}
          ListFooterComponent={
            typingNames.length
              ? <Text style={styles.typing}>
                  {typingNames.join(', ')} {typingNames.length > 1 ? 'écrivent' : 'écrit'}…
                </Text>
              : null
          }
        />
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={changeDraft}
            onBlur={stopTyping}
            maxLength={2000}
            placeholder="Écris un message…"
            placeholderTextColor="#789187"
            style={[styles.input, styles.composerInput]}
          />
          <ActionButton
            title={sending ? '…' : 'Envoyer'}
            disabled={sending || !draft.trim()}
            onPress={() => void send()}
            compact
          />
        </View>
      </View>
    );
  }

  const totalUnread = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0
  );

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
    >
      <Text style={styles.liveStatus}>
        {live ? '● Messages en direct' : '○ Reconnexion au temps réel…'}
      </Text>
      {friends.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nouvelle discussion</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.friendChoices}
          >
            {friends.map(({ user }) => (
              <Pressable
                key={user.id}
                onPress={() => setSelectedFriend(user.id)}
                style={[
                  styles.friendChoice,
                  selectedFriend === user.id && styles.friendChoiceActive
                ]}
              >
                <View style={styles.friendAvatarWrap}>
                  <Text style={styles.avatarText}>
                    {user.displayName.charAt(0).toUpperCase()}
                  </Text>
                  <View style={[
                    styles.presenceDot,
                    onlineUserIds.has(user.id)
                      ? styles.presenceOnline
                      : styles.presenceOffline
                  ]} />
                </View>
                <Text style={styles.choiceLabel} numberOfLines={1}>
                  {user.displayName}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <ActionButton
            title="Créer la conversation"
            disabled={!selectedFriend}
            onPress={() => void createConversation()}
          />
        </View>
      )}

      <Text style={styles.sectionTitle}>
        Conversations · {totalUnread} non lu(s)
      </Text>
      {conversations.map((conversation) => {
        const others = conversation.members.filter(
          (member) => member.user.id !== userId
        );
        const name = conversation.title || others
          .map((member) => member.user.displayName)
          .join(', ') || 'Conversation';
        const last = conversation.messages[0];
        const unread = conversation.unreadCount > 0;
        const online = others.some((member) =>
          onlineUserIds.has(member.user.id)
        );

        return (
          <Pressable
            key={conversation.id}
            onPress={() => void openConversation(conversation)}
            style={[styles.card, unread && styles.unreadConversation]}
          >
            <View style={styles.conversationTitleRow}>
              <View style={styles.conversationAvatar}>
                <Text style={styles.avatarText}>
                  {name.charAt(0).toUpperCase()}
                </Text>
                <View style={[
                  styles.presenceDot,
                  online ? styles.presenceOnline : styles.presenceOffline
                ]} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{name}</Text>
                <Text style={online ? styles.online : styles.muted}>
                  {online ? 'en ligne' : 'hors ligne'}
                </Text>
              </View>
              {unread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {conversation.unreadCount}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.muted, unread && styles.unreadPreview]}
              numberOfLines={2}
            >
              {last
                ? `${last.senderId === userId ? 'Toi : ' : ''}${last.content}`
                : 'Aucun message pour le moment.'}
            </Text>
            {last && (
              <Text style={styles.date}>
                {new Date(last.createdAt).toLocaleString('fr-FR')}
              </Text>
            )}
          </Pressable>
        );
      })}
      {!conversations.length && <Empty text="Aucune conversation." />}
    </ScrollView>
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

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  flex: { flex: 1 },
  liveStatus: { color: '#45e6bd', fontSize: 12, fontWeight: '800' },
  card: {
    backgroundColor: '#10231d',
    borderColor: '#1c3a31',
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 10
  },
  unreadConversation: {
    borderColor: '#45e6bd',
    backgroundColor: '#123027'
  },
  cardTitle: { color: '#f4fff9', fontSize: 17, fontWeight: '800' },
  sectionTitle: {
    color: '#f4fff9',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 8
  },
  muted: { color: '#91a79e', lineHeight: 20 },
  online: { color: '#45e6bd', lineHeight: 20, fontWeight: '700' },
  unreadPreview: { color: '#e7f7f0', fontWeight: '700' },
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
  empty: {
    backgroundColor: '#10231d',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center'
  },
  friendChoices: { gap: 10 },
  friendChoice: {
    width: 84,
    borderColor: '#25473b',
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    gap: 6
  },
  friendChoiceActive: {
    borderColor: '#45e6bd',
    backgroundColor: '#123027'
  },
  friendAvatarWrap: { position: 'relative' },
  choiceLabel: { color: '#d9ebe4', fontSize: 11, maxWidth: 70 },
  conversationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1b3b31',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  avatarText: { color: '#45e6bd', fontSize: 18, fontWeight: '900' },
  presenceDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#10231d'
  },
  presenceOnline: { backgroundColor: '#45e6bd' },
  presenceOffline: { backgroundColor: '#607a70' },
  unreadBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ff9d66',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7
  },
  unreadBadgeText: { color: '#281006', fontWeight: '900', fontSize: 12 },
  conversationRoot: { flex: 1, paddingTop: 12 },
  conversationHeader: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  messages: {
    padding: 16,
    gap: 10,
    flexGrow: 1,
    justifyContent: 'flex-end'
  },
  bubble: { maxWidth: '82%', padding: 12, borderRadius: 18, gap: 5 },
  bubbleMine: { backgroundColor: '#45e6bd', alignSelf: 'flex-end' },
  bubbleOther: { backgroundColor: '#10231d', alignSelf: 'flex-start' },
  bubbleText: { color: '#f4fff9' },
  bubbleMineText: { color: '#052017', fontWeight: '600' },
  senderName: { color: '#45e6bd', fontWeight: '800', fontSize: 11 },
  bubbleDate: { color: '#607a70', fontSize: 9 },
  receipt: { color: '#315d50', fontSize: 9, fontWeight: '700' },
  typing: {
    color: '#45e6bd',
    fontStyle: 'italic',
    paddingVertical: 8
  },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopColor: '#1c3a31',
    borderTopWidth: 1
  },
  composerInput: { flex: 1 }
});
