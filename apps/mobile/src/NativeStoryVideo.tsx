import { Platform, requireNativeComponent, View, type NativeSyntheticEvent } from 'react-native';

export type VideoProgress = {positionMs:number;durationMs:number};
type Props={
  sourceUri:string;
  style?:object;
  paused?:boolean;
  seekToMs?:number;
  onProgress?:(event:NativeSyntheticEvent<VideoProgress>)=>void;
};
const AndroidPlayer=requireNativeComponent<Props>('KnowMeStoryVideoView');

export function NativeStoryVideo({sourceUri,paused=false,style,seekToMs,onProgress}:Props) {
  if(Platform.OS!=='android')return <View style={style}/>;
  return <AndroidPlayer sourceUri={sourceUri} paused={paused} style={style}
    seekToMs={seekToMs} onProgress={onProgress}/>;
}
