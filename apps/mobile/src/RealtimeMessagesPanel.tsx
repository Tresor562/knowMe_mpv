import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
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
import { useAppearance } from './AppearanceProvider';
import { getRealtimeSocket } from './realtime';
import { ChatWallpaper, GlassSurface, KnowMeIcon, PressScale } from './ui/KnowMeUI';

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
  nexusAuthored?: boolean;
};
type Conversation = {
  id: string;
  title?: string | null;
  members: ConversationMember[];
  messages: ConversationMessage[];
  unreadCount: number;
  lastReadAt?: string | null;
};
type ConversationPinsResponse = {
  items: Array<{ conversationId: string }>;
  limit: number;
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

const NEXUS_MENTION = /(^|\s)@nexus\b/i;

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function normalizeConversation(
  conversation: Partial<Conversation> & Pick<Conversation, 'id' | 'members'>
): Conversation {
  return {
    id: conversation.id,
    title: conversation.title,
    members: conversation.members,
    messages: conversation.messages ?? [],
    unreadCount: conversation.unreadCount ?? 0,
    lastReadAt: conversation.lastReadAt ?? null
  };
}

function mergeMessages(
  current: ConversationMessage[],
  incoming: ConversationMessage[],
  prepend = false
) {
  const known = new Set(current.map((item) => item.id));
  const fresh = incoming.filter((item) => !known.has(item.id));
  return prepend ? [...fresh, ...current] : [...current, ...fresh];
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
  const { colors, visual, chat } = useAppearance();
  const socketRef = useRef<Socket | null>(null);
  const activeRef = useRef<Conversation | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActive = useRef(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pinnedConversationIds, setPinnedConversationIds] = useState<Set<string>>(new Set());
  const [pinLimit, setPinLimit] = useState<number | null>(null);
  const [pinBusyId, setPinBusyId] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [active, setActive] = useState<Conversation | null>(null);
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [readStates, setReadStates] = useState<ConversationMember[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [nexusPending, setNexusPending] = useState(false);
  const [creatingNexus, setCreatingNexus] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const applyPinData = useCallback((pinData: ConversationPinsResponse) => {
    setPinnedConversationIds(new Set(pinData.items.map((pin) => pin.conversationId)));
    setPinLimit(pinData.limit);
  }, []);

  const load = useCallback(async () => {
    try {
      const [conversationData, friendData, pinData] = await Promise.all([
        apiFetch<Conversation[]>('/conversations'),
        apiFetch<Friend[]>('/social/friends'),
        apiFetch<ConversationPinsResponse>('/conversation-pins')
      ]);
      setConversations(conversationData.map(normalizeConversation));
      setFriends(friendData);
      applyPinData(pinData);
    } catch (cause) {
      Alert.alert('Messages indisponibles', errorMessage(cause, 'Réessaie.'));
    } finally {
      setRefreshing(false);
    }
  }, [applyPinData, setRefreshing]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = useCallback(async (conversationId: string) => {
    const marked = await apiFetch<MarkRead>(
      `/conversations/${conversationId}/read`,
      { method: 'PATCH' }
    );

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
      const opened = activeRef.current;
      if (opened) {
        socket?.emit('conversation:join', { conversationId: opened.id });
      }
    };
    const onDisconnect = () => setLive(false);
    const onConnectError = () => setLive(false);
    const onMessage = (created: ConversationMessage) => {
      setConversations((current) => {
        const index = current.findIndex(
          (conversation) => conversation.id === created.conversationId
        );
        if (index < 0) {
          void load();
          return current;
        }

        const conversation = current[index];
        if (!conversation) return current;

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
        return [
          updated,
          ...current.filter((item) => item.id !== updated.id)
        ];
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
      if (
        event.userId === userId ||
        activeRef.current?.id !== event.conversationId
      ) {
        return;
      }
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
    const onConversationError = (event: {
      conversationId: string;
      message: string;
    }) => {
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
      const opened = activeRef.current;
      if (opened && socket) {
        socket.emit('typing:stop', { conversationId: opened.id });
        socket.emit('conversation:leave', { conversationId: opened.id });
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
  }, [load, markRead, userId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    const peerIds = [...new Set(
      conversations
        .flatMap((conversation) =>
          conversation.members.map((member) => member.user.id)
        )
        .filter((id) => id !== userId)
    )];
    if (peerIds.length) {
      socket.emit('presence:query', { userIds: peerIds });
    }
  }, [conversations, live, userId]);

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

  async function createNexusConversation() {
    if (creatingNexus) return;
    setCreatingNexus(true);
    try {
      const created = await apiFetch<Conversation>('/nexus-social/private-conversation', {
        method: 'POST',
        body: '{}'
      });
      const conversation = normalizeConversation(created);
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id)
      ]);
      await openConversation(conversation);
    } catch (cause) {
      Alert.alert('Nexus indisponible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setCreatingNexus(false);
    }
  }

  async function toggleConversationPin(conversationId: string, pinned: boolean) {
    if (pinBusyId) return;
    if (!pinned && (pinLimit === null || pinnedConversationIds.size >= pinLimit)) {
      return;
    }

    setPinBusyId(conversationId);
    try {
      await apiFetch(`/conversation-pins/${conversationId}`, {
        method: pinned ? 'DELETE' : 'PUT'
      });
      applyPinData(await apiFetch<ConversationPinsResponse>('/conversation-pins'));
    } catch (cause) {
      Alert.alert(
        pinned ? 'Désépinglage impossible' : 'Épinglage impossible',
        errorMessage(cause, 'Réessaie.')
      );
    } finally {
      setPinBusyId(null);
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

  async function invokeNexus(conversation: Conversation, created: ConversationMessage) {
    setNexusPending(true);
    try {
      const reply = await apiFetch<ConversationMessage>(
        `/conversations/${conversation.id}/nexus/reply`,
        {
          method: 'POST',
          body: JSON.stringify({
            sourceMessageId: created.id,
            idempotencyKey: `mobile:${conversation.id}:${created.id}:${userId}`,
            mode: 'instant'
          })
        }
      );
      setHistory((current) => mergeMessages(current, [reply]));
      void markRead(conversation.id).catch(() => undefined);
    } catch (cause) {
      Alert.alert(
        'Message envoyé, Nexus indisponible',
        errorMessage(cause, 'Tu peux réessayer avec un nouveau message.')
      );
    } finally {
      setNexusPending(false);
    }
  }

  async function send() {
    if (!active || !draft.trim() || sending || nexusPending) return;
    const content = draft.trim();
    const isNexusPrivate = active.title === 'Nexus' && active.members.length === 1 && active.members[0]?.userId === userId;
    setSending(true);
    stopTyping();
    try {
      const created = await apiFetch<ConversationMessage>(
        `/conversations/${active.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content })
        }
      );
      setHistory((current) => mergeMessages(current, [created]));
      setReadStates((current) => current.map((state) =>
        state.userId === userId
          ? { ...state, lastReadAt: created.createdAt }
          : state
      ));
      setDraft('');
      if (isNexusPrivate || NEXUS_MENTION.test(content)) {
        await invokeNexus(active, created);
      }
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
    setNexusPending(false);
    void load();
  }

  if (active) {
    const others = active.members.filter(
      (member) => member.user.id !== userId
    );
    const isNexusPrivate = active.title === 'Nexus' && others.length === 0;
    const name = isNexusPrivate ? 'Nexus' : active.title || others
      .map((member) => member.user.displayName)
      .join(', ') || 'Conversation';
    const online = !isNexusPrivate && others.some((member) =>
      onlineUserIds.has(member.user.id)
    );
    const typingNames = Object.values(typingUsers);
    const activeAvatarUrl = !isNexusPrivate ? others[0]?.user.avatarUrl : null;

    return (
      <View style={[styles.conversationRoot, { backgroundColor: colors.background }]}>
        <ChatWallpaper />
        <GlassSurface strength="medium" borderRadius={visual.controlRadius} style={styles.conversationHeader}>
          <IconButton icon="back" accessibilityLabel="Retour" onPress={closeConversation} />
          <View style={[styles.headerAvatar, { backgroundColor: colors.backgroundAccent, borderColor: colors.border }]}>
            {isNexusPrivate ? (
              <KnowMeIcon name="spark" size={19} color={colors.secondary} />
            ) : activeAvatarUrl ? (
              <Image source={{ uri: activeAvatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, { color: colors.accent }]}>
                {name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{name}</Text>
            <Text style={[
              isNexusPrivate || online ? styles.online : styles.muted,
              { color: isNexusPrivate || online ? colors.accent : colors.muted }
            ]}>
              {isNexusPrivate
                ? 'Assistant privé'
                : live
                  ? online
                    ? 'En ligne'
                    : 'Hors ligne'
                  : 'Connexion…'}
            </Text>
          </View>
          <IconButton
            icon="refresh"
            accessibilityLabel="Actualiser"
            onPress={() => void openConversation(active)}
          />
        </GlassSurface>

        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messages}
          ListHeaderComponent={nextCursor ? (
            <SecondaryButton
              title={loadingOlder ? 'Chargement…' : 'Messages précédents'}
              disabled={loadingOlder}
              onPress={() => void loadOlder()}
            />
          ) : null}
          renderItem={({ item }) => {
            const mine = item.senderId === userId;
            const nexus = item.nexusAuthored === true;
            const readers = mine
              ? readStates.filter((state) =>
                  state.userId !== userId &&
                  new Date(state.lastReadAt).getTime() >=
                    new Date(item.createdAt).getTime()
                )
              : [];

            return (
              <View
                style={[
                  styles.bubble,
                  { borderRadius: visual.bubbleRadius },
                  mine
                    ? [
                        styles.bubbleMine,
                        {
                          backgroundColor: colors.accent,
                          borderWidth: chat.bubbleBorderWidth,
                          borderColor: colors.accent
                        }
                      ]
                    : nexus
                      ? [
                          styles.bubbleNexus,
                          {
                            backgroundColor: colors.surfaceRaised,
                            borderColor: colors.secondary,
                            borderWidth: Math.max(1, chat.bubbleBorderWidth)
                          }
                        ]
                      : [
                          styles.bubbleOther,
                          {
                            backgroundColor: colors.surface,
                            borderWidth: chat.bubbleBorderWidth,
                            borderColor: colors.border
                          }
                        ]
                ]}
              >
                {!mine ? (
                  <Text style={[styles.senderName, { color: nexus ? colors.secondary : colors.accent }]}>
                    {nexus ? '✦ Nexus' : item.sender?.displayName ?? 'Utilisateur'}
                  </Text>
                ) : null}
                <Text
                  style={[
                    mine ? styles.bubbleMineText : styles.bubbleText,
                    { color: mine ? colors.accentText : colors.text }
                  ]}
                >
                  {item.content}
                </Text>
                <Text style={[styles.bubbleDate, { color: mine ? 'rgba(255,255,255,0.76)' : colors.muted }]}>
                  {formatMessageTime(item.createdAt)}
                </Text>
                {mine && readers.length > 0 ? (
                  <Text style={[styles.receipt, { color: colors.accentText }]}>
                    Lu par {readers
                      .map((state) => state.user.displayName)
                      .join(', ')}
                  </Text>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={<Empty text={isNexusPrivate ? 'Écris ton premier message à Nexus.' : 'Commence la conversation.'} />}
          ListFooterComponent={nexusPending ? (
            <Text style={[styles.typing, { color: colors.accent }]}>Nexus réfléchit…</Text>
          ) : typingNames.length ? (
            <Text style={[styles.typing, { color: colors.accent }]}>
              {typingNames.join(', ')}{' '}
              {typingNames.length > 1 ? 'écrivent' : 'écrit'}…
            </Text>
          ) : null}
        />

        <GlassSurface strength="medium" borderRadius={visual.cardRadius} style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={changeDraft}
            onBlur={stopTyping}
            maxLength={2000}
            placeholder={isNexusPrivate ? 'Écris à Nexus…' : 'Écris… @Nexus pour l’invoquer'}
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            style={[
              styles.input,
              styles.composerInput,
              { borderRadius: visual.inputRadius },
              {
                backgroundColor: colors.backgroundAccent,
                borderColor: colors.border,
                color: colors.text
              }
            ]}
          />
          <IconButton
            icon="arrow"
            accessibilityLabel="Envoyer"
            disabled={sending || nexusPending || !draft.trim()}
            onPress={() => void send()}
            filled
          />
        </GlassSurface>
      </View>
    );
  }

  const totalUnread = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0
  );
  const pinAtCapacity = pinLimit !== null && pinnedConversationIds.size >= pinLimit;
  const orderedConversations = [...conversations].sort((left, right) => {
    const leftPinned = pinnedConversationIds.has(left.id);
    const rightPinned = pinnedConversationIds.has(right.id);
    return leftPinned === rightPinned ? 0 : leftPinned ? -1 : 1;
  });

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
    >
      <View style={styles.liveStatusRow}>
        <View style={[styles.liveDot, { backgroundColor: live ? colors.accent : colors.muted }]} />
        <Text style={[styles.liveStatus, { color: live ? colors.accent : colors.muted }]}>
          {live ? 'Messages en direct' : 'Reconnexion au temps réel…'}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Nexus</Text>
        <Text style={[styles.muted, { color: colors.muted }]}>
          Conversation privée avec Nexus. Dans les groupes, écris @Nexus pour l’invoquer uniquement sur ce tour.
        </Text>
        <ActionButton
          title={creatingNexus ? 'Ouverture…' : '✦ Parler à Nexus'}
          disabled={creatingNexus}
          onPress={() => void createNexusConversation()}
        />
      </View>

      {friends.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Nouvelle discussion</Text>
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
                  {
                    borderRadius: visual.controlRadius,
                    borderColor: selectedFriend === user.id ? colors.accent : colors.border,
                    backgroundColor: selectedFriend === user.id
                      ? colors.surfaceRaised
                      : colors.surface
                  }
                ]}
              >
                <View style={[styles.friendAvatarWrap, { backgroundColor: colors.backgroundAccent }]}>
                  {user.avatarUrl ? (
                    <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={[styles.avatarText, { color: colors.accent }]}>
                      {user.displayName.charAt(0).toUpperCase()}
                    </Text>
                  )}
                  <View style={[
                    styles.presenceDot,
                    onlineUserIds.has(user.id)
                      ? styles.presenceOnline
                      : styles.presenceOffline
                  ]} />
                </View>
                <Text style={[styles.choiceLabel, { color: colors.text }]} numberOfLines={1}>
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
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Conversations · {totalUnread} non lu(s)
      </Text>
      {pinLimit !== null ? (
        <Text style={[styles.muted, { color: colors.muted }]}>
          {pinnedConversationIds.size}/{pinLimit} épinglée(s)
        </Text>
      ) : null}

      {orderedConversations.map((conversation) => {
        const others = conversation.members.filter(
          (member) => member.user.id !== userId
        );
        const isNexus = conversation.title === 'Nexus' && others.length === 0;
        const name = isNexus ? 'Nexus' : conversation.title || others
          .map((member) => member.user.displayName)
          .join(', ') || 'Conversation';
        const last = conversation.messages[0];
        const unread = conversation.unreadCount > 0;
        const pinned = pinnedConversationIds.has(conversation.id);
        const pinBusy = pinBusyId === conversation.id;
        const avatarUrl = !isNexus ? others[0]?.user.avatarUrl : null;
        const online = !isNexus && others.some((member) =>
          onlineUserIds.has(member.user.id)
        );

        return (
          <View
            key={conversation.id}
            style={[
              styles.card,
              styles.conversationCard,
              {
                backgroundColor: unread ? colors.surfaceRaised : colors.surfaceGlass,
                borderColor: unread ? colors.accent : colors.border,
                borderRadius: visual.cardRadius
              }
            ]}
          >
            <Pressable
              onPress={() => void openConversation(conversation)}
              style={styles.conversationOpen}
            >
              <View style={styles.conversationTitleRow}>
                <View
                  style={[
                    styles.conversationAvatar,
                    {
                      backgroundColor: colors.backgroundAccent,
                      borderColor: isNexus ? colors.secondary : colors.border
                    },
                    isNexus && styles.nexusAvatar
                  ]}
                >
                  {isNexus ? (
                    <KnowMeIcon name="spark" size={20} color={colors.secondary} />
                  ) : avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={[styles.avatarText, { color: colors.accent }]}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  )}
                  {!isNexus ? <View style={[
                    styles.presenceDot,
                    online ? styles.presenceOnline : styles.presenceOffline
                  ]} /> : null}
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{name}</Text>
                  <Text style={isNexus ? styles.online : online ? styles.online : styles.muted}>
                    {pinned ? 'Épinglée · ' : ''}{isNexus ? 'assistant privé' : online ? 'en ligne' : 'hors ligne'}
                  </Text>
                </View>
                {unread ? (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.unreadBadgeText, { color: colors.accentText }]}>
                      {conversation.unreadCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.muted,
                  unread && styles.unreadPreview,
                  { color: unread ? colors.text : colors.muted }
                ]}
                numberOfLines={2}
              >
                {last
                  ? `${last.senderId === userId ? 'Toi : ' : last.nexusAuthored ? 'Nexus : ' : ''}${last.content}`
                  : isNexus ? 'Pose une question à Nexus.' : 'Aucun message pour le moment.'}
              </Text>
              {last ? (
                <Text style={[styles.date, { color: colors.muted }]}>
                  {new Date(last.createdAt).toLocaleString('fr-FR')}
                </Text>
              ) : null}
            </Pressable>
            <SecondaryButton
              title={pinBusy ? 'Mise à jour…' : pinned ? 'Désépingler' : 'Épingler'}
              disabled={pinBusy || (!pinned && (pinLimit === null || pinAtCapacity))}
              onPress={() => void toggleConversationPin(conversation.id, pinned)}
            />
          </View>
        );
      })}

      {!conversations.length ? <Empty text="Aucune conversation." /> : null}
    </ScrollView>
  );
}

function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled = false,
  filled = false
}: {
  icon: 'back' | 'refresh' | 'arrow';
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  filled?: boolean;
}) {
  const { colors, visual } = useAppearance();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.iconButton,
        {
          backgroundColor: filled ? colors.accent : colors.backgroundAccent,
          borderColor: filled ? colors.accent : colors.border,
          borderRadius: visual.controlRadius
        },
        disabled && styles.disabled
      ]}
    >
      <KnowMeIcon
        name={icon}
        size={20}
        color={filled ? colors.accentText : colors.text}
        strokeWidth={1.9}
      />
    </PressScale>
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
  const { colors, visual } = useAppearance();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionButton,
        { backgroundColor: colors.accent, borderRadius: visual.controlRadius },
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
  const { colors, visual } = useAppearance();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.secondaryButton,
        {
          backgroundColor: colors.backgroundAccent,
          borderColor: colors.border,
          borderRadius: visual.controlRadius
        },
        disabled && styles.disabled
      ]}
    >
      <Text style={[styles.secondaryText, { color: colors.text }]}>{title}</Text>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  const { colors, visual } = useAppearance();
  return (
    <View style={[styles.empty, { backgroundColor: colors.surface, borderRadius: visual.cardRadius }]}>
      <Text style={[styles.muted, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28, gap: 10 },
  flex: { flex: 1 },
  liveStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveStatus: { fontSize: 11.5, fontWeight: '700' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 14,
    gap: 9
  },
  unreadConversation: {},
  cardTitle: { fontSize: 17, fontWeight: '800' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6
  },
  muted: { fontSize: 12.5, lineHeight: 18 },
  online: { lineHeight: 20, fontWeight: '700' },
  unreadPreview: { fontWeight: '700' },
  date: { fontSize: 11 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: 13,
    paddingVertical: 10,
    minHeight: 44
  },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center'
  },
  compactButton: { flex: 1 },
  actionText: { fontWeight: '900' },
  secondaryButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  secondaryText: { fontWeight: '800' },
  disabled: { opacity: 0.45 },
  empty: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center'
  },
  friendChoices: { gap: 10 },
  friendChoice: {
    width: 76,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 8,
    alignItems: 'center',
    gap: 6
  },
  friendChoiceActive: {},
  friendAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  choiceLabel: { fontSize: 10.5, maxWidth: 66 },
  conversationOpen: { gap: 10 },
  conversationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  conversationAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  nexusAvatar: { borderWidth: 1 },
  avatarText: { fontSize: 18, fontWeight: '900' },
  presenceDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  presenceOnline: { backgroundColor: '#37C977' },
  presenceOffline: { backgroundColor: '#8A8D93' },
  unreadBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7
  },
  unreadBadgeText: { fontWeight: '900', fontSize: 12 },
  conversationRoot: { flex: 1, paddingTop: 8, position: 'relative', overflow: 'hidden' },
  conversationHeader: {
    marginHorizontal: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  messages: {
    padding: 12,
    gap: 7,
    flexGrow: 1,
    justifyContent: 'flex-end'
  },
  bubble: { maxWidth: '84%', paddingHorizontal: 11, paddingVertical: 9, borderRadius: 18, gap: 4 },
  bubbleMine: { alignSelf: 'flex-end' },
  bubbleOther: { alignSelf: 'flex-start' },
  bubbleNexus: {
    borderWidth: 1,
    alignSelf: 'flex-start'
  },
  bubbleText: {},
  bubbleMineText: { fontWeight: '600' },
  senderName: { fontWeight: '800', fontSize: 11 },
  bubbleDate: { fontSize: 9 },
  receipt: { fontSize: 9, fontWeight: '700' },
  typing: { fontStyle: 'italic', paddingVertical: 8 },
  composer: {
    marginHorizontal: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    padding: 6
  },
  composerInput: { flex: 1 },
  iconButton: {
    width: 42,
    height: 42,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999
  },
  conversationCard: {
    paddingVertical: 12
  }
});