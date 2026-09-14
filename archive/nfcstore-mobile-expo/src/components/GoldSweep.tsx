import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * Gold elementlar ustidan o'tadigan diagonal yorug'lik — spetsifikatsiya
 * 7-bo'limdagi "soft diagonal light-sweep".
 *
 * Maketdagi CSS:
 *   ::after { position:absolute; top:0; bottom:0; width:35%;
 *             background: linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);
 *             animation: sweep 5s ease-in-out infinite }
 *   @keyframes sweep { 0%       { translateX(-120%) skewX(-18deg) }
 *                      60%,100% { translateX(320%)  skewX(-18deg) }
 *
 * Ikki nozik joy:
 *  1. CSS dagi `translateX(%)` elementning O'Z kengligiga nisbatan
 *     o'lchanadi, RN esa faqat piksel qabul qiladi. Shuning uchun
 *     to'ldiruvchi qatlam `onLayout` bilan o'lchanadi va foizlar
 *     pikselga aylantiriladi: strip = .35W, yo'l -0.42W dan +1.12W ga
 *     (ya'ni chapdan butunlay tashqarida boshlanib, o'ngdan butunlay
 *     tashqarida tugaydi).
 *  2. `60%,100%` — harakat davrning 60% ida tugaydi, qolgan 40% pauza.
 *     Shu sababli ketma-ketlikning ikkinchi qadami bir xil qiymatga
 *     "harakat" qiladi, ya'ni shunchaki ushlab turadi.
 *
 * Kesish shu komponentning o'zida (`overflow:'hidden'`) — ota elementga
 * qo'shimcha talab qo'yilmaydi.
 */
export function GoldSweep({ duration = 5000, radius = 0 }: { duration?: number; radius?: number }) {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) {
      setWidth(w);
      progress.value = 0;
      progress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: duration * 0.6, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: duration * 0.4 }),
        ),
        -1,
        false,
      );
    }
  };

  const stripStyle = useAnimatedStyle(() => {
    const from = -0.42 * width;
    const to = 1.12 * width;
    return {
      transform: [{ translateX: from + (to - from) * progress.value }, { skewX: '-18deg' }],
    };
  });

  return (
    <View
      onLayout={onLayout}
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radius,
        overflow: 'hidden',
      }}
    >
      {width > 0 ? (
        <Animated.View
          style={[
            { position: 'absolute', top: 0, bottom: 0, left: 0, width: width * 0.35 },
            stripStyle,
          ]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,.5)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
