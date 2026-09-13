import { type ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

/**
 * Pastdan chiqadigan varaq (bottom sheet) — maketdagi:
 *
 *   overlay: rgba(0,0,0,.62), fadeIn .2s
 *   sheet:   background color-mix(in srgb, #100c07 80%, transparent);
 *            backdrop-filter: blur(22px) saturate(140%);
 *            border: 1px solid #b3860f;
 *            border-radius: 28px 28px 0 0; padding: 12px 16px 26px;
 *            sheetUp .28s cubic-bezier(.2,.8,.25,1);
 *            box-shadow: 0 -20px 50px rgba(0,0,0,.6)
 *
 * `Modal` ishlatiladi, chunki varaq pastki navigatsiya USTIDA turishi
 * kerak — oddiy `View` bo'lsa u tab navigator ichida qolib, nav bar
 * uning ustidan chiqib ketardi.
 *
 * `backdrop-filter` (ortdagi ekranni bulutlashtirish) RN da MAVJUD EMAS
 * va uni beradigan kutubxona (`expo-blur`) bu muhitda o'rnatib
 * bo'lmaydi (paket reestri bloklangan). Shuning uchun varaq QATTIQ
 * `--sheet` foni bilan chiziladi: ortidagi ekran baribir `rgba(0,0,0,.62)`
 * parda bilan qoraytirilgan, ya'ni ko'zga farq deyarli bilinmaydi.
 * Bu yagona ataylab qilingan chekinish — hisobotda ham qayd etilgan.
 */
export function Sheet({
  visible,
  onClose,
  title,
  titleRight,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  titleRight?: ReactNode;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <AnimatedPressableOverlay onPress={onClose} />

        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.bezier(0.2, 0.8, 0.25, 1))}
          style={[
            {
              backgroundColor: theme.sheet,
              borderTopWidth: 1,
              // Spetsifikatsiya: `1px solid #b3860f` — to'q aksent,
              // shaffof `rim` emas. Bu varaqni fondan ajratib turadi.
              borderTopColor: theme.a2,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 12,
              paddingHorizontal: 16,
              // Maketda 26px; qurilmadagi xavfsiz zona qo'shiladi.
              paddingBottom: 26 + insets.bottom,
            },
            SH.sheet(),
          ]}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 4,
              backgroundColor: 'rgba(255,255,255,.18)',
              alignSelf: 'center',
              marginBottom: 14,
            }}
          />

          {title ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: titleRight ? 6 : 14,
              }}
            >
              <Text style={[sans(700, 15), { color: theme.ink }]}>{title}</Text>
              {titleRight}
            </View>
          ) : null}

          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

function AnimatedPressableOverlay({ onPress }: { onPress: () => void }) {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,.62)',
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityLabel="Yopish"
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}
