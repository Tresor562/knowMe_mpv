import { Image, Text, View } from 'react-native';
import { useRuntimeBadge } from '../RuntimeExperienceProvider';

/** Original KnowMe gold certification seal, shared with the Web badge artwork. */
export function GoldVerifiedBadge({
  size = 22,
  label = 'Compte officiel certifié KnowMe'
}: {
  size?: number;
  label?: string;
}) {
  const badge = useRuntimeBadge('staff_gold');
  if (badge && (badge.color.toUpperCase() !== '#E5AD31' || badge.symbol !== 'check')) {
    return <View accessible accessibilityRole="image" accessibilityLabel={label} style={{
      width:size,height:size,flexShrink:0,alignItems:'center',justifyContent:'center',
      backgroundColor:badge.color,borderRadius:size*.44
    }}><Text allowFontScaling={false} style={{color:'#fff',fontSize:size*.7,fontWeight:'900',includeFontPadding:false}}>
      {badge.symbol === 'star' ? '★' : badge.symbol === 'spark' ? '✦' : '✓'}
    </Text></View>;
  }
  return (
    <Image
      source={require('../../assets/branding/knowme-verified-gold.png')}
      style={{ width: size, height: size, flexShrink: 0 }}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    />
  );
}
