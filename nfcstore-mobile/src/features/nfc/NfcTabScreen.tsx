import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Card } from '@/components/Card';
import { TapScale } from '@/components/TapScale';
import { HandleChip } from '@/features/profile/header/ActionButtons';
import { SwitcherSheet } from '@/features/profile/sheets/SwitcherSheet';
import { SITE } from '@/features/profile/profileVM';
import { useProfileData } from '@/features/profile/useProfileData';
import { activeIdEquals, useActiveIdStore } from '@/store/activeIdStore';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

import { NfcScanCard } from './NfcScanCard';

/**
 * NFC tab — spetsifikatsiya (1-bo'lim): "NFC sits centre and reads as
 * the product core". Bu slice'da faqat tayyor va haqiqiy qismlar:
 * o'qish (`NfcScanCard`, avval Home'da edi) va foydalanuvchining
 * haqiqiy egalik qilingan ID'lari (`useProfileData` — allaqachon
 * `/auth/me` + `/companies/mine` dan olinadi, mock emas).
 *
 * To'liq NFC Center (My IDs boshqaruvi, ID katalogi/tariflar sotib
 * olish, ID detali, QR+ulashish) — keyingi slice, hozir qurilmaydi.
 */
export function NfcTabScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const setActive = useActiveIdStore((s) => s.setActive);

  const { vm, accounts, active } = useProfileData();
  const [switcherOpen, setSwitcherOpen] = useState(false);

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
          NFC
        </Text>
        <HandleChip
          handle={vm?.handle ?? '@…'}
          bordered
          onPress={() => setSwitcherOpen(true)}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 12 }}
      >
        <NfcScanCard />

        <Text style={[mono(600, 11), { color: theme.platinum, letterSpacing: 1.1 }]}>
          MENING ID'LARIM
        </Text>

        {accounts.length ? (
          accounts.map((account) => (
            <TapScale
              key={account.key}
              radius={16}
              onPress={() => setActive(account.id)}
              accessibilityLabel={account.name}
              accessibilityState={{ selected: activeIdEquals(active, account.id) }}
              style={{ borderRadius: 16 }}
            >
              <Card radius={16} style={{ padding: 16, gap: 6 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <Text style={[sans(700, 14, 1.3), { color: theme.ink, flex: 1 }]}>
                    {account.name}
                  </Text>
                  <Text
                    style={[mono(600, 11), { color: theme.platinum }]}
                    numberOfLines={1}
                  >
                    {account.kind === 'Business' ? 'BIZNES' : 'SHAXSIY'}
                  </Text>
                </View>
                <Text style={[sans(400, 12, 1.5), { color: theme.ash }]}>
                  {account.handle}
                </Text>
              </Card>
            </TapScale>
          ))
        ) : (
          <Text style={[sans(500, 12.5, 1.5), { color: theme.off }]}>
            Hozircha ID yo’q.
          </Text>
        )}

        <TapScale
          radius={16}
          onPress={() => WebBrowser.openBrowserAsync(`${SITE}/narxlar`).catch(() => {})}
          accessibilityLabel="Yangi NFC ID tariflari"
          style={{ borderRadius: 16 }}
        >
          <Card radius={16} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[sans(700, 13.5), { color: theme.ink }]}>
                Yangi NFC ID sotib olish
              </Text>
              <Text style={[sans(400, 11.5, 1.4), { color: theme.ash }]}>
                Bronze · Silver · Gold · Premium · Exclusive tariflari
              </Text>
            </View>
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path
                d="M8.5 12h7M12.5 8.5l3.5 3.5-3.5 3.5"
                stroke={theme.a2}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Card>
        </TapScale>
      </ScrollView>

      <SwitcherSheet
        visible={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        accounts={accounts}
        active={active}
        onPick={setActive}
        onCreateCompany={() => WebBrowser.openBrowserAsync(`${SITE}/business`).catch(() => {})}
      />
    </View>
  );
}
