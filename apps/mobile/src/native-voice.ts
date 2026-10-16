import {NativeModules, PermissionsAndroid, Platform} from 'react-native';
import type {SelectedKnowMeFile} from './native-gallery';

export type RecordedKnowMeVoice = SelectedKnowMeFile & {durationMs:number};
type VoiceBridge = {
  start():Promise<boolean>;
  stop():Promise<RecordedKnowMeVoice>;
  cancel():Promise<boolean>;
  play(uri:string):Promise<boolean>;
  stopPlayback():Promise<boolean>;
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
export async function stopKnowMeVoicePlayback():Promise<void> {
  await bridge().stopPlayback();
}
export async function discardKnowMeVoice(uri:string):Promise<void> {
  await bridge().discardFile(uri);
}
