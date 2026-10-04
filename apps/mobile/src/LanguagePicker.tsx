import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  SUPPORTED_LOCALES,
  localeDisplayName,
  type SupportedLocale
} from '@knowme/i18n-contract';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';

export function LanguagePicker({
  value,
  onChange,
  compact = false
}: {
  value: SupportedLocale;
  onChange: (locale: SupportedLocale) => void | Promise<void>;
  compact?: boolean;
}) {
  const { colors } = useAppearance();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return SUPPORTED_LOCALES.map((locale) => ({
      locale,
      nativeName: localeDisplayName(locale, locale),
      englishName: localeDisplayName(locale, 'en')
    }))
      .filter((item) => {
        if (!needle) return true;
        return (
          item.locale.toLocaleLowerCase().includes(needle) ||
          item.nativeName.toLocaleLowerCase().includes(needle) ||
          item.englishName.toLocaleLowerCase().includes(needle)
        );
      })
      .sort((a, b) => a.englishName.localeCompare(b.englishName));
  }, [query]);

  const selectedNativeName = localeDisplayName(value, value);
  const selectedEnglishName = localeDisplayName(value, 'en');

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.chooseLanguage')}
        onPress={() => setOpen(true)}
        style={[
          compact ? styles.compactButton : styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border
          }
        ]}
      >
        <View style={styles.buttonTextWrap}>
          {!compact ? (
            <Text style={[styles.kicker, { color: colors.muted }]}>
              {t('common.language')}
            </Text>
          ) : null}
          <Text style={[styles.selected, { color: colors.text }]} numberOfLines={1}>
            {selectedNativeName}
          </Text>
          {!compact && selectedEnglishName !== selectedNativeName ? (
            <Text style={[styles.secondary, { color: colors.muted }]} numberOfLines={1}>
              {selectedEnglishName}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.chevron, { color: colors.accent }]}>⌄</Text>
      </Pressable>

      <Modal
        animationType="slide"
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('common.chooseLanguage')}
              </Text>
              <Text style={[styles.count, { color: colors.muted }]}>
                {SUPPORTED_LOCALES.length} langues / scripts
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              style={[styles.close, { backgroundColor: colors.surfaceRaised }]}
            >
              <Text style={[styles.closeText, { color: colors.text }]}>×</Text>
            </Pressable>
          </View>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            value={query}
            onChangeText={setQuery}
            placeholder={t('common.searchLanguage')}
            placeholderTextColor={colors.muted}
            style={[
              styles.search,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text
              }
            ]}
          />

          <FlatList
            data={options}
            keyExtractor={(item) => item.locale}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={24}
            windowSize={12}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const selected = item.locale === value;
              return (
                <Pressable
                  onPress={() => {
                    void onChange(item.locale);
                    setOpen(false);
                    setQuery('');
                  }}
                  style={[
                    styles.row,
                    {
                      backgroundColor: selected ? colors.surfaceRaised : colors.surface,
                      borderColor: selected ? colors.accent : colors.border
                    }
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.nativeName, { color: colors.text }]}>
                      {item.nativeName}
                    </Text>
                    <Text style={[styles.englishName, { color: colors.muted }]}>
                      {item.englishName} · {item.locale}
                    </Text>
                  </View>
                  {selected ? (
                    <Text style={[styles.check, { color: colors.accent }]}>✓</Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  compactButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  buttonTextWrap: { flex: 1 },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 2
  },
  selected: { fontSize: 15, fontWeight: '900' },
  secondary: { fontSize: 11, marginTop: 1 },
  chevron: { fontSize: 21, fontWeight: '900' },
  modalRoot: { flex: 1 },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '900' },
  count: { fontSize: 12, marginTop: 2 },
  close: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: { fontSize: 26, lineHeight: 28 },
  search: {
    margin: 16,
    marginBottom: 8,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 15,
    fontSize: 15
  },
  list: { padding: 16, paddingTop: 6, gap: 9 },
  row: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  rowText: { flex: 1 },
  nativeName: { fontSize: 15, fontWeight: '900' },
  englishName: { fontSize: 11, marginTop: 2 },
  check: { fontSize: 20, fontWeight: '900' }
});
