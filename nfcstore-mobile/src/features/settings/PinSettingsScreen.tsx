import { useState } from 'react';
import { Text, View } from 'react-native';

import { BackBar } from '@/components/BackBar';
import { Card } from '@/components/Card';
import { GhostButton, GoldButton } from '@/components/GoldButton';
import { PinPad } from '@/components/PinPad';
import { usePinLockStore } from '@/store/pinLockStore';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

type Mode =
  | { step: 'idle' }
  | { step: 'verify-to-remove' }
  | { step: 'verify-to-change' }
  | { step: 'enter-new' }
  | { step: 'confirm-new'; first: string };

/**
 * Sozlamalar → PIN kod (`design`dagi so'rov: "Apkga kirish uchun pin
 * code qoyish bolsin settingsda"). Mahalliy, backendsiz funksiya —
 * `usePinLockStore` orqali `expo-secure-store`ga yoziladi.
 *
 * Oqim:
 *   PIN yo'q      → "Yoqish"       → enter-new → confirm-new → saqlash
 *   PIN bor       → "O'zgartirish" → joriy PINni tekshirish → enter-new → confirm-new
 *                 → "O'chirish"    → joriy PINni tekshirish → o'chirish
 */
export function PinSettingsScreen() {
  const { theme } = useTheme();
  const pin = usePinLockStore((s) => s.pin);
  const verify = usePinLockStore((s) => s.verify);
  const setPin = usePinLockStore((s) => s.setPin);
  const removePin = usePinLockStore((s) => s.removePin);

  const [mode, setMode] = useState<Mode>({ step: 'idle' });
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const reset = () => {
    setMode({ step: 'idle' });
    setValue('');
    setError(false);
  };

  if (mode.step !== 'idle') {
    const onChange = (v: string) => {
      setValue(v);
      if (error) setError(false);
    };

    if (mode.step === 'verify-to-remove' || mode.step === 'verify-to-change') {
      return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <BackBar title="PIN kod" />
          <PinPad
            title="Joriy PIN kodni kiriting"
            value={value}
            onChange={onChange}
            error={error}
            onComplete={(v) => {
              if (!verify(v)) {
                setError(true);
                setTimeout(() => setValue(''), 250);
                return;
              }
              if (mode.step === 'verify-to-remove') {
                removePin();
                setDone('PIN kod o’chirildi.');
                reset();
              } else {
                setValue('');
                setMode({ step: 'enter-new' });
              }
            }}
          />
        </View>
      );
    }

    if (mode.step === 'enter-new') {
      return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <BackBar title="PIN kod" />
          <PinPad
            title="Yangi PIN kod"
            subtitle="4 xonali kod tanlang."
            value={value}
            onChange={onChange}
            onComplete={(v) => {
              setValue('');
              setMode({ step: 'confirm-new', first: v });
            }}
          />
        </View>
      );
    }

    // confirm-new
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <BackBar title="PIN kod" />
        <PinPad
          title="PIN kodni takrorlang"
          value={value}
          onChange={onChange}
          error={error}
          onComplete={(v) => {
            if (v !== mode.first) {
              setError(true);
              setTimeout(() => {
                setValue('');
                setMode({ step: 'enter-new' });
              }, 400);
              return;
            }
            setPin(v);
            setDone('PIN kod o’rnatildi.');
            reset();
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <BackBar title="PIN kod" />
      <View style={{ padding: 16 }}>
        <Card radius={16} style={{ padding: 16, gap: 12 }}>
          <Text style={[sans(600, 13), { color: theme.ink }]}>
            Holat: {pin ? 'Yoqilgan' : 'O’chirilgan'}
          </Text>
          <Text style={[sans(400, 11.5, 1.4), { color: theme.off }]}>
            Yoqilgan bo’lsa, ilova har safar ochilganda yoki fondan
            qaytganda PIN kod so’raladi. Bu qurilma darajasidagi qulf —
            hisob paroliga aloqasi yo’q.
          </Text>
          {done ? (
            <Text style={[sans(500, 12, 1.4), { color: theme.verdant }]}>{done}</Text>
          ) : null}

          {pin ? (
            <>
              <GoldButton
                label="PIN kodni o’zgartirish"
                sweep={false}
                onPress={() => {
                  setDone(null);
                  setMode({ step: 'verify-to-change' });
                }}
              />
              <GhostButton
                label="PIN kodni o’chirish"
                onPress={() => {
                  setDone(null);
                  setMode({ step: 'verify-to-remove' });
                }}
              />
            </>
          ) : (
            <GoldButton
              label="PIN kodni yoqish"
              sweep={false}
              onPress={() => {
                setDone(null);
                setMode({ step: 'enter-new' });
              }}
            />
          )}
        </Card>
      </View>
    </View>
  );
}
