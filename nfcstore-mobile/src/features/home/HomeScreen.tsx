import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { type ReactNode, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { getGiftOffers, getPaymentsSettings, getPhysicalPricing } from '@/api/endpoints';
import { CardSurface } from '@/components/Card';
import {
  CardGlyph,
  CheckCircleGlyph,
  GiftGlyph,
  LinkGlyph,
  PaymentGlyph,
} from '@/components/Glyphs';
import { IconCircle } from '@/components/IconCircle';
import { ScreenHeader, SectionDivider } from '@/components/ScreenHeader';
import { TIER_METALS, TierMedal, type TierKey } from '@/components/TierMedal';
import { TapScale } from '@/components/TapScale';
import { NfcScanCard } from '@/features/nfc/NfcScanCard';
import { SITE } from '@/features/profile/profileVM';
import { SwitcherSheet } from '@/features/profile/sheets/SwitcherSheet';
import { useProfileData } from '@/features/profile/useProfileData';
import { money } from '@/lib/format';
import { useActiveIdStore } from '@/store/activeIdStore';
import { useAuthStore } from '@/store/authStore';
import { SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * HOME — egasining boshlang'ich maydoni: kartani o'qish, ID ni
 * boshqarish, sotib olish/sovg'a qilish, tariflarni ko'rish.
 *
 * Tuzilish (spetsifikatsiya 1-ekran):
 *   sarlavha qatori  -> "Home" 29px + ost-qator + hisob chipi
 *   hero karta       -> NFC o'qish (gold ramka + nafas + sweep)
 *   5 ta ikkilamchi karta
 *   "YANGI NFC ID" ajratkichi
 *   tarif medallari (gorizontal)
 *
 * MA'LUMOT MANBALARI — hammasi jonli API dan, maketdagi sonlar
 * (120 000, "284 marta o'qildi", "9 TA") faqat o'rin egallovchi:
 *   ID holati       -> faol profil javobi (ko'rishlar, ochiq havola)
 *   Jismoniy karta  -> GET /api/settings/physical-nfc-pricing
 *   Havolalar soni  -> profil javobidagi havolalar ro'yxati
 *   Sovg'a          -> GET /api/gift-offers
 *   To'lovlar       -> GET /api/settings/payments-enabled + /auth/me
 */
export function HomeScreen() {
  const { theme } = useTheme();
  const setActive = useActiveIdStore((s) => s.setActive);
  const user = useAuthStore((s) => s.user);

  const { vm, accounts, active } = useProfileData();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const pricing = useQuery({ queryKey: ['physical-pricing'], queryFn: getPhysicalPricing });
  const gifts = useQuery({ queryKey: ['gift-offers'], queryFn: getGiftOffers });
  const payments = useQuery({ queryKey: ['payments-settings'], queryFn: getPaymentsSettings });

  const isBusiness = vm?.kind === 'business';

  // Bir dona karta narxi — birinchi tarif (1–9 dona) bo'yicha.
  const unitPrice = pricing.data?.tiers?.[0]?.pricePerUnit ?? null;
  const delivery = pricing.data?.delivery;
  const pendingGifts = (gifts.data?.incoming?.length ?? 0) + (gifts.data?.outgoing?.length ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader
        title="Home"
        sub="Yana ko’rishganimizdan xursandmiz"
        handle={vm?.handle ?? '@…'}
        onOpenSwitcher={() => setSwitcherOpen(true)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
      >
        <NfcScanCard />

        <ActionCard
          icon={<CheckCircleGlyph color="#63d694" />}
          tint="#63d694"
          title={isBusiness ? 'Biznes ID faol' : 'Shaxsiy ID faol'}
          sub={vm ? `${vm.views} marta o’qildi · ${publicUrl(vm)}` : 'ID yuklanmoqda…'}
          meta={vm ? 'FAOL' : '—'}
          metaColor="#63d694"
          onPress={vm ? () => openUrl(publicUrl(vm, true)) : undefined}
        />

        <ActionCard
          icon={<CardGlyph color={theme.a1} />}
          title={
            isBusiness ? 'Jamoa uchun kartalar buyurtma qilish' : 'Jismoniy karta buyurtma qilish'
          }
          sub={
            delivery
              ? `Rang va uslubni tanlang, ${delivery.maxDays} kunda yetib boradi`
              : 'Rang va uslubni tanlang'
          }
          meta={unitPrice != null ? money(unitPrice) : '…'}
          onPress={() => openUrl(`${SITE}/karta-dizayni`)}
        />

        {isBusiness ? (
          <ActionCard
            icon={<LinkGlyph color={theme.a1} />}
            title="Mahsulot qo’shish"
            sub="Nom, narx va rasm bilan katalogni to’ldiring"
            meta={`${vm?.third.value ?? 0} TA`}
            onPress={vm?.companyId ? () => openUrl(`${SITE}/c/${vm.companyId}`) : undefined}
          />
        ) : (
          <ActionCard
            icon={<LinkGlyph color={theme.a1} />}
            title="Havolalarni tahrirlash"
            sub="Veb-sayt, Telegram, portfolio, kalendar"
            meta={`${vm?.third.value ?? 0} TA`}
            onPress={vm?.code ? () => openUrl(`${SITE}/${vm.code}`) : undefined}
          />
        )}

        <ActionCard
          icon={<GiftGlyph color={theme.a1} />}
          title={isBusiness ? 'Mijozga ID sovg’a qilish' : 'Do’stga ID sovg’a qilish'}
          sub={
            pendingGifts > 0
              ? 'Tasdiqlashni kutayotgan sovg’alar bor'
              : 'Qabul qiluvchi tasdiqlashi kerak'
          }
          meta={pendingGifts > 0 ? `${pendingGifts} KUTILMOQDA` : 'BEPUL'}
          onPress={() => openUrl(`${SITE}/gifts`)}
        />

        <ActionCard
          icon={<PaymentGlyph color={theme.a1} />}
          title="To’lovlar"
          sub={paymentsSub(user, payments.data?.sandbox)}
          meta={payments.data?.providers?.payme?.enabled === false ? 'O’CHIRILGAN' : 'PAYME'}
          onPress={() => openUrl(`${SITE}/tolovlar`)}
        />

        <SectionDivider label="YANGI NFC ID" />
        <TierStrip />
      </ScrollView>

      <SwitcherSheet
        visible={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        accounts={accounts}
        active={active}
        onPick={setActive}
      />
    </View>
  );
}

/**
 * Ikkilamchi karta — Home dagi beshta qatorning hammasi shu qobiqda:
 *
 *   row, gap 14, padding 15, radius 16, karta gradienti + rim-glow
 *   ikonka: 46×46 DUMALOQ plita, glif 19px stroke 1.7
 *   sarlavha 15.5px 700 · ost-qator 12px 400 rgba(255,255,255,.52)
 *   meta 10.5px IBM Plex Mono, aksent rangida, qatorga sig'maydi
 */
function ActionCard({
  icon,
  tint,
  title,
  sub,
  meta,
  metaColor,
  onPress,
}: {
  icon: ReactNode;
  tint?: string;
  title: string;
  sub: string;
  meta: string;
  metaColor?: string;
  onPress?: () => void;
}) {
  const { theme } = useTheme();

  return (
    <TapScale
      radius={16}
      onPress={onPress}
      accessibilityLabel={`${title}. ${sub}`}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 15,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.rim,
          backgroundColor: theme.c2,
          overflow: 'hidden',
        },
        SH.card(theme.a2),
      ]}
    >
      <CardSurface />
      <IconCircle tint={tint}>{icon}</IconCircle>

      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text style={[sans(700, 15.5, 1.3), { color: theme.ink }]} numberOfLines={1}>
          {title}
        </Text>
        <Text
          style={[sans(400, 12, 1.45), { color: 'rgba(255,255,255,.52)' }]}
          numberOfLines={2}
        >
          {sub}
        </Text>
      </View>

      <Text
        style={[mono(500, 10.5), { color: metaColor ?? theme.a1, flexShrink: 0 }]}
        numberOfLines={1}
      >
        {meta}
      </Text>
    </TapScale>
  );
}

/**
 * Tarif chizig'i — 96px kengligidagi kartalar, ichida 46px metall
 * medal, nom va narx.
 *
 * NARXLAR HAQIDA: bu sonlar maketdan EMAS, backenddagi haqiqiy
 * konstantadan olingan — `hosting/worker.js` dagi
 *
 *   const PERSONAL_TIER_PRICE =
 *     { exclusive: 490000, premium: 199000, gold: 149000,
 *       silver: 99000, free: 49000 };
 *
 * Ularni ochiq beradigan endpoint hozircha YO'Q, shuning uchun qiymat
 * shu yerda takrorlanadi. Narx o'zgarganda ikki joyni yangilash kerak
 * bo'ladi — buni yo'qotish uchun backendga kichik `GET
 * /api/settings/id-pricing` qo'shilsa, bu ro'yxat o'chiriladi.
 * (Hisobotda alohida taklif sifatida keltirilgan; backendga bu
 * bosqichda tegilmaydi.)
 */
const TIERS: { key: TierKey; price: number; from?: boolean }[] = [
  { key: 'free', price: 49_000 },
  { key: 'silver', price: 99_000 },
  { key: 'gold', price: 149_000 },
  { key: 'premium', price: 199_000 },
  // Exclusive to'g'ridan-to'g'ri sotilmaydi — "dan" boshlanadi
  // (worker.js: `exclusive` uchun narx qat'iy emas).
  { key: 'exclusive', price: 490_000, from: true },
];

function TierStrip() {
  const { theme } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // `boxShadow` karta chetidan tashqariga chiqadi — ro'yxat uni
      // kesib tashlamasligi uchun ichkarida bo'sh joy qoldiriladi.
      contentContainerStyle={{ gap: 9, paddingVertical: 6, paddingRight: 6 }}
      style={{ marginVertical: -6, flexGrow: 0 }}
    >
      {TIERS.map((t) => {
        const metal = TIER_METALS[t.key];
        return (
          <TapScale
            key={t.key}
            radius={16}
            onPress={() => openUrl(`${SITE}/narxlar`)}
            accessibilityLabel={`${metal.name} tarifi, ${money(t.price)}`}
            style={[
              {
                width: 96,
                alignItems: 'center',
                gap: 9,
                paddingVertical: 14,
                paddingHorizontal: 10,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.rim,
                backgroundColor: theme.c2,
                overflow: 'hidden',
              },
              SH.cardTight(theme.a2),
            ]}
          >
            <CardSurface />
            <TierMedal m1={metal.m1} m2={metal.m2} />
            <Text style={[sans(700, 12), { color: theme.ink }]}>{metal.name}</Text>
            <Text
              style={[mono(400, 9.5), { color: 'rgba(255,255,255,.5)' }]}
              numberOfLines={1}
            >
              {t.from ? `${money(t.price)} dan` : money(t.price)}
            </Text>
          </TapScale>
        );
      })}
    </ScrollView>
  );
}

/* ── yordamchilar ─────────────────────────────────────────────────── */

function publicUrl(vm: { kind: string; companyId?: string; code?: string }, full = false) {
  // Maketda `nfcstore.uz/id/<slug>` yozilgan, lekin saytdagi HAQIQIY
  // manzil boshqacha: kartalar uchun `/<KOD>`, kompaniyalar uchun
  // `/c/<ID>`. Ko'rsatilayotgan havola bosilganda ochiladigan havola
  // bilan bir xil bo'lishi shart, shuning uchun haqiqiy manzil.
  const path = vm.kind === 'business' ? `/c/${vm.companyId}` : `/${vm.code}`;
  return full ? `${SITE}${path}` : `nfcstore.uz${path}`;
}

function paymentsSub(
  user:
    | { isPremium?: boolean; premiumExpiresAt?: string | null; trialExpiresAt?: string | null }
    | null
    | undefined,
  sandbox?: boolean,
): string {
  const parts: string[] = [];
  if (sandbox) parts.push('TEST REJIMI');

  if (user?.premiumExpiresAt) {
    parts.push(`Karta ulangan · keyingi to’lov ${formatDate(user.premiumExpiresAt)}`);
  } else if (user?.isPremium) {
    // Eski bir martalik to'lov — muddatsiz (worker.js dagi izohga qarang).
    parts.push('Premium faol — muddatsiz');
  } else if (user?.trialExpiresAt) {
    parts.push(`Sinov davri ${formatDate(user.trialExpiresAt)} gacha`);
  } else {
    parts.push('Karta ulanmagan');
  }
  return parts.join(' · ');
}

function formatDate(iso: string): string {
  const ts = Date.parse(iso.replace(' ', 'T'));
  if (!Number.isFinite(ts)) return iso;
  return new Date(ts).toLocaleDateString('uz-UZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Tashqi havolalar ilova ichidagi brauzerda ochiladi.
 *
 * To'lov oqimi ham shu yo'l bilan: spetsifikatsiya aniq aytadi —
 * Payme/Click mantig'i ILOVADA QURILMAYDI, mavjud checkout havolasi
 * ochiladi (saytdagi naqshning o'zi).
 */
function openUrl(url: string) {
  WebBrowser.openBrowserAsync(url).catch(() => {});
}
