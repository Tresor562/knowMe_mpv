import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppearance } from './AppearanceProvider';
import { getMobileStickerCatalog, type MobileStickerCatalog } from './stickers';
import {
  readKnowStickerPacks, deleteKnowStickerPack, type KnowStickerPack
} from './KnowStickerPackStore';
import { KnowStickerPackCreator } from './KnowStickerPackCreator';
import { KnowMeAlert as Alert, KnowMeToast } from './ui/KnowMeFeedback';
import { KnowMeIcon } from './ui/KnowMeUI';
import {
  filterOfficialStickerPacks, filterPersonalStickerPacks
} from './marketplace-sticker-filters';

/**
 * Marketplace discovery: official packs come from the authenticated KnowMe API,
 * private KnowSticker packs stay local to this device. No unsupported sales or
 * false cloud ownership controls.
 */
export function MarketplaceStickerCollectionExperience() {
  const { colors } = useAppearance();
  const [catalog, setCatalog] = useState<MobileStickerCatalog | null>(null);
  const [personal, setPersonal] = useState<KnowStickerPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [busyPackId, setBusyPackId] = useState<string | null>(null);

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const [official, privatePacks] = await Promise.allSettled([
        getMobileStickerCatalog(),
        readKnowStickerPacks()
      ]);
      if (official.status === 'fulfilled') {
        setCatalog(official.value);
        setError('');
      } else {
        setError('Catalogue officiel indisponible. Les packs locaux restent accessibles.');
      }
      if (privatePacks.status === 'fulfilled') setPersonal(privatePacks.value);
      else setError('Impossible de lire les packs personnels sur cet appareil.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const official = useMemo(
    () => filterOfficialStickerPacks(catalog?.packs ?? [], search),
    [catalog, search]
  );
  const privatePacks = useMemo(
    () => filterPersonalStickerPacks(personal, search),
    [personal, search]
  );

  const confirmDelete = (pack: KnowStickerPack) => {
    if (busyPackId) return;
    Alert.alert(
      'Supprimer ce pack ?',
      '« ' + pack.name + ' » et ses ' + pack.items.length +
        ' stickers seront supprimés de cet appareil. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => {
          if (busyPackId) return;
          setBusyPackId(pack.id);
          void deleteKnowStickerPack(pack.id).then(() => {
            setPersonal(current => current.filter(item => item.id !== pack.id));
            KnowMeToast.show('Pack supprimé de cet appareil.', 'success');
          }).catch(cause => {
            Alert.alert('Suppression impossible', cause instanceof Error
              ? cause.message : 'Le stockage local est indisponible.');
          }).finally(() => setBusyPackId(null));
        } }
      ]
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.title, { color: colors.text }]}>Packs de stickers</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Catalogue KnowMe et créations sur ton appareil
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Actualiser les stickers"
          disabled={refreshing || loading} onPress={() => void refresh(true)}
          style={[styles.iconButton, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon name="refresh" size={20} color={colors.accent} />
        </Pressable>
      </View>

      <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.backgroundAccent }]}>
        <KnowMeIcon name="search" size={20} color={colors.muted} />
        <TextInput
          accessibilityLabel="Rechercher un pack de stickers"
          value={search} onChangeText={setSearch}
          placeholder="Rechercher un pack…" placeholderTextColor={colors.muted}
          autoCorrect={false} style={[styles.searchInput, { color: colors.text }]}
        />
        {search.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche"
            onPress={() => setSearch('')} style={styles.iconButton}>
            <KnowMeIcon name="close" size={20} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <Pressable accessibilityRole="button" onPress={() => setCreatorOpen(true)}
        style={[styles.createButton, { backgroundColor: colors.accent }]}>
        <KnowMeIcon name="create" size={21} color={colors.accentText} />
        <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 14 }}>
          Créer un pack KnowSticker
        </Text>
      </Pressable>

      {loading && !catalog && personal.length === 0 && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted }}>Chargement des stickers…</Text>
        </View>
      )}
      {error !== '' && (
        <View style={[styles.notice, { backgroundColor: colors.backgroundAccent }]}>
          <Text accessibilityRole="alert" style={{ color: colors.text, flex: 1, fontSize: 12 }}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Réessayer de charger les stickers"
            disabled={refreshing} onPress={() => void refresh(true)} style={styles.iconButton}>
            <KnowMeIcon name="refresh" size={19} color={colors.accent} />
          </Pressable>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Packs KnowMe officiels ({official.length})
        </Text>
        {official.map(pack => (
          <View key={pack.key + ':' + pack.version}
            style={[styles.pack, { borderColor: colors.border }]}>
            <View style={styles.packInfo}>
              <Text style={[styles.packName, { color: colors.text }]}>{pack.name}</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>{pack.description}</Text>
              <Text style={[styles.detail, { color: colors.accent }]}>
                {pack.stickers.length} stickers · catalogue officiel
              </Text>
            </View>
            <View style={styles.previews}>
              {pack.stickers.slice(0, 8).map(sticker => (
                <View key={sticker.key} accessibilityLabel={sticker.accessibilityLabel}
                  style={[styles.stickerPreview, { backgroundColor: colors.backgroundAccent }]}>
                  <Text style={styles.glyph}>{sticker.glyph}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        {!loading && official.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            {search ? 'Aucun pack officiel correspondant.' : 'Aucun pack officiel accessible.'}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Mes packs KnowSticker ({privatePacks.length})
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Ces packs sont enregistrés sur cet appareil. Ils ne sont pas encore synchronisés
          dans une boutique publique.
        </Text>
        {privatePacks.map(pack => (
          <View key={pack.id} style={[styles.personalRow, { borderColor: colors.border }]}>
            <View style={[styles.personalPreview, { backgroundColor: colors.backgroundAccent }]}>
              {pack.items[0]?.uri ? (
                <Image source={{ uri: pack.items[0].uri }} style={styles.personalImage}
                  accessibilityLabel={'Sticker du pack ' + pack.name} />
              ) : <KnowMeIcon name="spark" size={22} color={colors.accent} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.packName, { color: colors.text }]}>{pack.name}</Text>
              <Text style={[styles.detail, { color: colors.muted }]}>
                {pack.items.length} stickers · sur cet appareil
              </Text>
            </View>
            <Pressable accessibilityRole="button"
              accessibilityLabel={'Supprimer le pack ' + pack.name}
              disabled={busyPackId !== null} onPress={() => confirmDelete(pack)}
              style={[styles.iconButton, { backgroundColor: colors.backgroundAccent }]}>
              <KnowMeIcon name="close" size={19} color={colors.danger} />
            </Pressable>
          </View>
        ))}
        {!loading && privatePacks.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            {search ? 'Aucun pack personnel correspondant.' : 'Crée ton premier pack pour le retrouver ici.'}
          </Text>
        )}
      </View>

      <KnowStickerPackCreator visible={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        onCreated={() => { void refresh(true); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', gap: 15, paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 19, fontWeight: '700' },
  subtitle: { fontSize: 12, lineHeight: 17 },
  detail: { fontSize: 12, marginTop: 4 },
  iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
  search: { borderWidth: 1, borderRadius: 18, minHeight: 48, paddingLeft: 12, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 46, fontSize: 14 },
  createButton: { minHeight: 48, borderRadius: 16, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  center: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 10 },
  notice: { borderRadius: 14, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  section: { gap: 9 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  pack: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, gap: 10 },
  packInfo: { gap: 3 },
  packName: { fontSize: 14, fontWeight: '700' },
  previews: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stickerPreview: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 24 },
  personalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 68, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  personalPreview: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  personalImage: { width: '100%', height: '100%' },
  emptyText: { textAlign: 'center', paddingVertical: 15, fontSize: 13 }
});
