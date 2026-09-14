import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { getTapTarget } from '@/api/endpoints';
import { scanTag } from '@/lib/nfc';

export type ScanState =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'error'; message: string; canOpenSettings?: boolean };

/**
 * NFC teginish oqimi — SAYT BILAN BIR XIL tartibda:
 *
 *   1. Tegni o'qiymiz va URL'ni ajratamiz.
 *   2. URL yo'lida kod bo'lsa — DARHOL o'sha profilga o'tamiz.
 *   3. Chip tokeni bo'lsa, `/api/tap/:token` bilan faollikni ORQADA
 *      tekshiramiz. Faol emas bo'lsa profil ustida ogohlantirish
 *      chiqadi — profil BLOKLANMAYDI (ProfilePage.jsx bilan bir xil).
 *   4. Yo'lda kod bo'lmasa (eski teg) — `linkedCode` ga tayanamiz.
 *
 * Tarmoq xatosi profilni ochishga TO'SQINLIK QILMAYDI: saytda ham
 * shunday, chunki teginish allaqachon kimning kartasi ekanini aytgan.
 */
export function useNfcScan() {
  const [state, setState] = useState<ScanState>({ status: 'idle' });

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  const scan = useCallback(async () => {
    setState({ status: 'scanning' });
    const result = await scanTag();

    if (!result.ok) {
      if (result.reason === 'cancelled') {
        setState({ status: 'idle' });
        return;
      }
      setState({
        status: 'error',
        message:
          result.reason === 'unsupported'
            ? 'Bu qurilmada NFC yo’q yoki qo’llab-quvvatlanmaydi.'
            : result.reason === 'disabled'
              ? 'NFC o’chirilgan. Sozlamalarda yoqib, qayta urinib ko’ring.'
              : 'Kartani o’qib bo’lmadi. Kartani telefon orqasiga yaqinroq tutib qayta urinib ko’ring.',
        canOpenSettings: result.reason === 'disabled',
      });
      return;
    }

    const { target } = result;

    if (target.kind === 'card') {
      const inactive = target.token ? await checkInactive(target.token) : false;
      setState({ status: 'idle' });
      router.push(
        `/p/${target.code}${inactive ? '?inactive=1' : ''}`,
      );
      return;
    }

    if (target.kind === 'company') {
      setState({ status: 'idle' });
      router.push(`/c/${target.companyId}`);
      return;
    }

    if (target.kind === 'token') {
      // Yo'lda kod yo'q — serverdan so'raymiz. Bu YO'L faqat eski yoki
      // noto'liq yozilgan teglar uchun.
      try {
        const info = await getTapTarget(target.token);
        if (info.linkedCode) {
          setState({ status: 'idle' });
          router.push(`/p/${info.linkedCode.toUpperCase()}${info.active ? '' : '?inactive=1'}`);
          return;
        }
        setState({
          status: 'error',
          message: info.active
            ? 'Bu karta hali biror profilga ulanmagan.'
            : 'Bu karta faol emas — bloklangan yoki boshqa profilga o’tgan.',
        });
      } catch {
        setState({
          status: 'error',
          message:
            'Kartani tekshirib bo’lmadi — internet aloqasini tekshirib qayta urinib ko’ring.',
        });
      }
      return;
    }

    setState({
      status: 'error',
      message: 'Bu NFCSTORE kartasi emas yoki teg ichidagi ma’lumot tanilmadi.',
    });
  }, []);

  return { state, scan, reset };
}

/**
 * Chip faolligini tekshiradi. Tarmoq xatosi "faol emas" DEGANI EMAS —
 * shunday holatda `false` qaytariladi va profil ogohlantirishsiz
 * ochiladi (saytdagi xatti-harakat).
 */
async function checkInactive(token: string): Promise<boolean> {
  try {
    const info = await getTapTarget(token);
    return info.active === false;
  } catch {
    return false;
  }
}
