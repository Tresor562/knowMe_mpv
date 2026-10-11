import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { findKnowMeCustomEmoji } from '@knowme/animation-contract';

/**
 * Native, dependency-free KnowMe Motion illustration renderer.
 * First-party shapes, short native-driver motion and static accessibility fallback.
 * No remote downloads, Telegram assets, or executable animation payloads.
 */
export function KnowMeCustomEmoji({
  packKey, stickerKey, size = 72
}: { packKey: string; stickerKey: string; size?: number }) {
  const item = findKnowMeCustomEmoji(packKey, stickerKey);
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useRef(false);
  const play = useCallback(() => {
    if (!item || reduced.current) return;
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 850, useNativeDriver: true }).start();
  }, [item, progress]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(flag => {
      if (!mounted) return;
      reduced.current = flag;
      if (!flag) play();
    }).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', flag => {
      reduced.current = flag;
      if (flag) { progress.stopAnimation();progress.setValue(0); }
    });
    return () => { mounted=false;listener.remove();progress.stopAnimation(); };
  }, [play, progress]);

  if (!item) return null;
  const scale = progress.interpolate({
    inputRange:[0,.25,.5,.75,1],
    outputRange:item.motion==='heartbeat'?[1,1.2,.94,1.12,1]:[.95,1.12,.98,1.04,1]
  });
  const translateY = progress.interpolate({
    inputRange:[0,.25,.5,.75,1],
    outputRange:item.motion==='bounce'?[0,-8,2,-3,0]:[0,0,0,0,0]
  });
  const rotate = progress.interpolate({
    inputRange:[0,.25,.5,.75,1],
    outputRange:item.motion==='wiggle'
      ? ['0deg','-12deg','12deg','-6deg','0deg']
      : ['0deg','0deg','0deg','0deg','0deg']
  });
  const dim=size;
  const cx=dim/2;
  const iconColor = item.key==='pulse-heart'?'#FA579B'
    :item.key==='galaxy-smile'?'#E6BCFF'
    :item.key==='neon-flame'?'#FF9479'
    :'#74DBF4';
  const dot=(diameter:number,left:number,top:number,fill:string) => (
    <View style={{position:'absolute',left,top,width:diameter,height:diameter,
      borderRadius:diameter/2,backgroundColor:fill}}/>
  );
  const art = item.key==='pulse-heart'
    ? <>
      <View style={{position:'absolute',width:dim*.48,height:dim*.48,
        left:dim*.26,top:dim*.35,backgroundColor:iconColor,
        transform:[{rotate:'-45deg'}]}}/>
      {dot(dim*.48,dim*.13,dim*.18,iconColor)}
      {dot(dim*.48,dim*.39,dim*.18,iconColor)}
      {dot(dim*.095,dim*.07,dim*.08,'#B3FFED')}
      {dot(dim*.07,dim*.88,dim*.7,'#B3FFED')}
      </>
    : item.key==='prism-star' ? <>
      <Text style={{fontSize:dim*.85,color:'#7CE7F7',lineHeight:dim,
        textShadowColor:'#DDFDFF',textShadowRadius:4}}>✦</Text>
      {dot(dim*.1,dim*.12,dim*.15,'#E5ADFF')}
      {dot(dim*.08,dim*.8,dim*.76,'#DDA9FD')}
      </>
    : item.key==='orbit-spark' ? <>
      <View style={{position:'absolute',left:dim*.06,top:dim*.34,width:dim*.88,height:dim*.36,
        borderWidth:Math.max(1,dim*.035),borderRadius:dim*.5,borderColor:'#85EAE6',
        transform:[{rotate:'-31deg'}]}}/>
      <View style={{position:'absolute',left:dim*.06,top:dim*.34,width:dim*.88,height:dim*.36,
        borderWidth:Math.max(1,dim*.035),borderRadius:dim*.5,borderColor:'#B49AFF',
        transform:[{rotate:'57deg'}]}}/>
      <Text style={{fontSize:dim*.63,color:'#C6FAFF',lineHeight:dim*.82}}>✦</Text>
      {dot(dim*.1,dim*.79,dim*.28,'#FFBAF8')}
      </>
    : item.key==='galaxy-smile' ? <>
      <View style={{width:dim*.76,height:dim*.76,borderRadius:dim*.4,
        backgroundColor:iconColor,borderColor:'#E9FEFF',borderWidth:dim*.03}}>
        {dot(dim*.085,dim*.22,dim*.28,'#3B416B')}
        {dot(dim*.085,dim*.53,dim*.28,'#3B416B')}
        <View style={{position:'absolute',width:dim*.39,height:dim*.22,
          left:dim*.16,top:dim*.38,borderBottomColor:'#40456E',
          borderBottomWidth:dim*.06,borderRadius:dim*.24}}/>
      </View>
      {dot(dim*.07,dim*.09,dim*.09,'#FFDC94')}
      </>
    : item.key==='neon-flame' ? <>
      <View style={{width:dim*.57,height:dim*.72,marginTop:dim*.12,
        backgroundColor:'#FF8A82',borderRadius:dim*.3,
        transform:[{rotate:'24deg'}],alignItems:'center',justifyContent:'flex-end'}}>
        <View style={{width:dim*.22,height:dim*.42,backgroundColor:'#FFE4A1',
          borderTopLeftRadius:dim*.14,borderTopRightRadius:dim*.07,
          borderBottomLeftRadius:dim*.15,borderBottomRightRadius:dim*.15,
          marginBottom:dim*.045}}/>
      </View>
      <Text style={{position:'absolute',left:dim*.52,top:dim*.015,
        color:'#FFC984',fontSize:dim*.3}}>✦</Text>
      </>
    : <>
      <View style={{width:dim*.43,height:dim*.67,backgroundColor:'#79DFF0',
        borderTopLeftRadius:dim*.3,borderTopRightRadius:dim*.3,
        borderBottomLeftRadius:dim*.08,borderBottomRightRadius:dim*.08,
        transform:[{rotate:'35deg'}],borderColor:'#E6FBFF',
        borderWidth:dim*.03,alignItems:'center'}}>
        <View style={{marginTop:dim*.18,width:dim*.21,height:dim*.21,borderRadius:dim*.11,
          borderWidth:dim*.045,borderColor:'#E5F7FF',backgroundColor:'#4985C6'}}/>
      </View>
      <Text style={{position:'absolute',left:dim*.11,top:dim*.58,
        fontSize:dim*.35,color:'#FFAA82'}}>✦</Text>
      </>;

  return <Pressable onPress={play} accessibilityRole="button"
    accessibilityLabel={`Animer ${item.label}`}
    style={{width:dim+8,height:dim+8,justifyContent:'center',alignItems:'center'}}>
    <Animated.View style={{width:dim,height:dim,alignItems:'center',justifyContent:'center',
      transform:[{scale},{translateY},{rotate}]}}>
      <View style={[StyleSheet.absoluteFill,{borderRadius:dim/2,
        backgroundColor:'rgba(54,210,207,.10)'}]}/>
      {art}
    </Animated.View>
  </Pressable>;
}
