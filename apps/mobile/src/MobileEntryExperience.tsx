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
  const { colors, visual } = useAppearance();
  const { locale, setLocalLocale } = useI18n();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <BrandMark size={30} />
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
          <GlassSurface
            strength="soft"
            borderRadius={visual.cardRadius}
            style={styles.logoGlass}
          >
            <BrandMark size={48} />
          </GlassSurface>
          <Text style={[styles.title, { color: colors.text }]}>
            Bienvenue sur KnowMe
          </Text>
          <Text style={[styles.copy, { color: colors.muted }]}>
            Messages, appels, groupes, chaînes et outils IA dans une expérience compacte, rapide et personnelle.
          </Text>
        </View>

        <View style={styles.actions}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Connexion ou inscription"
            onPress={onAccount}
            style={[
              styles.primary,
              {
                backgroundColor: colors.accent,
                borderRadius: visual.controlRadius
              }
            ]}
          >
            <Text style={[styles.primaryText, { color: colors.accentText }]}>
              Connexion / Inscription
            </Text>
            <KnowMeIcon name="arrow" size={18} color={colors.accentText} />
          </PressScale>

          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Essayer PLAY sans compte"
            onPress={onGuest}
            style={[
              styles.secondary,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: visual.controlRadius
              }
            ]}
          >
            <Text style={[styles.secondaryText, { color: colors.text }]}>
              Essayer PLAY sans compte
            </Text>
          </PressScale>

          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Récupérer mon compte"
            onPress={onRecovery}
            style={styles.textButton}
          >
            <Text style={[styles.textButtonText, { color: colors.accent }]}>
              Récupérer mon compte
            </Text>
          </PressScale>

          <Text style={[styles.note, { color: colors.muted }]}>
            La langue suit ton appareil par défaut et reste modifiable à tout moment.
          </Text>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16
  },
  topRow: {
    minHeight: 48,
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
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.35
  },
  languageWrap: {
    width: 112
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingTop: 6
  },
  logoGlass: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18
  },
  title: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '700',
    letterSpacing: -0.55,
    textAlign: 'center'
  },
  copy: {
    maxWidth: 340,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8
  },
  actions: {
    gap: 8,
    paddingTop: 4
  },
  primary: {
    minHeight: 50,
    borderRadius: 22,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9
  },
  primaryText: {
    fontWeight: '700',
    fontSize: 15
  },
  secondary: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryText: {
    fontWeight: '600',
    fontSize: 15
  },
  textButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textButtonText: {
    fontWeight: '600',
    fontSize: 13.5
  },
  note: {
    fontSize: 11.5,
    lineHeight: 16.5,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingBottom: 2
  }
});
