import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DockPosition } from './navigation-dock-model';

const KEY = 'knowme.navigation.dock.v1';
export type DockPreferences = {position:DockPosition; autoHide:boolean};
export const DEFAULT_DOCK_PREFERENCES: DockPreferences = { position:'bottom',autoHide:true };

export async function loadDockPreferences(): Promise<DockPreferences> {
  try {
    const raw=await AsyncStorage.getItem(KEY);
    if(!raw)return DEFAULT_DOCK_PREFERENCES;
    const value:unknown=JSON.parse(raw);
    if(!value||typeof value!=='object')return DEFAULT_DOCK_PREFERENCES;
    const prefs=value as Record<string, unknown>;
    return {
      position:prefs.position==='top'?'top':'bottom',
      autoHide:typeof prefs.autoHide==='boolean'?prefs.autoHide:true
    };
  } catch {
    return DEFAULT_DOCK_PREFERENCES;
  }
}

export async function saveDockPreferences(preferences: DockPreferences) {
  await AsyncStorage.setItem(KEY,JSON.stringify(preferences));
}
