import { KnowMeAlert as Alert } from './ui/KnowMeFeedback';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  MOBILE_AVATAR_LAYER_SLOTS,
  MobileAvatarLayerSlot,
  MobileAvatarManifest,
  MobileAvatarStudioState
} from './avatar-studio';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';
import { avatarStudioPhase } from './avatar-studio-view-model';
import {
  avatarStudioLabel, avatarStudioOptionCount, avatarStudioRarityLabel,
  avatarStudioSlotLabel, avatarStudioSlotStatus
} from './avatar-studio-l10n';
import { GlassSurface, KnowMeIcon, PressScale } from './ui/KnowMeUI';

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function AvatarPreview({ manifest, label }: { manifest: MobileAvatarManifest; label: string }) {
  const { colors, visual } = useAppearance();
  const visibleLayers = manifest.layers.filter((layer) => layer.item);
  return (
    <View style={[styles.preview, { backgroundColor: colors.backgroundAccent, borderColor: colors.border, borderRadius: Math.max(visual.cardRadius, 30) }]} accessibilityLabel={label}>
      {visibleLayers.length === 0 && manifest.legacyAvatarUrl ? (
        <Image source={{ uri: manifest.legacyAvatarUrl }} style={styles.legacyAvatar} />
      ) : null}
      {visibleLayers.length === 0 && !manifest.legacyAvatarUrl ? (
        <View style={styles.fallback}>
          <Text style={[styles.fallbackInitials, { color: colors.text }]}>{manifest.fallback.initials}</Text>
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
  const { locale } = useI18n();
  const en = locale === 'en';
  const uiLocale = en ? 'en' : 'fr';
  const copy = avatarStudioLabel(uiLocale);
  const tr = (fr: string, english: string) => en ? english : fr;
  const [studio, setStudio] = useState<MobileAvatarStudioState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busySlot, setBusySlot] = useState<MobileAvatarLayerSlot | null>(null);
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    try {
      setStudio(await getMobileAvatarStudio());
      setStatus('');
      setStatusError(false);
    } catch (cause) {
      setStatus(message(cause, tr('Le studio d’avatar est indisponible.', 'Avatar Studio is unavailable.')));
      setStatusError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [en]);

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
    setStatusError(false);
    try {
      const result = await equipMobileAvatarLayer(slot, itemId);
      setStudio(result.studio);
      setStatus(
        avatarStudioSlotStatus(slot, itemId ? 'equipped' : 'removed', uiLocale)
      );
    } catch (cause) {
      const text = message(cause, copy.updateFailed);
      setStatus(text);
      setStatusError(true);
      Alert.alert('Avatar Studio', text);
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
            {tr('Compose ton avatar avec les éléments de ton inventaire.',
                'Build your avatar using items you own.')}
          </Text>
        </View>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={tr('Actualiser', 'Refresh')}
          disabled={refreshing || loading}
          onPress={() => void load(true)}
          style={[
            styles.refresh,
            { borderColor: colors.border, backgroundColor: colors.backgroundAccent }
          ]}
        >
          <KnowMeIcon name="refresh" size={18} color={refreshing ? colors.muted : colors.accent} />
        </PressScale>
      </View>

      {status && studio ? <Text accessibilityRole={statusError ? 'alert' : undefined}
        style={[styles.status, { color: statusError ? colors.danger : colors.accent }]}>{status}</Text> : null}

      {avatarStudioPhase(loading, Boolean(studio)) === 'loading' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.muted, { color: colors.muted }]}>
            {tr('Chargement du studio…', 'Loading Avatar Studio…')}
          </Text>
        </View>
      ) : avatarStudioPhase(loading, Boolean(studio)) === 'error' ? (
        <View style={styles.retryPanel}>
          <KnowMeIcon name="refresh" size={28} color={colors.muted} />
          <Text accessibilityRole="alert" style={[styles.retryMessage, { color: colors.text }]}>
            {status || tr('Impossible de charger ton avatar.', 'Could not load your avatar.')}
          </Text>
          <PressScale accessibilityRole="button"
            accessibilityLabel={tr('Réessayer le chargement du studio', 'Retry loading Avatar Studio')}
            disabled={refreshing}
            style={[styles.retryButton, { borderColor: colors.border, backgroundColor: colors.backgroundAccent }]}
            onPress={() => void load(true)}>
            {refreshing ? <ActivityIndicator color={colors.accent} size="small" /> :
              <KnowMeIcon name="refresh" size={19} color={colors.accent} />}
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {refreshing ? tr('Nouvelle tentative…', 'Retrying…') : tr('Réessayer', 'Retry')}
            </Text>
          </PressScale>
        </View>
      ) : studio ? (
        <>
          <AvatarPreview manifest={studio.manifest} label={copy.preview} />
          <Text style={[styles.profileName, { color: colors.text }]}>{studio.profile.displayName}</Text>
          <Text style={[styles.handle, { color: colors.accent }]}>@{studio.profile.username}</Text>

          {MOBILE_AVATAR_LAYER_SLOTS.map((slot) => {
            const items = inventoryBySlot.get(slot) ?? [];
            const equipped = studio.equipment.find((entry) => entry.slot === slot)?.item ?? null;
            return (
              <View key={slot} style={[styles.layerSection, { backgroundColor: colors.surfaceGlass, borderColor: colors.border, borderRadius: visual.controlRadius }]}>
                <View style={styles.layerHeader}>
                  <View style={styles.layerTitleBox}>
                    <Text style={[styles.layerTitle, { color: colors.text }]}>{avatarStudioSlotLabel(slot, uiLocale)}</Text>
                    <Text style={[styles.muted, { color: colors.muted }]}>
                      {equipped ? `${equipped.name} · ${copy.itemEquipped}` : avatarStudioOptionCount(items.length, uiLocale)}
                    </Text>
                  </View>
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel={`${copy.remove} · ${avatarStudioSlotLabel(slot, uiLocale)}`}
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
                  <Text style={[styles.muted, { color: colors.muted }]}>{copy.inventoryEmpty}</Text>
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
                          disabled={busySlot !== null || selected}
                          accessibilityRole="button"
                          accessibilityLabel={`${entry.item.name}, ${selected ? tr('équipé', 'equipped') : avatarStudioRarityLabel(entry.item.rarity, uiLocale)}`}
                          accessibilityState={{ disabled: busySlot !== null || selected, selected }}
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
                            {selected ? copy.equipped : avatarStudioRarityLabel(entry.item.rarity, uiLocale)}
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
            {copy.policy}
          </Text>
        </>
      ) : null}
    </GlassSurface>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  mutedButton: { opacity: 0.45 },
  status: { fontSize: 11.5, lineHeight: 17 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muted: { fontSize: 10.5, lineHeight: 15 },
  retryPanel: { minHeight: 190, alignItems: 'center', justifyContent: 'center', padding: 18, gap: 13 },
  retryMessage: { textAlign: 'center', fontSize: 14, lineHeight: 21 },
  retryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 48, minWidth: 146, paddingHorizontal: 20, gap: 10,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 17 },
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
