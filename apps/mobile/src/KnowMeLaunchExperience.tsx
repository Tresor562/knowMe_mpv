import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
  useColorScheme
} from 'react-native';
import { hasSession } from './api';
import { MobileEntryExperience } from './MobileEntryExperience';
import { resolveLaunchMotion } from './launch-motion-model';

/**
 * Render the real application immediately. The cover disappears as soon as
 * the local session check finishes; the logo is never an artificial wait.
 * The platform splash remains static, while this is the lightweight animated
 * hand-off after React Native has started.
 */
export function KnowMeLaunchExperience() {
  const scheme = useColorScheme();
  const light = scheme === 'light';
  const palette = light
    ? { background: '#f6f7fc', text: '#1b2543', accent: '#485fd2', glow: '#23b9a2' }
    : { background: '#090e1c', text: '#f1f4ff', accent: '#92a9ff', glow: '#75dbbe' };

  const [sessionChecked, setSessionChecked] = useState(false);
  const [coverVisible, setCoverVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  const logoProgress = useRef(new Animated.Value(0)).current;
  const nameProgress = useRef(new Animated.Value(0)).current;
  const coverOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { if (mounted) setReducedMotion(enabled); })
      .catch(() => { /* Not available on all Android versions. */ });

    // Presence is a local/cache lookup, not a network or authentication gate.
    // The entry experience performs its own state reconciliation underneath.
    void hasSession()
      .catch(() => false)
      .finally(() => { if (mounted) setSessionChecked(true); });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!coverVisible) return;
    const motion = resolveLaunchMotion(reducedMotion);
    const animation = Animated.parallel([
      Animated.timing(logoProgress, {
        toValue: 1,
        duration: motion.enterMs,
        useNativeDriver: true
      }),
      Animated.timing(nameProgress, {
        toValue: 1,
        delay: motion.nameDelayMs,
        duration: motion.enterMs,
        useNativeDriver: true
      })
    ]);
    animation.start();
    return () => animation.stop();
  }, [coverVisible, logoProgress, nameProgress, reducedMotion]);

  useEffect(() => {
    if (!sessionChecked || !coverVisible) return;
    const animation = Animated.timing(coverOpacity, {
      toValue: 0,
      duration: resolveLaunchMotion(reducedMotion).exitMs,
      useNativeDriver: true
    });
    animation.start(({ finished }) => {
      if (finished) setCoverVisible(false);
    });
    return () => animation.stop();
  }, [coverOpacity, coverVisible, reducedMotion, sessionChecked]);

  return (
    <View style={styles.root}>
      <MobileEntryExperience />
      {coverVisible ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLabel="KnowMe"
          style={[styles.cover, { backgroundColor: palette.background, opacity: coverOpacity }]}
        >
          <View style={styles.center}>
            <Animated.View
              style={[
                styles.haloWrap,
                {
                  opacity: logoProgress,
                  transform: [
                    {
                      scale: logoProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.94, 1]
                      })
                    },
                    {
                      translateY: logoProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0]
                      })
                    }
                  ]
                }
              ]}
            >
              <View style={[styles.haloOuter, { borderColor: palette.accent }]} />
              <View style={[styles.haloInner, { backgroundColor: palette.glow }]} />
              <Image
                source={require('../assets/branding/knowme-icon.png')}
                resizeMode="contain"
                style={styles.logo}
                accessibilityLabel="Logo KnowMe"
                accessibilityRole="image"
              />
            </Animated.View>
            <Animated.Text
              style={[
                styles.wordmark,
                {
                  color: palette.text,
                  opacity: nameProgress,
                  transform: [
                    {
                      translateY: nameProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [9, 0]
                      })
                    }
                  ]
                }
              ]}
            >
              KnowMe
            </Animated.Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  haloWrap: {
    width: 156,
    height: 156,
    alignItems: 'center',
    justifyContent: 'center'
  },
  haloOuter: {
    position: 'absolute',
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 1,
    opacity: 0.24
  },
  haloInner: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    opacity: 0.11
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 22
  },
  wordmark: {
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.7,
    marginTop: 4
  }
});
