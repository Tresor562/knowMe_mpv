import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { AppContent } from '../App';
import { AccountRecoveryExperience } from './AccountRecoveryExperience';
import { hasSession, subscribeToSessionPresence } from './api';
import { AppearanceProvider, useAppearance } from './AppearanceProvider';
import { GuestQuickMathExperience } from './GuestQuickMathExperience';
import { useI18n } from './I18nProvider';
import { LanguagePicker } from './LanguagePicker';
import {
  MobileEntryMode,
  reconcileMobileEntrySession,
  resolveInitialMobileEntry,
  selectMobileEntry
} from './mobile-entry-model';
import {
  BrandMark,
  GlassSurface,
  KnowMeIcon,
  PressScale
} from './ui/KnowMeUI';

function PublicChoice({
  onAccount,
  onGuest,
  onRecovery
}: {
  onAccount: () => void;
  onGuest: () => void;
  onRecovery: () => void;
}) {
  const { colors } = useAppearance();
  const { locale, setLocalLocale } = useI18n();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View pointerEvents="none" style={[styles.glowOne, { backgroundColor: colors.accent }]} />
      <View pointerEvents="none" style={[styles.glowTwo, { backgroundColor: colors.secondary }]} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <BrandMark size={32} />
            <Text style={[styles.brandName, { color: colors.text }]}>KnowMe</Text>
          </View>
          <View style={styles.languageWrap}>
            <LanguagePicker
              compact
              value={locale}
              onChange={(nextLocale) => setLocalLocale(nextLocale)}
            />
          </View>
        </View>

        <View style={styles.hero}>
          <GlassSurface strength="soft" borderRadius={34} style={styles.logoGlass}>
            <BrandMark size={58} />
          </GlassSurface>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            MESSAGES · PLAY · DISCOVER
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Bienvenue sur KnowMe.
          </Text>
          <Text style={[styles.copy, { color: colors.muted }]}>
            Une messagerie sociale rapide, personnelle et vivante — avec ton identité, tes conversations et ton univers au même endroit.
          </Text>
        </View>

        <GlassSurface strength="medium" borderRadius={28} style={styles.actionsCard}>
          <PressScale
            accessibilityRole="button"
            onPress={onAccount}
            style={[styles.primary, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.primaryText, { color: colors.accentText }]}>
              Connexion / Inscription
            </Text>
            <KnowMeIcon name="arrow" size={18} color={colors.accentText} />
          </PressScale>

          <PressScale
            accessibilityRole="button"
            onPress={onGuest}
            style={[
              styles.secondary,
              {
                backgroundColor: colors.backgroundAccent,
                borderColor: colors.border
              }
            ]}
          >
            <Text style={[styles.secondaryText, { color: colors.text }]}>
              Essayer PLAY sans compte
            </Text>
          </PressScale>

          <PressScale
            accessibilityRole="button"
            onPress={onRecovery}
            style={styles.textButton}
          >
            <Text style={[styles.textButtonText, { color: colors.accent }]}>
              Mot de passe oublié ?
            </Text>
          </PressScale>

          <Text style={[styles.note, { color: colors.muted }]}>
            La langue suit ton appareil par défaut et reste modifiable à tout moment.
          </Text>
        </GlassSurface>
      </View>
    </SafeAreaView>
  );
}

function EntryContent() {
  const { colors } = useAppearance();
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
      <SafeAreaView style={[styles.loadingRoot, { backgroundColor: colors.background }]}>
        <BrandMark size={54} />
        <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (mode === 'account') {
    return (
      <AppContent
        onExitAuth={() => setMode((current) => selectMobileEntry(current, 'choice'))}
      />
    );
  }

  if (mode === 'guest') {
    return (
      <GuestQuickMathExperience
        onBack={() => setMode((current) => selectMobileEntry(current, 'choice'))}
      />
    );
  }

  if (mode === 'recovery') {
    return (
      <AccountRecoveryExperience
        onBack={() => setMode((current) => selectMobileEntry(current, 'choice'))}
      />
    );
  }

  return (
    <PublicChoice
      onAccount={() => setMode((current) => selectMobileEntry(current, 'account'))}
      onGuest={() => setMode((current) => selectMobileEntry(current, 'guest'))}
      onRecovery={() => setMode((current) => selectMobileEntry(current, 'recovery'))}
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
  root: {
    flex: 1,
    overflow: 'hidden'
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loader: {
    marginTop: 18
  },
  glowOne: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -165,
    right: -120,
    opacity: 0.1
  },
  glowTwo: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    bottom: -150,
    left: -110,
    opacity: 0.08
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 18
  },
  topRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9
  },
  brandName: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.45
  },
  languageWrap: {
    width: 120
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingTop: 10
  },
  logoGlass: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.15,
    marginBottom: 10
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center'
  },
  copy: {
    maxWidth: 350,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8
  },
  actionsCard: {
    padding: 12,
    gap: 9
  },
  primary: {
    minHeight: 52,
    borderRadius: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9
  },
  primaryText: {
    fontWeight: '900',
    fontSize: 15.5
  },
  secondary: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryText: {
    fontWeight: '800',
    fontSize: 15
  },
  textButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textButtonText: {
    fontWeight: '800',
    fontSize: 13.5
  },
  note: {
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingBottom: 2
  }
});
