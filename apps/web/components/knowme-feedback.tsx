'use client';
import { useEffect, useRef, useState } from 'react';
type Dialog = { kind: 'confirm' | 'prompt'; message: string; initial?: string; resolve: (answer: boolean | string | null) => void };
type Toast = { text: string; tone: 'info' | 'success' | 'error' };
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
  const [toast, setToast] = useState<Toast | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const currentQueue = useRef<Dialog[]>([]);
  const active = queue[0];
  useEffect(() => { currentQueue.current = queue; }, [queue]);
  useEffect(() => {
    const handler = (item: Dialog) => setQueue(previous => [...previous, item]);
    dispatch = handler;
    showToast = setToast;
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
    box.current?.querySelector<HTMLElement>('input,button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        active.resolve(active.kind === 'confirm' ? false : null);
        setQueue(items => items.slice(1));
      }
      if (event.key === 'Tab') {
        const controls = [...(box.current?.querySelectorAll<HTMLElement>('input,button') ?? [])];
        if (controls.length && event.shiftKey && document.activeElement === controls[0]) {
          event.preventDefault(); controls[controls.length - 1].focus();
        } else if (controls.length && !event.shiftKey && document.activeElement === controls[controls.length - 1]) {
          event.preventDefault(); controls[0].focus();
        }
      }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('keydown', keydown);
      document.body.style.overflow = scroll;
      previous?.focus();
    };
  }, [active]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
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
          <span className="km-feedback-symbol" aria-hidden="true">✦</span>
          <div><small>KNOWME</small><h2 id="km-feedback-title">{active.kind === 'prompt'
            ? en ? 'Edit' : 'Modifier' : en ? 'Confirmation' : 'Confirmation'}</h2></div>
        </div>
        <p id="km-feedback-description">{active.message}</p>
        {active.kind === 'prompt' ? <form onSubmit={e => { e.preventDefault(); finish(true); }}>
          <label htmlFor="km-feedback-input">{en ? 'Value' : 'Valeur'}</label>
          <input id="km-feedback-input" className="km-feedback-input" autoComplete="off"
            value={value} maxLength={160} onChange={e => setValue(e.target.value)} />
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
    {toast ? <div className={'km-feedback-toast km-feedback-' + toast.tone} role="status">
      <span aria-hidden="true">✦</span><span>{toast.text}</span>
      <button aria-label="Fermer" onClick={() => setToast(null)}>×</button>
    </div> : null}
  </>;
}
