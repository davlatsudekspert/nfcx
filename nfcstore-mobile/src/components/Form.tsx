import { type ReactNode } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { CardSurface } from '@/components/Card';
import { TapScale } from '@/components/TapScale';
import { SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * Forma maydonlari — barcha yangi ekranlar (ID sotib olish, Company ID
 * ochish, havolalarni tahrirlash) shu qismlardan yig'iladi, shunda
 * ko'rinish bitta joyda boshqariladi.
 */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: 7 }}>
      <Text style={[mono(500, 10.5), { color: theme.a1, letterSpacing: 1.05 }]}>
        {label.toUpperCase()}
      </Text>
      {children}
      {error ? (
        <Text style={[sans(500, 11.5, 1.4), { color: '#d98b8b' }]}>{error}</Text>
      ) : hint ? (
        <Text style={[sans(400, 11.5, 1.4), { color: 'rgba(255,255,255,.42)' }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Input({
  invalid = false,
  multiline = false,
  ...props
}: TextInputProps & { invalid?: boolean }) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: invalid ? 'rgba(190,80,80,.5)' : theme.rim,
        backgroundColor: theme.c2,
        overflow: 'hidden',
      }}
    >
      <CardSurface />
      <TextInput
        placeholderTextColor={theme.off}
        multiline={multiline}
        style={[
          sans(500, 13.5, 1.45),
          {
            color: theme.ink,
            paddingHorizontal: 13,
            paddingVertical: 12,
            minHeight: multiline ? 92 : 44,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
        {...props}
      />
    </View>
  );
}

/** Bir qatorli tanlov — kategoriya, soni va h.k. */
export function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <TapScale
            key={o.key}
            radius={11}
            onPress={() => onChange(o.key)}
            pulseColor={on ? theme.a1 : undefined}
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            style={[
              {
                paddingVertical: 8,
                paddingHorizontal: 13,
                borderRadius: 11,
                overflow: 'hidden',
                backgroundColor: on ? theme.a2 : theme.c2,
                borderWidth: 1,
                borderColor: on ? 'transparent' : theme.rim,
              },
              on ? SH.pill(theme.a1) : null,
            ]}
          >
            {on ? null : <CardSurface />}
            <Text
              style={[
                sans(600, 11.5),
                { color: on ? theme.onAccent : 'rgba(255,255,255,.55)' },
              ]}
            >
              {o.label}
            </Text>
          </TapScale>
        );
      })}
    </View>
  );
}

/** Xato yoki muvaffaqiyat xabari — formaning ostida. */
export function Notice({ kind, text }: { kind: 'error' | 'ok'; text: string }) {
  const err = kind === 'error';
  return (
    <View
      style={{
        paddingVertical: 11,
        paddingHorizontal: 13,
        borderRadius: 12,
        backgroundColor: err ? 'rgba(190,80,80,.12)' : 'rgba(64,190,120,.12)',
        borderWidth: 1,
        borderColor: err ? 'rgba(190,80,80,.26)' : 'rgba(64,190,120,.28)',
      }}
    >
      <Text style={[sans(500, 12.5, 1.45), { color: err ? '#d98b8b' : '#63d694' }]}>
        {text}
      </Text>
    </View>
  );
}
