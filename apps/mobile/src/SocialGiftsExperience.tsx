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
import { useAppearance } from './AppearanceProvider';

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function GiftVisual({ gift }: { gift: MobileSocialGiftDefinition }) {
  const { colors, visual } = useAppearance();
  return (
    <View style={[styles.giftVisual, { backgroundColor: colors.surface, borderRadius: visual.controlRadius }]} accessibilityLabel={`${gift.name}, ${gift.rarity}`}>
      <Text style={styles.giftEmoji}>{gift.emoji}</Text>
    </View>
  );
}

export function SocialGiftsExperience() {
  const { colors, visual } = useAppearance();
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
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>Cadeaux sociaux</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Offre un souvenir visuel à un ami. Le destinataire ne reçoit ni solde, ni bonus de jeu,
            ni permission.
          </Text>
        </View>
        <Pressable
          disabled={refreshing}
          onPress={() => void load(true)}
          style={({ pressed }) => [
            styles.refresh,
            { backgroundColor: colors.backgroundAccent, borderColor: colors.border, borderRadius: visual.controlRadius },
            (pressed || refreshing) && styles.mutedButton
          ]}
        >
          <Text style={[styles.refreshText, { color: colors.accent }]}>{refreshing ? '…' : '↻'}</Text>
        </Pressable>
      </View>

      <View style={[styles.balanceBox, { backgroundColor: colors.backgroundAccent, borderRadius: visual.controlRadius }]}>
        <Text style={[styles.muted, { color: colors.muted }]}>Solde KnowCoins</Text>
        <Text style={[styles.balance, { color: colors.accent }]}>{balance}</Text>
      </View>

      {status ? <Text style={[styles.status, { color: colors.accent }]}>{status}</Text> : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.muted, { color: colors.muted }]}>Chargement du catalogue…</Text>
        </View>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Choisir un ami</Text>
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
                      {
                        backgroundColor: selected ? colors.surfaceRaised : colors.backgroundAccent,
                        borderColor: selected ? colors.accent : colors.border,
                        borderRadius: visual.controlRadius
                      },
                      pressed && styles.mutedButton
                    ]}
                  >
                    <Text style={[styles.friendInitial, { backgroundColor: colors.accent, color: colors.accentText }]}>
                      {friend.user.displayName.charAt(0).toUpperCase()}
                    </Text>
                    <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>
                      {friend.user.displayName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.muted, { color: colors.muted }]}>
              Accepte d’abord une amitié pour pouvoir envoyer un cadeau.
            </Text>
          )}

          <TextInput
            value={giftMessage}
            onChangeText={setGiftMessage}
            maxLength={160}
            placeholder="Petit message facultatif"
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            style={[
              styles.input,
              {
                backgroundColor: colors.backgroundAccent,
                borderColor: colors.border,
                color: colors.text,
                borderRadius: visual.inputRadius
              }
            ]}
          />

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Catalogue original</Text>
          {catalog.map((gift) => {
            const affordable = balance >= gift.priceKnowCoins;
            const disabled = !recipientId || !affordable || busyGiftKey !== null;
            return (
              <View key={gift.key} style={[styles.giftCard, { backgroundColor: colors.backgroundAccent, borderColor: colors.border, borderRadius: visual.controlRadius }]}>
                <GiftVisual gift={gift} />
                <View style={styles.giftText}>
                  <Text style={[styles.giftName, { color: colors.text }]}>{gift.name}</Text>
                  <Text style={[styles.rarity, { color: colors.muted }]}>{mobileSocialGiftRarity(gift.rarity)}</Text>
                  <Text style={[styles.giftDescription, { color: colors.muted }]}>{gift.description}</Text>
                  <Text style={[styles.price, { color: colors.accent }]}>{gift.priceKnowCoins} KnowCoins</Text>
                  <Text style={[styles.safety, { color: colors.muted }]}>Visuel · non revendable · aucun solde reçu</Text>
                </View>
                <Pressable
                  disabled={disabled}
                  onPress={() => void send(gift)}
                  style={({ pressed }) => [
                    styles.sendButton,
                    { backgroundColor: colors.accent, borderRadius: visual.controlRadius },
                    (pressed || disabled) && styles.mutedButton
                  ]}
                >
                  <Text style={[styles.sendButtonText, { color: colors.accentText }]}>
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

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Reçus récemment</Text>
          {inbox.length ? (
            inbox.map((item) => (
              <View key={item.id} style={[
                styles.historyRow,
                {
                  backgroundColor: colors.backgroundAccent,
                  borderColor: !item.viewedAt ? colors.accent : colors.border,
                  borderRadius: visual.controlRadius
                }
              ]}>
                <Text style={styles.historyEmoji}>{item.gift.emoji}</Text>
                <View style={styles.historyText}>
                  <Text style={[styles.historyTitle, { color: colors.text }]}>{item.gift.name}</Text>
                  <Text style={[styles.muted, { color: colors.muted }]}>
                    {item.sender?.displayName ?? 'Compte indisponible'} ·{' '}
                    {new Date(item.sentAt).toLocaleDateString('fr-FR')}
                  </Text>
                  {item.message ? <Text style={[styles.historyMessage, { color: colors.muted }]}>“{item.message}”</Text> : null}
                </View>
                <Pressable
                  disabled={Boolean(item.viewedAt) || busyInboxId === item.id}
                  onPress={() => void view(item)}
                  style={({ pressed }) => [
                    styles.viewButton,
                    { borderColor: colors.accent, borderRadius: visual.controlRadius },
                    (pressed || Boolean(item.viewedAt)) && styles.mutedButton
                  ]}
                >
                  <Text style={[styles.viewButtonText, { color: colors.accent }]}>{item.viewedAt ? 'Vu' : 'Ouvrir'}</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={[styles.muted, { color: colors.muted }]}>Aucun cadeau reçu.</Text>
          )}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Envoyés récemment</Text>
          {sent.length ? (
            sent.map((item) => (
              <View key={item.id} style={[styles.historyRow, { backgroundColor: colors.backgroundAccent, borderColor: colors.border, borderRadius: visual.controlRadius }]}>
                <Text style={styles.historyEmoji}>{item.gift.emoji}</Text>
                <View style={styles.historyText}>
                  <Text style={styles.historyTitle}>{item.gift.name}</Text>
                  <Text style={[styles.muted, { color: colors.muted }]}>
                    {item.recipient?.displayName ?? 'Compte indisponible'} ·{' '}
                    {item.priceKnowCoins} KC
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.muted, { color: colors.muted }]}>Aucun cadeau envoyé.</Text>
          )}

          {policy ? (
            <Text style={[styles.policy, { color: colors.muted }]}>
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
        borderWidth: 1,
        padding: 18,
    gap: 14
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1, gap: 8 },
  title: { fontSize: 19, fontWeight: '900' },
  description: { fontSize: 14, lineHeight: 21 },
  refresh: {
    width: 42,
    height: 42,
        borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  refreshText: { fontSize: 22, fontWeight: '900' },
  mutedButton: { opacity: 0.45 },
  balanceBox: { padding: 14, gap: 3 },
  balance: { fontSize: 26, fontWeight: '900' },
  status: { fontSize: 13, lineHeight: 19 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontWeight: '900', fontSize: 16, marginTop: 4 },
  muted: { fontSize: 12 },
  friendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  friendButton: {
    minWidth: 92,
    maxWidth: 130,
        borderWidth: 1,
        padding: 10,
    alignItems: 'center',
    gap: 6
  },
  friendSelected: {},
  friendInitial: {
    width: 34,
    height: 34,
    borderRadius: 17,
    textAlign: 'center',
    textAlignVertical: 'center',
        fontWeight: '900'
  },
  friendName: { fontWeight: '800', fontSize: 12 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  giftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
        borderWidth: 1,
        padding: 13
  },
  giftVisual: {
    width: 54,
    height: 54,
    borderRadius: 18,
        alignItems: 'center',
    justifyContent: 'center'
  },
  giftEmoji: { fontSize: 29 },
  giftText: { flex: 1, gap: 3 },
  giftName: { fontWeight: '900' },
  rarity: { fontSize: 11 },
  giftDescription: { fontSize: 11, lineHeight: 16 },
  price: { fontWeight: '900', fontSize: 12 },
  safety: { fontSize: 10 },
  sendButton: {
    minWidth: 72,
        paddingHorizontal: 11,
    paddingVertical: 10,
    alignItems: 'center'
  },
  sendButtonText: { fontWeight: '900', fontSize: 11 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
        borderWidth: 1,
        padding: 12
  },
  unreadRow: {},
  historyEmoji: { fontSize: 27 },
  historyText: { flex: 1, gap: 3 },
  historyTitle: { fontWeight: '900' },
  historyMessage: { fontSize: 12, lineHeight: 17 },
  viewButton: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  viewButtonText: { fontWeight: '900', fontSize: 11 },
  policy: { fontSize: 11, lineHeight: 17 }
});
