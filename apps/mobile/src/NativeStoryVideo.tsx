import {useEffect,useState} from 'react';
import {AppState,Platform,requireNativeComponent,View,type NativeSyntheticEvent} from 'react-native';
import {shouldSuspendVideo} from './video-lifecycle';

export type VideoProgress = {positionMs:number;durationMs:number};
type Props={
  sourceUri:string;
  style?:object;
  paused?:boolean;
  seekToMs?:number;
  onProgress?:(event:NativeSyntheticEvent<VideoProgress>)=>void;
  onPlaybackError?:(event:NativeSyntheticEvent<{message:string}>)=>void;
};
const AndroidPlayer=requireNativeComponent<Props>('KnowMeStoryVideoView');

export function NativeStoryVideo({sourceUri,paused=false,style,seekToMs,onProgress,onPlaybackError}:Props){
  const [appState,setAppState]=useState<string|null>(AppState.currentState);
  useEffect(()=>{
    if(Platform.OS!=='android')return;
    // Applies to stories, Reels and feed videos alike. Do not play in the
    // background; a manually paused video stays paused on return.
    const subscription=AppState.addEventListener('change',setAppState);
    return ()=>subscription.remove();
  },[]);
  if(Platform.OS!=='android')return <View style={style}/>;
  return <AndroidPlayer sourceUri={sourceUri}
    paused={shouldSuspendVideo(paused,appState)}
    style={style} seekToMs={seekToMs}
    onProgress={onProgress} onPlaybackError={onPlaybackError}/>;
}
