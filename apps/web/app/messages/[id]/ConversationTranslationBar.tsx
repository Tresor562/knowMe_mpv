'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../lib/api';

type TranslationItem = {
  id: string;
  original: string;
  translated: string;
  sourceLanguage?: string | null;
};

type Offer = {
  sourceLanguage: string | null;
  targetLanguage: string;
  shouldOffer: boolean;
};

type TranslationState = {
  active: boolean;
  targetLanguage: string;
  translations: Record<string, string>;
};

const LANGUAGE_OPTIONS = ['fr', 'en', 'es', 'pt', 'de', 'it', 'ar', 'zh', 'ja', 'ko', 'ru'];

function languageName(code: string, locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function ConversationTranslationBar({
  conversationId,
  messages,
  appLanguage,
  onChange
}: {
  conversationId: string;
  messages: Array<{ id: string; text: string }>;
  appLanguage: string;
  onChange: (state: TranslationState) => void;
}) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [targetLanguage, setTargetLanguage] = useState(appLanguage);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const previousIdsRef = useRef<Set<string>>(new Set());
  const browserTranslatorRef = useRef<{
    sourceLanguage: string;
    targetLanguage: string;
    translate: (text: string) => Promise<string>;
    destroy?: () => void;
  } | null>(null);

  const stableMessages = useMemo(() => {
    const unique = new Map<string, string>();
    for (const item of messages) {
      if (item.id && item.text.trim()) unique.set(item.id, item.text);
    }
    return [...unique].map(([id, text]) => ({ id, text }));
  }, [messages]);
  const stableIds = useMemo(
    () => stableMessages.map((item) => item.id),
    [stableMessages]
  );

  useEffect(() => {
    setTargetLanguage(appLanguage);
    setActive(false);
    setTranslations({});
    previousIdsRef.current = new Set();
    onChange({ active: false, targetLanguage: appLanguage, translations: {} });

    void apiFetch<Offer>(
      `/conversations/${conversationId}/translation-offer?targetLanguage=${encodeURIComponent(appLanguage)}`
    )
      .then(setOffer)
      .catch(() => setOffer(null));
  }, [appLanguage, conversationId, onChange]);

  async function browserTranslate(ids: string[], language: string) {
    const sourceLanguage = offer?.sourceLanguage;
    if (!sourceLanguage) return null;
    const factory = (
      window as typeof window & {
        Translator?: {
          availability: (input: {
            sourceLanguage: string;
            targetLanguage: string;
          }) => Promise<string | null>;
          create: (input: {
            sourceLanguage: string;
            targetLanguage: string;
          }) => Promise<{
            sourceLanguage: string;
            targetLanguage: string;
            translate: (text: string) => Promise<string>;
            destroy?: () => void;
          }>;
        };
      }
    ).Translator;
    if (!factory) return null;

    const availability = await factory.availability({
      sourceLanguage,
      targetLanguage: language
    });
    if (!availability || availability === 'unavailable') return null;

    let translator = browserTranslatorRef.current;
    if (
      !translator ||
      translator.sourceLanguage !== sourceLanguage ||
      translator.targetLanguage !== language
    ) {
      translator?.destroy?.();
      translator = await factory.create({
        sourceLanguage,
        targetLanguage: language
      });
      browserTranslatorRef.current = translator;
    }

    const sourceById = new Map(
      stableMessages.map((item) => [item.id, item.text] as const)
    );
    const entries = await Promise.all(
      ids.flatMap((id) => {
        const text = sourceById.get(id);
        return text
          ? [
              translator!.translate(text).then(
                (translated) => [id, translated] as const
              )
            ]
          : [];
      })
    );
    return Object.fromEntries(entries);
  }

  async function translate(ids = stableIds, language = targetLanguage) {
    if (!ids.length || busy) return;
    setBusy(true);
    setError('');
    try {
      let mapped: Record<string, string> | null = null;
      try {
        mapped = await browserTranslate(ids, language);
      } catch {
        mapped = null;
      }

      let resolvedTarget = language;
      if (!mapped) {
        const result = await apiFetch<{
          targetLanguage: string;
          items: TranslationItem[];
        }>(`/conversations/${conversationId}/translate`, {
          method: 'POST',
          body: JSON.stringify({
            targetLanguage: language,
            messageIds: ids
          })
        });
        mapped = Object.fromEntries(
          result.items.map((item) => [item.id, item.translated])
        );
        resolvedTarget = result.targetLanguage;
      }
      const next = ids === stableIds
        ? mapped
        : { ...translations, ...mapped };
      setTranslations(next);
      setTargetLanguage(resolvedTarget);
      setActive(true);
      previousIdsRef.current = new Set(stableIds);
      onChange({
        active: true,
        targetLanguage: resolvedTarget,
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
    const missing = stableIds.filter(
      (id) => !previousIdsRef.current.has(id) && !translations[id]
    );
    previousIdsRef.current = new Set(stableIds);
    if (missing.length) void translate(missing, targetLanguage);
  }, [active, busy, stableIds, targetLanguage, translations]);

  function showOriginal() {
    setActive(false);
    setTranslations({});
    previousIdsRef.current = new Set();
    onChange({ active: false, targetLanguage, translations: {} });
  }

  const allTargets = [...new Set([appLanguage, ...LANGUAGE_OPTIONS])];

  if (!offer?.shouldOffer && !active && !error) return null;

  return (
    <section
      aria-label="Traduction de la conversation"
      style={{
        marginTop: 10,
        padding: '10px 12px',
        borderRadius: 14,
        border: '1px solid rgba(69,230,189,.24)',
        background: 'rgba(69,230,189,.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap'
      }}
    >
      {!active ? (
        <>
          <button
            type="button"
            className="btn"
            disabled={busy || !stableIds.length}
            onClick={() => void translate()}
          >
            {busy
              ? 'Traduction…'
              : `Traduire en ${languageName(targetLanguage, appLanguage)}`}
          </button>
          <input
            className="input"
            aria-label="Langue de traduction"
            list="knowme-translation-languages"
            value={targetLanguage}
            onChange={(event) => setTargetLanguage(event.target.value)}
            placeholder="fr, en, es, nl…"
            style={{ width: 150 }}
          />
        </>
      ) : (
        <>
          <strong style={{ color: 'var(--mint)' }}>
            Traduit en {languageName(targetLanguage, appLanguage)}
          </strong>
          <button type="button" className="btn" onClick={showOriginal}>
            Afficher l’original
          </button>
          <input
            className="input"
            aria-label="Changer la langue de traduction"
            list="knowme-translation-languages"
            value={targetLanguage}
            onChange={(event) => setTargetLanguage(event.target.value)}
            onBlur={() => {
              setTranslations({});
              previousIdsRef.current = new Set();
              void translate(stableIds, targetLanguage);
            }}
            placeholder="fr, en, es, nl…"
            style={{ width: 150 }}
          />
        </>
      )}
      <datalist id="knowme-translation-languages">
        {allTargets.map((language) => (
          <option key={language} value={language}>
            {languageName(language, appLanguage)}
          </option>
        ))}
      </datalist>
      {error ? <small style={{ color: 'var(--orange)' }}>{error}</small> : null}
      <small style={{ color: 'var(--muted)', flexBasis: '100%' }}>
        Traduction automatique : le texte original reste toujours disponible.
      </small>
    </section>
  );
}
