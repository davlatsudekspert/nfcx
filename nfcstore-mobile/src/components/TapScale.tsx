import { type ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Maketdagi `.tapscale` ning RN ekvivalenti:
 *
 *   .tapscale        { transition: transform .12s ease }
 *   .tapscale:active { transform: scale(.955); animation: goldPulse .5s ease-out }
 *   @keyframes goldPulse { 0% { box-shadow: 0 0 0 0 var(--pulse) }
 *                        100% { box-shadow: 0 0 0 14px transparent } }
 *
 * `box-shadow` ning tarqalishini (spread) RN da animatsiya qilib
 * bo'lmaydi, shuning uchun pulsatsiya yupqa CHEGARA halqasi bilan
 * chiziladi: element chetida 1 -> 1.14 ga kengayib o'chadi. Ko'rinishi
 * box-shadow pulsatsiyasi bilan bir xil.
 *
 * `style` TO'G'RIDAN-TO'G'RI bosiladigan elementga beriladi — maketdagi
 * padding, flex va markazlash qoidalari o'zgarmasin. Halqa esa birinchi
 * bola sifatida, `position:absolute` bilan chiziladi: u faqat chetdagi
 * 2px ni egallaydi, kontentni bosmaydi.
 */
export type TapScaleProps = {
  children?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Halqa radiusi — elementning borderRadius'i bilan bir xil bo'lishi kerak. */
  radius?: number;
  /** Maketdagi `--pulse`. Gold tugmalar uchun aksent rangi berilishi mumkin. */
  pulseColor?: string;
  disabled?: boolean;
  hitSlop?: number;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'tab' | 'link' | 'imagebutton';
  accessibilityState?: { selected?: boolean; disabled?: boolean };
};

export function TapScale({
  children,
  onPress,
  style,
  radius = 13,
  pulseColor = 'rgba(255,255,255,.14)',
  disabled = false,
  hitSlop,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: TapScaleProps) {
  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value,
    transform: [{ scale: 1 + pulse.value * 0.14 }],
  }));

  const press = () => {
    scale.value = withTiming(0.955, { duration: 120, easing: Easing.ease });
    pulse.value = 0;
    pulse.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) });
  };

  const release = () => {
    scale.value = withTiming(1, { duration: 120, easing: Easing.ease });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press}
      onPressOut={release}
      disabled={disabled || !onPress}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={[style, boxStyle]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: -1,
            left: -1,
            right: -1,
            bottom: -1,
            borderRadius: radius + 1,
            borderWidth: 2,
            borderColor: pulseColor,
          },
          ringStyle,
        ]}
      />
      {children}
    </AnimatedPressable>
  );
}
