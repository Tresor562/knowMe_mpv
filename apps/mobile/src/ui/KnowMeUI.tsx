import { BlurView } from 'expo-blur';
import { ReactNode, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageStyle,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle
} from 'react-native';
import { useAppearance } from '../AppearanceProvider';

export type KnowMeIconName =
  | 'home'
  | 'discover'
  | 'create'
  | 'messages'
  | 'profile'
  | 'bell'
  | 'spark'
  | 'challenge'
  | 'coins'
  | 'arrow'
  | 'check'
  | 'settings';

export function BrandMark({ size = 38 }: { size?: number }) {
  const unit = size / 38;
  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <View
        style={[
          styles.brandPill,
          {
            width: 11 * unit,
            height: 31 * unit,
            borderRadius: 6 * unit,
            left: 3 * unit,
            top: 3.5 * unit,
            backgroundColor: '#B35CFF',
            transform: [{ rotate: '8deg' }]
          }
        ]}
      />
      <View
        style={[
          styles.brandPill,
          {
            width: 11 * unit,
            height: 25 * unit,
            borderRadius: 6 * unit,
            left: 16 * unit,
            top: 0,
            backgroundColor: '#FF7DB8',
            transform: [{ rotate: '42deg' }]
          }
        ]}
      />
      <View
        style={[
          styles.brandPill,
          {
            width: 11 * unit,
            height: 25 * unit,
            borderRadius: 6 * unit,
            left: 17 * unit,
            top: 16 * unit,
            backgroundColor: '#FFB25C',
            transform: [{ rotate: '-42deg' }]
          }
        ]}
      />
      <View
        style={[
          styles.brandPill,
          {
            width: 9 * unit,
            height: 28 * unit,
            borderRadius: 5 * unit,
            left: 10 * unit,
            top: 5 * unit,
            backgroundColor: '#7D66FF',
            opacity: 0.88
          }
        ]}
      />
    </View>
  );
}

function Line({
  width,
  height = 2,
  left,
  top,
  rotate = '0deg',
  color
}: {
  width: number;
  height?: number;
  left: number;
  top: number;
  rotate?: string;
  color: string;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        width,
        height,
        left,
        top,
        borderRadius: height / 2,
        backgroundColor: color,
        transform: [{ rotate }]
      }}
    />
  );
}

export function KnowMeIcon({
  name,
  size = 22,
  color = '#AEB6C4',
  strokeWidth = 1.8
}: {
  name: KnowMeIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const s = size / 24;
  const sw = strokeWidth * s;
  const commonBorder = { borderColor: color, borderWidth: sw };

  if (name === 'home') {
    return (
      <View style={{ width: size, height: size }}>
        <Line width={10 * s} height={sw} left={3.1 * s} top={7.4 * s} rotate="-38deg" color={color} />
        <Line width={10 * s} height={sw} left={10.9 * s} top={7.4 * s} rotate="38deg" color={color} />
        <View
          style={[
            {
              position: 'absolute',
              left: 5.2 * s,
              top: 9.2 * s,
              width: 13.6 * s,
              height: 11.6 * s,
              borderRadius: 3 * s,
              borderTopWidth: 0
            },
            commonBorder
          ]}
        />
        <View
          style={[
            {
              position: 'absolute',
              left: 10 * s,
              top: 14.1 * s,
              width: 4.2 * s,
              height: 6.4 * s,
              borderRadius: 1.4 * s
            },
            commonBorder
          ]}
        />
      </View>
    );
  }

  if (name === 'discover') {
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={[
            {
              position: 'absolute',
              left: 3.3 * s,
              top: 3.3 * s,
              width: 13.2 * s,
              height: 13.2 * s,
              borderRadius: 7 * s
            },
            commonBorder
          ]}
        />
        <Line width={8 * s} height={sw} left={14.2 * s} top={16.1 * s} rotate="46deg" color={color} />
      </View>
    );
  }

  if (name === 'create') {
    return (
      <View style={{ width: size, height: size }}>
        <Line width={15 * s} height={sw} left={4.5 * s} top={11.1 * s} color={color} />
        <Line width={15 * s} height={sw} left={4.5 * s} top={11.1 * s} rotate="90deg" color={color} />
      </View>
    );
  }

  if (name === 'messages') {
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={[
            {
              position: 'absolute',
              left: 3 * s,
              top: 4 * s,
              width: 18 * s,
              height: 14 * s,
              borderRadius: 5 * s
            },
            commonBorder
          ]}
        />
        <Line width={6 * s} height={sw} left={4.2 * s} top={17.6 * s} rotate="-36deg" color={color} />
        <Line width={6.7 * s} height={sw} left={7.3 * s} top={9 * s} color={color} />
        <Line width={4.8 * s} height={sw} left={7.3 * s} top={12.4 * s} color={color} />
      </View>
    );
  }

  if (name === 'profile') {
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={[
            {
              position: 'absolute',
              left: 7.4 * s,
              top: 3 * s,
              width: 9.2 * s,
              height: 9.2 * s,
              borderRadius: 5 * s
            },
            commonBorder
          ]}
        />
        <View
          style={[
            {
              position: 'absolute',
              left: 4.3 * s,
              top: 13.8 * s,
              width: 15.4 * s,
              height: 7 * s,
              borderRadius: 7 * s,
              borderBottomWidth: 0
            },
            commonBorder
          ]}
        />
      </View>
    );
  }

  if (name === 'bell') {
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={[
            {
              position: 'absolute',
              left: 5.2 * s,
              top: 5 * s,
              width: 13.6 * s,
              height: 13.2 * s,
              borderRadius: 7 * s,
              borderBottomLeftRadius: 4 * s,
              borderBottomRightRadius: 4 * s
            },
            commonBorder
          ]}
        />
        <Line width={14 * s} height={sw} left={5 * s} top={17.5 * s} color={color} />
        <View
          style={{
            position: 'absolute',
            width: 3.5 * s,
            height: 3.5 * s,
            borderRadius: 2 * s,
            left: 10.3 * s,
            top: 19.2 * s,
            backgroundColor: color
          }}
        />
      </View>
    );
  }

  if (name === 'spark') {
    return (
      <View style={{ width: size, height: size }}>
        <Line width={14 * s} height={sw} left={5 * s} top={11 * s} rotate="45deg" color={color} />
        <Line width={14 * s} height={sw} left={5 * s} top={11 * s} rotate="-45deg" color={color} />
        <Line width={9 * s} height={sw} left={7.5 * s} top={11 * s} rotate="90deg" color={color} />
        <Line width={9 * s} height={sw} left={7.5 * s} top={11 * s} color={color} />
      </View>
    );
  }

  if (name === 'challenge') {
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={[
            {
              position: 'absolute',
              left: 4 * s,
              top: 4 * s,
              width: 16 * s,
              height: 16 * s,
              borderRadius: 8 * s
            },
            commonBorder
          ]}
        />
        <Line width={8 * s} height={sw} left={8 * s} top={8 * s} rotate="45deg" color={color} />
        <Line width={8 * s} height={sw} left={8 * s} top={14 * s} rotate="-45deg" color={color} />
      </View>
    );
  }

  if (name === 'coins') {
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={[
            {
              position: 'absolute',
              left: 4 * s,
              top: 4 * s,
              width: 16 * s,
              height: 16 * s,
              borderRadius: 8 * s
            },
            commonBorder
          ]}
        />
        <View
          style={[
            {
              position: 'absolute',
              left: 8 * s,
              top: 7.2 * s,
              width: 8 * s,
              height: 9.6 * s,
              borderRadius: 4.8 * s
            },
            commonBorder
          ]}
        />
      </View>
    );
  }

  if (name === 'arrow') {
    return (
      <View style={{ width: size, height: size }}>
        <Line width={13 * s} height={sw} left={4 * s} top={11 * s} color={color} />
        <Line width={8 * s} height={sw} left={11 * s} top={8.2 * s} rotate="40deg" color={color} />
        <Line width={8 * s} height={sw} left={11 * s} top={13.8 * s} rotate="-40deg" color={color} />
      </View>
    );
  }

  if (name === 'check') {
    return (
      <View style={{ width: size, height: size }}>
        <Line width={8 * s} height={sw} left={3.5 * s} top={12.6 * s} rotate="42deg" color={color} />
        <Line width={13 * s} height={sw} left={8.3 * s} top={10.6 * s} rotate="-46deg" color={color} />
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          {
            position: 'absolute',
            left: 4 * s,
            top: 4 * s,
            width: 16 * s,
            height: 16 * s,
            borderRadius: 8 * s
          },
          commonBorder
        ]}
      />
      <View
        style={{
          position: 'absolute',
          left: 10 * s,
          top: 10 * s,
          width: 4 * s,
          height: 4 * s,
          borderRadius: 2 * s,
          backgroundColor: color
        }}
      />
    </View>
  );
}

export function PressScale({
  children,
  onPress,
  disabled = false,
  style,
  accessibilityRole,
  accessibilityLabel
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: PressableProps['accessibilityRole'];
  accessibilityLabel?: string;
}) {
  const { appearance } = useAppearance();
  const value = useRef(new Animated.Value(1)).current;
  const motion = appearance?.preference.animationsEnabled !== false;

  function to(next: number) {
    if (!motion) return;
    Animated.spring(value, {
      toValue: next,
      useNativeDriver: true,
      speed: 28,
      bounciness: 2
    }).start();
  }

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
    >
      <Animated.View
        style={[
          style,
          motion ? { transform: [{ scale: value }] } : null,
          disabled ? { opacity: 0.45 } : null
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function FadeRise({
  children,
  delay = 0,
  distance = 10,
  style
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { appearance, visual } = useAppearance();
  const enabled = appearance?.preference.animationsEnabled !== false;
  const progress = useRef(new Animated.Value(enabled ? 0 : 1)).current;

  useEffect(() => {
    if (!enabled) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: visual.transitionDuration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [delay, enabled, progress, visual.transitionDuration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0]
              })
            }
          ]
        }
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function Avatar({
  uri,
  name,
  size = 42,
  ring = false,
  style
}: {
  uri?: string | null;
  name: string;
  size?: number;
  ring?: boolean;
  style?: StyleProp<ImageStyle>;
}) {
  const initial = (name.trim()[0] || 'K').toUpperCase();
  const { colors } = useAppearance();

  const body = uri ? (
    <Image
      source={{ uri }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceRaised
        },
        style
      ]}
    />
  ) : (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#24233B',
          alignItems: 'center',
          justifyContent: 'center'
        }
      ]}
    >
      <Text
        style={{
          color: '#F6F2FF',
          fontWeight: '900',
          fontSize: Math.max(14, size * 0.38)
        }}
      >
        {initial}
      </Text>
    </View>
  );

  if (!ring) return body;

  return (
    <View
      style={{
        width: size + 6,
        height: size + 6,
        borderRadius: (size + 6) / 2,
        borderWidth: 2,
        borderColor: '#B45CFF',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {body}
    </View>
  );
}



const CHAT_WALLPAPER_POINTS = [
  { left: '5%', top: '6%', rotate: '-12deg', scale: 0.86 },
  { left: '34%', top: '4%', rotate: '9deg', scale: 1.02 },
  { left: '72%', top: '8%', rotate: '-7deg', scale: 0.9 },
  { left: '16%', top: '20%', rotate: '14deg', scale: 0.98 },
  { left: '56%', top: '23%', rotate: '-16deg', scale: 0.82 },
  { left: '84%', top: '29%', rotate: '11deg', scale: 1.06 },
  { left: '3%', top: '39%', rotate: '-8deg', scale: 1.02 },
  { left: '40%', top: '43%', rotate: '16deg', scale: 0.88 },
  { left: '70%', top: '48%', rotate: '-13deg', scale: 1.04 },
  { left: '18%', top: '58%', rotate: '8deg', scale: 0.92 },
  { left: '53%', top: '62%', rotate: '-10deg', scale: 1.08 },
  { left: '86%', top: '66%', rotate: '12deg', scale: 0.84 },
  { left: '5%', top: '76%', rotate: '13deg', scale: 0.9 },
  { left: '35%', top: '80%', rotate: '-15deg', scale: 1.04 },
  { left: '68%', top: '85%', rotate: '7deg', scale: 0.94 },
  { left: '88%', top: '91%', rotate: '-11deg', scale: 0.84 }
] as const;

function chatWallpaperIcons(kind: string): KnowMeIconName[] {
  if (kind === 'nature') return ['spark', 'discover', 'messages', 'profile'];
  if (kind === 'weather') return ['spark', 'bell', 'messages', 'discover'];
  if (kind === 'universe') return ['spark', 'discover', 'create', 'messages'];
  if (kind === 'future') return ['settings', 'spark', 'messages', 'check'];
  if (kind === 'anime') return ['profile', 'spark', 'messages', 'create'];
  if (kind === 'gaming') return ['challenge', 'coins', 'spark', 'check'];
  if (kind === 'fantasy') return ['spark', 'challenge', 'coins', 'discover'];
  if (kind === 'artistic') return ['create', 'spark', 'messages', 'discover'];
  return ['messages', 'spark', 'check', 'discover'];
}

export function ChatWallpaper({
  style
}: {
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, chat } = useAppearance();
  const icons = chatWallpaperIcons(chat.wallpaperKind);
  const points = CHAT_WALLPAPER_POINTS.slice(0, chat.wallpaperDensity);

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { overflow: 'hidden' },
        style
      ]}
    >
      {chat.wallpaperGlow ? (
        <>
          <View
            style={{
              position: 'absolute',
              width: 280,
              height: 280,
              borderRadius: 140,
              right: -120,
              top: -100,
              backgroundColor: colors.accent,
              opacity: chat.wallpaperOpacity * 0.58
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: 240,
              height: 240,
              borderRadius: 120,
              left: -110,
              bottom: -80,
              backgroundColor: colors.secondary,
              opacity: chat.wallpaperOpacity * 0.46
            }}
          />
        </>
      ) : null}

      {points.map((point, index) => (
        <View
          key={`${point.left}-${point.top}-${index}`}
          style={{
            position: 'absolute',
            left: point.left,
            top: point.top,
            opacity: chat.wallpaperOpacity,
            transform: [
              { rotate: point.rotate },
              { scale: point.scale }
            ]
          }}
        >
          <KnowMeIcon
            name={icons[index % icons.length]!}
            size={26}
            color={
              index % 3 === 0
                ? colors.accent
                : index % 3 === 1
                  ? colors.secondary
                  : colors.muted
            }
            strokeWidth={1.55}
          />
        </View>
      ))}
    </View>
  );
}

export type GlassStrength = 'soft' | 'medium' | 'strong';

export function GlassSurface({
  children,
  style,
  strength = 'medium',
  borderRadius = 26
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  strength?: GlassStrength;
  borderRadius?: number;
}) {
  const { colors, appearance, visual } = useAppearance();
  const reduceTransparency = appearance?.preference.reduceTransparency === true;
  const intensity = Math.min(
    90,
    (strength === 'soft' ? 28 : strength === 'strong' ? 68 : 48) + visual.glassBoost
  );
  const shadowOpacity = strength === 'soft' ? 0.045 : strength === 'strong' ? 0.11 : 0.075;
  const tint = colors.statusBar === 'dark' ? 'light' : 'dark';
  const glassTint =
    colors.statusBar === 'dark'
      ? strength === 'strong'
        ? 'rgba(255,255,255,0.56)'
        : strength === 'medium'
          ? 'rgba(255,255,255,0.42)'
          : 'rgba(255,255,255,0.28)'
      : strength === 'strong'
        ? 'rgba(10,14,24,0.48)'
        : strength === 'medium'
          ? 'rgba(10,14,24,0.34)'
          : 'rgba(10,14,24,0.22)';

  return (
    <View
      style={[
        {
          position: 'relative',
          borderRadius,
          shadowColor: '#000000',
          shadowOpacity,
          shadowRadius: strength === 'strong' ? 22 : 16,
          shadowOffset: { width: 0, height: strength === 'strong' ? 10 : 7 },
          elevation: Math.max(strength === 'strong' ? 10 : 6, visual.elevation)
        },
        style
      ]}
    >
      {reduceTransparency ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius,
              backgroundColor:
                strength === 'strong' ? colors.surfaceRaised : colors.surface
            }
          ]}
        />
      ) : (
        <BlurView
          pointerEvents="none"
          tint={tint}
          intensity={intensity}
          experimentalBlurMethod={
            Platform.OS === 'android' ? 'dimezisBlurView' : undefined
          }
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius,
              overflow: 'hidden'
            }
          ]}
        />
      )}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius,
            backgroundColor: reduceTransparency ? 'transparent' : glassTint,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor:
              colors.statusBar === 'dark'
                ? 'rgba(255,255,255,0.46)'
                : 'rgba(255,255,255,0.12)'
          }
        ]}
      />
      {children}
    </View>
  );
}

export function SoftSurface({
  children,
  style,
  strong = false
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
}) {
  const { colors, visual } = useAppearance();
  return (
    <View
      style={[
        {
          backgroundColor: strong ? colors.surfaceRaised : colors.surface,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: visual.cardRadius
        },
        style
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  brandPill: {
    position: 'absolute'
  }
});
