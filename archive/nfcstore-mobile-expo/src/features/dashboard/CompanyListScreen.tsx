import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { getMyCompanies } from '@/api/endpoints';
import { Card } from '@/components/Card';
import { StripeFill } from '@/components/StripeFill';
import { TapScale } from '@/components/TapScale';
import { HandleChip } from '@/features/profile/header/ActionButtons';
import { SwitcherSheet } from '@/features/profile/sheets/SwitcherSheet';
import { SITE } from '@/features/profile/profileVM';
import { useProfileData } from '@/features/profile/useProfileData';
import { compactCount } from '@/lib/format';
import { useActiveIdStore } from '@/store/activeIdStore';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * Kompaniyalar tabi — foydalanuvchining barcha Company ID lari.
 *
 * Har bir yozuv Dashboard'ga olib boradi (egasi bo'lsa). Yangi Company
 * ID ochish oqimi hozircha veb orqali: u alohida ko'p qadamli forma
 * (nom tanlash, kategoriya, tavsif, to'lov) va keyingi bosqichga
 * kelishilgan.
 */
export function CompanyListScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const setActive = useActiveIdStore((s) => s.setActive);

  const { vm, accounts, active } = useProfileData();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const companies = useQuery({ queryKey: ['companies', 'mine'], queryFn: getMyCompanies });
  const list = companies.data ?? [];

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
          paddingBottom: 14,
        }}
      >
        <Text style={[sans(800, 24, 1.2), { color: theme.ink, letterSpacing: -0.48 }]}>
          Kompaniyalar
        </Text>
        <HandleChip
          handle={vm?.handle ?? '@…'}
          bordered
          onPress={() => setSwitcherOpen(true)}
        />
      </View>

      {companies.isLoading && !list.length ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.a1} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 12 }}
        >
          {list.map((company) => (
            <TapScale
              key={company.companyId}
              radius={16}
              onPress={() => router.push(`/dashboard/${company.companyId}`)}
              accessibilityLabel={`${company.displayName} — Dashboard`}
              style={{ borderRadius: 16 }}
            >
              <Card radius={16} style={{ padding: 16, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {company.logoUrl ? (
                    <Image
                      source={{ uri: company.logoUrl }}
                      contentFit="cover"
                      style={{ width: 46, height: 46, borderRadius: 12 }}
                    />
                  ) : (
                    <StripeFill
                      step={6}
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: theme.rim,
                      }}
                    />
                  )}

                  <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
                    <Text
                      style={[sans(700, 14, 1.25), { color: theme.ink }]}
                      numberOfLines={1}
                    >
                      {company.displayName || company.companyId}
                    </Text>
                    <Text style={[mono(500, 11), { color: theme.a1, letterSpacing: 0.88 }]}>
                      {company.companyId}
                    </Text>
                  </View>

                  <Svg width={18} height={18} viewBox="0 0 24 24">
                    <Path
                      d="M8.5 12h7M12.5 8.5l3.5 3.5-3.5 3.5"
                      stroke={theme.a2}
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </Svg>
                </View>

                <Text style={[sans(400, 12, 1.45), { color: 'rgba(255,255,255,.48)' }]}>
                  {company.catalog.length} mahsulot ·{' '}
                  {compactCount(company.followers)} obunachi ·{' '}
                  {compactCount(company.views)} ko’rish
                </Text>
              </Card>
            </TapScale>
          ))}

          <TapScale
            radius={16}
            onPress={() => WebBrowser.openBrowserAsync(`${SITE}/business`).catch(() => {})}
            accessibilityLabel="Yangi Company ID ochish"
            style={{
              borderRadius: 16,
              paddingVertical: 18,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.rim,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,.05)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={14} height={14} viewBox="0 0 8 8">
                <Path
                  d="M4 .8v6.4M.8 4h6.4"
                  stroke={theme.a1}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[sans(600, 13.5), { color: theme.ink }]}>
                Yangi Company ID ochish
              </Text>
              <Text style={[sans(400, 11.5, 1.4), { color: 'rgba(255,255,255,.45)' }]}>
                Bepul avtomatik ID yoki tanlangan nom
              </Text>
            </View>
          </TapScale>

          {!list.length ? (
            <Text
              style={[
                sans(500, 12.5, 1.5),
                { color: theme.off, textAlign: 'center', paddingVertical: 20 },
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
