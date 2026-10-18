import { type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { PressScale, type KnowMeIconName } from './KnowMeUI';
import { KnowMeNativeAnimatedIcon } from './KnowMeNativeAnimatedIcon';
import { type NativeIconOperationState } from './native-icon-motion-model';

type Props = {
  name: KnowMeIconName;
  /** The voice-accessible action label; never inferred from a decorative path. */
  label: string;
  state?: NativeIconOperationState;
  size?: number;
  color?: string;
  disabled?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  progress?: number | null;
  eventToken?: string | number | null;
  /** Optional button surface overrides, without shrinking the hit target. */
  style?: StyleProp<ViewStyle>;
};

/** Compact 20–24dp drawing; independently >= 48dp Android action surface. */
export function KnowMeNativeIconButton({
  name, label, state = 'idle', size = 22, color, disabled = false,
  onPress, onLongPress, progress, eventToken, style
}: Props) {
  const accessibilityState: PressableProps['accessibilityState'] = {
    disabled, busy: state === 'loading' || state === 'sending' || state === 'syncing',
    selected: state === 'selected' || state === 'open'
  };
  const controlStyle: StyleProp<ViewStyle> = [{
    width: 48, height: 48, minWidth: 48, minHeight: 48,
    borderRadius: 16, justifyContent: 'center', alignItems: 'center'
  }, style];

  return <PressScale
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={accessibilityState}
    style={controlStyle}
    onPress={onPress}
    onLongPress={onLongPress}
    disabled={disabled}>
    <KnowMeNativeAnimatedIcon
      name={name} state={state} size={size} color={color}
      progress={progress} eventToken={eventToken}
    />
  </PressScale>;
}
