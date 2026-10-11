import { Platform, requireNativeComponent, View } from 'react-native';

type Props={sourceUri:string;style?:object;paused?:boolean};
const AndroidPlayer=requireNativeComponent<Props>('KnowMeStoryVideoView');

export function NativeStoryVideo({sourceUri,paused=false,style}:Props) {
  if(Platform.OS!=='android')return <View style={style}/>;
  return <AndroidPlayer sourceUri={sourceUri} paused={paused} style={style}/>;
}
