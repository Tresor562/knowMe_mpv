import {NativeModules, PermissionsAndroid, Platform} from 'react-native';
import type {SelectedKnowMeFile} from './native-gallery';

export type RecordedKnowMeVoice = SelectedKnowMeFile & {durationMs:number};
type VoiceBridge = {
  start():Promise<boolean>;
  stop():Promise<RecordedKnowMeVoice>;
  cancel():Promise<boolean>;
  play(uri:string):Promise<boolean>;
  stopPlayback():Promise<boolean>;
  pausePlayback?():Promise<boolean>;
  resumePlayback?():Promise<boolean>;
  playbackStatus?():Promise<{playing:boolean;durationMs:number;positionMs:number;uri:string|null}>;
  seekPlayback?(positionMs:number):Promise<boolean>;
  discardFile(uri:string):Promise<boolean>;
};
function bridge():VoiceBridge {
  const module=NativeModules.KnowMeVoice as VoiceBridge|undefined;
  if(Platform.OS!=='android'||!module) {
    throw new Error('Le microphone KnowMe exige une nouvelle APK native.');
  }
  if(Number(Platform.Version)<29) {
    throw new Error('Les notes vocales Ogg nécessitent Android 10 ou plus.');
  }
  return module;
}

export async function startKnowMeVoice():Promise<void> {
  const native=bridge();
  const permission=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if(permission!==PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Autorisation microphone refusée. Active-la dans les paramètres Android.');
  }
  await native.start();
}
export async function stopKnowMeVoice():Promise<RecordedKnowMeVoice> {
  return bridge().stop();
}
export async function cancelKnowMeVoice():Promise<void> {
  await bridge().cancel();
}
export async function playKnowMeVoice(uri:string):Promise<void> {
  await bridge().play(uri);
}
/** Optional for installed older APKs; never silently reinterpret stop as pause. */
export async function pauseKnowMeVoicePlayback():Promise<void> {
  const native=bridge();
  if(!native.pausePlayback)throw new Error('La pause vocale nécessite la nouvelle APK KnowMe.');
  await native.pausePlayback();
}
export async function resumeKnowMeVoicePlayback():Promise<void> {
  const native=bridge();
  if(!native.resumePlayback)throw new Error('La reprise vocale nécessite la nouvelle APK KnowMe.');
  await native.resumePlayback();
}
export async function stopKnowMeVoicePlayback():Promise<void> {
  await bridge().stopPlayback();
}
export async function discardKnowMeVoice(uri:string):Promise<void> {
  await bridge().discardFile(uri);
}

/** Optional on older installed APKs; future Android builds expose exact position. */
export async function getKnowMeVoicePlaybackStatus() {
  const native=bridge();
  if(!native.playbackStatus)return null;
  return native.playbackStatus();
}
export async function seekKnowMeVoicePlayback(positionMs:number):Promise<void> {
  const native=bridge();
  if(!native.seekPlayback)throw new Error('La recherche audio nécessite la nouvelle version de KnowMe.');
  await native.seekPlayback(positionMs);
}
