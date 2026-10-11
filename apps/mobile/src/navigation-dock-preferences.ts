import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DockPlacement } from './navigation-dock-model';

export type DockSettings = {
  placement: DockPlacement;
  autoHide: boolean;
};

const KEY = 'knowme.native.navigation.settings.v1';
const DEFAULT: DockSettings = { placement: 'bottom', autoHide: true };
const listeners = new Set<(value: DockSettings) => void>();
let current: DockSettings = DEFAULT;

export async function loadDockSettings(): Promise<DockSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return current;
    const result = JSON.parse(raw) as Partial<DockSettings>;
    current = {
      placement: result.placement === 'top' ? 'top' : 'bottom',
      autoHide: result.autoHide !== false
    };
    return current;
  } catch {
    return current;
  }
}

export async function saveDockSettings(next: DockSettings): Promise<void> {
  if (next.placement !== 'top' && next.placement !== 'bottom') throw new Error('Placement inconnu');
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  current = next;
  for (const listener of listeners) listener(current);
}

export function listenDockSettings(listener: (value: DockSettings) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
