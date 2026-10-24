import {useEffect,useState} from 'react';
import {AppState,Platform,requireNativeComponent,View,type NativeSyntheticEvent} from 'react-native';
import {shouldSuspendVideo} from './video-lifecycle';

export type VideoProgress = {positionMs:number;durationMs:number};
type Props={
  sourceUri:string;
  style?:object;
  paused?:boolean;
  nativeControls?:boolean;
  resizeMode?:'contain'|'cover';
  seekToMs?:number;
  onProgress?:(event:NativeSyntheticEvent<VideoProgress>)=>void;
  onPlaybackError?:(event:NativeSyntheticEvent<{message:string}>)=>void;
  onPlaybackComplete?:(event:NativeSyntheticEvent<{durationMs:number}>)=>void;
};
const AndroidPlayer=requireNativeComponent<Props>('KnowMeStoryVideoView');

export function NativeStoryVideo({sourceUri,paused=false,nativeControls=true,resizeMode='contain',style,seekToMs,onProgress,onPlaybackError,onPlaybackComplete}:Props){
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
    paused={shouldSuspendVideo(paused,appState)} nativeControls={nativeControls}
    resizeMode={resizeMode}
    style={style} seekToMs={seekToMs}
    onProgress={onProgress} onPlaybackError={onPlaybackError}
    onPlaybackComplete={onPlaybackComplete}/>;
}
