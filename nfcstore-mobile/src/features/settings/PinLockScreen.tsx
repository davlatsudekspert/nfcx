import { useState } from 'react';
import { View } from 'react-native';

import { PinPad } from '@/components/PinPad';
import { usePinLockStore } from '@/store/pinLockStore';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * To'liq ekranli qulf — ilova ildizida (`app/_layout.tsx`) `locked ===
 * true` bo'lganda TAB QOBIG'I O'RNIGA ko'rsatiladi. Orqaga tugmasi yo'q:
 * PIN o'rnatilgan bo'lsa, to'g'ri kod kiritilmaguncha ilova ichiga
 * kirib bo'lmaydi (foydalanuvchining aynan so'ragan xatti-harakati).
 */
export function PinLockScreen() {
  const { theme } = useTheme();
  const verify = usePinLockStore((s) => s.verify);
  const unlock = usePinLockStore((s) => s.unlock);

  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

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
    </View>
  );
}
