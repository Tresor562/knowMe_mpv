import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  getMobileFriends,
  getMobileSocialGiftCatalog,
  getMobileSocialGiftInbox,
  getMobileSocialGiftPolicy,
  getMobileSocialGiftSent,
  getMobileWallet,
  markMobileSocialGiftViewed,
  MobileFriend,
  MobileSocialGiftDefinition,
  MobileSocialGiftInboxItem,
  MobileSocialGiftPolicy,
  MobileSocialGiftSentItem,
  mobileSocialGiftIdempotencyKey,
  mobileSocialGiftRarity,
  sendMobileSocialGift
} from './social-gifts';

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function GiftVisual({ gift }: { gift: MobileSocialGiftDefinition }) {
  return (
    <View style={styles.giftVisual} accessibilityLabel={`${gift.name}, ${gift.rarity}`}>
      <Text style={styles.giftEmoji}>{gift.emoji}</Text>
    </View>
  );
}

export function SocialGiftsExperience() {
  const [catalog, setCatalog] = useState<MobileSocialGiftDefinition[]>([]);
  const [friends, setFriends] = useState<MobileFriend[]>([]);
  const [inbox, setInbox] = useState<MobileSocialGiftInboxItem[]>([]);
  const [sent, setSent] = useState<MobileSocialGiftSentItem[]>([]);
  const [policy, setPolicy] = useState<MobileSocialGiftPolicy | null>(null);
  const [balance, setBalance] = useState(0);
  const [recipientId, setRecipientId] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyGiftKey, setBusyGiftKey] = useState<string | null>(null);
  const [busyInboxId, setBusyInboxId] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setStatus('');
    try {
      const [giftCatalog, currentFriends, giftInbox, giftSent, giftPolicy, wallet] =
        await Promise.all([
          getMobileSocialGiftCatalog(),
          getMobileFriends(),
          getMobileSocialGiftInbox(12),
          getMobileSocialGiftSent(12),
          getMobileSocialGiftPolicy(),
          getMobileWallet()
        ]);
      setCatalog(giftCatalog);
      setFriends(currentFriends);
      setInbox(giftInbox.items);
      setSent(giftSent.items);
      setPolicy(giftPolicy);
      setBalance(wallet.balance);
      setRecipientId((current) =>
        current && currentFriends.some((friend) => friend.user.id === current)
          ? current
          : currentFriends[0]?.user.id ?? ''
      );
    } catch (cause) {
      setStatus(message(cause, 'Les cadeaux sociaux sont indisponibles.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.user.id === recipientId)?.user ?? null,
    [friends, recipientId]
  );

  async function send(gift: MobileSocialGiftDefinition) {
    if (!recipientId || busyGiftKey) return;
    setBusyGiftKey(gift.key);
    setStatus('');
    try {
      const result = await sendMobileSocialGift(
        {
          recipientId,
          giftKey: gift.key,
          message: giftMessage.trim() || undefined
        },
        mobileSocialGiftIdempotencyKey(recipientId, gift.key)
      );
      setBalance(result.senderBalance);
      setGiftMessage('');
      setStatus(
        result.replayed
          ? 'Ce cadeau avait déjà été enregistré. Aucun second débit.'
          : `${gift.emoji} ${gift.name} envoyé à ${selectedFriend?.displayName ?? 'ton ami'}.`
      );
      const history = await getMobileSocialGiftSent(12);
      setSent(history.items);
      Alert.alert(
        result.replayed ? 'Cadeau déjà enregistré' : 'Cadeau envoyé',
        result.replayed
          ? 'KnowMe a retrouvé le reçu existant sans débiter une seconde fois.'
          : 'Le débit KnowCoins et le reçu ont été enregistrés atomiquement.'
      );
    } catch (cause) {
      const text = message(cause, 'Envoi du cadeau impossible.');
      setStatus(text);
      Alert.alert('Cadeau impossible', text);
    } finally {
      setBusyGiftKey(null);
    }
  }

  async function view(item: MobileSocialGiftInboxItem) {
    if (item.viewedAt || busyInboxId) return;
    setBusyInboxId(item.id);
    try {
      const result = await markMobileSocialGiftViewed(item.id);
      setInbox((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, viewedAt: result.viewedAt } : entry
        )
      );
    } catch (cause) {
      setStatus(message(cause, 'Mise à jour impossible.'));
    } finally {
      setBusyInboxId(null);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Cadeaux sociaux</Text>
          <Text style={styles.description}>
            Offre un souvenir visuel à un ami. Le destinataire ne reçoit ni solde, ni bonus de jeu,
            ni permission.
          </Text>
        </View>
        <Pressable
          disabled={refreshing}
          onPress={() => void load(true)}
          style={({ pressed }) => [styles.refresh, (pressed || refreshing) && styles.mutedButton]}
        >
          <Text style={styles.refreshText}>{refreshing ? '…' : '↻'}</Text>
        </Pressable>
      </View>

      <View style={styles.balanceBox}>
        <Text style={styles.muted}>Solde KnowCoins</Text>
        <Text style={styles.balance}>{balance}</Text>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#45e6bd" />
          <Text style={styles.muted}>Chargement du catalogue…</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Choisir un ami</Text>
          {friends.length ? (
            <View style={styles.friendGrid}>
              {friends.map((friend) => {
                const selected = friend.user.id === recipientId;
                return (
                  <Pressable
                    key={friend.friendshipId}
                    onPress={() => setRecipientId(friend.user.id)}
                    style={({ pressed }) => [
                      styles.friendButton,
                      selected && styles.friendSelected,
                      pressed && styles.mutedButton
                    ]}
                  >
                    <Text style={styles.friendInitial}>
                      {friend.user.displayName.charAt(0).toUpperCase()}
                    </Text>
                    <Text style={styles.friendName} numberOfLines={1}>
                      {friend.user.displayName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.muted}>
              Accepte d’abord une amitié pour pouvoir envoyer un cadeau.
            </Text>
          )}

          <TextInput
            value={giftMessage}
            onChangeText={setGiftMessage}
            maxLength={160}
            placeholder="Petit message facultatif"
            placeholderTextColor="#789187"
            style={styles.input}
          />

          <Text style={styles.sectionTitle}>Catalogue original</Text>
          {catalog.map((gift) => {
            const affordable = balance >= gift.priceKnowCoins;
            const disabled = !recipientId || !affordable || busyGiftKey !== null;
            return (
              <View key={gift.key} style={styles.giftCard}>
                <GiftVisual gift={gift} />
                <View style={styles.giftText}>
                  <Text style={styles.giftName}>{gift.name}</Text>
                  <Text style={styles.rarity}>{mobileSocialGiftRarity(gift.rarity)}</Text>
                  <Text style={styles.giftDescription}>{gift.description}</Text>
                  <Text style={styles.price}>{gift.priceKnowCoins} KnowCoins</Text>
                  <Text style={styles.safety}>Visuel · non revendable · aucun solde reçu</Text>
                </View>
                <Pressable
                  disabled={disabled}
                  onPress={() => void send(gift)}
                  style={({ pressed }) => [
                    styles.sendButton,
                    (pressed || disabled) && styles.mutedButton
                  ]}
                >
                  <Text style={styles.sendButtonText}>
                    {busyGiftKey === gift.key
                      ? '…'
                      : !affordable
                        ? 'Solde insuffisant'
                        : 'Offrir'}
                  </Text>
                </Pressable>
              </View>
            );
          })}

          <Text style={styles.sectionTitle}>Reçus récemment</Text>
          {inbox.length ? (
            inbox.map((item) => (
              <View key={item.id} style={[styles.historyRow, !item.viewedAt && styles.unreadRow]}>
                <Text style={styles.historyEmoji}>{item.gift.emoji}</Text>
                <View style={styles.historyText}>
                  <Text style={styles.historyTitle}>{item.gift.name}</Text>
                  <Text style={styles.muted}>
                    {item.sender?.displayName ?? 'Compte indisponible'} ·{' '}
                    {new Date(item.sentAt).toLocaleDateString('fr-FR')}
                  </Text>
                  {item.message ? <Text style={styles.historyMessage}>“{item.message}”</Text> : null}
                </View>
                <Pressable
                  disabled={Boolean(item.viewedAt) || busyInboxId === item.id}
                  onPress={() => void view(item)}
                  style={({ pressed }) => [
                    styles.viewButton,
                    (pressed || Boolean(item.viewedAt)) && styles.mutedButton
                  ]}
                >
                  <Text style={styles.viewButtonText}>{item.viewedAt ? 'Vu' : 'Ouvrir'}</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>Aucun cadeau reçu.</Text>
          )}

          <Text style={styles.sectionTitle}>Envoyés récemment</Text>
          {sent.length ? (
            sent.map((item) => (
              <View key={item.id} style={styles.historyRow}>
                <Text style={styles.historyEmoji}>{item.gift.emoji}</Text>
                <View style={styles.historyText}>
                  <Text style={styles.historyTitle}>{item.gift.name}</Text>
                  <Text style={styles.muted}>
                    {item.recipient?.displayName ?? 'Compte indisponible'} ·{' '}
                    {item.priceKnowCoins} KC
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>Aucun cadeau envoyé.</Text>
          )}

          {policy ? (
            <Text style={styles.policy}>
              Limite serveur : {policy.dailyGiftCountLimit} cadeaux et{' '}
              {policy.dailySpendLimitKnowCoins} KnowCoins par jour.
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#10231d',
    borderColor: '#1c3a31',
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1, gap: 8 },
  title: { color: '#f4fff9', fontSize: 19, fontWeight: '900' },
  description: { color: '#b6c8c0', fontSize: 14, lineHeight: 21 },
  refresh: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderColor: '#25473b',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  refreshText: { color: '#45e6bd', fontSize: 22, fontWeight: '900' },
  mutedButton: { opacity: 0.45 },
  balanceBox: { backgroundColor: '#091914', borderRadius: 16, padding: 14, gap: 3 },
  balance: { color: '#45e6bd', fontSize: 26, fontWeight: '900' },
  status: { color: '#45e6bd', fontSize: 13, lineHeight: 19 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { color: '#f4fff9', fontWeight: '900', fontSize: 16, marginTop: 4 },
  muted: { color: '#91a79e', fontSize: 12 },
  friendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  friendButton: {
    minWidth: 92,
    maxWidth: 130,
    backgroundColor: '#091914',
    borderColor: '#25473b',
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    gap: 6
  },
  friendSelected: { borderColor: '#45e6bd' },
  friendInitial: {
    width: 34,
    height: 34,
    borderRadius: 17,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: '#45e6bd',
    color: '#052017',
    fontWeight: '900'
  },
  friendName: { color: '#f4fff9', fontWeight: '800', fontSize: 12 },
  input: {
    minHeight: 50,
    backgroundColor: '#091914',
    borderColor: '#25473b',
    borderWidth: 1,
    borderRadius: 16,
    color: '#f4fff9',
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  giftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#091914',
    borderColor: '#25473b',
    borderWidth: 1,
    borderRadius: 18,
    padding: 13
  },
  giftVisual: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#10231d',
    alignItems: 'center',
    justifyContent: 'center'
  },
  giftEmoji: { fontSize: 29 },
  giftText: { flex: 1, gap: 3 },
  giftName: { color: '#f4fff9', fontWeight: '900' },
  rarity: { color: '#91a79e', fontSize: 11 },
  giftDescription: { color: '#b6c8c0', fontSize: 11, lineHeight: 16 },
  price: { color: '#45e6bd', fontWeight: '900', fontSize: 12 },
  safety: { color: '#789187', fontSize: 10 },
  sendButton: {
    minWidth: 72,
    backgroundColor: '#45e6bd',
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 10,
    alignItems: 'center'
  },
  sendButtonText: { color: '#052017', fontWeight: '900', fontSize: 11 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#091914',
    borderColor: '#18372d',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12
  },
  unreadRow: { borderColor: '#45e6bd' },
  historyEmoji: { fontSize: 27 },
  historyText: { flex: 1, gap: 3 },
  historyTitle: { color: '#f4fff9', fontWeight: '900' },
  historyMessage: { color: '#b6c8c0', fontSize: 12, lineHeight: 17 },
  viewButton: {
    borderColor: '#45e6bd',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  viewButtonText: { color: '#45e6bd', fontWeight: '900', fontSize: 11 },
  policy: { color: '#789187', fontSize: 11, lineHeight: 17 }
});
