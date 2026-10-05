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
import { GlassSurface, KnowMeIcon, PressScale } from './ui/KnowMeUI';

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function rarityLabel(value: string) {
  const labels: Record<string, string> = {
    COMMON: 'Commun',
    UNCOMMON: 'Peu commun',
    RARE: 'Rare',
    EPIC: 'Épique',
    LEGENDARY: 'Légendaire'
  };
  return labels[value] ?? value.replaceAll('_', ' ').toLocaleLowerCase();
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
    </GlassSurface>
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
    <GlassSurface strength="soft" borderRadius={visual.cardRadius} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.headerIcon, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon name="profile" size={21} color={colors.secondary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>Avatar Studio</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Compose ton avatar avec les éléments de ton inventaire.
          </Text>
        </View>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Actualiser"
          disabled={refreshing}
          onPress={() => void load(true)}
          style={[
            styles.refresh,
            { borderColor: colors.border, backgroundColor: colors.backgroundAccent }
          ]}
        >
          <KnowMeIcon name="refresh" size={18} color={refreshing ? colors.muted : colors.accent} />
        </PressScale>
      </View>

      {status ? <Text style={[styles.status, { color: colors.accent }]}>{status}</Text> : null}

      {loading || !studio ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.muted, { color: colors.muted }]}>Chargement du studio…</Text>
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
              <View key={slot} style={[styles.layerSection, { backgroundColor: colors.surfaceGlass, borderColor: colors.border, borderRadius: visual.controlRadius }]}>
                <View style={styles.layerHeader}>
                  <View style={styles.layerTitleBox}>
                    <Text style={[styles.layerTitle, { color: colors.text }]}>{MOBILE_AVATAR_LAYER_LABELS[slot]}</Text>
                    <Text style={[styles.muted, { color: colors.muted }]}>
                      {equipped ? `${equipped.name} équipé` : `${items.length} option(s)`}
                    </Text>
                  </View>
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel={`Retirer ${MOBILE_AVATAR_LAYER_LABELS[slot]}`}
                    disabled={!equipped || busySlot !== null}
                    onPress={() => void equip(slot, null)}
                    style={[
                      styles.removeButton,
                      { borderColor: colors.border, backgroundColor: colors.backgroundAccent },
                      (!equipped || busySlot !== null) && styles.mutedButton
                    ]}
                  >
                    <KnowMeIcon name="close" size={15} color={equipped ? colors.danger : colors.muted} />
                  </PressScale>
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
                              backgroundColor: selected ? colors.backgroundAccent : colors.surfaceGlass,
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
                            {selected ? 'Équipé' : rarityLabel(entry.item.rarity)}
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
            Seuls les éléments de ton inventaire peuvent être équipés. La visibilité de ton avatar suit tes réglages de confidentialité.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 3 },
  title: { fontSize: 18, fontWeight: '800' },
  description: { fontSize: 12.5, lineHeight: 18 },
  refresh: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  mutedButton: { opacity: 0.45 },
  status: { fontSize: 11.5, lineHeight: 17 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muted: { fontSize: 10.5, lineHeight: 15 },
  preview: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  legacyAvatar: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', gap: 6 },
  fallbackInitials: { fontSize: 64, fontWeight: '800' },
  fallbackToken: { fontSize: 10 },
  layer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  profileName: { fontWeight: '800', fontSize: 16 },
  handle: { fontSize: 11.5, fontWeight: '700' },
  layerSection: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 9
  },
  layerHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  layerTitleBox: { flex: 1, gap: 2 },
  layerTitle: { fontSize: 13, fontWeight: '800' },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  itemStrip: { gap: 8 },
  itemCard: {
    width: 104,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    gap: 5
  },
  itemImage: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  itemName: { fontWeight: '700', fontSize: 11 },
  itemRarity: { fontSize: 9.5 },
  policy: { fontSize: 10.5, lineHeight: 15 }
});
