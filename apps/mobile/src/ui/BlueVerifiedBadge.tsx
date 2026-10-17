import { Image, Text, View } from 'react-native';
import { useRuntimeBadge } from '../RuntimeExperienceProvider';

/** The blue scalloped KnowMe verified seal is identical in light/dark themes.
 * The rendering is embedded so Android never needs a remote asset request.
 * A KnowMe verification does not imply verification from Meta.
 */
const BLUE_SEAL_URI = 'data:image/png;base64,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';

export function BlueVerifiedBadge({
  size = 21,
  label = 'Compte certifié KnowMe'
}: { size?: number; label?: string }) {
  const badge = useRuntimeBadge('verified_blue');
  if (badge && (badge.color.toUpperCase() !== '#1877F2' || badge.symbol !== 'check')) {
    return <View accessible accessibilityRole="image" accessibilityLabel={label} style={{
      width:size,height:size,flexShrink:0,alignItems:'center',justifyContent:'center',
      backgroundColor:badge.color,borderRadius:size*.44
    }}><Text allowFontScaling={false} style={{color:'#fff',fontSize:size*.7,fontWeight:'900',includeFontPadding:false}}>
      {badge.symbol === 'star' ? '★' : badge.symbol === 'spark' ? '✦' : '✓'}
    </Text></View>;
  }
  return (
    <Image
      source={{ uri:BLUE_SEAL_URI }}
      style={{ width:size, height:size, flexShrink:0 }}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    />
  );
}
