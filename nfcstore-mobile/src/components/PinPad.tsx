import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

import { TapScale } from './TapScale';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/**
 * PIN kiritish uchun umumiy UI — ham qulf ekranida (`PinLockScreen`),
 * ham sozlamalarda (`PinSettingsScreen`) ishlatiladi. To'liq nazorat
 * qilinadigan komponent: qiymatni o'zi saqlamaydi, faqat 4 xonaga
 * to'lganda `onComplete` chaqiradi.
 */
export function PinPad({
  title,
  subtitle,
  value,
  onChange,
  onComplete,
  error,
}: {
  title: string;
  subtitle?: string;
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  /** Xato bo'lsa nuqtalar qizil rangda "silkinadi". */
  error?: boolean;
}) {
  const { theme } = useTheme();
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!error) return;
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [error, shake]);

  const press = (k: string) => {
    if (k === '') return;
    if (k === 'del') {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= PIN_LENGTH) return;
    const next = value + k;
    onChange(next);
    if (next.length === PIN_LENGTH) onComplete(next);
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 24 }}>
      <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 36, gap: 8 }}>
        <Text style={[sans(700, 16), { color: theme.ink }]}>{title}</Text>
        {subtitle ? (
          <Text
            style={[sans(400, 12.5, 1.4), { color: theme.off, textAlign: 'center' }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <Animated.View
        style={{
          flexDirection: 'row',
          gap: 16,
          marginBottom: 44,
          transform: [
            {
              translateX: shake.interpolate({
                inputRange: [-1, 1],
                outputRange: [-8, 8],
              }),
            },
          ],
        }}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              borderWidth: 1.5,
              borderColor: error ? theme.signal : theme.a1,
              backgroundColor:
                i < value.length ? (error ? theme.signal : theme.a1) : 'transparent',
            }}
          />
        ))}
      </Animated.View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 264, gap: 16 }}>
        {KEYS.map((k, i) =>
          k === '' ? (
            <View key={i} style={{ width: 72, height: 72 }} />
          ) : (
            <TapScale
              key={i}
              radius={36}
              onPress={() => press(k)}
              accessibilityLabel={k === 'del' ? 'O’chirish' : k}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,.05)',
                borderWidth: 1,
                borderColor: theme.hairline,
              }}
            >
              {k === 'del' ? (
                <Svg width={22} height={18} viewBox="0 0 24 20">
                  <Path
                    d="M9 1H22a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H9a1 1 0 0 1-.78-.37L1 10l7.22-8.63A1 1 0 0 1 9 1Z"
                    stroke={theme.ink}
                    strokeWidth={1.6}
                    fill="none"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M13 6l6 8M19 6l-6 8"
                    stroke={theme.ink}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                  />
                </Svg>
              ) : (
                <Text style={[mono(500, 22), { color: theme.ink }]}>{k}</Text>
              )}
            </TapScale>
          ),
        )}
      </View>
    </View>
  );
}

export { PIN_LENGTH };
