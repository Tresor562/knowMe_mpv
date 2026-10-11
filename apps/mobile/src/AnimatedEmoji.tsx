import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet } from 'react-native';
import { getAnimatedEmojiMotion } from '@knowme/animation-contract';

type Props = {
  glyph: string;
  size?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  autoPlay?: boolean;
};

/**
 * Lightweight native-driver animated emoji. Text is Unicode, so all unsupported
 * devices still render it normally. Motion respects Android's accessibility flag.
 */
export function AnimatedEmoji({ glyph, size = 30, onPress, onLongPress, autoPlay = true }: Props) {
  const motion = getAnimatedEmojiMotion(glyph);
  const progress = useRef(new Animated.Value(0)).current;
  const reduceMotion = useRef(false);
  const animate = useCallback(() => {
    if (!motion || reduceMotion.current) return;
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: motion === 'shake' ? 680 : 980,
      useNativeDriver: true
    }).start();
  }, [motion, progress]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!mounted) return;
      reduceMotion.current = reduced;
      if (autoPlay && !reduced) animate();
    }).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      reduceMotion.current = enabled;
      if (enabled) { progress.stopAnimation(); progress.setValue(0); }
    });
    return () => { mounted = false; listener.remove(); progress.stopAnimation(); };
  }, [animate, autoPlay, progress]);

  const scale = progress.interpolate({
    inputRange: [0, .25, .5, .75, 1],
    outputRange: motion === 'heartbeat' ? [1, 1.2, .96, 1.16, 1]
      : motion === 'pop' ? [.8, 1.24, .95, 1.06, 1]
      : motion === 'twinkle' ? [1, 1.24, .9, 1.1, 1]
      : [1, 1.09, .96, 1.04, 1]
  });
  const translateY = progress.interpolate({
    inputRange: [0, .25, .5, .75, 1],
    outputRange: motion === 'bounce' ? [0, -10, 2, -3, 0] : [0, 0, 0, 0, 0]
  });
  const translateX = progress.interpolate({
    inputRange: [0, .25, .5, .75, 1],
    outputRange: motion === 'shake' ? [0, -5, 5, -3, 0] : [0, 0, 0, 0, 0]
  });
  const rotate = progress.interpolate({
    inputRange: [0, .25, .5, .75, 1],
    outputRange: motion === 'wiggle' ? ['0deg', '-15deg', '13deg', '-7deg', '0deg']
      : ['0deg', '0deg', '0deg', '0deg', '0deg']
  });

  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Animer ${glyph}`}
    onPress={() => { animate(); onPress?.(); }}
    onLongPress={onLongPress}
    style={[styles.touch, { minWidth: Math.max(44, size + 8), minHeight: Math.max(44, size + 8) }]}
  >
    <Animated.Text style={{
      fontSize: size,
      lineHeight: size * 1.26,
      textAlign: 'center',
      transform: [{ scale }, { translateY }, { translateX }, { rotate }]
    }}>{glyph}</Animated.Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  touch: { alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }
});
