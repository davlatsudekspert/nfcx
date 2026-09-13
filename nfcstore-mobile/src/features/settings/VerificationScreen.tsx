import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import {
  ApiError,
  getTelegramLinkStatus,
  startTelegramLink,
  type TgLinkStatus,
} from '@/api/client';
import { confirmTelegramLink, getMe } from '@/api/endpoints';
import { BackBar } from '@/components/BackBar';
import { Card } from '@/components/Card';
import { GoldButton } from '@/components/GoldButton';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

const POLL_MS = 3000;
/** Token 15 daqiqa amal qiladi (backend) — shundan sal kamroq kutamiz. */
const POLL_TIMEOUT_MS = 14 * 60_000;

type LinkFlowState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'waiting'; token: string; url: string }
  | { phase: 'confirming'; token: string }
  | { phase: 'error'; message: string };

/**
 * Sozlamalar → Tasdiqlash — spetsifikatsiya "Three corrections":
 *
 *   1. Hisob tasdiqlash = EMAIL. Backend'da bu FLOW HALI YO'Q (faqat
 *      parolni tiklash uchun email yuborish infratuzilmasi bor,
 *      `sendEmailD1`/Resend) — shuning uchun MISSING BACKEND CAPABILITY
 *      sifatida ko'rsatiladi, fake "kod yuborildi" degan holat YO'Q.
 *   2. Profil tasdiqlash = mavjud NFCSTORE Telegram bot oqimi
 *      (`POST /api/auth/tg-link/start` → bot → `GET .../status` →
 *      `POST /api/settings/link-telegram`), HAQIQIY, tasdiqlangan.
 *   3. Ikkalasi ARALASHTIRILMAYDI — alohida kartalar, alohida holat.
 *
 * Tasdiqlangan nishon backend'dan (`user.telegramLinked`) — clientda
 * hech qachon qattiq yozilmagan.
 */
export function VerificationScreen() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe });
  const user = meQuery.data?.user;

  const [flow, setFlow] = useState<LinkFlowState>({ phase: 'idle' });
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadline = useRef(0);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  const startFlow = async () => {
    setFlow({ phase: 'starting' });
    try {
      const { token, url } = await startTelegramLink();
      setFlow({ phase: 'waiting', token, url });
      await Linking.openURL(url).catch(() => {
        // Telegram o'rnatilmagan yoki havolani ochib bo'lmadi — baribir
        // kutish holatida qolamiz, odam qo'lda ochishi mumkin
        // (havola pastda matn sifatida ko'rinadi).
      });
      pollDeadline.current = Date.now() + POLL_TIMEOUT_MS;
      pollTimer.current = setInterval(() => pollStatus(token), POLL_MS);
    } catch (err) {
      setFlow({ phase: 'error', message: startErrorText(err) });
    }
  };

  const pollStatus = async (token: string) => {
    if (Date.now() > pollDeadline.current) {
      stopPolling();
      setFlow({ phase: 'error', message: 'Vaqt tugadi. Qayta urinib ko’ring.' });
      return;
    }
    let status: TgLinkStatus;
    try {
      status = await getTelegramLinkStatus(token);
    } catch {
      return; // vaqtinchalik tarmoq xatosi — keyingi tikda qayta urinadi
    }
    if (status.status === 'expired') {
      stopPolling();
      setFlow({ phase: 'error', message: 'Havola muddati tugadi. Qayta boshlang.' });
      return;
    }
    if (status.status === 'linked') {
      stopPolling();
      setFlow({ phase: 'confirming', token });
      try {
        await confirmTelegramLink(token);
        await queryClient.invalidateQueries({ queryKey: ['me'] });
        setFlow({ phase: 'idle' });
      } catch (err) {
        setFlow({ phase: 'error', message: confirmErrorText(err) });
      }
    }
    // 'pending' — jim davom etamiz.
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <BackBar title="Tasdiqlash" />

      <View style={{ padding: 16, gap: 14 }}>
        {/* ── Hisob — Email ─────────────────────────────────────────── */}
        <Card radius={16} style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[mono(600, 11), { color: theme.a1, letterSpacing: 1.1 }]}>
              HISOB — EMAIL
            </Text>
            <StatusChip label="Mavjud emas" tone="muted" />
          </View>
          <Text style={[sans(400, 12.5, 1.5), { color: theme.ash }]}>
            {user?.email ?? '—'}
          </Text>
          <Text style={[sans(400, 11.5, 1.45), { color: theme.off }]}>
            Email orqali hisobni tasdiqlash hozircha ilovada mavjud emas
            (backend'da bu tasdiqlash oqimi hali yo’q). Telefon raqamingiz
            aloqa ma’lumoti sifatida saqlanadi.
          </Text>
        </Card>

        {/* ── Profil — Telegram ─────────────────────────────────────── */}
        <Card radius={16} style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[mono(600, 11), { color: theme.a1, letterSpacing: 1.1 }]}>
              PROFIL — TELEGRAM
            </Text>
            <StatusChip
              label={user?.telegramLinked ? 'Tasdiqlangan' : 'Tasdiqlanmagan'}
              tone={user?.telegramLinked ? 'verdant' : 'muted'}
            />
          </View>
          <Text style={[sans(400, 11.5, 1.45), { color: theme.off }]}>
            Parolni tiklash va buyurtma xabarlari shu bog’lanishga tayanadi.
            Kod so’ralmaydi — botda bitta tugma bosiladi.
          </Text>

          {user?.telegramLinked ? null : (
            <>
              {flow.phase === 'waiting' ? (
                <Text style={[sans(500, 12, 1.4), { color: theme.a1 }]}>
                  Botda “Kontaktni ulashish” tugmasini bosing — bu yerga
                  qaytish shart emas, o’zi davom etadi…
                </Text>
              ) : null}
              {flow.phase === 'confirming' ? (
                <Text style={[sans(500, 12, 1.4), { color: theme.a1 }]}>
                  Tasdiqlanmoqda…
                </Text>
              ) : null}
              {flow.phase === 'error' ? (
                <Text style={[sans(500, 11.5, 1.4), { color: theme.signal }]}>
                  {flow.message}
                </Text>
              ) : null}

              <GoldButton
                label={
                  flow.phase === 'starting'
                    ? 'Ochilmoqda…'
                    : flow.phase === 'waiting'
                      ? 'Qayta ochish'
                      : 'Telegramda tasdiqlash'
                }
                sweep={false}
                onPress={
                  flow.phase === 'starting' || flow.phase === 'confirming'
                    ? undefined
                    : flow.phase === 'waiting'
                      ? () => Linking.openURL(flow.url).catch(() => {})
                      : startFlow
                }
              />
            </>
          )}
        </Card>
      </View>
    </View>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: 'verdant' | 'muted';
}) {
  const { theme } = useTheme();
  const color = tone === 'verdant' ? theme.verdant : theme.off;
  return (
    <View
      style={{
        paddingVertical: 4,
        paddingHorizontal: 9,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: color,
      }}
    >
      <Text style={[mono(600, 9.5), { color, letterSpacing: 0.4 }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function startErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'bot_not_configured') return 'Telegram bot hozircha sozlanmagan.';
    if (err.code === 'too_many_requests') return 'Juda ko’p urinish. Birozdan keyin qayta urining.';
  }
  return 'Boshlab bo’lmadi. Qayta urinib ko’ring.';
}

function confirmErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'phone_taken') {
      return 'Bu Telegram raqami boshqa tasdiqlangan hisobga tegishli.';
    }
    if (err.code === 'link_not_confirmed') return 'Tasdiqlash muddati tugadi. Qayta boshlang.';
    if (err.isUnauthorized) return 'Sessiya tugagan. Qayta kiring.';
  }
  return 'Tasdiqlab bo’lmadi. Qayta urinib ko’ring.';
}
