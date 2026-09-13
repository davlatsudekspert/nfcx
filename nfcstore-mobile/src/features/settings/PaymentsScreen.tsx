import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';

import { getPayments } from '@/api/endpoints';
import type { PaymentRecord } from '@/api/types';
import { BackBar } from '@/components/BackBar';
import { Card } from '@/components/Card';
import { GhostButton } from '@/components/GoldButton';
import { TapScale } from '@/components/TapScale';
import { SITE } from '@/features/profile/profileVM';
import { money, relativeTime } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * To'lovlar tarixi — `GET /api/payments` (haqiqiy, `web_orders`
 * jadvali, autentifikatsiya talab qiladi). Avval bu qator faqat
 * `${SITE}/tolovlar`ni ochardi — endi haqiqiy ma'lumot ilovaning o'zida
 * ko'rinadi.
 *
 * MUHIM (spetsifikatsiya qoidasi): checkout/to'lov BOSHLASH bu yerda
 * QURILMAGAN. Yangi to'lov kerak bo'lsa haqiqiy veb sahifasiga
 * yo'naltiriladi — Payme/Click mantig'i ilovada takrorlanmaydi.
 * Holatni (`status`) HAM faqat backend belgilaydi, client hech qachon
 * "to'landi" deb o'zi qaror qilmaydi.
 */
export function PaymentsScreen() {
  const { theme } = useTheme();
  const paymentsQuery = useQuery({ queryKey: ['payments'], queryFn: getPayments });

  const payments = paymentsQuery.data?.payments ?? [];
  const pendingPayout = paymentsQuery.data?.pendingPayout ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <BackBar title="To’lovlar" />

      {paymentsQuery.isError ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
            gap: 14,
          }}
        >
          <Text style={[sans(500, 13, 1.5), { color: theme.off, textAlign: 'center' }]}>
            Ma’lumotni yuklab bo’lmadi. Internetni tekshirib qayta urinib ko’ring.
          </Text>
          <TapScale
            radius={11}
            onPress={() => paymentsQuery.refetch()}
            accessibilityLabel="Qayta urinish"
            style={{
              paddingVertical: 10,
              paddingHorizontal: 18,
              borderRadius: 11,
              backgroundColor: 'rgba(255,255,255,.06)',
              borderWidth: 1,
              borderColor: theme.rim,
            }}
          >
            <Text style={[sans(600, 12.5), { color: theme.ink }]}>Qayta urinish</Text>
          </TapScale>
        </View>
      ) : paymentsQuery.isLoading ? (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{ height: 74, borderRadius: 16, backgroundColor: '#121117' }}
            />
          ))}
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 28 }}
          ListHeaderComponent={
            pendingPayout > 0 ? (
              <Card
                radius={16}
                style={{
                  padding: 16,
                  marginBottom: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={[sans(600, 13), { color: theme.ink }]}>Kutilayotgan to’lov</Text>
                <Text style={[mono(600, 14), { color: theme.verdant }]}>
                  {money(pendingPayout)}
                </Text>
              </Card>
            ) : null
          }
          ListEmptyComponent={
            <Text
              style={[
                sans(500, 12.5, 1.5),
                { color: theme.off, textAlign: 'center', paddingVertical: 40 },
              ]}
            >
              Hozircha to’lov tarixi yo’q
            </Text>
          }
          ListFooterComponent={
            <GhostButton
              label="Yangi to’lov — saytda"
              onPress={() => WebBrowser.openBrowserAsync(`${SITE}/tolovlar`).catch(() => {})}
              style={{ marginTop: 6 }}
            />
          }
          renderItem={({ item }) => <PaymentRow payment={item} />}
        />
      )}
    </View>
  );
}

function PaymentRow({ payment }: { payment: PaymentRecord }) {
  const { theme } = useTheme();
  const tone = statusTone(payment.status, theme);

  return (
    <Card radius={16} style={{ padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[sans(700, 13.5), { color: theme.ink }]}>{kindLabel(payment.kind)}</Text>
        <Text style={[mono(600, 12.5), { color: theme.a1 }]}>{money(payment.price)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[mono(500, 10.5), { color: theme.ash, letterSpacing: 0.4 }]}>
          {payment.code} · {relativeTime(payment.createdAt)}
        </Text>
        <View
          style={{
            paddingVertical: 3,
            paddingHorizontal: 8,
            borderRadius: 7,
            borderWidth: 1,
            borderColor: tone,
          }}
        >
          <Text style={[mono(600, 9.5), { color: tone, letterSpacing: 0.4 }]}>
            {statusLabel(payment.status).toUpperCase()}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function statusTone(status: string, theme: { verdant: string; signal: string; a1: string; off: string }): string {
  if (status === 'paid') return theme.verdant;
  if (status === 'pending') return theme.a1;
  if (status === 'cancelled' || status === 'failed') return theme.signal;
  return theme.off;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    paid: 'To’landi',
    pending: 'Kutilmoqda',
    cancelled: 'Bekor qilindi',
    failed: 'Muvaffaqiyatsiz',
  };
  return map[status] ?? status;
}

function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    physical_card: 'Jismoniy karta',
    premium: 'Premium',
    custom_id: 'Maxsus ID',
    auction_payment: 'Auksion to’lovi',
  };
  return map[kind] ?? kind;
}
