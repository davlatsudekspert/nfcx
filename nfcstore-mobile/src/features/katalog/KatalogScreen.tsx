import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  getCatalogRecords,
  getPublicCompanies,
  searchRecords,
} from '@/api/endpoints';
import type { CatalogRecord, PublicCompany } from '@/api/types';
import { StripeFill } from '@/components/StripeFill';
import { TapScale } from '@/components/TapScale';
import { HandleChip } from '@/features/profile/header/ActionButtons';
import { SwitcherSheet } from '@/features/profile/sheets/SwitcherSheet';
import { useProfileData } from '@/features/profile/useProfileData';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { A120, A150, SHADOW } from '@/theme/css';
import { useActiveIdStore } from '@/store/activeIdStore';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

import { useRecentSearches } from './useRecentSearches';

/**
 * Discover — band qilingan profillar bo'yicha yagona qidiruv oynasi.
 *
 * MUHIM: bu BITTA ID sotib olish ekrani EMAS. Bu saytdagi mavjud
 * Catalog funksiyasining o'zi: barcha ochiq profillar ro'yxati,
 * All / Personal / Expert / Business filtrlari bilan.
 *
 * Ro'yxat elementlari — MINI NFC KARTA ko'rinishida: qora fon, ingichka
 * gold chegara, chapda rasm, kartada nom va ID kod (spetsifikatsiya
 * 1-bo'lim).
 *
 * Ikki manba qo'shiladi:
 *   GET /api/records   — shaxsiy / ekspert / biznes turidagi kartalar
 *   GET /api/companies — Company ID li kompaniyalar
 * Kompaniyalar "Business" va "Barchasi" filtrlarida ko'rinadi, chunki
 * saytda ular ham biznes profillar hisoblanadi.
 *
 * BACKEND AUDITI (bu slice uchun): production Worker'da (`hosting/worker.js`)
 * shaxsiy/ekspert/biznes uchun BITTA qidiruv bor (`/api/records/search`,
 * `profileType` maydoni bilan) — shuning uchun All/Personal/Expert/Business
 * filtrlari real. Lekin butun sayt bo'ylab MAHSULOT/XIZMAT qidiruvi
 * (bitta kompaniyaning o'z katalogidan tashqari) va band qilinMAGAN NFC
 * ID'larni ko'rish/qidirish uchun HECH QANDAY endpoint yo'q — shuning
 * uchun "Mahsulot/Xizmat" va "NFC ID" filtrlari BU EKRANGA QO'SHILMADI
 * (fake natija ko'rsatmaslik uchun). NFC ID tarif katalogi allaqachon
 * `NFC` tabida bor (haqiqiy narxlar).
 */

type Filter = 'all' | 'personal' | 'expert' | 'business';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'personal', label: 'Shaxsiy' },
  { key: 'expert', label: 'Ekspert' },
  { key: 'business', label: 'Biznes' },
];

/** Ro'yxatdagi bitta element — karta yoki kompaniya. */
type Entry =
  | { kind: 'card'; id: string; name: string; code: string; city: string; photo: string; label: string }
  | { kind: 'company'; id: string; name: string; code: string; city: string; photo: string; label: string };

export function KatalogScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const setActive = useActiveIdStore((s) => s.setActive);

  const { vm, accounts, active } = useProfileData();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const recent = useRecentSearches();

  const trimmed = query.trim();
  // Yozishda HAR HARFDA so'rov yubormaslik uchun: server so'rovi faqat
  // foydalanuvchi 300ms JIM turgan qiymat bilan ishlaydi. React Query
  // buning ustiga har bir `queryKey` uchun eskirgan so'rovni o'zi
  // bekor qiladi (AbortController) — shuning uchun tezda ketma-ket
  // yozilgan holatlar ortiqcha tarmoq trafigi yaratmaydi.
  const debouncedQuery = useDebouncedValue(trimmed, 300);
  // Server qidiruvi kamida 2 belgi talab qiladi, aks holda bo'sh
  // ro'yxat qaytaradi — shuning uchun shundan qisqasida umuman
  // so'ramaymiz va butun ro'yxatni ko'rsatamiz.
  const searching = debouncedQuery.length >= 2;

  const listQuery = useQuery({
    queryKey: ['catalog', 'records'],
    queryFn: getCatalogRecords,
    enabled: !searching,
  });

  const searchQuery = useQuery({
    queryKey: ['catalog', 'search', debouncedQuery],
    queryFn: () => searchRecords(debouncedQuery),
    enabled: searching,
  });

  const companiesQuery = useQuery({
    queryKey: ['catalog', 'companies'],
    queryFn: getPublicCompanies,
  });

  // Muvaffaqiyatli qidiruv "so'nggi qidiruvlar" ro'yxatiga yoziladi —
  // faqat qurilmada (`useRecentSearches`), serverga yubormaydi.
  useEffect(() => {
    if (searching && searchQuery.isSuccess) recent.add(debouncedQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, searchQuery.isSuccess, debouncedQuery]);

  const records: CatalogRecord[] = (searching ? searchQuery.data : listQuery.data) ?? [];
  const companies: PublicCompany[] = companiesQuery.data ?? [];

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];

    // Kompaniyalar oldinda: ular Company ID li "haqiqiy" biznes
    // profillar va saytda ham yuqorida turadi.
    if (filter === 'all' || filter === 'business') {
      const q = debouncedQuery.toLowerCase();
      for (const c of companies) {
        // Kompaniyalar uchun server qidiruvi yo'q, shuning uchun
        // allaqachon yuklangan ro'yxat mahalliy filtrlanadi.
        if (searching && !`${c.displayName} ${c.companyId} ${c.city}`.toLowerCase().includes(q)) {
          continue;
        }
        out.push({
          kind: 'company',
          id: `company:${c.companyId}`,
          name: c.displayName || c.companyId,
          code: c.companyId,
          city: c.city,
          photo: c.logoUrl,
          // Haqiqiy kategoriya (`GET /api/companies`) — "Business →
          // logo + company + category" talabi.
          label: c.category || c.subcategory || 'Kompaniya',
        });
      }
    }

    for (const r of records) {
      if (filter !== 'all' && r.profileType !== filter) continue;
      out.push({
        kind: 'card',
        id: `card:${r.code}`,
        name: r.name || r.code,
        code: r.code,
        city: r.city,
        photo: r.avatarUrl,
        label: KIND_LABEL[r.profileType] ?? 'Profil',
      });
    }

    return out;
  }, [records, companies, filter, searching, debouncedQuery]);

  const loading = searching ? searchQuery.isLoading : listQuery.isLoading;
  const isError = searching ? searchQuery.isError : listQuery.isError;
  const retry = () => (searching ? searchQuery.refetch() : listQuery.refetch());

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingTop: 10 + insets.top,
          paddingHorizontal: 16,
          paddingBottom: 12,
        }}
      >
        <Text style={[sans(800, 24, 1.2), { color: theme.ink, letterSpacing: -0.48 }]}>
          Discover
        </Text>
        <HandleChip
          handle={vm?.handle ?? '@…'}
          bordered
          onPress={() => setSwitcherOpen(true)}
        />
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            paddingHorizontal: 12,
            height: 42,
            borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,.05)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,.08)',
          }}
        >
          <Svg width={15} height={15} viewBox="0 0 24 24">
            <Path
              d="M16.5 16.5L21 21M18 10.5a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"
              stroke={theme.off}
              strokeWidth={1.7}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onSubmitEditing={() => recent.add(query)}
            placeholder="Nom, ID kod yoki shahar"
            placeholderTextColor={theme.off}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={[sans(500, 13), { flex: 1, color: theme.ink, padding: 0 }]}
          />
          {query ? (
            <TapScale
              radius={8}
              onPress={() => setQuery('')}
              accessibilityLabel="Qidiruvni tozalash"
              style={{ padding: 4, borderRadius: 8 }}
            >
              <Svg width={12} height={12} viewBox="0 0 12 12">
                <Path
                  d="M1 1l10 10M11 1L1 11"
                  stroke={theme.off}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>
            </TapScale>
          ) : null}
        </View>
      </View>

      {inputFocused && !query && recent.items.length ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            paddingHorizontal: 16,
            paddingBottom: 13,
          }}
        >
          <FlatList
            horizontal
            data={recent.items}
            keyExtractor={(v) => v}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7 }}
            renderItem={({ item }) => (
              <RecentChip label={item} onPress={() => setQuery(item)} />
            )}
          />
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          gap: 7,
          paddingHorizontal: 16,
          paddingBottom: 13,
        }}
      >
        {FILTERS.map((f) => (
          <FilterChip
            key={f.key}
            label={f.label}
            on={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </View>

      {isError && !entries.length ? (
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
            onPress={retry}
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
      ) : loading && !entries.length ? (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <DiscoverSkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24,
            gap: 10,
          }}
          // 500 tagacha yozuv keladi, shuning uchun FlatList: hammasini
          // bir vaqtda chizmaydi.
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={
            <Text
              style={[
                sans(500, 12.5, 1.5),
                { color: theme.off, textAlign: 'center', paddingVertical: 40 },
              ]}
            >
              {searching
                ? `"${debouncedQuery}" bo’yicha hech narsa topilmadi`
                : 'Ro’yxat bo’sh'}
            </Text>
          }
          renderItem={({ item }) => (
            <MiniNfcCard
              entry={item}
              onPress={() =>
                router.push(
                  item.kind === 'company' ? `/c/${item.code}` : `/p/${item.code}`,
                )
              }
            />
          )}
        />
      )}

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

const KIND_LABEL: Record<string, string> = {
  personal: 'Shaxsiy',
  expert: 'Ekspert',
  business: 'Biznes',
};

/** So'nggi qidiruv chipi — bosilganda o'sha so'z qayta qidiriladi. */
function RecentChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useTheme();

  return (
    <TapScale
      radius={9}
      onPress={onPress}
      accessibilityLabel={`So'nggi qidiruv: ${label}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 11,
        borderRadius: 9,
        backgroundColor: 'rgba(255,255,255,.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,.08)',
      }}
    >
      <Svg width={11} height={11} viewBox="0 0 24 24">
        <Path
          d="M12 7v5l3.5 2M21 12a9 9 0 11-9-9 9 9 0 019 9z"
          stroke={theme.off}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      <Text style={[sans(500, 11.5), { color: 'rgba(255,255,255,.65)' }]}>{label}</Text>
    </TapScale>
  );
}

/**
 * Yuklanish skeleton'i — haqiqiy natija kartasi bilan BIR XIL o'lcham
 * (spetsifikatsiya: "skeletons matching the real layout so nothing
 * shifts"). Animatsiyasiz, statik silhouette — byudjetga mos.
 */
function DiscoverSkeletonRow() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        paddingVertical: 13,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: '#121117',
      }}
    >
      <View style={{ width: 54, height: 54, borderRadius: 9, backgroundColor: '#1b1a21' }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ width: '55%', height: 13, borderRadius: 4, backgroundColor: '#1b1a21' }} />
        <View style={{ width: '35%', height: 11, borderRadius: 4, backgroundColor: '#1b1a21' }} />
        <View style={{ width: '45%', height: 10, borderRadius: 4, backgroundColor: '#1b1a21' }} />
      </View>
    </View>
  );
}

function FilterChip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
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
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 11,
        overflow: 'hidden',
        backgroundColor: on ? undefined : 'rgba(255,255,255,.05)',
        borderWidth: 1,
        borderColor: on ? 'transparent' : 'rgba(255,255,255,.08)',
      }}
    >
      {on ? (
        <LinearGradient
          colors={[theme.a1, theme.a2]}
          start={A120.start}
          end={A120.end}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      <Text
        style={[
          sans(600, 11.5),
          { color: on ? theme.onAccent : 'rgba(255,255,255,.55)' },
        ]}
      >
        {label}
      </Text>
    </TapScale>
  );
}

/**
 * Mini NFC karta — maketdagi direktoriya elementi.
 *
 * Chegara ATAYLAB `theme.a2` (to'q aksent), `theme.rim` emas: bu
 * "ingichka gold chegara" talabi va u elementni haqiqiy NFC kartaga
 * o'xshatadi.
 */
function MiniNfcCard({ entry, onPress }: { entry: Entry; onPress: () => void }) {
  const { theme } = useTheme();

  return (
    <TapScale
      radius={12}
      onPress={onPress}
      accessibilityLabel={`${entry.name}, ${entry.code}`}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
          paddingVertical: 13,
          paddingHorizontal: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.a2,
          overflow: 'hidden',
        },
        SHADOW.card,
      ]}
    >
      <LinearGradient
        colors={[theme.c1, theme.c2]}
        start={A150.start}
        end={A150.end}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Maketdagi `inset 0 1px 0 rgba(255,255,255,.04)` — yuqori
          chetdagi nozik yorug'lik, kartaga hajm beradi. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'rgba(255,255,255,.04)',
        }}
      />

      {entry.photo ? (
        <Image
          source={{ uri: entry.photo }}
          contentFit="cover"
          style={{
            width: 54,
            height: 54,
            borderRadius: 9,
            borderWidth: 1,
            borderColor: theme.rim,
          }}
        />
      ) : (
        <StripeFill
          step={6}
          style={{
            width: 54,
            height: 54,
            borderRadius: 9,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: theme.rim,
          }}
        />
      )}

      <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
        <Text style={[sans(700, 13.5, 1.2), { color: theme.ink }]} numberOfLines={1}>
          {entry.name}
        </Text>
        <Text style={[mono(500, 11), { color: theme.a1, letterSpacing: 0.88 }]}>
          {entry.code}
        </Text>
        <Text
          style={[sans(500, 10.5), { color: 'rgba(255,255,255,.4)' }]}
          numberOfLines={1}
        >
          {entry.city ? `${entry.label} · ${entry.city}` : entry.label}
        </Text>
      </View>

      <Svg width={18} height={18} viewBox="0 0 24 24" opacity={0.8}>
        <Path
          d="M8.5 12h7M12.5 8.5l3.5 3.5-3.5 3.5"
          stroke={theme.a2}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </TapScale>
  );
}
