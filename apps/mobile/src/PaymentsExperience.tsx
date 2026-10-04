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

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function providerLabel(provider: string) {
  if (provider === 'GOOGLE_PLAY') return 'Google Play';
  if (provider === 'APPLE_APP_STORE') return 'Apple App Store';
  return provider;
}

function statusColor(status: string) {
  if (['PAID', 'FULFILLED'].includes(status)) return '#7A5CFF';
  if (['FAILED', 'INIT_FAILED', 'CANCELED'].includes(status)) return '#FF6B73';
  if (['REFUNDED', 'REVIEW_REQUIRED'].includes(status)) return '#f4c95d';
  return '#929BAD';
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
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        (pressed || disabled) && styles.buttonDisabled
      ]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function PaymentsExperience() {
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
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.cardTitle}>Paiements et abonnements</Text>
          <Text style={styles.description}>
            Les prix et attributions restent autoritaires côté serveur. Aucune preuve d’achat brute
            n’est saisie manuellement dans l’application.
          </Text>
        </View>
        <Pressable
          disabled={refreshing}
          onPress={() => void load(true)}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.buttonDisabled]}
        >
          <Text style={styles.refreshText}>{refreshing ? '…' : '↻'}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#7A5CFF" />
          <Text style={styles.muted}>Chargement du catalogue sécurisé…</Text>
        </View>
      ) : (
        <>
          <View style={styles.policyBox}>
            <Text style={styles.policyTitle}>
              {platformProvider ? providerLabel(platformProvider) : 'Boutique native indisponible'}
            </Text>
            <Text style={styles.policyText}>
              Fournisseur : {providerConfigured ? 'configuré' : 'désactivé'} · pont natif :{' '}
              {bridgeAvailable ? 'installé' : 'absent'}
            </Text>
            {accountReference ? (
              <Text style={styles.accountReference} numberOfLines={1}>
                Référence de compte liée : {accountReference.accountReference}
              </Text>
            ) : null}
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Text style={styles.sectionTitle}>Catalogue mobile</Text>
          {catalog.length === 0 ? (
            <Text style={styles.muted}>
              Aucun produit mobile actif n’est mappé pour cette plateforme.
            </Text>
          ) : (
            catalog.map((product) => (
              <View key={product.key} style={styles.productCard}>
                <View style={styles.productHeader}>
                  <View style={styles.productText}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productDescription}>
                      {product.description ?? 'Produit KnowMe vérifié par la boutique.'}
                    </Text>
                  </View>
                  {product.highlighted ? <Text style={styles.highlight}>CHOIX</Text> : null}
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
                    <View key={price.id} style={styles.priceRow}>
                      <View style={styles.priceText}>
                        <Text style={styles.price}>
                          {formatMobileMinorAmount(price.unitAmount, price.currency)}
                        </Text>
                        <Text style={styles.muted}>{providerLabel(price.provider)}</Text>
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
            <Text style={styles.helper}>
              Les boutons restent bloqués tant que la configuration fournisseur et le pont natif signé
              ne sont pas tous les deux disponibles. L’application ne simule jamais un achat réussi.
            </Text>
          ) : null}

          <Text style={styles.sectionTitle}>Commandes récentes</Text>
          {orders.length === 0 ? (
            <Text style={styles.muted}>Aucune commande enregistrée.</Text>
          ) : (
            orders.map((order) => (
              <View key={order.id} style={styles.orderRow}>
                <View style={styles.orderText}>
                  <Text style={styles.orderName}>{order.productName}</Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {order.reference} · {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                <Text style={[styles.orderStatus, { color: statusColor(order.status) }]}>
                  {mobilePaymentStatus(order.status)}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#101521',
    borderColor: '#273044',
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1, gap: 8 },
  cardTitle: { color: '#F7F7FB', fontSize: 19, fontWeight: '900' },
  description: { color: '#B8C0CE', fontSize: 14, lineHeight: 21 },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderColor: '#30394E',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  refreshText: { color: '#7A5CFF', fontSize: 22, fontWeight: '900' },
  buttonDisabled: { opacity: 0.45 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muted: { color: '#929BAD', fontSize: 12 },
  policyBox: {
    backgroundColor: '#0D111B',
    borderColor: '#30394E',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 5
  },
  policyTitle: { color: '#F7F7FB', fontWeight: '900' },
  policyText: { color: '#B8C0CE', fontSize: 12, lineHeight: 18 },
  accountReference: { color: '#737E93', fontSize: 11 },
  message: { color: '#7A5CFF', fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: '#F7F7FB', fontWeight: '900', fontSize: 16, marginTop: 4 },
  productCard: {
    backgroundColor: '#0D111B',
    borderRadius: 18,
    borderColor: '#30394E',
    borderWidth: 1,
    padding: 14,
    gap: 12
  },
  productHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  productText: { flex: 1, gap: 5 },
  productName: { color: '#F7F7FB', fontWeight: '900', fontSize: 16 },
  productDescription: { color: '#B8C0CE', fontSize: 12, lineHeight: 18 },
  highlight: {
    color: '#FFFFFF',
    backgroundColor: '#7A5CFF',
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
    gap: 12,
    borderTopColor: '#18372d',
    borderTopWidth: 1,
    paddingTop: 12
  },
  priceText: { flex: 1, gap: 3 },
  price: { color: '#F7F7FB', fontWeight: '900', fontSize: 17 },
  button: {
    minWidth: 104,
    backgroundColor: '#7A5CFF',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center'
  },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  helper: { color: '#737E93', fontSize: 11, lineHeight: 17 },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0D111B',
    borderRadius: 16,
    padding: 13
  },
  orderText: { flex: 1, gap: 4 },
  orderName: { color: '#F7F7FB', fontWeight: '800' },
  orderStatus: { fontWeight: '900', fontSize: 12 }
});
