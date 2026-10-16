import { Image } from 'react-native';

/** Original KnowMe gold certification seal, shared with the Web badge artwork. */
export function GoldVerifiedBadge({
  size = 22,
  label = 'Compte officiel certifié KnowMe'
}: {
  size?: number;
  label?: string;
}) {
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
