import { useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppearance } from './AppearanceProvider';
import { PaymentsExperience } from './PaymentsExperience';
import { SocialGiftsExperience } from './SocialGiftsExperience';
import { GlassSurface, KnowMeIcon } from './ui/KnowMeUI';

type StoreSection = 'gifts' | 'coins';

/**
 * Native KnowMe marketplace entry.
 * It presents genuine existing server-backed gifting and wallet purchase flows.
 * No unverified APK catalog, app download button or mock products are exposed.
 */
export function MarketplaceExperience({ onBack }: { onBack: () => void }) {
  const { colors } = useAppearance();
  const [section, setSection] = useState<StoreSection>('gifts');

  // Android hardware/gesture back should match the visible header back action.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => listener.remove();
  }, [onBack]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GlassSurface strength="soft" borderRadius={24} style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour aux suggestions"
          hitSlop={6}
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && { backgroundColor: colors.backgroundAccent }]}
        >
          <KnowMeIcon name="back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.heading}>
          <Text style={[styles.title, { color: colors.text }]}>Marketplace</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Cadeaux et achats KnowMe</Text>
        </View>
        <KnowMeIcon name="spark" size={23} color={colors.accent} />
      </GlassSurface>
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {([
          ['gifts', 'Cadeaux', 'spark'],
          ['coins', 'KnowCoins', 'coins']
        ] as const).map(([value, title, icon]) => {
          const active = section === value;
          return (
            <Pressable key={value} accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setSection(value)}
              style={[
                styles.tab,
                { borderBottomColor: active ? colors.accent : 'transparent' }
              ]}>
              <KnowMeIcon name={icon} size={19} color={active ? colors.accent : colors.muted} />
              <Text style={[styles.tabText,{color:active ? colors.accent : colors.muted}]}>{title}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        key={section}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {section === 'gifts'
          ? <SocialGiftsExperience />
          : <PaymentsExperience />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  header: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 9,
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heading: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontWeight: '700', fontSize: 21, letterSpacing: -.5 },
  subtitle: { fontWeight: '400', fontSize: 12 },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 13,
    marginTop: 5,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  tab: {
    flex: 1,
    minHeight: 48,
    borderBottomWidth: 3,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: 13, paddingTop: 12, paddingBottom: 90 }
});
