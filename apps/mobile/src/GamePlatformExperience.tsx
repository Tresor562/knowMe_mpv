import { StyleSheet, View } from 'react-native';
import { AffinityGameExperience } from './AffinityGameExperience';
import { PulseDuelExperience } from './PulseDuelExperience';

export function GamePlatformExperience() {
  return (
    <View style={styles.stack}>
      <PulseDuelExperience />
      <AffinityGameExperience />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 }
});
