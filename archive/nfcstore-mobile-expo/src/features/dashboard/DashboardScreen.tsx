import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import {
  getCompany,
  getCompanyOrders,
  getCompanyStats,
  setOrderStatus,
} from '@/api/endpoints';
import type { Company } from '@/api/types';
import { BackBar } from '@/components/BackBar';
import { Card } from '@/components/Card';
import { TapScale } from '@/components/TapScale';
import { VDivider } from '@/components/GoldButton';
import { compactCount, money, relativeTime } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

import { CatalogManager } from './CatalogManager';
import { ViewsSparkline } from './ViewsSparkline';

type Section = 'stats' | 'orders' | 'catalog';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'stats', label: 'Statistika' },
  { key: 'orders', label: 'Buyurtmalar' },
  { key: 'catalog', label: 'Katalog' },
];

/**
 * Biznes egasining Dashboard'i — saytdagi kompaniya ish maydonining
 * (Boshqaruv / Statistika / Buyurtmalar) mobil ekvivalenti.
 *
 * Bu bosqichda ATAYLAB sodda saqlangan (kelishilgan): asosiy
 * metrikalar, buyurtmalar ro'yxati va katalog boshqaruvi. Rasm yuklash
 * keyingi bosqichda.
 */
export function DashboardScreen({ companyId }: { companyId: string }) {
  const { theme } = useTheme();
  const [section, setSection] = useState<Section>('stats');

  const companyQuery = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany(companyId),
  });

  const statsQuery = useQuery({
    queryKey: ['company-stats', companyId],
    queryFn: () => getCompanyStats(companyId, 30),
  });

  const ordersQuery = useQuery({
    queryKey: ['company-orders', companyId],
    queryFn: () => getCompanyOrders(companyId),
  });

  const company = companyQuery.data;

  if (companyQuery.isLoading && !company) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <BackBar title="Dashboard" subtitle={companyId} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.a1} />
        </View>
      </View>
    );
  }

  if (!company) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <BackBar title="Dashboard" subtitle={companyId} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
        >
          <Text style={[sans(500, 13, 1.5), { color: theme.off, textAlign: 'center' }]}>
            Kompaniyani yuklab bo’lmadi. Internetni tekshirib qayta urinib ko’ring.
          </Text>
        </View>
      </View>
    );
  }

  const stats = statsQuery.data;
  const orders = ordersQuery.data ?? [];
  const newOrders = orders.filter((o) => o.status === 'new').length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <BackBar title="Dashboard" subtitle={company.displayName || companyId} />

      <View
        style={{
          flexDirection: 'row',
          gap: 7,
          paddingHorizontal: 16,
          paddingTop: 6,
          paddingBottom: 12,
        }}
      >
        {SECTIONS.map((s) => (
          <SectionTab
            key={s.key}
            label={s.label}
            badge={s.key === 'orders' && newOrders > 0 ? newOrders : undefined}
            on={section === s.key}
            onPress={() => setSection(s.key)}
          />
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 12 }}
      >
        {section === 'stats' ? (
          <>
            <Card radius={16} style={{ padding: 16, gap: 14 }}>
              <Text style={[mono(600, 11), { color: theme.a1, letterSpacing: 1.1 }]}>
                OXIRGI 30 KUN
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                <Metric label="ko’rish" value={compactCount(stats?.views ?? 0)} />
                <VDivider height={26} />
                <Metric label="teginish" value={compactCount(stats?.taps ?? 0)} />
                <VDivider height={26} />
                <Metric label="buyurtma" value={compactCount(stats?.orders ?? 0)} />
              </View>
              {stats?.series?.length ? <ViewsSparkline series={stats.series} /> : null}
            </Card>

            <Card radius={16} style={{ padding: 16, gap: 10 }}>
              <Text style={[mono(600, 11), { color: theme.a1, letterSpacing: 1.1 }]}>
                UMUMIY
              </Text>
              <Row k="Obunachilar" v={compactCount(company.followers)} />
              <Row k="Barcha ko’rishlar" v={compactCount(company.views)} />
              <Row k="Mahsulotlar" v={String(company.catalog.length)} />
              <Row k="Holat" v={statusLabel(company.status)} />
              <Row k="Tarif" v={planLabel(company)} />
            </Card>

            {stats?.actions?.length ? (
              <Card radius={16} style={{ padding: 16, gap: 10 }}>
                <Text style={[mono(600, 11), { color: theme.a1, letterSpacing: 1.1 }]}>
                  BOSILGAN AMALLAR
                </Text>
                {stats.actions.slice(0, 6).map((a) => (
                  <Row key={a.key} k={actionLabel(a.key)} v={compactCount(a.hits)} />
                ))}
              </Card>
            ) : null}

            {stats?.items?.length ? (
              <Card radius={16} style={{ padding: 16, gap: 10 }}>
                <Text style={[mono(600, 11), { color: theme.a1, letterSpacing: 1.1 }]}>
                  ENG KO’P OCHILGAN MAHSULOTLAR
                </Text>
                {stats.items.slice(0, 5).map((i) => (
                  <Row key={i.id} k={i.name || i.id} v={compactCount(i.hits)} />
                ))}
              </Card>
            ) : null}
          </>
        ) : null}

        {section === 'orders' ? (
          <OrdersList companyId={companyId} orders={orders} loading={ordersQuery.isLoading} />
        ) : null}

        {section === 'catalog' ? (
          <CatalogManager companyId={companyId} company={company} />
        ) : null}
      </ScrollView>
    </View>
  );
}

/* ── Buyurtmalar ──────────────────────────────────────────────────── */

const ORDER_FLOW: { status: string; label: string }[] = [
  { status: 'new', label: 'Yangi' },
  { status: 'confirmed', label: 'Tasdiqlangan' },
  { status: 'done', label: 'Bajarilgan' },
  { status: 'cancelled', label: 'Bekor qilingan' },
];

function OrdersList({
  companyId,
  orders,
  loading,
}: {
  companyId: string;
  orders: import('@/api/types').CompanyOrder[];
  loading: boolean;
}) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const mutate = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      setOrderStatus(companyId, id, status),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['company-orders', companyId] });
      // Buyurtma soni statistikaga ham kiradi.
      queryClient.invalidateQueries({ queryKey: ['company-stats', companyId] });
    },
  });

  if (loading && !orders.length) {
    return <ActivityIndicator color={theme.a1} style={{ marginTop: 24 }} />;
  }

  if (!orders.length) {
    return (
      <Text
        style={[
          sans(500, 12.5, 1.5),
          { color: theme.off, textAlign: 'center', paddingVertical: 36 },
        ]}
      >
        Hozircha buyurtma yo’q
      </Text>
    );
  }

  return (
    <>
      {orders.map((order) => (
        <Card key={order.id} radius={16} style={{ padding: 16, gap: 10 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Text style={[sans(700, 13.5, 1.3), { color: theme.ink, flex: 1 }]}>
              {order.itemName || 'Mahsulot'}
              {order.qty > 1 ? ` × ${order.qty}` : ''}
            </Text>
            <Text style={[mono(600, 11.5), { color: theme.a1 }]}>
              {money(order.price * order.qty)}
            </Text>
          </View>

          <Row k="Mijoz" v={order.name || '—'} />
          <Row k="Telefon" v={order.phone || '—'} />
          {order.note ? <Row k="Izoh" v={order.note} /> : null}
          <Row k="Vaqt" v={relativeTime(order.createdAt)} />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 2 }}>
            {ORDER_FLOW.map((f) => (
              <TapScale
                key={f.status}
                radius={9}
                onPress={
                  order.status === f.status
                    ? undefined
                    : () => mutate.mutate({ id: order.id, status: f.status })
                }
                accessibilityLabel={f.label}
                accessibilityState={{ selected: order.status === f.status }}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 11,
                  borderRadius: 9,
                  backgroundColor:
                    order.status === f.status ? 'rgba(255,255,255,.1)' : 'transparent',
                  borderWidth: 1,
                  borderColor:
                    order.status === f.status ? theme.a2 : 'rgba(255,255,255,.1)',
                }}
              >
                <Text
                  style={[
                    sans(600, 11),
                    {
                      color:
                        order.status === f.status ? theme.a1 : 'rgba(255,255,255,.5)',
                    },
                  ]}
                >
                  {f.label}
                </Text>
              </TapScale>
            ))}
          </View>
        </Card>
      ))}
    </>
  );
}

/* ── kichik bo'laklar ─────────────────────────────────────────────── */

function SectionTab({
  label,
  on,
  badge,
  onPress,
}: {
  label: string;
  on: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <TapScale
      radius={11}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 13,
        borderRadius: 11,
        backgroundColor: on ? 'rgba(255,255,255,.08)' : 'transparent',
        borderWidth: 1,
        borderColor: on ? theme.a2 : 'rgba(255,255,255,.08)',
      }}
    >
      <Text
        style={[sans(600, 12), { color: on ? theme.a1 : 'rgba(255,255,255,.5)' }]}
      >
        {label}
      </Text>
      {badge ? (
        <View
          style={{
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            paddingHorizontal: 5,
            backgroundColor: theme.a1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[mono(600, 10), { color: theme.onAccent }]}>{badge}</Text>
        </View>
      ) : null}
    </TapScale>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'flex-start', gap: 4 }}>
      <Text style={[sans(800, 19), { color: theme.ink }]}>{value}</Text>
      <Text style={[sans(500, 10.5), { color: 'rgba(255,255,255,.42)' }]}>{label}</Text>
    </View>
  );
}

export function Row({ k, v }: { k: string; v: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <Text style={[sans(500, 12, 1.35), { color: 'rgba(255,255,255,.45)' }]}>{k}</Text>
      <Text
        style={[sans(600, 12.5, 1.35), { color: theme.ink, textAlign: 'right', flexShrink: 1 }]}
        numberOfLines={2}
      >
        {v}
      </Text>
    </View>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    active: 'Faol',
    pending_review: 'Ko’rib chiqilmoqda',
    rejected: 'Rad etilgan',
    draft: 'Qoralama',
  };
  return map[status] ?? status;
}

function planLabel(company: Company): string {
  const plan = company.plan;
  if (!plan) return '—';
  const base = plan.plan === 'free' ? 'Bepul' : 'Sotib olingan';
  if (plan.productLimit != null) return `${base} · ${plan.productLimit} mahsulot limiti`;
  return `${base} · cheklovsiz`;
}

/** `company_stats.ref` qiymatlari — saytdagi tugma nomlari. */
function actionLabel(key: string): string {
  const map: Record<string, string> = {
    phone: 'Telefon',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    facebook: 'Facebook',
    website: 'Veb-sayt',
    address: 'Manzil',
    map: 'Xarita',
    order: 'Buyurtma',
    share: 'Ulashish',
  };
  return map[key] ?? key;
}
