import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import {
  equipMobileAvatarLayer,
  getMobileAvatarStudio,
  MOBILE_AVATAR_LAYER_LABELS,
  MOBILE_AVATAR_LAYER_SLOTS,
  MobileAvatarLayerSlot,
  MobileAvatarManifest,
  MobileAvatarStudioState
} from './avatar-studio';

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function AvatarPreview({ manifest }: { manifest: MobileAvatarManifest }) {
  const visibleLayers = manifest.layers.filter((layer) => layer.item);
  return (
    <View style={styles.preview} accessibilityLabel="Aperçu de l’avatar composé">
      {visibleLayers.length === 0 && manifest.legacyAvatarUrl ? (
        <Image source={{ uri: manifest.legacyAvatarUrl }} style={styles.legacyAvatar} />
      ) : null}
      {visibleLayers.length === 0 && !manifest.legacyAvatarUrl ? (
        <View style={styles.fallback}>
          <Text style={styles.fallbackInitials}>{manifest.fallback.initials}</Text>
          <Text style={styles.fallbackToken}>{manifest.fallback.paletteToken}</Text>
        </View>
      ) : null}
      {visibleLayers.map((layer) => (
        <Image
          key={`${layer.slot}:${layer.item!.id}:${layer.item!.version}`}
          source={{ uri: layer.item!.assetUrl }}
          style={[styles.layer, { zIndex: layer.zIndex }]}
          resizeMode="contain"
          accessibilityLabel={layer.item!.name}
        />
      ))}
    </View>
  );
}

export function AvatarStudioExperience() {
  const [studio, setStudio] = useState<MobileAvatarStudioState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busySlot, setBusySlot] = useState<MobileAvatarLayerSlot | null>(null);
  const [status, setStatus] = useState('');

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    try {
      setStudio(await getMobileAvatarStudio());
      setStatus('');
    } catch (cause) {
      setStatus(message(cause, 'Le studio d’avatar est indisponible.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const inventoryBySlot = useMemo(() => {
    const result = new Map<
      MobileAvatarLayerSlot,
      MobileAvatarStudioState['inventory']
    >();
    if (!studio) return result;
    for (const slot of MOBILE_AVATAR_LAYER_SLOTS) {
      result.set(
        slot,
        studio.inventory.filter((entry) => entry.item.slot === slot)
      );
    }
    return result;
  }, [studio]);

  async function equip(slot: MobileAvatarLayerSlot, itemId: string | null) {
    if (busySlot) return;
    setBusySlot(slot);
    setStatus('');
    try {
      const result = await equipMobileAvatarLayer(slot, itemId);
      setStudio(result.studio);
      setStatus(
        itemId
          ? `${MOBILE_AVATAR_LAYER_LABELS[slot]} mis à jour.`
          : `${MOBILE_AVATAR_LAYER_LABELS[slot]} retiré.`
      );
    } catch (cause) {
      const text = message(cause, 'Modification impossible.');
      setStatus(text);
      Alert.alert('Studio d’avatar', text);
    } finally {
      setBusySlot(null);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Studio d’avatar</Text>
          <Text style={styles.description}>
            Assemble uniquement les couches présentes dans ton inventaire KnowMe. Le serveur valide
            chaque équipement et résout l’ordre de rendu.
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

      {status ? <Text style={styles.status}>{status}</Text> : null}

      {loading || !studio ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#45e6bd" />
          <Text style={styles.muted}>Chargement du rendu autoritaire…</Text>
        </View>
      ) : (
        <>
          <AvatarPreview manifest={studio.manifest} />
          <Text style={styles.profileName}>{studio.profile.displayName}</Text>
          <Text style={styles.handle}>@{studio.profile.username}</Text>

          {MOBILE_AVATAR_LAYER_SLOTS.map((slot) => {
            const items = inventoryBySlot.get(slot) ?? [];
            const equipped = studio.equipment.find((entry) => entry.slot === slot)?.item ?? null;
            return (
              <View key={slot} style={styles.layerSection}>
                <View style={styles.layerHeader}>
                  <View style={styles.layerTitleBox}>
                    <Text style={styles.layerTitle}>{MOBILE_AVATAR_LAYER_LABELS[slot]}</Text>
                    <Text style={styles.muted}>{slot}</Text>
                  </View>
                  <Pressable
                    disabled={!equipped || busySlot !== null}
                    onPress={() => void equip(slot, null)}
                    style={({ pressed }) => [
                      styles.removeButton,
                      (pressed || !equipped || busySlot !== null) && styles.mutedButton
                    ]}
                  >
                    <Text style={styles.removeButtonText}>Retirer</Text>
                  </Pressable>
                </View>

                {items.length === 0 ? (
                  <Text style={styles.muted}>Aucun objet compatible dans l’inventaire.</Text>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.itemStrip}
                  >
                    {items.map((entry) => {
                      const selected = equipped?.id === entry.item.id;
                      return (
                        <Pressable
                          key={entry.id}
                          disabled={busySlot !== null}
                          onPress={() => void equip(slot, entry.item.id)}
                          style={({ pressed }) => [
                            styles.itemCard,
                            selected && styles.itemSelected,
                            (pressed || busySlot !== null) && styles.mutedButton
                          ]}
                        >
                          <Image
                            source={{ uri: entry.item.previewUrl ?? entry.item.assetUrl }}
                            style={styles.itemImage}
                            resizeMode="contain"
                          />
                          <Text style={styles.itemName} numberOfLines={1}>
                            {entry.item.name}
                          </Text>
                          <Text style={[styles.itemRarity, selected && styles.selectedText]}>
                            {selected ? 'Équipé' : entry.item.rarity}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            );
          })}

          <Text style={styles.policy}>
            Aucun upload arbitraire · aucune couche non possédée · aucun effet de jeu · visibilité
            publique régie par les paramètres cosmétiques.
          </Text>
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
  status: { color: '#45e6bd', fontSize: 13, lineHeight: 19 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muted: { color: '#91a79e', fontSize: 12 },
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#091914',
    borderColor: '#25473b',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  legacyAvatar: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', gap: 6 },
  fallbackInitials: { color: '#f4fff9', fontSize: 72, fontWeight: '900' },
  fallbackToken: { color: '#789187', fontSize: 11 },
  layer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  profileName: { color: '#f4fff9', fontWeight: '900', fontSize: 18 },
  handle: { color: '#45e6bd', fontWeight: '800' },
  layerSection: {
    backgroundColor: '#091914',
    borderColor: '#25473b',
    borderWidth: 1,
    borderRadius: 18,
    padding: 13,
    gap: 12
  },
  layerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  layerTitleBox: { flex: 1, gap: 3 },
  layerTitle: { color: '#f4fff9', fontWeight: '900' },
  removeButton: {
    borderColor: '#ff9d66',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  removeButtonText: { color: '#ff9d66', fontWeight: '900', fontSize: 11 },
  itemStrip: { gap: 10 },
  itemCard: {
    width: 116,
    backgroundColor: '#10231d',
    borderColor: '#1c3a31',
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 6
  },
  itemSelected: { borderColor: '#45e6bd' },
  itemImage: { width: '100%', aspectRatio: 1, backgroundColor: '#091914', borderRadius: 12 },
  itemName: { color: '#f4fff9', fontWeight: '800', fontSize: 12 },
  itemRarity: { color: '#91a79e', fontSize: 10 },
  selectedText: { color: '#45e6bd' },
  policy: { color: '#789187', fontSize: 11, lineHeight: 17 }
});
