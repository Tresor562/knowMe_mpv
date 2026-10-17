import { Text, View } from 'react-native';

/**
 * KnowMe blue certified badge. Original rounded eight-point seal, displayed
 * only when the server returns verification.isVerified === true.
 */
export function BlueVerifiedBadge({
  size = 21,
  label = 'Compte certifié KnowMe'
}: { size?: number; label?: string }) {
  const face = Math.round(size * 0.77);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{width:size,height:size,flexShrink:0,alignItems:'center',justifyContent:'center'}}
    >
      <View style={{
        position:'absolute',width:face,height:face,
        borderRadius:Math.max(3,Math.round(size*0.13)),
        backgroundColor:'#258CEB',transform:[{rotate:'45deg'}]
      }}/>
      <View style={{
        position:'absolute',width:face,height:face,
        borderRadius:Math.max(3,Math.round(size*0.13)),
        backgroundColor:'#258CEB'
      }}/>
      <Text allowFontScaling={false} style={{
        color:'#fff',fontSize:size*0.65,fontWeight:'900',
        textAlign:'center',includeFontPadding:false,marginTop:-size*0.04
      }}>✓</Text>
    </View>
  );
}
