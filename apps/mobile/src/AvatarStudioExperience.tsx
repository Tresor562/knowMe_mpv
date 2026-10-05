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
import { useAppearance } from './AppearanceProvider';

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function AvatarPreview({ manifest }: { manifest: MobileAvatarManifest }) {
  const { colors, visual } = useAppearance();
  const visibleLayers = manifest.layers.filter((layer) => layer.item);
  return (
    <View style={[styles.preview, { backgroundColor: colors.backgroundAccent, borderColor: colors.border, borderRadius: Math.max(visual.cardRadius, 30) }]} accessibilityLabel="Aperçu de l’avatar composé">
      {visibleLayers.length === 0 && manifest.legacyAvatarUrl ? (
        <Image source={{ uri: manifest.legacyAvatarUrl }} style={styles.legacyAvatar} />
      ) : null}
      {visibleLayers.length === 0 && !manifest.legacyAvatarUrl ? (
        <View style={styles.fallback}>
          <Text style={[styles.fallbackInitials, { color: colors.text }]}>{manifest.fallback.initials}</Text>
          <Text style={[styles.fallbackToken, { color: colors.muted }]}>{manifest.fallback.paletteToken}</Text>
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
  const { colors, visual } = useAppearance();
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
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>Studio d’avatar</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Assemble uniquement les couches présentes dans ton inventaire KnowMe. Le serveur valide
            chaque équipement et résout l’ordre de rendu.
          </Text>
        </View>
        <Pressable
          disabled={refreshing}
          onPress={() => void load(true)}
          style={({ pressed }) => [
            styles.refresh,
            { borderColor: colors.border, backgroundColor: colors.backgroundAccent, borderRadius: visual.controlRadius },
            (pressed || refreshing) && styles.mutedButton
          ]}
        >
          <Text style={[styles.refreshText, { color: colors.accent }]}>{refreshing ? '…' : '↻'}</Text>
        </Pressable>
      </View>

      {status ? <Text style={[styles.status, { color: colors.accent }]}>{status}</Text> : null}

      {loading || !studio ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.muted, { color: colors.muted }]}>Chargement du rendu autoritaire…</Text>
        </View>
      ) : (
        <>
          <AvatarPreview manifest={studio.manifest} />
          <Text style={[styles.profileName, { color: colors.text }]}>{studio.profile.displayName}</Text>
          <Text style={[styles.handle, { color: colors.accent }]}>@{studio.profile.username}</Text>

          {MOBILE_AVATAR_LAYER_SLOTS.map((slot) => {
            const items = inventoryBySlot.get(slot) ?? [];
            const equipped = studio.equipment.find((entry) => entry.slot === slot)?.item ?? null;
            return (
              <View key={slot} style={[styles.layerSection, { backgroundColor: colors.backgroundAccent, borderColor: colors.border, borderRadius: visual.controlRadius }]}>
                <View style={styles.layerHeader}>
                  <View style={styles.layerTitleBox}>
                    <Text style={[styles.layerTitle, { color: colors.text }]}>{MOBILE_AVATAR_LAYER_LABELS[slot]}</Text>
                    <Text style={[styles.muted, { color: colors.muted }]}>{slot}</Text>
                  </View>
                  <Pressable
                    disabled={!equipped || busySlot !== null}
                    onPress={() => void equip(slot, null)}
                    style={({ pressed }) => [
                      styles.removeButton,
                      { borderColor: colors.danger, borderRadius: visual.controlRadius },
                      (pressed || !equipped || busySlot !== null) && styles.mutedButton
                    ]}
                  >
                    <Text style={[styles.removeButtonText, { color: colors.danger }]}>Retirer</Text>
                  </Pressable>
                </View>

                {items.length === 0 ? (
                  <Text style={[styles.muted, { color: colors.muted }]}>Aucun objet compatible dans l’inventaire.</Text>
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
                            {
                              backgroundColor: colors.surface,
                              borderColor: selected ? colors.accent : colors.border,
                              borderRadius: visual.controlRadius
                            },
                            (pressed || busySlot !== null) && styles.mutedButton
                          ]}
                        >
                          <Image
                            source={{ uri: entry.item.previewUrl ?? entry.item.assetUrl }}
                            style={[styles.itemImage, { backgroundColor: colors.backgroundAccent }]}
                            resizeMode="contain"
                          />
                          <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                            {entry.item.name}
                          </Text>
                          <Text style={[styles.itemRarity, { color: selected ? colors.accent : colors.muted }]}>
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

          <Text style={[styles.policy, { color: colors.muted }]}>
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
  status: { fontSize: 13, lineHeight: 19 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muted: { fontSize: 12 },
  preview: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  legacyAvatar: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', gap: 6 },
  fallbackInitials: { fontSize: 72, fontWeight: '900' },
  fallbackToken: { fontSize: 11 },
  layer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  profileName: { fontWeight: '900', fontSize: 18 },
  handle: { fontWeight: '800' },
  layerSection: {
        borderWidth: 1,
        padding: 13,
    gap: 12
  },
  layerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  layerTitleBox: { flex: 1, gap: 3 },
  layerTitle: { fontWeight: '900' },
  removeButton: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  removeButtonText: { fontWeight: '900', fontSize: 11 },
  itemStrip: { gap: 10 },
  itemCard: {
    width: 116,
        borderWidth: 1,
        padding: 10,
    gap: 6
  },
  itemSelected: {},
  itemImage: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  itemName: { fontWeight: '800', fontSize: 12 },
  itemRarity: { fontSize: 10 },
  selectedText: {},
  policy: { fontSize: 11, lineHeight: 17 }
});
