import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { getRuntimeLocale } from './i18n-runtime';

type TranslationItem = {
  id: string;
  translated: string;
};

type Offer = {
  sourceLanguage: string | null;
  targetLanguage: string;
  shouldOffer: boolean;
};

export type ConversationTranslationState = {
  active: boolean;
  targetLanguage: string;
  translations: Record<string, string>;
};

const NAMES: Record<string, Record<string, string>> = {
  fr: {
    fr: 'français',
    en: 'anglais',
    es: 'espagnol',
    pt: 'portugais',
    de: 'allemand',
    it: 'italien',
    ar: 'arabe',
    zh: 'chinois',
    ja: 'japonais',
    ko: 'coréen',
    ru: 'russe'
  },
  en: {
    fr: 'French',
    en: 'English',
    es: 'Spanish',
    pt: 'Portuguese',
    de: 'German',
    it: 'Italian',
    ar: 'Arabic',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    ru: 'Russian'
  }
};

function languageLabel(code: string, locale: string) {
  const baseLocale = locale.toLowerCase().split('-')[0] ?? locale;
  const baseCode = code.toLowerCase().split('-')[0] ?? code;
  return NAMES[baseLocale]?.[baseCode] ?? code;
}

export function MobileConversationTranslationBar({
  conversationId,
  messages,
  onChange
}: {
  conversationId: string;
  messages: Array<{ id: string; text: string }>;
  onChange: (state: ConversationTranslationState) => void;
}) {
  const appLanguage = getRuntimeLocale();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>(appLanguage);
  const [active, setActive] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const knownIdsRef = useRef<Set<string>>(new Set());

  const stableMessages = useMemo(() => {
    const unique = new Map<string, string>();
    for (const message of messages) {
      if (message.id && message.text.trim()) {
        unique.set(message.id, message.text);
      }
    }
    return [...unique].map(([id, text]) => ({ id, text }));
  }, [messages]);

  const ids = useMemo(
    () => stableMessages.map((message) => message.id),
    [stableMessages]
  );

  useEffect(() => {
    let mounted = true;
    setActive(false);
    setTranslations({});
    setTargetLanguage(appLanguage);
    knownIdsRef.current = new Set();
    onChange({
      active: false,
      targetLanguage: appLanguage,
      translations: {}
    });

    void apiFetch<Offer>(
      `/conversations/${conversationId}/translation-offer?targetLanguage=${encodeURIComponent(appLanguage)}`
    )
      .then((value) => {
        if (mounted) setOffer(value);
      })
      .catch(() => {
        if (mounted) setOffer(null);
      });

    return () => {
      mounted = false;
    };
  }, [appLanguage, conversationId, onChange]);

  async function translate(
    requestedIds = ids,
    language = targetLanguage,
    replace = false
  ) {
    if (!requestedIds.length || busy) return;
    const normalized = language.trim();
    if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(normalized)) {
      setError('Entre un code de langue valide, par exemple fr, en ou pt-BR.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await apiFetch<{
        targetLanguage: string;
        items: TranslationItem[];
      }>(`/conversations/${conversationId}/translate`, {
        method: 'POST',
        body: JSON.stringify({
          targetLanguage: normalized,
          messageIds: requestedIds
        })
      });
      const mapped = Object.fromEntries(
        result.items.map((item) => [item.id, item.translated])
      );
      const next = replace ? mapped : { ...translations, ...mapped };
      setTranslations(next);
      setTargetLanguage(result.targetLanguage);
      setActive(true);
      knownIdsRef.current = new Set(ids);
      onChange({
        active: true,
        targetLanguage: result.targetLanguage,
        translations: next
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'La traduction est temporairement indisponible.'
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!active || busy) return;
    const missing = ids.filter(
      (id) => !knownIdsRef.current.has(id) && !translations[id]
    );
    knownIdsRef.current = new Set(ids);
    if (missing.length) void translate(missing, targetLanguage);
  }, [active, busy, ids, targetLanguage, translations]);

  function showOriginal() {
    setActive(false);
    setTranslations({});
    knownIdsRef.current = new Set();
    onChange({
      active: false,
      targetLanguage,
      translations: {}
    });
  }

  if (!offer?.shouldOffer && !active && !error) return null;

  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        {!active ? (
          <Pressable
            disabled={busy || !ids.length}
            onPress={() => void translate(ids, targetLanguage, true)}
            style={[styles.primaryButton, busy && styles.disabled]}
          >
            <Text style={styles.primaryText}>
              {busy
                ? 'Traduction…'
                : `Traduire en ${languageLabel(targetLanguage, appLanguage)}`}
            </Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.activeLabel}>
              Traduit en {languageLabel(targetLanguage, appLanguage)}
            </Text>
            <Pressable onPress={showOriginal} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Afficher l’original</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.row}>
        <TextInput
          value={targetLanguage}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={35}
          placeholder="fr, en, es, pt-BR…"
          placeholderTextColor="#789187"
          onChangeText={setTargetLanguage}
          style={styles.input}
        />
        {active ? (
          <Pressable
            disabled={busy}
            onPress={() => {
              setTranslations({});
              knownIdsRef.current = new Set();
              void translate(ids, targetLanguage, true);
            }}
            style={[styles.secondaryButton, busy && styles.disabled]}
          >
            <Text style={styles.secondaryText}>
              {busy ? '…' : 'Changer'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.hint}>
        Traduction automatique. Le message original reste toujours disponible.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#315449',
    borderRadius: 16,
    backgroundColor: '#0c211a'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  primaryButton: {
    backgroundColor: '#45e6bd',
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 10
  },
  primaryText: {
    color: '#052017',
    fontWeight: '900'
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#315449',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  secondaryText: {
    color: '#d9ebe4',
    fontWeight: '800'
  },
  activeLabel: {
    color: '#45e6bd',
    fontWeight: '900'
  },
  input: {
    minWidth: 150,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#25473b',
    borderRadius: 12,
    backgroundColor: '#091914',
    color: '#f4fff9',
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  hint: {
    color: '#91a79e',
    fontSize: 11
  },
  error: {
    color: '#ff9d66',
    fontSize: 11
  },
  disabled: {
    opacity: 0.45
  }
});
