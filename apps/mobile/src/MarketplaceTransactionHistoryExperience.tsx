import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppearance } from './AppearanceProvider';
import { apiFetch } from './api';
import { fetchCosmeticPurchaseHistory, type CosmeticPurchaseReceipt } from './cosmetics';
import {
  getMobileSocialGiftSent,
  type MobileSocialGiftPage,
  type MobileSocialGiftSentItem
} from './social-gifts';
import {
  appendUniqueGiftReceipts, marketplaceReceiptRows, type ReceiptFilter
} from './marketplace-receipt-model';
import { KnowMeIcon } from './ui/KnowMeUI';

/**
 * Read-only KnowCoins receipts; not the full wallet ledger.
 * A failed API source must not be interpreted as zero transactions.
 */
export function MarketplaceTransactionHistoryExperience() {
  const { colors } = useAppearance();
  const [cosmetics, setCosmetics] = useState<CosmeticPurchaseReceipt[]>([]);
  const [sentGifts, setSentGifts] = useState<MobileSocialGiftSentItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [missingSources, setMissingSources] = useState<string[]>([]);
  const [olderError, setOlderError] = useState('');
  const [filter, setFilter] = useState<ReceiptFilter>('all');
  const [query, setQuery] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      fetchCosmeticPurchaseHistory(),
      getMobileSocialGiftSent(30)
    ]);
    const failed: string[] = [];
    if (results[0].status === 'fulfilled') setCosmetics(results[0].value.receipts);
    else {
      setCosmetics([]);
      failed.push('achats');
    }
    if (results[1].status === 'fulfilled') {
      setSentGifts(results[1].value.items);
      setCursor(results[1].value.nextCursor);
    } else {
      setSentGifts([]);
      setCursor(null);
      failed.push('cadeaux envoyés');
    }
    setMissingSources(failed);
    setOlderError('');
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const rows = useMemo(() => marketplaceReceiptRows(cosmetics, sentGifts, filter, query),
    [cosmetics, sentGifts, filter, query]);

  const loadOlder = async () => {
    if (loadingOlder || !cursor) return;
    const requestedCursor = cursor;
    setLoadingOlder(true);
    setOlderError('');
    try {
      const page = await apiFetch<MobileSocialGiftPage<MobileSocialGiftSentItem>>(
        '/social/gifts/sent?limit=30&cursor=' + encodeURIComponent(requestedCursor)
      );
      setSentGifts(previous => appendUniqueGiftReceipts(previous, page.items));
      setCursor(page.nextCursor === requestedCursor ? null : page.nextCursor);
    } catch {
      setOlderError('Impossible de charger les anciens cadeaux. Réessaie.');
    } finally {
      setLoadingOlder(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={[styles.title, { color: colors.text }]}>Mes transactions</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Achats et cadeaux envoyés confirmés par KnowMe
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Actualiser l’historique"
          disabled={loading} onPress={() => void reload()}
          style={[styles.iconButton, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon name="refresh" size={19} color={colors.accent}/>
        </Pressable>
      </View>
      <Text style={[styles.note, { color: colors.muted }]}>
        Cette liste ne représente pas tout le portefeuille : les cadeaux reçus et autres
        mouvements KnowCoins ne sont pas inclus.
      </Text>
      <View style={styles.filters} accessibilityRole="tablist">
        {([
          ['all', 'Tout'],
          ['cosmetics', 'Achats'],
          ['gifts', 'Cadeaux envoyés']
        ] as const).map(([value, label]) => (
          <Pressable key={value} accessibilityRole="tab"
            accessibilityState={{ selected: filter === value }}
            onPress={() => setFilter(value)}
            style={[styles.filter,
              { borderColor: filter === value ? colors.accent : colors.border,
                backgroundColor: filter === value ? colors.backgroundAccent : colors.background }
            ]}>
            <Text style={{ color: filter === value ? colors.accent : colors.muted, fontSize: 12, fontWeight: '700' }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.backgroundAccent }]}>
        <KnowMeIcon name="search" size={19} color={colors.muted}/>
        <TextInput
          accessibilityLabel="Rechercher dans les transactions"
          value={query} onChangeText={setQuery}
          placeholder="Rechercher un achat ou un cadeau…"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          style={[styles.searchInput, { color: colors.text }]}
        />
        {query.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche"
            onPress={() => setQuery('')} style={styles.iconButton}>
            <KnowMeIcon name="close" size={18} color={colors.muted}/>
          </Pressable>
        )}
      </View>
      {missingSources.length > 0 && !loading && (
        <View style={[styles.warning, { backgroundColor: colors.backgroundAccent }]}>
          <Text accessibilityRole="alert" style={[styles.note, { color: colors.danger }]}>
            Historique incomplet : {missingSources.join(' et ')} indisponibles.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void reload()} style={styles.retry}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Réessayer</Text>
          </Pressable>
        </View>
      )}
      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted, fontSize: 13 }}>Chargement des reçus…</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>
            {missingSources.length === 2
              ? 'Impossible de consulter les reçus pour le moment.'
              : 'Aucune transaction correspondante dans les résultats chargés.'}
          </Text>
        </View>
      ) : rows.map(item => {
        const timestamp = Date.parse(item.createdAt);
        const date = Number.isFinite(timestamp)
          ? new Date(timestamp).toLocaleString('fr-FR')
          : 'Date indisponible';
        return (
          <View key={item.id} style={[styles.receipt, { borderBottomColor: colors.border }]}>
            <View style={[styles.receiptIcon, { backgroundColor: colors.backgroundAccent }]}>
              <KnowMeIcon name={item.kind === 'gifts' ? 'spark' : 'coins'} size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text numberOfLines={1} style={[styles.receiptName, { color: colors.text }]}>{item.label}</Text>
              <Text numberOfLines={2} style={[styles.receiptDetail, { color: colors.muted }]}>{item.detail}</Text>
              <Text style={[styles.receiptDetail, { color: colors.muted }]}>{date}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text style={[styles.amount, { color: colors.text }]}>
                −{item.priceKnowCoins.toLocaleString('fr-FR')}
              </Text>
              <Text style={[styles.receiptDetail, { color: colors.muted }]}>KnowCoins</Text>
            </View>
          </View>
        );
      })}
      {!loading && cursor !== null && (filter === 'all' || filter === 'gifts') && (
        <View style={styles.loadMore}>
          {olderError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{olderError}</Text> : null}
          <Pressable accessibilityRole="button" disabled={loadingOlder}
            onPress={() => void loadOlder()}
            style={[styles.moreButton, { backgroundColor: colors.backgroundAccent }]}>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>
              {loadingOlder ? 'Chargement…' : 'Charger les anciens cadeaux'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 13, paddingBottom: 22 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 19, fontWeight: '800' },
  subtitle: { fontSize: 12, lineHeight: 18 },
  note: { fontSize: 12, lineHeight: 18 },
  iconButton: { height: 44, width: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filter: { minHeight: 44, borderWidth: 1, borderRadius: 24, justifyContent: 'center', paddingHorizontal: 14 },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 12, paddingRight: 3 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 46, fontSize: 13 },
  warning: { padding: 12, borderRadius: 15, gap: 6 },
  retry: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  empty: { minHeight: 130, justifyContent: 'center', alignItems: 'center', gap: 12 },
  receipt: { minHeight: 81, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  receiptIcon: { width: 46, height: 46, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  receiptName: { fontSize: 14, fontWeight: '700' },
  receiptDetail: { fontSize: 11, lineHeight: 16 },
  amount: { fontSize: 14, fontWeight: '800' },
  loadMore: { padding: 10, alignItems: 'center', gap: 10 },
  moreButton: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 16, justifyContent: 'center' }
});
