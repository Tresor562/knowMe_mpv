import { KnowMeAlert as Alert } from './ui/KnowMeFeedback';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
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
import { getRealtimeSocket } from './realtime';
import { KnowMeMentionText } from './KnowMeMentionText';
import { MessagesOrganizationExperience } from './MessagesOrganizationExperience';
import { Avatar, GlassSurface, KnowMeIcon } from './ui/KnowMeUI';
import { GoldVerifiedBadge } from './ui/GoldVerifiedBadge';
import { BlueVerifiedBadge } from './ui/BlueVerifiedBadge';
import { RemoteCosmeticBadges } from './ui/RemoteCosmeticBadges';

type UserSummary = {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  staff?: {shield?:string}|null;
  verification?: {isVerified:true;label:string}|null;
};

type Friend = { friendshipId: string; user: UserSummary };
type FriendRequest = { id: string; requester: UserSummary };
type SentFriendRequest = {id:string;addressee:UserSummary};
type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
};
type Section = 'friends' | 'messages' | 'notifications';

function notificationGlyph(type: string): 'messages' | 'heart' | 'profile' | 'check' | 'bell' {
  if (type === 'MESSAGE' || type.includes('CHAT')) return 'messages';
  if (type.includes('POST') || type.includes('COMMENT') || type.includes('MENTION') || type.includes('CREATOR')) return 'heart';
  if (type.includes('FRIEND') || type.includes('FOLLOW')) return 'profile';
  if (type.includes('SECURITY')) return 'check';
  return 'bell';
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export function SocialHub({ userId, linkedConversationId, linkedMessageId, linkedMediaId, mode = 'messages', onOpenProfile, onOpenMarketplace, onContentScroll, onImmersiveChange, topNavigation }: { userId: string; linkedConversationId?: string | null; linkedMessageId?: string | null; linkedMediaId?: string | null; mode?: 'messages' | 'discover' | 'notifications'; onOpenProfile?: (username: string) => void; onOpenMarketplace?: () => void; onContentScroll?: (offset: number) => void; onImmersiveChange?: (active: boolean) => void; topNavigation?: ReactNode }) {
  const { colors } = useAppearance();
  const [section, setSection] = useState<Section>(mode === 'discover' ? 'friends' : mode === 'notifications' ? 'notifications' : 'messages');
  const [refreshing, setRefreshing] = useState(false);
  // Opening a conversation removes hub chrome and gives the chat the full screen.
  const [immersive, setImmersive] = useState(false);
  const handleImmersiveChange = useCallback((active: boolean) => {
    setImmersive(active);
    onImmersiveChange?.(active);
  }, [onImmersiveChange]);

  useEffect(() => {
    setRefreshing(false);
    setImmersive(false);
    setSection(mode === 'discover' ? 'friends' : mode === 'notifications' ? 'notifications' : 'messages');
  }, [userId, linkedConversationId, mode]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {!immersive ? <View style={styles.header}>
        <GlassSurface strength="soft" borderRadius={24}
          style={topNavigation ? styles.joinedHeader : styles.headerTop}>
          <View style={topNavigation ? styles.headerTop : styles.inlineHeader}>
            <View style={styles.headerTitleBlock}>
              <Text style={[styles.heading, { color: colors.text }]}>{mode === "discover" ? "Suggestions" : mode === "notifications" ? "Notifications" : "Messages"}</Text>
              <Text style={[styles.headerSub, { color: colors.muted }]}>{mode === "discover" ? "Retrouve des personnes et découvre leurs profils." : mode === "notifications" ? "Tes dernières activités." : "Tes conversations, en direct."}</Text>
            </View>
            <View style={[styles.headerIcon, { backgroundColor: colors.backgroundAccent }]}>
              <KnowMeIcon name={mode === "discover" ? "discover" : mode === "notifications" ? "bell" : "messages"} size={21} color={colors.accent} />
            </View>
          </View>
          {topNavigation}
        </GlassSurface>
        {mode === "messages" && <GlassSurface strength="soft" borderRadius={22} style={styles.segmented}>
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
        </GlassSurface>}
      </View> : null}

      {section === 'friends' && (
        <FriendsPanel
          key={`friends:${userId}`}
          refreshing={refreshing}
          setRefreshing={setRefreshing}
          onOpenProfile={onOpenProfile}
          onOpenMarketplace={mode === 'discover' ? onOpenMarketplace : undefined}
          onContentScroll={onContentScroll}
        />
      )}
      {section === 'messages' && (
        <MessagesOrganizationExperience
          key={`messages:${userId}`}
          userId={userId}
          linkedConversationId={linkedConversationId}
          linkedMessageId={linkedMessageId}
          linkedMediaId={linkedMediaId}
          onImmersiveChange={handleImmersiveChange}
          onContentScroll={onContentScroll}
          refreshing={refreshing}
          setRefreshing={setRefreshing}
        />
      )}
      {section === 'notifications' && (
        <NotificationsPanel
          key={`notifications:${userId}`}
          onContentScroll={onContentScroll}
          refreshing={refreshing}
          setRefreshing={setRefreshing}
        />
      )}
    </View>
  );
}

function FriendsPanel({
  refreshing,
  setRefreshing,
  onOpenProfile,
  onOpenMarketplace,
  onContentScroll
}: {
  refreshing: boolean;
  setRefreshing: (value: boolean) => void;
  onOpenProfile?: (username: string) => void;
  onOpenMarketplace?: () => void;
  onContentScroll?: (offset: number) => void;
}) {
  const { colors } = useAppearance();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests,setSentRequests] = useState<SentFriendRequest[]>([]);
  const [results, setResults] = useState<UserSummary[]>([]);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [friendData,requestData,sentData] = await Promise.all([
        apiFetch<Friend[]>('/social/friends'),
        apiFetch<FriendRequest[]>('/social/friend-requests/incoming'),
        apiFetch<SentFriendRequest[]>('/social/friend-requests/outgoing').catch(cause=>{
          if((cause as {status?:number})?.status===404)return [];
          throw cause;
        })
      ]);
      setFriends(friendData);
      setRequests(requestData);
      setSentRequests(sentData);
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
      await load();
      Alert.alert('Demande envoyée', 'La personne recevra une notification.');
    } catch (cause) {
      Alert.alert('Envoi impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setBusyId(null);
    }
  }

  async function cancelSentRequest(id:string){
    if(busyId)return;
    setBusyId(id);
    try{
      await apiFetch('/social/friend-requests/'+encodeURIComponent(id),{method:'DELETE'});
      await load();
    }catch(cause){
      Alert.alert('Annulation impossible',errorMessage(cause,'Réessaie.'));
    }finally{setBusyId(null);}
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
      onScroll={event=>onContentScroll?.(event.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
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
      {onOpenMarketplace ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ouvrir la marketplace KnowMe"
          onPress={onOpenMarketplace}
          style={({pressed}) => [
            {
              minHeight: 68,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 11,
              paddingHorizontal: 13,
              paddingVertical: 11,
              borderRadius: 20,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.backgroundAccent : colors.surfaceGlass
            }
          ]}>
          <View style={{width:42,height:42,borderRadius:15,backgroundColor:colors.backgroundAccent,alignItems:'center',justifyContent:'center'}}>
            <KnowMeIcon name="spark" size={24} color={colors.accent} />
          </View>
          <View style={{flex:1,minWidth:0,gap:3}}>
            <Text style={{color:colors.text,fontSize:15,fontWeight:'700'}}>Marketplace</Text>
            <Text style={{color:colors.muted,fontSize:12}}>Cadeaux et achats KnowMe</Text>
          </View>
          <KnowMeIcon name="arrow" size={19} color={colors.muted} />
        </Pressable>
      ) : null}

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
          <Identity user={requester} onOpenProfile={onOpenProfile} />
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

      {sentRequests.length>0&&<>
        <Text style={[styles.sectionTitle,{color:colors.text}]}>
          Demandes envoyées ({sentRequests.length})
        </Text>
        {sentRequests.map(request=><View key={request.id}
          style={[styles.card,{backgroundColor:colors.surfaceGlass,borderColor:colors.border}]}>
          <Identity user={request.addressee} onOpenProfile={onOpenProfile}/>
          <SecondaryButton title="Annuler la demande"
            disabled={Boolean(busyId)}
            onPress={()=>void cancelSentRequest(request.id)}/>
        </View>)}
      </>}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Mes amis ({friends.length})</Text>
      {friends.map(({ friendshipId, user }) => (
        <View key={friendshipId} style={[styles.card, { backgroundColor: colors.surfaceGlass, borderColor: colors.border }]}>
          <Identity user={user} onOpenProfile={onOpenProfile} />
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
          <Identity user={user} onOpenProfile={onOpenProfile} />
          <ActionButton
            title={busyId===user.id?'Envoi…':
              sentRequests.some(request=>request.addressee.id===user.id)?'En attente':
              friends.some(friend=>friend.user.id===user.id)?'Déjà amis':'Ajouter'}
            disabled={Boolean(busyId)||
              sentRequests.some(request=>request.addressee.id===user.id)||
              friends.some(friend=>friend.user.id===user.id)}
            onPress={() => void addFriend(user.id)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

function NotificationsPanel({
  refreshing,
  setRefreshing,
  onContentScroll
}: {
  refreshing: boolean;
  setRefreshing: (value: boolean) => void;
  onContentScroll?: (offset: number) => void;
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

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const refresh = () => { if (active) void load(); };
    void getRealtimeSocket().then(socket => {
      if (!active || !socket) return;
      socket.on('notification:created', refresh);
      socket.on('notification:read', refresh);
      socket.on('notification:read-all', refresh);
      unsubscribe = () => {
        socket.off('notification:created', refresh);
        socket.off('notification:read', refresh);
        socket.off('notification:read-all', refresh);
      };
    }).catch(() => {
      // Pull-to-refresh remains available when realtime is offline.
    });
    return () => { active = false; unsubscribe?.(); };
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
      onScroll={event=>onContentScroll?.(event.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
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
          ? <View style={styles.notificationTools}>
              <Text style={[styles.notificationCount, {color: colors.muted}]}>{unread} non lue(s)</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Tout marquer comme lu"
                onPress={() => void markAllRead()}
                style={[styles.notificationMarkAll, {backgroundColor: colors.backgroundAccent}]}>
                <KnowMeIcon name="check" size={18} color={colors.accent}/>
                <Text style={[styles.notificationMarkAllText, {color: colors.accent}]}>Tout lire</Text>
              </Pressable>
            </View>
          : null
      }
      ListEmptyComponent={<Empty text="Aucune notification." />}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.readAt ? item.title + ' · lue' : item.title + ' · marquer comme lue'}
          accessibilityState={{disabled: Boolean(item.readAt)}}
          disabled={Boolean(item.readAt)}
          onPress={() => void markRead(item.id)}
          style={[styles.notificationRow, {
            backgroundColor: item.readAt ? 'transparent' : colors.backgroundAccent,
            borderBottomColor: colors.border
          }]}>
          <View style={[styles.notificationGlyph, {backgroundColor: colors.surface}]}>
            <KnowMeIcon name={notificationGlyph(item.type)} size={21}
              color={item.readAt ? colors.muted : colors.accent}/>
          </View>
          <View style={styles.notificationCopy}>
            <Text style={[styles.notificationTitle, {color: colors.text}]} numberOfLines={2}>{item.title}</Text>
            <KnowMeMentionText text={item.body} style={[styles.notificationPreview, {color: colors.muted}]}/>
            <Text style={[styles.notificationDate, {color: colors.muted}]}>
              {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </Text>
          </View>
          {!item.readAt && <View style={[styles.notificationUnread, {backgroundColor: colors.accent}]}/>}
        </Pressable>
      )}
    />
  );
}

function Identity({ user, onOpenProfile }: { user: UserSummary; onOpenProfile?: (username: string) => void }) {
  const { colors } = useAppearance();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Voir le profil de ${user.displayName}`} onPress={() => onOpenProfile?.(user.username)} style={styles.identity}>
      <Avatar uri={user.avatarUrl} name={user.displayName} size={48} />
      <View style={styles.identityText}>
        <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{user.displayName}</Text>
          {user.verification?.isVerified?<BlueVerifiedBadge size={18} label={user.verification.label}/>:user.staff?.shield==='GOLD'?<GoldVerifiedBadge size={18}/>:null}
          <RemoteCosmeticBadges username={user.username} size={18} />
        </View>
        <Text style={[styles.muted, { color: colors.muted }]}>@{user.username}</Text>
        {user.bio ? (
          <Text style={[styles.bio, { color: colors.muted }]} numberOfLines={2}>{user.bio}</Text>
        ) : null}
      </View>
    </Pressable>
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
  joinedHeader: { overflow: 'hidden', padding: 0 },
  inlineHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  notificationTools: { minHeight: 44, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8, paddingHorizontal: 5 },
  notificationCount: { fontSize: 12, fontWeight: '600' },
  notificationMarkAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center',
    gap: 6, borderRadius: 13, paddingHorizontal: 13 },
  notificationMarkAllText: { fontSize: 12, fontWeight: '700' },
  notificationRow: { minHeight: 74, flexDirection: 'row', alignItems: 'flex-start',
    gap: 10, borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 13, paddingHorizontal: 10, paddingVertical: 12 },
  notificationGlyph: { width: 38, height: 38, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notificationCopy: { flex: 1, minWidth: 0, gap: 3 },
  notificationTitle: { fontSize: 13.5, fontWeight: '700', lineHeight: 18 },
  notificationPreview: { fontSize: 12, lineHeight: 17 },
  notificationDate: { fontSize: 10.5, marginTop: 2 },
  notificationUnread: { width: 7, height: 7, borderRadius: 4, marginTop: 8, flexShrink: 0 },
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
