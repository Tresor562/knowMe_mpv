import { StyleSheet, View } from 'react-native';
import { AffinityGameExperience } from './AffinityGameExperience';
import { PulseDuelExperience } from './PulseDuelExperience';
import { SocialMatchmakingExperience } from './SocialMatchmakingExperience';

export function GamePlatformExperience() {
  return (
    <View style={styles.stack}>
      <PulseDuelExperience />
      <AffinityGameExperience />
      <SocialMatchmakingExperience />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 }
});
