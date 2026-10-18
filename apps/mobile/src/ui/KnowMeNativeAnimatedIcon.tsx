import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing } from 'react-native';
import { useAppearance } from '../AppearanceProvider';
import {
  nativeIconChanged, nativeIconShouldLoop, nativeVisibleGlyph,
  nativeIconProgress, type NativeIconOperationState
} from './native-icon-motion-model';
import {
  KnowMeIcon, type KnowMeIconName, useKnowMeSystemReducedMotion
} from './KnowMeUI';

export type NativeAnimatedIconProps = {
  name: KnowMeIconName;
  state?: NativeIconOperationState;
  size?: number;
  color?: string;
  strokeWidth?: number;
  progress?: number | null;
  eventToken?: string | number | null;
};

/**
 * Native-driver animation around the original Android KnowMeIcon family.
 * The caller owns the real persisted/API state. This wrapper is deliberately
 * not a replacement for react-native-svg vector paths (pending dependency).
 */
export function KnowMeNativeAnimatedIcon({
  name, state = 'idle', size = 22, color,
  strokeWidth = 1.8, progress = null, eventToken = null
}: NativeAnimatedIconProps) {
  const { appearance, colors } = useAppearance();
  const reducedMotion = useKnowMeSystemReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const value = useRef(new Animated.Value(1)).current;
  const old = useRef({ name, state, eventToken });
  const initialized = useRef(false);
  const animation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const listener = AppState.addEventListener('change', status => setForeground(status === 'active'));
    return () => listener.remove();
  }, []);

  const enabled = foreground && !reducedMotion &&
    appearance?.preference.animationsEnabled !== false &&
    appearance?.preference.animatedIconsEnabled !== false;

  useEffect(() => {
    animation.current?.stop();
    animation.current = null;

    const next = { name, state, eventToken };
    const changed = nativeIconChanged(old.current, next);
    old.current = next;
    if (!initialized.current) {
      initialized.current = true;
      value.setValue(1);
      return;
    }
    if (!enabled) { value.setValue(1); return; }
    if (nativeIconShouldLoop(state)) {
      value.setValue(0);
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 850,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 850,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ]));
      animation.current = loop;
      loop.start();
    } else if (changed) {
      value.setValue(0);
      const transition = Animated.timing(value, {
        toValue: 1, duration: 260, easing: Easing.out(Easing.back(1.25)),
        useNativeDriver: true
      });
      animation.current = transition;
      transition.start();
    } else {
      value.setValue(1);
    }
    return () => {
      animation.current?.stop();
      animation.current = null;
    };
  }, [name, state, eventToken, enabled, value]);

  const effectiveName = nativeVisibleGlyph(name, state) as KnowMeIconName;
  const selectedHeart = name === 'heart' && state === 'selected';
  const effectiveColor = selectedHeart ? '#ef3340'
    : state === 'error' ? colors.danger
    : state === 'success' ? colors.accent
    : color ?? colors.text;

  const scale = value.interpolate({
    inputRange: [0, .55, 1],
    outputRange: [state === 'selected' ? .82 : .95, 1.10, 1]
  });
  const translateY = value.interpolate({
    inputRange: [0, 1],
    outputRange: [name === 'download' ? -2 : name === 'refresh' ? 0 : 1, 0]
  });
  const rotate = value.interpolate({
    inputRange: [0, 1],
    outputRange: [name === 'settings' || name === 'refresh' ? '-12deg' : '0deg', '0deg']
  });
  const realProgress = nativeIconProgress(state, progress);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size, height: size, alignItems: 'center', justifyContent: 'center',
        transform: enabled ? [{ scale }, { translateY }, { rotate }] : undefined
      }}>
      <KnowMeIcon name={effectiveName} size={size} color={effectiveColor} strokeWidth={strokeWidth}/>
      {realProgress !== null && (
        <Animated.View style={{
          position: 'absolute', bottom: -3, left: 2, right: 2, height: 2,
          borderRadius: 2, backgroundColor: colors.border
        }}>
          <Animated.View style={{ height: 2, borderRadius: 2, backgroundColor: colors.accent,
            width: `${Math.round(realProgress * 100)}%` }} />
        </Animated.View>
      )}
    </Animated.View>
  );
}
