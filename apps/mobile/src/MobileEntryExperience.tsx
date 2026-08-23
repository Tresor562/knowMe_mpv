import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import App from '../App';
import { hasSession, subscribeToSessionPresence } from './api';
import { AppearanceProvider, useAppearance } from './AppearanceProvider';
import { GuestQuickMathExperience } from './GuestQuickMathExperience';
import {
  MobileEntryMode,
  reconcileMobileEntrySession,
  resolveInitialMobileEntry,
  selectMobileEntry
} from './mobile-entry-model';

function PublicChoice({ onAccount, onGuest }: { onAccount: () => void; onGuest: () => void }) {
  const { colors } = useAppearance();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.brandMark, { backgroundColor: colors.accent }]}>
          <Text style={[styles.brandMarkText, { color: colors.accentText }]}>K</Text>
        </View>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>PLAY · DISCOVER · CONNECT</Text>
        <Text style={[styles.title, { color: colors.text }]}>Entre pour jouer. Crée un compte quand tu veux garder plus.</Text>
        <Text style={[styles.copy, { color: colors.muted }]}>Quick Math est disponible sans compte avec une identité temporaire. Connexion et inscription restent disponibles sans détour.</Text>

        <Pressable accessibilityRole="button" onPress={onGuest} style={[styles.primary, { backgroundColor: colors.accent }]}>
          <Text style={[styles.primaryText, { color: colors.accentText }]}>Jouer sans compte</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onAccount} style={[styles.secondary, { borderColor: colors.border }]}>
          <Text style={[styles.secondaryText, { color: colors.text }]}>Connexion / Inscription</Text>
        </Pressable>
        <Text style={[styles.note, { color: colors.muted }]}>Le mode invité est temporaire, soumis à l’age-gate et n’ouvre aucun accès aux données d’un compte.</Text>
      </View>
    </SafeAreaView>
  );
}

function EntryContent() {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<MobileEntryMode>('choice');

  useEffect(() => {
    let active = true;
    void hasSession()
      .then((present) => {
        if (active) setMode(resolveInitialMobileEntry(present));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return subscribeToSessionPresence((present) => {
      setMode((current) => reconcileMobileEntrySession(current, present));
    });
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (mode === 'account') {
    return <App />;
  }

  if (mode === 'guest') {
    return (
      <GuestQuickMathExperience
        onBack={() => setMode((current) => selectMobileEntry(current, 'choice'))}
      />
    );
  }

  return (
    <PublicChoice
      onAccount={() => setMode((current) => selectMobileEntry(current, 'account'))}
      onGuest={() => setMode((current) => selectMobileEntry(current, 'guest'))}
    />
  );
}

export function MobileEntryExperience() {
  return (
    <AppearanceProvider>
      <EntryContent />
    </AppearanceProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  brandMark: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { fontSize: 34, fontWeight: '900' },
  eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '900' },
  copy: { fontSize: 16, lineHeight: 23, marginBottom: 8 },
  primary: { borderRadius: 18, paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center' },
  primaryText: { fontWeight: '900', fontSize: 16 },
  secondary: { borderWidth: 1, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center' },
  secondaryText: { fontWeight: '800', fontSize: 15 },
  note: { fontSize: 12, lineHeight: 18, marginTop: 4 }
});