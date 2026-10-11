import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DockPlacement } from './navigation-dock-model';

const KEY = 'knowme.native.navigation.placement.v1';
const listeners = new Set<(value: DockPlacement) => void>();
let current: DockPlacement = 'bottom';

export async function loadDockPlacement(): Promise<DockPlacement> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    current = value === 'top' ? 'top' : 'bottom';
    return current;
  } catch {
    return current;
  }
}

export async function saveDockPlacement(value: DockPlacement) {
  await AsyncStorage.setItem(KEY, value);
  current = value;
  for (const listener of listeners) listener(value);
}

export function listenDockPlacement(listener: (value: DockPlacement) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
