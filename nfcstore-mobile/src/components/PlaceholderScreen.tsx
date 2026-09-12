import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { HandleChip } from '@/features/profile/header/ActionButtons';
import { SwitcherSheet } from '@/features/profile/sheets/SwitcherSheet';
import { useProfileData } from '@/features/profile/useProfileData';
import { useActiveIdStore } from '@/store/activeIdStore';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * Home / Katalog / Company ekranlari uchun vaqtinchalik qobiq.
 *
 * Bu bosqichda faqat Profil ekrani to'liq qilinadi (egasining qarori),
 * qolgan uchtasi keyingi davrada. Lekin ular BO'SH qolmaydi: har birida
 * sarlavha va ALMASHTIRGICH TUGMASI bor — egasining aniq talabi shu edi:
 *
 *   "Add the same handle + chevron switcher trigger to the Home screen's
 *    top bar too … so switching accounts is accessible from Home as
 *    well — not just from the Profile tab"
 *
 * Shuning uchun bu yerda ham Profil ekranidagi AYNAN o'sha `HandleChip`
 * va `SwitcherSheet` ishlatiladi — nusxa emas.
 */
export function PlaceholderScreen({
  title,
  note,
  planned,
}: {
  title: string;
  note: string;
  /** Keyingi bosqichda qo'shiladigan narsalar ro'yxati. */
  planned: string[];
}) {
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
          paddingBottom: 16,
        }}
      >
        <Text
          style={[sans(800, 24, 1.2), { color: theme.ink, letterSpacing: -0.48 }]}
        >
          {title}
        </Text>
        <HandleChip
          handle={vm?.handle ?? '@…'}
          bordered
          onPress={() => setSwitcherOpen(true)}
        />
      </View>

      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <Card style={{ padding: 16, gap: 8 }}>
          <Text style={[mono(600, 11), { color: theme.a1, letterSpacing: 1.1 }]}>
            KEYINGI BOSQICHDA
          </Text>
          <Text style={[sans(400, 12.5, 1.5), { color: 'rgba(255,255,255,.6)' }]}>
            {note}
          </Text>
        </Card>

        {planned.map((item) => (
          <Card key={item} shadow="soft" style={{ padding: 16 }}>
            <Text style={[sans(600, 13, 1.4), { color: theme.ink }]}>{item}</Text>
          </Card>
        ))}
      </View>

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
