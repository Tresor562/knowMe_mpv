import { KnowMeAlert as Alert } from './ui/KnowMeFeedback';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Keyboard,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import type { Socket } from 'socket.io-client';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { apiFetch } from './api';
import { ChatMediaAttachment } from './ChatMediaAttachment';
import { ChatAudioMiniBar } from './ChatAudioMiniBar';
import { ChatGroupInfoSheet } from './ChatGroupInfoSheet';
import { GoldVerifiedBadge } from './ui/GoldVerifiedBadge';
import { RemoteCosmeticBadges } from './ui/RemoteCosmeticBadges';
import { BlueVerifiedBadge } from './ui/BlueVerifiedBadge';
import { ChatMediaPicker } from './ChatMediaPicker';
import { AnimatedEmoji } from './AnimatedEmoji';
import {ChatExpressionKeyboard, type ExpressionTab} from './ChatExpressionKeyboard';
import { isStandaloneAnimatedEmojiText } from '@knowme/animation-contract';
import { useAppearance } from './AppearanceProvider';
import { useProfileNavigation } from './profile-navigation';
import { KnowMeMentionText } from './KnowMeMentionText';
import { getRealtimeSocket } from './realtime';
import { GlassSurface, KnowMeIcon, PressScale } from './ui/KnowMeUI';

type UserSummary = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  staff?: {shield?:string}|null;
  verification?: {isVerified:true;label:string}|null;
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
  presentation?:{kind:'TEXT';text:string}|
    {kind:'STICKER';sticker:{glyph:string;label:string}}|
    {kind:'GIF'|'STICKER_IMAGE'|'IMAGE'|'VIDEO'|'AUDIO'|'DOCUMENT';assetId:string;mimeType:string;fileName?:string;sizeBytes?:number};
};
type Conversation = {
  id: string;
  title?: string | null;
  isGroup?:boolean;
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
type ActivityEvent = {conversationId:string;userId:string;username?:string;
  kind:'recording_voice'|'recording_video'|'uploading_media';active:boolean;expiresAt:number};
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
    isGroup: conversation.isGroup,
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


/** The selected user theme determines outgoing bubble color; no hard-coded green. */
function bubbleForAccent(accent:string):string {
  const raw=accent.trim().replace('#','');
  const hex=/^[0-9a-f]{6}$/i.test(raw)?raw:/^[0-9a-f]{3}$/i.test(raw)?
    raw.split('').map(x=>x+x).join(''):null;
  if(!hex)return accent;
  const channel=(offset:number)=>parseInt(hex.slice(offset,offset+2),16);
  const bg=[11,20,26],ratio=0.62;
  return '#'+[0,2,4].map((offset,index)=>
    Math.round(channel(offset)*ratio+(bg[index] ?? 26)* (1-ratio)).toString(16).padStart(2,'0')).join('');
}

const REFERENCE_CHAT={
  background:'#0b141a',header:'#0b141a',field:'#202c33',mine:'#005c4b',
  other:'#202c33',text:'#e9edef',muted:'#8696a0',blue:'#53bdeb'
} as const;

/** Quiet patterned conversation backdrop, independent of global feed themes. */
function ReferenceChatWallpaper() {
  const positions:[number,number,number][]=[
    [6,5,-22],[26,8,19],[48,3,-9],[71,9,14],[89,4,23],
    [15,20,16],[37,25,-15],[61,21,32],[85,30,-20],
    [6,37,-28],[28,42,10],[48,37,25],[72,44,-17],[93,49,14],
    [11,55,23],[32,61,-16],[55,58,8],[79,67,33],
    [7,74,9],[25,82,-11],[47,77,28],[67,86,19],[91,83,-12],
    [13,95,23],[40,95,-19],[74,96,25]
  ];
  const iconNames= ['camera','messages','heart','spark','discover','profile','video-call'] as const;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {positions.map(([x,y,rotation],index)=><View key={index} style={{
      position:'absolute',left:`${x}%` as `${number}%`,top:`${y}%` as `${number}%`,opacity:0.24,
      transform:[{rotate:`${rotation}deg`}]
    }}><KnowMeIcon name={iconNames[index%iconNames.length]!} size={31} color="#39444b" strokeWidth={1.3}/></View>)}
  </View>;
}

export function RealtimeMessagesPanel({
  userId,
  refreshing,
  setRefreshing,
  linkedConversationId,
  linkedMessageId,
  linkedMediaId,
  onConversationModeChange
}: {
  userId: string;
  linkedConversationId?: string | null;
  linkedMessageId?: string | null;
  linkedMediaId?: string | null;
  onConversationModeChange?: (active: boolean) => void;
  refreshing: boolean;
  setRefreshing: (value: boolean) => void;
}) {
  const { colors, visual } = useAppearance();
  const bubbleMineColor=bubbleForAccent(colors.accent);
  const openProfile = useProfileNavigation();
  const socketRef = useRef<Socket | null>(null);
  const activeRef = useRef<Conversation | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkedConversationOpened = useRef<string | null>(null);
  const linkedMessageScrolled = useRef<string | null>(null);
  const soughtCursors = useRef(new Set<string>());
  const messageListRef = useRef<FlatList<ConversationMessage>>(null);
  const typingActive = useRef(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pinnedConversationIds, setPinnedConversationIds] = useState<Set<string>>(new Set());
  const [pinLimit, setPinLimit] = useState<number | null>(null);
  const [pinBusyId, setPinBusyId] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [groupMode,setGroupMode]=useState(false);
  const [selectedGroupIds,setSelectedGroupIds]=useState<Set<string>>(new Set());
  const [groupName,setGroupName]=useState('');
  const [groupBusy,setGroupBusy]=useState(false);

  const [active, setActive] = useState<Conversation | null>(null);
  const [groupInfoOpen,setGroupInfoOpen]=useState(false);
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [readStates, setReadStates] = useState<ConversationMember[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [activityUsers,setActivityUsers]=useState<Record<string,{name:string;kind:ActivityEvent['kind'];expiresAt:number}>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [panelOpen,setPanelOpen]=useState(false);
  const [panelExpanded,setPanelExpanded]=useState(false);
  const [panelTab,setPanelTab]=useState<ExpressionTab>('stickers');
  const [typingFocused,setTypingFocused]=useState(false);
  const [gifGalleryRequest,setGifGalleryRequest]=useState(0);
  const composerInputRef=useRef<TextInput>(null);
  const [composerHeight, setComposerHeight] = useState(44);
  const [sending, setSending] = useState(false);
  const [nexusPending, setNexusPending] = useState(false);
  const [creatingNexus, setCreatingNexus] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    onConversationModeChange?.(Boolean(active));
    return () => onConversationModeChange?.(false);
  }, [active, onConversationModeChange]);

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
    const onActivity=(event:ActivityEvent)=>{
      if(event.userId===userId||activeRef.current?.id!==event.conversationId)return;
      setActivityUsers(current=>{
        const next={...current};
        if(event.active&&event.expiresAt>Date.now())next[event.userId]={
          name:event.username||'Quelqu’un',kind:event.kind,expiresAt:event.expiresAt
        };
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
      connectedSocket.on('activity:update',onActivity);
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
      socket?.off('activity:update',onActivity);
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

  useEffect(()=>{
    if(!active)return;
    const timer=setInterval(()=>{
      setActivityUsers(current=>{
        const next=Object.fromEntries(Object.entries(current).filter(([,status])=>status.expiresAt>Date.now()));
        return Object.keys(next).length===Object.keys(current).length?current:next;
      });
    },1200);
    return()=>clearInterval(timer);
  },[active?.id]);

  async function openConversation(conversation: Conversation) {
    try {
      const data = await apiFetch<MessageHistory>(
        `/conversations/${conversation.id}/messages?limit=50`
      );
      setHistory(data.items);
      setReadStates(data.readStates);
      setNextCursor(data.nextCursor ?? null);
      setTypingUsers({});
      setActivityUsers({});
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

  useEffect(() => {
    if (!linkedConversationId) return;
    const found = conversations.find(item => item.id === linkedConversationId);
    if (found && linkedConversationOpened.current !== linkedConversationId) {
      linkedConversationOpened.current = linkedConversationId;
      linkedMessageScrolled.current = null;
      soughtCursors.current.clear();
      void openConversation(found);
    }
  }, [linkedConversationId, conversations]);

  useEffect(() => {
    if (!linkedMessageId || !active || active.id !== linkedConversationId || loadingOlder) return;
    const index = history.findIndex(item => item.id === linkedMessageId);
    if (index >= 0) {
      if (linkedMessageScrolled.current !== linkedMessageId) {
        linkedMessageScrolled.current = linkedMessageId;
        messageListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      }
      return;
    }
    if (nextCursor && soughtCursors.current.size < 100 && !soughtCursors.current.has(nextCursor)) {
      soughtCursors.current.add(nextCursor);
      void loadOlder();
    }
  }, [linkedMessageId, linkedConversationId, active, history, nextCursor, loadingOlder]);

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

  async function createGroup() {
    const name=groupName.trim();
    if(groupBusy || name.length<1 || selectedGroupIds.size<2)return;
    setGroupBusy(true);
    try {
      const created=await apiFetch<Conversation>('/conversations',{
        method:'POST',
        body:JSON.stringify({title:name,memberIds:[...selectedGroupIds]})
      });
      const chat=normalizeConversation(created);
      setConversations(current=>[chat,...current.filter(item=>item.id!==chat.id)]);
      setGroupName('');
      setSelectedGroupIds(new Set());
      setGroupMode(false);
      await openConversation(chat);
    }catch(cause){
      Alert.alert('Groupe impossible',errorMessage(cause,'Réessaie.'));
    }finally{setGroupBusy(false);}
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

  function openCalls(media:'audio'|'video',peerId?:string){
    if(!peerId){
      Alert.alert('Appels KnowMe','Sélectionne une conversation individuelle pour appeler.');
      return;
    }
    const url=`https://knowme-nextech.vercel.app/calls?peer=${encodeURIComponent(peerId)}&media=${media}`;
    // KnowMe's current WebRTC call centre handles signalling and media permissions.
    // Do not create a call server-side before the real caller has approved microphone/camera.
    void Linking.openURL(url).catch(()=>Alert.alert('Appels indisponibles',
      'Impossible d’ouvrir les appels KnowMe. Vérifie ta connexion.'));
  }

  function closeConversation() {
    stopTyping();
    if (active) {
      socketRef.current?.emit('conversation:leave', {
        conversationId: active.id
      });
    }
    setGroupInfoOpen(false);
    setActive(null);
    setPanelOpen(false);
    setComposerHeight(44);
    setHistory([]);
    setReadStates([]);
    setTypingUsers({});
    setActivityUsers({});
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
    const recording=Object.values(activityUsers).find(item=>item.kind==='recording_voice');
    const recordingLabel=recording?`${recording.name} enregistre un vocal…`:null;
    const activeAvatarUrl = !isNexusPrivate ? others[0]?.user.avatarUrl : null;
    const isGroup=Boolean(active.isGroup||active.members.length>2);

    return (
      <View style={[styles.conversationRoot, { backgroundColor: REFERENCE_CHAT.background }]}>
        <ReferenceChatWallpaper />
        <View style={[styles.referenceHeader,{backgroundColor:REFERENCE_CHAT.header}]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Retour aux conversations"
            onPress={closeConversation} style={styles.referenceBack}>
            <KnowMeIcon name="back" size={27} color={REFERENCE_CHAT.text}/>
          </Pressable>
          <Pressable accessibilityRole="button"
            accessibilityLabel={isGroup?'Voir les informations du groupe':'Voir le profil'}
            disabled={!isGroup&&others.length!==1}
            onPress={()=>{
              if(isGroup)setGroupInfoOpen(true);
              else {const peer=others[0]?.user;if(peer)openProfile?.(peer.username);}
            }}
            style={styles.referenceAvatar}>
            {isNexusPrivate?<KnowMeIcon name="spark" size={24} color={REFERENCE_CHAT.blue}/>:
              activeAvatarUrl?<Image source={{uri:activeAvatarUrl}} style={styles.avatarImage}/>:
                <Text style={{color:REFERENCE_CHAT.text,fontSize:20}}>{name.charAt(0).toUpperCase()}</Text>}
          </Pressable>
          <Pressable accessibilityRole="button"
            accessibilityLabel={isGroup?`Informations de ${name}`:`Profil de ${name}`}
            disabled={!isGroup&&others.length!==1}
            onPress={()=>{
              if(isGroup)setGroupInfoOpen(true);
              else {const peer=others[0]?.user;if(peer)openProfile?.(peer.username);}
            }}
            style={styles.referenceHeaderTitle}>
            <Text style={styles.referenceName} numberOfLines={1}>{name}</Text>
            <Text numberOfLines={1} style={{color:typingNames.length?'#53bdeb':'#91a7b5',fontSize:11}}>
              {recordingLabel|| (typingNames.length?typingNames.length===1?`${typingNames[0]} écrit…`:
                `${typingNames.length} personnes écrivent…`:
                isGroup?`${active.members.length} membres`:
                online?'En ligne':'Appuie pour les informations')}
            </Text>
            {others.length===1?(others[0]?.user.verification?.isVerified?<BlueVerifiedBadge size={18} label={others[0]?.user.verification.label}/>:others[0]?.user.staff?.shield==='GOLD'?<GoldVerifiedBadge size={18}/>:null):null}{others.length===1 && others[0]?.user.username ? <RemoteCosmeticBadges username={others[0].user.username} size={18}/> : null}
          </Pressable>
          <Pressable style={styles.referenceHeaderAction} accessibilityRole="button"
            accessibilityLabel="Appel vocal"
            onPress={()=>openCalls('audio',others.length===1?others[0]?.user.id:undefined)}>
            <KnowMeIcon name="phone-call" size={24} color={REFERENCE_CHAT.text}/>
          </Pressable>
          <Pressable style={styles.referenceMore} accessibilityRole="button" accessibilityLabel="Options de conversation"
            onPress={()=>Alert.alert('Conversation',name,[
              ...(others.length===1?[{text:'Voir le profil',onPress:()=>{const peer=others[0]?.user;if(peer)openProfile?.(peer.username);}}]:[]),
              {text:'Appel vidéo',onPress:()=>openCalls('video',others.length===1?others[0]?.user.id:undefined)},
              {text:'Actualiser',onPress:()=>void openConversation(active)},
              {text:'Fermer',style:'cancel' as const}
            ])}>
            <KnowMeIcon name="more-vertical" size={24} color={REFERENCE_CHAT.text}/>
          </Pressable>
        </View>

        <ChatAudioMiniBar ownerId={userId}/>
        <ChatGroupInfoSheet conversationId={active.id} visible={groupInfoOpen}
          viewerId={userId} onClose={()=>setGroupInfoOpen(false)}
          onChanged={()=>{void load();}}
          onLeft={()=>{setGroupInfoOpen(false);closeConversation();}}/>
        <FlatList
          ref={messageListRef}
          onScrollToIndexFailed={info => messageListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true })}
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
          renderItem={({ item, index }) => {
            const mine = item.senderId === userId;
            const nexus = item.nexusAuthored === true;
            const imageOnly=item.presentation?.kind==='IMAGE'||item.presentation?.kind==='GIF';
            const showDate=index===0||new Date(history[index-1]!.createdAt).toDateString()!==new Date(item.createdAt).toDateString();
            const day=new Date(item.createdAt);
            const label=day.toDateString()===new Date().toDateString()?'Aujourd’hui':
              day.toDateString()===new Date(Date.now()-86400000).toDateString()?'Hier':
                day.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
            const readers = mine
              ? readStates.filter((state) =>
                  state.userId !== userId &&
                  new Date(state.lastReadAt).getTime() >=
                    new Date(item.createdAt).getTime()
                )
              : [];

            return (
              <View style={styles.referenceMessageItem}>
                {showDate?<View style={styles.referenceDay}><Text style={styles.referenceDayText}>{label}</Text></View>:null}
              <Pressable
                accessibilityHint="Appui long pour partager le message"
                onLongPress={() => {
                  const media = item.presentation && 'assetId' in item.presentation
                    ? item.presentation : null;
                  const shareMessage = () => void Share.share({
                    message: buildKnowMePublicLink({ kind: 'message', id: item.id })
                  });
                  Alert.alert('Options du message', 'Partager un lien KnowMe',
                    media ? [
                      { text: 'Lien du message', onPress: shareMessage },
                      { text: 'Lien du média', onPress: () => void Share.share({
                        message: buildKnowMePublicLink({
                          kind: media.kind === 'GIF' ? 'gif' : 'media',
                          id: media.assetId
                        })
                      }) },
                      { text: 'Fermer', style: 'cancel' }
                    ] : [
                      { text: 'Partager le message', onPress: shareMessage },
                      { text: 'Fermer', style: 'cancel' }
                    ]
                  );
                }}
                style={[
                  styles.bubble,
                  { borderRadius: 8 },
                  mine? [styles.bubbleMine,{backgroundColor:bubbleMineColor}]:
                    [styles.bubbleOther,{backgroundColor:REFERENCE_CHAT.other}],
                  imageOnly?styles.referenceImageBubble:null,
                  linkedMessageId === item.id ? { borderWidth: 2, borderColor: REFERENCE_CHAT.blue } : null
                ]}
              >
                {!mine && (others.length>1 || nexus) ? (
                  nexus || !item.sender?.username ? (
                    <Text style={[styles.senderName, { color: REFERENCE_CHAT.blue }]}>
                      {nexus ? '✦ Nexus' : 'Utilisateur'}
                    </Text>
                  ) : (
                    <Pressable accessibilityRole="button"
                      accessibilityLabel={`Voir le profil de ${item.sender.displayName}`}
                      onPress={() => openProfile?.(item.sender!.username)}>
                      <View style={styles.verifiedName}><Text style={[styles.senderName, { color: REFERENCE_CHAT.blue }]}>{item.sender.displayName}</Text>{item.sender.verification?.isVerified?<BlueVerifiedBadge size={16} label={item.sender.verification?.label}/>:item.sender.staff?.shield==='GOLD'?<GoldVerifiedBadge size={16}/>:null}<RemoteCosmeticBadges username={item.sender.username} size={16}/></View>
                    </Pressable>
                  )
                ) : null}
                {item.presentation?.kind==='GIF'||
                 item.presentation?.kind==='STICKER_IMAGE'||
                 item.presentation?.kind==='IMAGE'||item.presentation?.kind==='VIDEO'||
                 item.presentation?.kind==='AUDIO'||item.presentation?.kind==='DOCUMENT'
                  ? <View>
                    <ChatMediaAttachment assetId={item.presentation.assetId} kind={item.presentation.kind}
                      fileName={item.presentation.fileName} mimeType={item.presentation.mimeType}
                      avatarUrl={item.sender?.avatarUrl}
                      ownerId={userId} origin={name}
                      sender={item.sender?.displayName??'Message vocal'}
                      autoOpen={linkedMediaId === item.presentation.assetId}/>
                  </View>
                  : item.presentation?.kind==='STICKER'
                    ? <Pressable accessibilityRole="button"
                        accessibilityLabel={`Options du sticker ${item.presentation.sticker.label}`}
                        onPress={()=>{
                          const name=item.presentation?.kind==='STICKER'?item.presentation.sticker.label:'Sticker';
                          Alert.alert('Sticker KnowMe',name,[
                            {text:'Partager le message',onPress:()=>{
                              void Share.share({message:buildKnowMePublicLink({kind:'message',id:item.id})});
                            }},
                            {text:'Fermer',style:'cancel'}
                          ]);
                        }}
                        style={{alignItems:'flex-start',gap:2}}>
                        <AnimatedEmoji glyph={item.presentation.sticker.glyph} size={46}/>
                        <Text style={{color:REFERENCE_CHAT.text,fontSize:12}}>
                          {item.presentation.sticker.label}
                        </Text>
                      </Pressable>
                    : isStandaloneAnimatedEmojiText(item.presentation?.kind==='TEXT'
                        ? item.presentation.text : item.content)
                      ? <AnimatedEmoji size={50} glyph={(item.presentation?.kind==='TEXT'
                          ? item.presentation.text : item.content).trim()}/>
                      : <KnowMeMentionText
                        text={item.presentation?.kind==='TEXT' ? item.presentation.text : item.content}
                        style={[mine ? styles.bubbleMineText : styles.bubbleText,
                          { color: REFERENCE_CHAT.text,fontSize:16,lineHeight:21 }]}/>}
                <View style={styles.referenceMeta}>
                  <Text style={styles.referenceTime}>{formatMessageTime(item.createdAt)}</Text>
                  {mine?<Text style={[styles.referenceTick,{color:readers.length?REFERENCE_CHAT.blue:REFERENCE_CHAT.muted}]}
                    accessibilityLabel={readers.length?'Message lu':'Message envoyé'}>{readers.length?'✓✓':'✓'}</Text>:null}
                </View>
              </Pressable>
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

        <View style={styles.referenceComposer}>
          <View style={styles.referenceComposeRow}>
            <ChatMediaPicker<ConversationMessage> conversationId={active.id}
              onRecordingChange={recording=>socketRef.current?.emit(recording?'activity:start':'activity:stop',
                {conversationId:active.id,kind:'recording_voice'})}
              referenceChat showVoice={!draft.trim()&&!panelOpen} gifGalleryRequest={gifGalleryRequest}
              expressionOpen={panelOpen} expressionExpanded={panelExpanded}
              onToggleExpression={()=>setPanelExpanded(value=>!value)}
              inputSlot={<>
                <Pressable accessibilityRole="button"
                  accessibilityLabel={panelOpen?'Revenir au clavier':'Ouvrir emojis GIF et stickers'}
                  accessibilityState={{expanded:panelOpen}}
                  onPress={()=>{
                    if(panelOpen){
                      setPanelOpen(false);
                      setPanelExpanded(false);
                      composerInputRef.current?.focus();
                      return;
                    }
                    setPanelTab(typingFocused||Boolean(draft.trim())?'emoji':'stickers');
                    setPanelExpanded(false);
                    Keyboard.dismiss();
                    setPanelOpen(true);
                  }} style={styles.referenceEmoji}>
                  <KnowMeIcon name={panelOpen?'keyboard':typingFocused||Boolean(draft.trim())?'smile':'sticker'}
                    size={26} color={REFERENCE_CHAT.muted}/>
                </Pressable>
                <TextInput ref={composerInputRef} value={draft} onChangeText={changeDraft}
                  onFocus={()=>{setTypingFocused(true);setPanelOpen(false);}}
                  onBlur={()=>{setTypingFocused(false);stopTyping();}}
                  onContentSizeChange={event=>{
                    const next=Math.min(116,Math.max(44,Math.ceil(event.nativeEvent.contentSize.height)+14));
                    setComposerHeight(current=>current===next?current:next);
                  }}
                  multiline textAlignVertical="center" maxLength={2000}
                  maxFontSizeMultiplier={1.3}
                  placeholder={isNexusPrivate?'Message à Nexus':'Message'}
                  placeholderTextColor={REFERENCE_CHAT.muted} selectionColor={colors.accent}
                  style={[styles.referenceInput,{height:composerHeight}]}/>
              </>}
              onSent={created=>{
                setHistory(current=>mergeMessages(current,[created]));
                setConversations(current=>current.map(item=>item.id===active.id
                  ? {...item,messages:[created]}:item));
              }}/>
            {draft.trim()?<Pressable accessibilityRole="button" accessibilityLabel="Envoyer"
              disabled={sending||nexusPending} onPress={()=>void send()}
              style={[styles.referenceSend,{backgroundColor:colors.accent}]}>
              <KnowMeIcon name="arrow" size={25} color={colors.accentText}/>
            </Pressable>:null}
          </View>
        </View>
        {panelOpen?<ChatExpressionKeyboard<ConversationMessage>
          conversationId={active.id} tab={panelTab} onChangeTab={setPanelTab}
          onClose={()=>{setPanelOpen(false);setPanelExpanded(false);composerInputRef.current?.focus();}}
          expanded={panelExpanded} onExpandedChange={setPanelExpanded}
          onInsertEmoji={emoji=>changeDraft(draft+emoji)}
          onImportGif={()=>{setGifGalleryRequest(id=>id+1);}}
          onSent={created=>{
            setHistory(current=>mergeMessages(current,[created]));
            setConversations(current=>current.map(item=>item.id===active.id
              ? {...item,messages:[created]}:item));
          }}
        />:null}
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
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
            <Text style={[styles.cardTitle,{color:colors.text}]}>
              {groupMode?'Nouveau groupe':'Nouvelle discussion'}
            </Text>
            <Pressable accessibilityRole="button"
              onPress={()=>{setGroupMode(current=>!current);setSelectedGroupIds(new Set());}}
              style={{minHeight:44,paddingHorizontal:10,justifyContent:'center'}}>
              <Text style={{color:colors.accent,fontWeight:'700'}}>
                {groupMode?'Discussion privée':'Créer un groupe'}
              </Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.friendChoices}
          >
            {friends.map(({ user }) => (
              <Pressable
                key={user.id}
                onPress={() => {
                  if(!groupMode){setSelectedFriend(user.id);return;}
                  setSelectedGroupIds(current=>{
                    const next=new Set(current);
                    if(next.has(user.id))next.delete(user.id);
                    else next.add(user.id);
                    return next;
                  });
                }}
                style={[
                  styles.friendChoice,
                  {
                    borderRadius: visual.controlRadius,
                    borderColor: (groupMode?selectedGroupIds.has(user.id):selectedFriend===user.id) ? colors.accent : colors.border,
                    backgroundColor: (groupMode?selectedGroupIds.has(user.id):selectedFriend===user.id)
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
          {groupMode?<View style={{gap:10}}>
            <Text style={{color:colors.muted,fontSize:12}}>
              {selectedGroupIds.size} contacts sélectionnés (minimum 2)
            </Text>
            <TextInput
              value={groupName} onChangeText={setGroupName}
              maxLength={90} placeholder="Nom du groupe"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Nom du nouveau groupe"
              style={[styles.input,{color:colors.text,borderColor:colors.border,backgroundColor:colors.backgroundAccent}]}
            />
            <ActionButton
              title={groupBusy?'Création…':'Créer le groupe'}
              disabled={groupBusy||selectedGroupIds.size<2||!groupName.trim()}
              onPress={()=>void createGroup()}/>
          </View>:<ActionButton
            title="Créer la conversation"
            disabled={!selectedFriend}
            onPress={() => void createConversation()}
          />}
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
                  <View style={styles.verifiedName}><Text style={[styles.cardTitle,{color:colors.text},styles.flex]} numberOfLines={1}>{name}</Text>{others.length===1?(others[0]?.user.verification?.isVerified?<BlueVerifiedBadge size={17} label={others[0]?.user.verification.label}/>:others[0]?.user.staff?.shield==='GOLD'?<GoldVerifiedBadge size={17}/>:null):null}{others.length===1 && others[0]?.user.username ? <RemoteCosmeticBadges username={others[0].user.username} size={17}/> : null}</View>
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
                  ? `${last.senderId === userId ? 'Toi : ' : last.nexusAuthored ? 'Nexus : ' : ''}${last.presentation?.kind==='STICKER_IMAGE'?'Sticker':last.presentation?.kind==='IMAGE'?'Image':last.presentation?.kind==='GIF'?'GIF':last.presentation?.kind==='STICKER'?'Sticker':last.presentation?.kind==='TEXT'?last.presentation.text:last.content}`
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
  conversationRoot: { flex: 1, position: 'relative', overflow: 'hidden' },
  referenceHeader:{height:62,paddingHorizontal:5,flexDirection:'row',alignItems:'center',gap:4},
  referenceBack:{width:37,height:48,alignItems:'center',justifyContent:'center'},
  referenceAvatar:{height:40,width:40,borderRadius:20,backgroundColor:'#1d2b34',
    alignItems:'center',justifyContent:'center',overflow:'hidden',marginRight:4},
  referenceHeaderTitle:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:6},
  referenceName:{fontSize:19,fontWeight:'500',color:REFERENCE_CHAT.text,flexShrink:1},
  referenceHeaderAction:{width:37,height:46,alignItems:'center',justifyContent:'center'},
  referenceMore:{width:27,height:46,alignItems:'center',justifyContent:'center'},
  referenceMessageItem:{width:'100%',gap:0},
  referenceImageBubble:{backgroundColor:'transparent',paddingHorizontal:0,paddingVertical:0,
    borderWidth:0,elevation:0},
  referenceDay:{alignSelf:'center',backgroundColor:'#1b2931',borderRadius:8,
    paddingHorizontal:12,paddingVertical:5,marginVertical:13},
  referenceDayText:{color:'#bec9ce',fontSize:12},
  referenceMeta:{flexDirection:'row',alignItems:'center',alignSelf:'flex-end',gap:4,minHeight:15,marginTop:1},
  referenceTime:{fontSize:10.5,color:'#afbdc3'},
  referenceTick:{fontSize:12,fontWeight:'700'},
  referenceComposer:{backgroundColor:REFERENCE_CHAT.background,paddingHorizontal:7,
    paddingTop:5,paddingBottom:8},
  referenceComposeRow:{flexDirection:'row',alignItems:'flex-end',gap:7},
  referenceInput:{flex:1,minWidth:0,fontSize:16,paddingHorizontal:4,paddingVertical:6,
    lineHeight:22,includeFontPadding:false,color:REFERENCE_CHAT.text},
  referenceEmoji:{width:34,height:44,justifyContent:'center',alignItems:'center'},
  referenceSend:{height:52,width:52,borderRadius:26,backgroundColor:'#f5f6f6',
    alignItems:'center',justifyContent:'center'},
  referenceTools:{backgroundColor:'#202c33',borderRadius:12,marginTop:7,
    paddingHorizontal:10,paddingVertical:5,flexDirection:'row',alignItems:'center',gap:11},
  conversationHeader: {
    marginHorizontal: 0,
    marginTop: 0,
    paddingHorizontal: 9,
    paddingVertical: 6,
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9
  },
  messages: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 4,
    flexGrow: 1,
    justifyContent: 'flex-end'
  },
  bubble: {maxWidth:'87%',paddingHorizontal:9,paddingVertical:6,borderRadius:8,gap:2,elevation:1},
  bubbleMine: { alignSelf: 'flex-end' },
  bubbleOther: { alignSelf: 'flex-start' },
  bubbleNexus: {
    borderWidth: 1,
    alignSelf: 'flex-start'
  },
  bubbleText: {},
  bubbleMineText: { fontWeight: '600' },
  senderName: { fontWeight: '800', fontSize: 11 },
  verifiedName:{flexDirection:'row',alignItems:'center',gap:5,flexShrink:1},
  bubbleDate: { fontSize: 9 },
  receipt: { fontSize: 9, fontWeight: '700' },
  typing: { fontStyle: 'italic', paddingVertical: 8 },
  composer: {
    marginHorizontal: 5,
    marginBottom: 3,
    paddingHorizontal: 5,
    paddingVertical: 4,
    gap: 3
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    minHeight: 44
  },
  composerToolsTrigger: {
    width: 38,
    minHeight: 44,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center'
  },
  composerTools: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
    paddingHorizontal: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  composerToolsLabel: { fontSize: 12, fontWeight: '600' },
  composerInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false
  },
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