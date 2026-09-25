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
  messageIds,
  appLanguage,
  onChange
}: {
  conversationId: string;
  messageIds: string[];
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

  const stableIds = useMemo(
    () => [...new Set(messageIds)].filter(Boolean),
    [messageIds]
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

  async function translate(ids = stableIds, language = targetLanguage) {
    if (!ids.length || busy) return;
    setBusy(true);
    setError('');
    try {
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
      const mapped = Object.fromEntries(
        result.items.map((item) => [item.id, item.translated])
      );
      const next = ids === stableIds
        ? mapped
        : { ...translations, ...mapped };
      setTranslations(next);
      setTargetLanguage(result.targetLanguage);
      setActive(true);
      previousIdsRef.current = new Set(stableIds);
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
          <select
            className="input"
            aria-label="Langue de traduction"
            value={targetLanguage}
            onChange={(event) => setTargetLanguage(event.target.value)}
            style={{ width: 'auto', minWidth: 150 }}
          >
            {allTargets.map((language) => (
              <option key={language} value={language}>
                {languageName(language, appLanguage)}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <strong style={{ color: 'var(--mint)' }}>
            Traduit en {languageName(targetLanguage, appLanguage)}
          </strong>
          <button type="button" className="btn" onClick={showOriginal}>
            Afficher l’original
          </button>
          <select
            className="input"
            aria-label="Changer la langue de traduction"
            value={targetLanguage}
            onChange={(event) => {
              const next = event.target.value;
              setTargetLanguage(next);
              setTranslations({});
              previousIdsRef.current = new Set();
              void translate(stableIds, next);
            }}
            style={{ width: 'auto', minWidth: 150 }}
          >
            {allTargets.map((language) => (
              <option key={language} value={language}>
                {languageName(language, appLanguage)}
              </option>
            ))}
          </select>
        </>
      )}
      {error ? <small style={{ color: 'var(--orange)' }}>{error}</small> : null}
      <small style={{ color: 'var(--muted)', flexBasis: '100%' }}>
        Traduction automatique : le texte original reste toujours disponible.
      </small>
    </section>
  );
}
