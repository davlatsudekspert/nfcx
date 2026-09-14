import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import { A120, A150, SHADOW } from '@/theme/css';
import { useActiveIdStore } from '@/store/activeIdStore';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * Katalog — band qilingan profillar direktoriyasi.
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

  const trimmed = query.trim();
  // Server qidiruvi kamida 2 belgi talab qiladi, aks holda bo'sh
  // ro'yxat qaytaradi — shuning uchun shundan qisqasida umuman
  // so'ramaymiz va butun ro'yxatni ko'rsatamiz.
  const searching = trimmed.length >= 2;

  const listQuery = useQuery({
    queryKey: ['catalog', 'records'],
    queryFn: getCatalogRecords,
    enabled: !searching,
  });

  const searchQuery = useQuery({
    queryKey: ['catalog', 'search', trimmed],
    queryFn: () => searchRecords(trimmed),
    enabled: searching,
  });

  const companiesQuery = useQuery({
    queryKey: ['catalog', 'companies'],
    queryFn: getPublicCompanies,
  });

  const records: CatalogRecord[] = (searching ? searchQuery.data : listQuery.data) ?? [];
  const companies: PublicCompany[] = companiesQuery.data ?? [];

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];

    // Kompaniyalar oldinda: ular Company ID li "haqiqiy" biznes
    // profillar va saytda ham yuqorida turadi.
    if (filter === 'all' || filter === 'business') {
      const q = trimmed.toLowerCase();
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
          label: 'Kompaniya',
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
  }, [records, companies, filter, searching, trimmed]);

  const loading = searching ? searchQuery.isLoading : listQuery.isLoading;

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
          Katalog
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

      {loading && !entries.length ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.a1} />
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
                ? `"${trimmed}" bo’yicha hech narsa topilmadi`
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
