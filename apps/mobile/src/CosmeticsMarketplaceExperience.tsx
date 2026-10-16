import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  equipCosmetic,
  fetchCosmeticInventory,
  fetchCosmeticShop,
  purchaseCosmetic,
  type CosmeticOffer
} from './cosmetics';
import { useAppearance } from './AppearanceProvider';
import { KnowMeAlert, KnowMeToast } from './ui/KnowMeFeedback';
import { GlassSurface, KnowMeIcon } from './ui/KnowMeUI';

type Shop = Awaited<ReturnType<typeof fetchCosmeticShop>>;
type Inventory = Awaited<ReturnType<typeof fetchCosmeticInventory>>;

const SLOTS: Record<string, string> = {
  AVATAR_FRAME: 'Cadre d’avatar',
  PROFILE_BACKGROUND: 'Fond de profil',
  CHAT_BUBBLE: 'Bulles de discussion',
  PROFILE_BADGE: 'Badge du profil'
};

function purchaseKey(offerId: string) {
  return `km-android-${offerId.slice(0, 12)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

/** Genuine KnowMe personalizations: the server defines offers, prices, ownership and equipment. */
export function CosmeticsMarketplaceExperience() {
  const { colors } = useAppearance();
  const [shop, setShop] = useState<Shop | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  // Keep the same idempotency key after a network error: a successful server
  // purchase with a lost response must never debit KnowCoins a second time.
  const pendingPurchases = useRef<Record<string, string>>({});

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const [nextShop, nextInventory] = await Promise.all([
        fetchCosmeticShop(),
        fetchCosmeticInventory()
      ]);
      setShop(nextShop);
      setInventory(nextInventory);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Catalogue momentanément indisponible.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const ownedIds = useMemo(
    () => new Set((inventory?.inventory ?? []).map(ownership => ownership.itemId)),
    [inventory]
  );
  const equippedIds = useMemo(
    () => new Set((inventory?.equipment ?? []).map(equipment => equipment.itemId)),
    [inventory]
  );

  const buy = async (offer: CosmeticOffer) => {
    if (busyId) return;
    setBusyId(offer.id);
    setError('');
    const key = pendingPurchases.current[offer.id] ?? purchaseKey(offer.id);
    pendingPurchases.current[offer.id] = key;
    try {
      const result = await purchaseCosmetic(offer.id, key);
      delete pendingPurchases.current[offer.id];
      KnowMeToast.show(
        result.replayed
          ? 'Cet achat avait déjà été enregistré. Aucun deuxième débit.'
          : `${offer.item.name} ajouté à ta collection.`,
        'success'
      );
      await refresh(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Achat indisponible.';
      setError(message);
      KnowMeToast.show(message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmPurchase = (offer: CosmeticOffer) => {
    if (!offer.affordable) {
      KnowMeToast.show('Solde KnowCoins insuffisant.', 'error');
      return;
    }
    KnowMeAlert.alert(
      'Confirmer l’achat',
      `Acheter « ${offer.item.name} » pour ${offer.priceKnowCoins.toLocaleString('fr-FR')} KnowCoins ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Acheter', onPress: () => { void buy(offer); } }
      ]
    );
  };

  const equip = async (offer: CosmeticOffer) => {
    if (busyId || !ownedIds.has(offer.itemId)) return;
    setBusyId(offer.id);
    try {
      await equipCosmetic(offer.item.slot, offer.itemId);
      KnowMeToast.show(`${offer.item.name} équipé.`, 'success');
      await refresh(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Équipement impossible.';
      setError(message);
      KnowMeToast.show(message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.summary}>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.text }]}>Personnalisation</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Habille ton profil et tes discussions
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Actualiser les personnalisations"
          disabled={refreshing || loading} onPress={() => void refresh(true)}
          style={[styles.refresh, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon name="refresh" size={20} color={colors.accent} />
        </Pressable>
      </View>

      {shop ? (
        <GlassSurface strength="soft" borderRadius={18} style={styles.balance}>
          <KnowMeIcon name="coins" size={22} color={colors.accent} />
          <Text style={[styles.balanceLabel, { color: colors.muted }]}>Solde</Text>
          <Text style={[styles.balanceValue, { color: colors.text }]}>
            {shop.wallet.balance.toLocaleString('fr-FR')} KnowCoins
          </Text>
        </GlassSurface>
      ) : null}

      {loading && !shop ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted }}>Chargement de la collection…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.message, { backgroundColor: colors.backgroundAccent }]}>
          <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh(true)}
            style={[styles.retry, { borderColor: colors.border }]}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Réessayer</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && shop && shop.offers.length === 0 ? (
        <Text style={[styles.empty, { color: colors.muted }]}>
          Aucune personnalisation disponible pour le moment.
        </Text>
      ) : null}

      {shop?.offers.map(offer => {
        const owned = offer.owned || ownedIds.has(offer.itemId);
        const equipped = equippedIds.has(offer.itemId);
        const busy = busyId === offer.id;
        const disabled = Boolean(busyId) || refreshing;
        return (
          <GlassSurface key={offer.id} strength="soft" borderRadius={22} style={styles.card}>
            <View style={[styles.preview, { backgroundColor: colors.backgroundAccent }]}>
              {offer.item.previewUrl
                ? <Image source={{ uri: offer.item.previewUrl }} style={styles.photo}
                    resizeMode="cover" accessibilityLabel={`Aperçu de ${offer.item.name}`} />
                : <KnowMeIcon name="spark" size={29} color={colors.accent} />}
            </View>
            <View style={styles.details}>
              <Text style={[styles.name, { color: colors.text }]}>{offer.item.name}</Text>
              <Text style={[styles.kind, { color: colors.muted }]}>
                {SLOTS[offer.item.slot] ?? 'Apparence'} · {offer.item.rarity}
              </Text>
              {offer.item.description
                ? <Text style={[styles.description, { color: colors.muted }]} numberOfLines={2}>
                    {offer.item.description}
                  </Text>
                : null}
              <View style={styles.actionRow}>
                <Text style={[styles.price, { color: colors.accent }]}>
                  {owned ? 'Dans ta collection' : `${offer.priceKnowCoins.toLocaleString('fr-FR')} KnowCoins`}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={equipped
                    ? `${offer.item.name} déjà équipé`
                    : owned ? `Équiper ${offer.item.name}` : `Acheter ${offer.item.name}`}
                  accessibilityState={{ disabled: disabled || equipped }}
                  disabled={disabled || equipped}
                  onPress={() => owned ? void equip(offer) : confirmPurchase(offer)}
                  style={({ pressed }) => [
                    styles.action,
                    { backgroundColor: equipped ? colors.backgroundAccent : colors.accent },
                    pressed && { opacity: 0.82 },
                    (disabled || equipped) && { opacity: 0.65 }
                  ]}>
                  <Text style={[styles.actionText, {
                    color: equipped ? colors.muted : colors.accentText
                  }]}>
                    {busy ? 'En cours…' : equipped ? 'Équipé' : owned ? 'Équiper' : 'Acheter'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </GlassSurface>
        );
      })}
      <Text style={[styles.footer, { color: colors.muted }]}>
        Les prix, les possessions et les débits sont vérifiés par KnowMe. Aucun achat ne donne d’avantage dans les jeux.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', gap: 12, paddingBottom: 20 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleBlock: { flex: 1, gap: 3 },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -.4 },
  subtitle: { fontSize: 12 },
  refresh: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  balance: { paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  balanceLabel: { fontSize: 13, flex: 1 },
  balanceValue: { fontWeight: '800', fontSize: 13 },
  center: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 12 },
  message: { borderRadius: 18, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  retry: { minHeight: 44, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, justifyContent: 'center' },
  empty: { textAlign: 'center', paddingVertical: 30, fontSize: 13 },
  card: { padding: 13, flexDirection: 'row', gap: 13, alignItems: 'flex-start' },
  preview: { width: 77, height: 77, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  details: { flex: 1, minWidth: 0, gap: 5 },
  name: { fontSize: 15, fontWeight: '750' },
  kind: { fontSize: 12 },
  description: { fontSize: 12, lineHeight: 17 },
  actionRow: { flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 7, justifyContent: 'space-between' },
  price: { flex: 1, fontSize: 12, fontWeight: '700' },
  action: { minWidth: 94, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 12, fontWeight: '750' },
  footer: { fontSize: 11, lineHeight: 17, paddingTop: 2 }
});
