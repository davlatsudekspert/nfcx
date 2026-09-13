import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { PinPad } from '@/components/PinPad';
import { TapScale } from '@/components/TapScale';
import { usePinLockStore } from '@/store/pinLockStore';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

/**
 * To'liq ekranli qulf — ilova ildizida (`app/_layout.tsx`) `locked ===
 * true` bo'lganda TAB QOBIG'I O'RNIGA ko'rsatiladi. PIN har doim
 * zaxira sifatida ishlaydi: Face ID/barmoq izi yoqilgan bo'lsa ekran
 * ochilganda avtomatik so'raladi, lekin klaviatura doim ko'rinadi —
 * bekor qilinsa yoki muvaffaqiyatsiz bo'lsa foydalanuvchi PIN kiritadi.
 */
export function PinLockScreen() {
  const { theme } = useTheme();
  const verify = usePinLockStore((s) => s.verify);
  const unlock = usePinLockStore((s) => s.unlock);
  const biometricEnabled = usePinLockStore((s) => s.biometricEnabled);
  const biometricAvailable = usePinLockStore((s) => s.biometricAvailable);
  const tryBiometricUnlock = usePinLockStore((s) => s.tryBiometricUnlock);

  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const askedOnMount = useRef(false);

  const canBiometric = biometricEnabled && biometricAvailable;

  useEffect(() => {
    if (!canBiometric || askedOnMount.current) return;
    askedOnMount.current = true;
    tryBiometricUnlock();
    // Faqat ekran ochilganda BIR MARTA avtomatik so'raladi — foydalanuvchi
    // bekor qilgach har harf bosilganda qayta-qayta chiqavermaydi.
  }, [canBiometric, tryBiometricUnlock]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <PinPad
        title="PIN kodni kiriting"
        subtitle="Ilovaga kirish uchun PIN kod talab qilinadi."
        value={value}
        onChange={(v) => {
          setValue(v);
          if (error) setError(false);
        }}
        onComplete={(v) => {
          if (verify(v)) {
            unlock();
            setValue('');
          } else {
            setError(true);
            setTimeout(() => setValue(''), 250);
          }
        }}
        error={error}
      />
      {canBiometric ? (
        <View style={{ alignItems: 'center', paddingBottom: 28 }}>
          <TapScale
            radius={12}
            onPress={() => tryBiometricUnlock()}
            accessibilityLabel="Face ID yoki barmoq izi bilan ochish"
            style={{ paddingVertical: 10, paddingHorizontal: 18 }}
          >
            <Text style={[sans(600, 12.5), { color: theme.a1 }]}>
              Face ID / Barmoq izi bilan ochish
            </Text>
          </TapScale>
        </View>
      ) : null}
    </View>
  );
}
