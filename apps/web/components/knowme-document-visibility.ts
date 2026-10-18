import { useSyncExternalStore } from 'react';

// One document visibility listener shared by every KnowMe animated glyph.
// Presentation motion is optional; the underlying feature remains active.
const subscribers = new Set<() => void>();
const onVisibilityChange = () => subscribers.forEach(notify => notify());

function subscribe(notify: () => void) {
  subscribers.add(notify);
  if (subscribers.size === 1 && typeof document !== 'undefined')
    document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    subscribers.delete(notify);
    if (!subscribers.size && typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
function getSnapshot() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}
function getServerSnapshot() { return true; }

export function useKnowMeDocumentVisible() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
