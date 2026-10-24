import {Platform,requireNativeComponent,View,type StyleProp,type ViewStyle} from 'react-native';

/** First real MP4 frame; public URLs only, bounded background extraction. */
const AndroidStill=requireNativeComponent<{sourceUri:string;style?:StyleProp<ViewStyle>}>('KnowMePublicVideoStill');

export function NativePublicVideoStill({sourceUri,style}:{
  sourceUri:string;style?:StyleProp<ViewStyle>;
}){
  if(Platform.OS!=='android')return <View style={style}/>;
  return <AndroidStill sourceUri={sourceUri} style={style}/>;
}
