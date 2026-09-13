import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';

import { tapLight } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * "Tortib yangilash" — ekranning so'rovlarini qaytadan oladi.
 *
 * `keys` — shu ekran ishlatadigan so'rov kalitlari. Hammasini emas,
 * aynan shularni yangilaymiz: butun keshni tashlash boshqa
 * ekranlarning ma'lumotini ham yo'qotardi va qaytib kelganda ular
 * bo'sh bo'lib turardi.
 *
 * Chaqirilishi:
 *   <ScrollView refreshControl={usePullToRefresh([['me'], ['companies','mine']])} />
 */
export function usePullToRefresh(keys: readonly (readonly unknown[])[]) {
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);

  const onRefresh = useCallback(async () => {
    setBusy(true);
    tapLight();
    try {
      await Promise.all(
        keys.map((key) => queryClient.invalidateQueries({ queryKey: key as unknown[] })),
      );
    } finally {
      setBusy(false);
    }
    // `keys` har renderda yangi massiv bo'lishi mumkin, shuning uchun
    // uning MAZMUNI bo'yicha bog'lanamiz — aks holda `onRefresh` har
    // safar qayta yaratilib, `RefreshControl` behuda yangilanardi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, JSON.stringify(keys)]);

  return (
    <RefreshControl
      refreshing={busy}
      onRefresh={onRefresh}
      tintColor={theme.a1}
      colors={[theme.a1]}
      progressBackgroundColor={theme.c1}
    />
  );
}
