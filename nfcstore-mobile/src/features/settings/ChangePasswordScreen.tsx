import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { changePasswordDirect } from '@/api/endpoints';
import { AuthField } from '@/features/auth/AuthField';
import { BackBar } from '@/components/BackBar';
import { Card } from '@/components/Card';
import { GoldButton } from '@/components/GoldButton';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

/**
 * Parolni o'zgartirish — `POST /api/settings/change-password-direct`
 * (haqiqiy, joriy parol bilan tasdiqlanadi).
 *
 * MUHIM: muvaffaqiyatdan keyin backend BARCHA sessiyalarni o'chiradi,
 * mobilning JORIY sessiyasi ham shu jumladan (`api/endpoints.ts`dagi
 * izohga qarang — sabab: backend faqat cookie sessiyani saqlab
 * qolishni biladi, Bearer tokenni emas). Shuning uchun bu ekran buni
 * YASHIRMAYDI: muvaffaqiyatli almashtirgach ATAYLAB chiqish qiladi va
 * "qayta kiring" deb ochiq aytadi — soxta "hammasi joyida, davom
 * eting" holatini ko'rsatmaydi.
 */
export function ChangePasswordScreen() {
  const { theme } = useTheme();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit =
    current.length > 0 && next.length >= 6 && next === confirm && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await changePasswordDirect(current, next);
      setDone(true);
      // Backend joriy sessiyani ham o'chirdi — mahalliy holatni ham
      // shunga moslashtiramiz va kirish ekraniga qaytaramiz.
      await useAuthStore.getState().signOut();
      setTimeout(() => router.replace('/login'), 1400);
    } catch (err) {
      setError(changePasswordErrorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <BackBar title="Parolni o’zgartirish" />

      <View style={{ padding: 16 }}>
        <Card radius={16} style={{ padding: 16, gap: 12 }}>
          {done ? (
            <Text style={[sans(600, 13, 1.4), { color: theme.verdant }]}>
              Parol o’zgartirildi. Xavfsizlik uchun qayta kirishingiz kerak…
            </Text>
          ) : (
            <>
              <AuthField
                label="Joriy parol"
                value={current}
                onChangeText={setCurrent}
                placeholder="••••••"
                secureTextEntry
              />
              <AuthField
                label="Yangi parol"
                value={next}
                onChangeText={setNext}
                placeholder="Kamida 6 belgi"
                secureTextEntry
              />
              <AuthField
                label="Yangi parolni takrorlang"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="••••••"
                secureTextEntry
              />
              {confirm.length > 0 && next !== confirm ? (
                <Text style={[sans(500, 11.5), { color: theme.signal }]}>
                  Parollar mos emas.
                </Text>
              ) : null}
              {error ? (
                <Text style={[sans(500, 12, 1.4), { color: theme.signal }]}>{error}</Text>
              ) : null}
              <Text style={[sans(400, 11, 1.4), { color: theme.off }]}>
                Almashtirgach barcha qurilmalardagi sessiya tugaydi —
                qayta kirishingiz kerak bo’ladi.
              </Text>
              <GoldButton
                label={submitting ? 'Yuborilmoqda…' : 'Parolni almashtirish'}
                onPress={canSubmit ? onSubmit : undefined}
                sweep={false}
              />
            </>
          )}
        </Card>
      </View>
    </View>
  );
}

function changePasswordErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'bad_current_password') return 'Joriy parol noto’g’ri.';
    if (err.code === 'weak_password') return 'Yangi parol kamida 6 belgidan iborat bo’lishi kerak.';
    if (err.code === 'too_many_requests') return 'Juda ko’p urinish. Birozdan keyin qayta urining.';
    if (err.isUnauthorized) return 'Sessiya tugagan. Qayta kiring.';
  }
  return 'Parolni almashtirib bo’lmadi. Qayta urinib ko’ring.';
}
