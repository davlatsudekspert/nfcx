import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { getMyCompanies } from '@/api/endpoints';
import type { Company } from '@/api/types';
import { CardSurface } from '@/components/Card';
import { BuildingGlyph, ChevronRight, PlusGlyph } from '@/components/Glyphs';
import { GoldCircle, IconCircle } from '@/components/IconCircle';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StripeFill } from '@/components/StripeFill';
import { TapScale } from '@/components/TapScale';
import { SITE } from '@/features/profile/profileVM';
import { SwitcherSheet } from '@/features/profile/sheets/SwitcherSheet';
import { useProfileData } from '@/features/profile/useProfileData';
import { compactCount } from '@/lib/format';
import { useActiveIdStore } from '@/store/activeIdStore';
import { A120, A165, SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * COMPANY — foydalanuvchining barcha Company ID lari.
 *
 * Har bir yozuv Dashboard'ga olib boradi. Yangi Company ID ochish oqimi
 * veb orqali: u ko'p qadamli forma (nom tanlash, kategoriya, tavsif,
 * to'lov) va keyingi bosqichga kelishilgan.
 */
export function CompanyListScreen() {
  const { theme } = useTheme();
  const setActive = useActiveIdStore((s) => s.setActive);

  const { vm, accounts, active } = useProfileData();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const companies = useQuery({ queryKey: ['companies', 'mine'], queryFn: getMyCompanies });
  const list = companies.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader
        title="Kompaniyalar"
        sub="Quring. Boshqaring. O’stiring."
        handle={vm?.handle ?? '@…'}
        onOpenSwitcher={() => setSwitcherOpen(true)}
      />

      {companies.isLoading && !list.length ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.a1} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        >
          {list.map((company) => (
            <CompanyCard key={company.companyId} company={company} />
          ))}

          <CreateCompanyCard
            onPress={() => WebBrowser.openBrowserAsync(`${SITE}/business`).catch(() => {})}
          />

          {!list.length ? (
            <Text
              style={[
                sans(500, 12.5, 1.5),
                { color: theme.off, textAlign: 'center', paddingVertical: 16 },
              ]}
            >
              Hozircha kompaniyangiz yo’q.
            </Text>
          ) : null}
        </ScrollView>
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

/**
 * Kompaniya kartasi — Home dagi ikkilamchi kartaning qobig'i, lekin
 * ikonka o'rnida 48px DUMALOQ logotip uyasi (o'ng pastki burchagida
 * kichik bino belgisi) va o'ngda rol nishoni turadi.
 *
 * ROL HAQIDA: `GET /api/companies/mine` faqat `owner_user_id = men`
 * bo'lgan kompaniyalarni qaytaradi, ya'ni hozirgi backendda bu ro'yxat
 * har doim EGA. ADMIN darajasi backendda hali yo'q (a'zolik jadvali
 * mavjud emas), shuning uchun nishon ma'lumotdan o'qiladi va faqat
 * mavjud bo'lmaganda "OWNER" ga tushadi — a'zolik qo'shilganda kod
 * o'zgarmasdan to'g'ri ishlaydi.
 */
function CompanyCard({ company }: { company: Company }) {
  const { theme } = useTheme();
  const role = (company.role || 'owner').toUpperCase();
  const isOwner = role === 'OWNER';

  return (
    <TapScale
      radius={16}
      onPress={() => router.push(`/dashboard/${company.companyId}`)}
      accessibilityLabel={`${company.displayName || company.companyId} — Dashboard`}
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

      <View style={{ width: 48, height: 48 }}>
        <IconCircle size={48}>
          {company.logoUrl ? (
            <Image
              source={{ uri: company.logoUrl }}
              contentFit="cover"
              style={{ width: 48, height: 48, borderRadius: 24 }}
            />
          ) : (
            <StripeFill
              step={6}
              style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden' }}
            />
          )}
        </IconCircle>
        {/* Kichik bino belgisi — o'ng pastki burchakda. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: theme.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BuildingGlyph color={theme.a1} size={12} width={1.8} />
        </View>
      </View>

      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text style={[sans(700, 15.5, 1.3), { color: theme.ink }]} numberOfLines={1}>
          {company.displayName || company.companyId}
        </Text>
        <Text
          style={[sans(400, 12, 1.45), { color: 'rgba(255,255,255,.52)' }]}
          numberOfLines={1}
        >
          {company.catalog.length} mahsulot · {compactCount(company.followers)} obunachi
        </Text>
      </View>

      <RoleBadge label={isOwner ? 'EGA' : role} gold={isOwner} />
      <ChevronRight color={theme.a2} size={16} width={1.7} />
    </TapScale>
  );
}

/**
 * Rol nishoni:
 *   OWNER      — gold gradient + `inset 0 1px 0 rgba(255,255,255,.45)`,
 *                yozuv `#150f04`
 *   ADMIN/…    — `rgba(255,255,255,.07)`, `1px solid rgba(255,255,255,.12)`,
 *                yozuv `rgba(255,255,255,.6)`
 */
function RoleBadge({ label, gold }: { label: string; gold: boolean }) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        paddingVertical: 5,
        paddingHorizontal: 9,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: gold ? theme.a2 : 'rgba(255,255,255,.07)',
        borderWidth: gold ? 0 : 1,
        borderColor: 'rgba(255,255,255,.12)',
      }}
    >
      {gold ? (
        <>
          <LinearGradient
            colors={[theme.a1, theme.a2]}
            start={A120.start}
            end={A120.end}
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: 'rgba(255,255,255,.45)',
            }}
          />
        </>
      ) : null}
      <Text
        style={[
          mono(600, 9.5),
          {
            color: gold ? theme.onAccent : 'rgba(255,255,255,.6)',
            letterSpacing: 0.76,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * "Yangi Company ID" kartasi:
 *   1px dashed #b3860f
 *   linear-gradient(165deg, rgba(240,207,122,.07), rgba(240,207,122,.02))
 *   box-shadow: 0 8px 20px rgba(0,0,0,.4), 0 0 18px -6px #b3860f
 *   48px gold to'ldirilgan doira ichida `+`
 */
function CreateCompanyCard({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();

  return (
    <TapScale
      radius={16}
      onPress={onPress}
      pulseColor={theme.a1}
      accessibilityLabel="Yangi Company ID ochish"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 15,
          borderRadius: 16,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.a2,
          backgroundColor: theme.bg,
          overflow: 'hidden',
        },
        { boxShadow: `0px 8px 20px rgba(0, 0, 0, 0.4), 0px 0px 18px -6px ${theme.a2}` },
      ]}
    >
      <LinearGradient
        colors={[withAlpha(theme.a1, 0.07), withAlpha(theme.a1, 0.02)]}
        start={A165.start}
        end={A165.end}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <GoldCircle size={48}>
        <PlusGlyph color={theme.onAccent} size={17} width={2} />
      </GoldCircle>

      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text style={[sans(700, 15.5, 1.3), { color: theme.ink }]}>
          Yangi Company ID ochish
        </Text>
        <Text style={[sans(400, 12, 1.45), { color: 'rgba(255,255,255,.52)' }]}>
          Yana bitta biznes profilini ro’yxatdan o’tkazing
        </Text>
      </View>

      <Text style={[mono(500, 10.5), { color: theme.a1, flexShrink: 0 }]}>YANGI</Text>
    </TapScale>
  );
}

/** `#rrggbb` -> `rgba(r,g,b,a)` — punktir kartaning yumshoq gold foni. */
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
