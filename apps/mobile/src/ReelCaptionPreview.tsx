import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * The "...more" affordance is based on real native line wrapping, never on
 * a character-count guess. This also handles emoji, CJK and accessibility fonts.
 */
export function ReelCaptionPreview({content,en,onExpand}:{
  content:string;en:boolean;onExpand:()=>void;
}) {
  const [overflow,setOverflow]=useState(false);
  useEffect(()=>setOverflow(false),[content]);
  if(!content.trim())return null;
  return <View style={styles.root}>
    <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      onTextLayout={event=>setOverflow(previous=>
        previous===(event.nativeEvent.lines.length>2)?previous:
          event.nativeEvent.lines.length>2)}
      style={styles.measure}>{content}</Text>
    <Pressable disabled={!overflow} accessibilityRole={overflow?'button':undefined}
      accessibilityLabel={overflow?(en?'Read full description':'Voir toute la description'):undefined}
      onPress={onExpand}>
      <Text style={styles.caption} numberOfLines={2}>{content}</Text>
      {overflow&&<Text style={styles.moreText}>{en?'More':'…plus'}</Text>}
    </Pressable>
  </View>;
}
const styles=StyleSheet.create({
  root:{alignSelf:'stretch',position:'relative',minWidth:0},
  measure:{position:'absolute',top:0,left:0,right:0,opacity:0,fontSize:15,
    lineHeight:21,includeFontPadding:false},
  caption:{color:'#fff',fontSize:15,lineHeight:21,includeFontPadding:false,
    textShadowColor:'#000c',textShadowRadius:4},
  moreText:{color:'#c9d8dc',fontSize:12,marginTop:2}
});
