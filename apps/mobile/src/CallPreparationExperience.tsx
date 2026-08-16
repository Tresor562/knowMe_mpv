import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useAppearance } from './AppearanceProvider';
import { CallDevicePreparation } from './CallDevicePreparation';
import { CallPreferenceSettings } from './CallPreferenceSettings';

export function CallPreparationExperience({ onBack }: { onBack: () => void }) {
  const { colors } = useAppearance();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={[styles.backButton, { borderColor: colors.border }]}
      >
        <Text style={[styles.backButtonText, { color: colors.accent }]}>
          ← Accueil
        </Text>
      </Pressable>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>APPELS</Text>
      <Text style={[styles.heading, { color: colors.text }]}>
        Disponibilité et appareils
      </Text>
      <Text style={[styles.intro, { color: colors.muted }]}>
        Choisis quand tu peux être appelé, puis vérifie volontairement les
        permissions de ce téléphone.
      </Text>

      <CallPreferenceSettings />
      <CallDevicePreparation />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9
  },
  backButtonText: { fontWeight: '800' },
  eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  heading: { fontSize: 30, fontWeight: '900' },
  intro: { fontSize: 15, lineHeight: 22 }
});
