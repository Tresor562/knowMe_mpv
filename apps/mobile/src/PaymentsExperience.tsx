import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import {
  formatMobileMinorAmount,
  getMobilePaymentCatalog,
  getMobilePaymentOrders,
  getMobilePaymentProviders,
  getStoreAccountReference,
  MobileCommercePrice,
  MobileCommerceProduct,
  MobilePaymentOrder,
  MobileProviderConfiguration,
  mobilePaymentStatus,
  StoreAccountReference,
  verifyNativePurchase
} from './payments';
import {
  mobileStoreProvider,
  nativePurchasesAvailable,
  requestNativePurchase
} from './native-purchases';
import { useAppearance } from './AppearanceProvider';
import { GlassSurface, KnowMeIcon, PressScale } from './ui/KnowMeUI';

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function providerLabel(provider: string) {
  if (provider === 'GOOGLE_PLAY') return 'Google Play';
  if (provider === 'APPLE_APP_STORE') return 'Apple App Store';
  return provider;
}

function statusColor(status: string, colors: { accent: string; danger: string; muted: string }) {
  if (['PAID', 'FULFILLED'].includes(status)) return colors.accent;
  if (['FAILED', 'INIT_FAILED', 'CANCELED'].includes(status)) return colors.danger;
  if (['REFUNDED', 'REVIEW_REQUIRED'].includes(status)) return '#F4C95D';
  return colors.muted;
}

function PurchaseButton({
  title,
  disabled,
  onPress
}: {
  title: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, visual } = useAppearance();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.accent, borderRadius: visual.controlRadius },
        (pressed || disabled) && styles.buttonDisabled
      ]}
    >
      <Text style={[styles.buttonText, { color: colors.accentText }]}>{title}</Text>
    </Pressable>
  );
}

export function PaymentsExperience() {
  const { colors, visual } = useAppearance();
  const [catalog, setCatalog] = useState<MobileCommerceProduct[]>([]);
  const [orders, setOrders] = useState<MobilePaymentOrder[]>([]);
  const [providers, setProviders] = useState<MobileProviderConfiguration | null>(null);
  const [accountReference, setAccountReference] = useState<StoreAccountReference | null>(null);
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyPriceId, setBusyPriceId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setMessage('');
    try {
      const provider = mobileStoreProvider();
      const [products, configuration, orderPage, nativeAvailable] = await Promise.all([
        getMobilePaymentCatalog(),
        getMobilePaymentProviders(),
        getMobilePaymentOrders(12),
        nativePurchasesAvailable()
      ]);
      setCatalog(products);
      setProviders(configuration);
      setOrders(orderPage.items);
      setBridgeAvailable(nativeAvailable);
      if (provider) {
        setAccountReference(await getStoreAccountReference());
      } else {
        setAccountReference(null);
      }
    } catch (cause) {
      setMessage(errorMessage(cause, 'Les paiements mobiles sont indisponibles.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function purchase(product: MobileCommerceProduct, price: MobileCommercePrice) {
    if (!accountReference || !price.externalProductId || busyPriceId) return;
    setBusyPriceId(price.id);
    setMessage('');
    try {
      const proof = await requestNativePurchase({
        provider: price.provider,
        externalProductId: price.externalProductId,
        accountReference: accountReference.accountReference
      });
      const result = await verifyNativePurchase(product.key, proof);
      setMessage(
        result.order.fulfilledAt
          ? 'Achat vérifié et contenu délivré par le serveur.'
          : `Achat reçu : ${mobilePaymentStatus(result.order.status)}.`
      );
      Alert.alert(
        result.order.fulfilledAt ? 'Achat confirmé' : 'Achat reçu',
        result.order.fulfilledAt
          ? 'KnowMe a vérifié la boutique et délivré le produit.'
          : 'Le statut a été enregistré. La boutique peut encore finaliser le paiement.'
      );
      await load(true);
    } catch (cause) {
      const text = errorMessage(cause, 'Impossible de terminer cet achat.');
      setMessage(text);
      Alert.alert('Achat impossible', text);
    } finally {
      setBusyPriceId(null);
    }
  }

  const platformProvider = mobileStoreProvider();
  const providerConfigured = platformProvider
    ? Boolean(providers?.providers[platformProvider]?.configured)
    : false;
  const purchaseReady = Boolean(
    platformProvider && providerConfigured && bridgeAvailable && accountReference
  );

  return (
    <GlassSurface strength="soft" borderRadius={visual.cardRadius} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.headerIcon, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon name="coins" size={21} color={colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>KnowCoins & paiements</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Achats sécurisés via la boutique de ton appareil.
          </Text>
        </View>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Actualiser"
          disabled={refreshing}
          onPress={() => void load(true)}
          style={[
            styles.refreshButton,
            { backgroundColor: colors.backgroundAccent, borderColor: colors.border }
          ]}
        >
          <KnowMeIcon name="refresh" size={18} color={refreshing ? colors.muted : colors.accent} />
        </PressScale>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.muted, { color: colors.muted }]}>Chargement du catalogue sécurisé…</Text>
        </View>
      ) : (
        <>
          <View style={[styles.policyBox, { backgroundColor: colors.backgroundAccent }]}>
            <View style={[styles.storeStateIcon, { backgroundColor: purchaseReady ? colors.surfaceGlass : colors.surfaceRaised }]}>
              <KnowMeIcon name={purchaseReady ? 'check' : 'settings'} size={18} color={purchaseReady ? colors.accent : colors.muted} />
            </View>
            <View style={styles.policyCopy}>
              <Text style={[styles.policyTitle, { color: colors.text }]}>
                {purchaseReady
                  ? `Achats disponibles via ${providerLabel(platformProvider!)}`
                  : 'Achats temporairement indisponibles'}
              </Text>
              <Text style={[styles.policyText, { color: colors.muted }]}>
                {purchaseReady
                  ? 'Les achats sont vérifiés automatiquement avant attribution.'
                  : 'KnowMe réactivera les achats lorsque la boutique de cet appareil sera prête.'}
              </Text>
            </View>
          </View>

          {message ? <Text style={[styles.message, { color: colors.accent }]}>{message}</Text> : null}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Boutique</Text>
          {catalog.length === 0 ? (
            <Text style={[styles.muted, { color: colors.muted }]}>
              Aucun produit n’est disponible pour le moment.
            </Text>
          ) : (
            catalog.map((product) => (
              <View key={product.key} style={[styles.productCard, { backgroundColor: colors.backgroundAccent, borderColor: colors.border, borderRadius: visual.controlRadius }]}>
                <View style={styles.productHeader}>
                  <View style={styles.productText}>
                    <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>
                    <Text style={[styles.productDescription, { color: colors.muted }]}>
                      {product.description ?? 'Produit KnowMe vérifié par la boutique.'}
                    </Text>
                  </View>
                  {product.highlighted ? <Text style={[styles.highlight, { backgroundColor: colors.accent, color: colors.accentText }]}>CHOIX</Text> : null}
                </View>
                {product.requiresVerification ? (
                  <Text style={styles.warning}>Identité vérifiée requise avant l’achat.</Text>
                ) : null}
                {product.prices.map((price) => {
                  const canPurchase = Boolean(
                    purchaseReady &&
                      price.externalProductId &&
                      price.provider === platformProvider &&
                      busyPriceId === null
                  );
                  const busy = busyPriceId === price.id;
                  return (
                    <View key={price.id} style={[styles.priceRow, { borderTopColor: colors.border }]}>
                      <View style={styles.priceText}>
                        <Text style={[styles.price, { color: colors.text }]}>
                          {formatMobileMinorAmount(price.unitAmount, price.currency)}
                        </Text>
                        <Text style={[styles.muted, { color: colors.muted }]}>{providerLabel(price.provider)}</Text>
                      </View>
                      <PurchaseButton
                        disabled={!canPurchase}
                        title={
                          busy
                            ? 'Validation…'
                            : purchaseReady
                              ? 'Acheter'
                              : 'Indisponible'
                        }
                        onPress={() => void purchase(product, price)}
                      />
                    </View>
                  );
                })}
              </View>
            ))
          )}

          {!purchaseReady ? (
            <Text style={[styles.helper, { color: colors.muted }]}>
              Les achats restent désactivés tant que la boutique de l’appareil n’est pas disponible.
            </Text>
          ) : null}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Commandes récentes</Text>
          {orders.length === 0 ? (
            <Text style={[styles.muted, { color: colors.muted }]}>Aucune commande enregistrée.</Text>
          ) : (
            orders.map((order) => (
              <View key={order.id} style={[styles.orderRow, { backgroundColor: colors.backgroundAccent, borderRadius: visual.controlRadius }]}>
                <View style={styles.orderText}>
                  <Text style={[styles.orderName, { color: colors.text }]}>{order.productName}</Text>
                  <Text style={[styles.muted, { color: colors.muted }]} numberOfLines={1}>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[styles.orderStatus, { color: statusColor(order.status, colors) }]}>
                  {mobilePaymentStatus(order.status)}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 12
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  description: { fontSize: 12.5, lineHeight: 18 },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonDisabled: { opacity: 0.45 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muted: { fontSize: 12 },
  policyBox: {
    minHeight: 62,
    borderRadius: 20,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9
  },
  storeStateIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  policyCopy: { flex: 1 },
  policyTitle: { fontSize: 13, fontWeight: '800' },
  policyText: { fontSize: 11, lineHeight: 16, marginTop: 1 },
  accountReference: { fontSize: 11 },
  message: { fontSize: 11.5, lineHeight: 17 },
  sectionTitle: { fontWeight: '800', fontSize: 15, marginTop: 3 },
  productCard: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10
  },
  productHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  productText: { flex: 1, gap: 5 },
  productName: { fontWeight: '800', fontSize: 14.5 },
  productDescription: { fontSize: 12, lineHeight: 18 },
  highlight: {
        borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: '900'
  },
  warning: { color: '#f4c95d', fontSize: 12, lineHeight: 18 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10
  },
  priceText: { flex: 1, gap: 3 },
  price: { fontWeight: '800', fontSize: 15 },
  button: {
    minWidth: 92,
    minHeight: 40,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonText: { fontWeight: '900', fontSize: 12 },
  helper: { fontSize: 11, lineHeight: 17 },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11
  },
  orderText: { flex: 1, gap: 4 },
  orderName: { fontWeight: '800' },
  orderStatus: { fontWeight: '800', fontSize: 11 }
});
