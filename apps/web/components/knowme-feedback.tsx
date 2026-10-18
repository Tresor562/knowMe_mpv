'use client';
import { useEffect, useRef, useState } from 'react';
import { wrappedDialogFocus } from './dialog-focus';
import { enqueueNotice } from './toast-queue';
import { KnowMeGlyph } from './knowme-glyph';
import { KnowMeIconButton } from './knowme-icon-button';
type Dialog = { kind: 'confirm' | 'prompt'; message: string; initial?: string; resolve: (answer: boolean | string | null) => void };
type Toast = { text: string; tone: 'info' | 'success' | 'error' };
type QueuedToast = Toast & { id: number };
let nextToastId = 0;
let dispatch: ((dialog: Dialog) => void) | null = null;
let showToast: ((toast: Toast) => void) | null = null;

export function knowMeConfirm(message: string): Promise<boolean> {
  return new Promise(resolve => {
    if (!dispatch) return resolve(false);
    dispatch({ kind: 'confirm', message, resolve: value => resolve(value === true) });
  });
}
export function knowMePrompt(message: string, initial = ''): Promise<string | null> {
  return new Promise(resolve => {
    if (!dispatch) return resolve(null);
    dispatch({ kind: 'prompt', message, initial, resolve: value => resolve(typeof value === 'string' ? value : null) });
  });
}
export function knowMeToast(text: string, tone: Toast['tone'] = 'info') { showToast?.({ text, tone }); }

export function KnowMeDialogHost() {
  const [queue, setQueue] = useState<Dialog[]>([]);
  const [value, setValue] = useState('');
  const [toastQueue, setToastQueue] = useState<QueuedToast[]>([]);
  const [toastPaused, setToastPaused] = useState(false);
  const toast = toastQueue[0] ?? null;
  const box = useRef<HTMLDivElement>(null);
  const currentQueue = useRef<Dialog[]>([]);
  const active = queue[0];
  useEffect(() => { currentQueue.current = queue; }, [queue]);
  useEffect(() => {
    const handler = (item: Dialog) => setQueue(previous => [...previous, item]);
    dispatch = handler;
    showToast = (next) => setToastQueue((previous) => {
      // A burst of identical errors should not bury the user in alerts.
      return enqueueNotice(previous, { ...next, id: ++nextToastId }, 4);
    });
    return () => {
      if (dispatch === handler) dispatch = null;
      showToast = null;
      currentQueue.current.forEach(item => item.resolve(item.kind === 'confirm' ? false : null));
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    setValue(active.initial ?? '');
    const previous = document.activeElement as HTMLElement | null;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => Array.from(
      box.current?.querySelectorAll<HTMLElement>('input,textarea,button,[href],[tabindex]:not([tabindex="-1"])') ?? []
    ).filter((element) => !element.hasAttribute('disabled') && element.getClientRects().length > 0);
    const focusFirst = () => controls()[0]?.focus();
    focusFirst();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        active.resolve(active.kind === 'confirm' ? false : null);
        setQueue(items => items.slice(1));
      }
      if (event.key === 'Tab') {
        const candidates = controls();
        const current = candidates.indexOf(document.activeElement as HTMLElement);
        const next = wrappedDialogFocus(candidates.length, current, event.shiftKey);
        if (next !== null) {
          event.preventDefault();
          candidates[next]?.focus();
        }
      }
    };
    const keepFocusInside = (event: FocusEvent) => {
      if (box.current && event.target instanceof Node && !box.current.contains(event.target)) {
        focusFirst();
      }
    };
    window.addEventListener('keydown', keydown);
    document.addEventListener('focusin', keepFocusInside);
    return () => {
      window.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', keepFocusInside);
      document.body.style.overflow = scroll;
      previous?.focus();
    };
  }, [active]);
  useEffect(() => {
    if (!toast || toastPaused) return;
    // Errors need longer reading time than an ordinary success confirmation.
    const timer = setTimeout(() => setToastQueue((items) => items.slice(1)),
      toast.tone === 'error' ? 8000 : 5000);
    return () => clearTimeout(timer);
  }, [toast?.id, toast?.tone, toastPaused]);
  const finish = (accepted: boolean) => {
    if (!active) return;
    active.resolve(active.kind === 'confirm' ? accepted : accepted ? value.trim() : null);
    setQueue(previous => previous.slice(1));
  };
  const en = typeof document !== 'undefined' && document.documentElement.lang === 'en';
  return <>
    {active ? <div className="km-feedback-backdrop" onMouseDown={e => {
      if (e.target === e.currentTarget) finish(false);
    }}>
      <div ref={box} role="dialog" aria-modal="true" className="km-feedback-dialog"
        aria-labelledby="km-feedback-title" aria-describedby="km-feedback-description">
        <div className="km-feedback-head">
          <span className="km-feedback-symbol" aria-hidden="true"><KnowMeGlyph name="shield" size={23}/></span>
          <div><small>KNOWME</small><h2 id="km-feedback-title">{active.kind === 'prompt'
            ? en ? 'Edit' : 'Modifier' : en ? 'Confirmation' : 'Confirmation'}</h2></div>
        </div>
        <p id="km-feedback-description">{active.message}</p>
        {active.kind === 'prompt' ? <form onSubmit={e => { e.preventDefault(); finish(true); }}>
          <label htmlFor="km-feedback-input">{en ? 'Value' : 'Valeur'}</label>
          <input id="km-feedback-input" className="km-feedback-input" autoComplete="off"
            value={value} onChange={e => setValue(e.target.value)} />
          <div className="km-feedback-actions">
            <button type="button" onClick={() => finish(false)}>{en ? 'Cancel' : 'Annuler'}</button>
            <button type="submit" className="km-feedback-primary" disabled={!value.trim()}>
              {en ? 'Save' : 'Enregistrer'}</button>
          </div>
        </form> : <div className="km-feedback-actions">
          <button onClick={() => finish(false)}>{en ? 'Cancel' : 'Annuler'}</button>
          <button className="km-feedback-primary" onClick={() => finish(true)}>
            {en ? 'Confirm' : 'Confirmer'}</button>
        </div>}
      </div>
    </div> : null}
    {toast ? <div className={'km-feedback-toast km-feedback-' + toast.tone}
      onMouseEnter={() => setToastPaused(true)} onMouseLeave={() => setToastPaused(false)}
      onFocusCapture={() => setToastPaused(true)} onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastPaused(false);
      }}
      role={toast.tone === 'error' ? 'alert' : 'status'} aria-live={toast.tone === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
      <span key={toast.id} className="km-feedback-tone-glyph" aria-hidden="true"><KnowMeGlyph name={toast.tone === 'error'
        ? 'warning' : toast.tone === 'success' ? 'check-circle' : 'info'} size={21}/></span>
      <span>{toast.text}</span>
      <KnowMeIconButton name="close" size={20} label={en ? "Close notification" : "Fermer la notification"}
        onClick={() => { setToastQueue((items) => items.slice(1)); setToastPaused(false); }}/>
    </div> : null}
  </>;
}
