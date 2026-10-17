import { Text, View } from 'react-native';

/** Blue scalloped certification seal, inspired by the familiar Meta verified shape.
 * KnowMe certification is independent of any third-party identity service.
 */
export function BlueVerifiedBadge({
  size = 21,
  label = 'Compte certifié KnowMe'
}: { size?: number; label?: string }) {
  // Four softly rounded squares, 22.5 degrees apart, form a 16-lobed blue seal.
  // Unlike emoji/font glyphs this renders reliably in both themes on Android.
  const side = size * 0.78;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}
      style={{width:size,height:size,flexShrink:0,alignItems:'center',justifyContent:'center'}}>
      {[0,22.5,45,67.5].map(rotation => (
        <View key={rotation} style={{
          position:'absolute',width:side,height:side,
          borderRadius:side * 0.22,backgroundColor:'#1877F2',
          transform:[{rotate:rotation + 'deg'}]
        }}/>
      ))}
      <Text allowFontScaling={false} style={{
        color:'#FFFFFF',fontWeight:'900',fontSize:size*0.67,
        textAlign:'center',includeFontPadding:false,marginTop:-size*0.07
      }}>✓</Text>
    </View>
  );
}
