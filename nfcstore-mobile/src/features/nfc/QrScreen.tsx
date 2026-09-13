import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { BackBar } from '@/components/BackBar';
import { Card } from '@/components/Card';
import { GhostButton, GoldButton } from '@/components/GoldButton';
import { StripeFill } from '@/components/StripeFill';
import { useProfileData } from '@/features/profile/useProfileData';
import { useTheme } from '@/theme/ThemeProvider';
import { sans, mono } from '@/theme/type';

/**
 * QR + ulashish — `design_handoff_nfcstore_app` (NFC Center flow).
 *
 * MUHIM (egasining qoidalari):
 *   1. QR hech qachon fake qiymatdan generatsiya qilinmaydi.
 *   2. QR manbasi HAQIQIY NFCSTORE ochiq URL — `useProfileData()` dan
 *      kelgan `vm.shareUrl`. Bu AYNAN o'sha manba: `ActionButtons.tsx`
 *      dagi "Ulashish" tugmasi ham shu maydondan foydalanadi (bitta
 *      yagona haqiqat manbai) — shaxsiyda `${SITE}/CODE`, biznesda
 *      `${SITE}/kompaniyalar/id` (ikkalasi ham `src/lib/tagUrl.ts`
 *      tomonidan qo'llab-quvvatlanadigan haqiqiy ochiq yo'l).
 *   3. `vm` — `useProfileData()` orqali FAOL identity'ga (`activeIdStore`)
 *      obuna. Profil Switcher orqali identity o'zgarsa, shu komponent
 *      qayta render bo'ladi va QR/nom/avatar DARHOL yangi haqiqiy
 *      qiymat bilan yangilanadi — qo'lda yangilash shart emas.
 *   4. QR faqat CLIENTDA chiziladi (`react-native-qrcode-svg`,
 *      `react-native-svg` ustida — loyihada allaqachon bor edi), lekin
 *      uning MAZMUNI (`value={vm.shareUrl}`) to'liq backend/real profil
 *      routingiga bog'liq.
 *
 * QURILMAGAN: "QR rasmini ulashish" (bitmap sifatida). Buning uchun
 * faylga yozish kerak (`expo-file-system` + `expo-sharing`) — bu
 * slice'da FAQAT `react-native-qrcode-svg` tasdiqlangan edi, shuning
 * uchun qo'shimcha ikkita native bog'liqlik qo'shilmadi. Havolani
 * ulashish (`Share.share`) va nusxalash (`expo-clipboard` — bu ham
 * kichik, zarur qo'shimcha) to'liq ishlaydi.
 */
export function QrScreen() {
  const { theme } = useTheme();
  const { vm } = useProfileData();
  const [copied, setCopied] = useState(false);

  if (!vm) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <BackBar title="QR kod" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[sans(500, 12.5, 1.5), { color: theme.off }]}>Yuklanmoqda…</Text>
        </View>
      </View>
    );
  }

  const idLabel = vm.kind === 'business' ? vm.companyId! : vm.code!;

  const copyLink = async () => {
    await Clipboard.setStringAsync(vm.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const shareLink = () => {
    Share.share({ message: `${vm.name} — ${vm.shareUrl}`, url: vm.shareUrl }).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <BackBar title="QR kod" subtitle={vm.handle} />

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, gap: 20 }}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          {vm.photoUrl ? (
            <Image
              source={{ uri: vm.photoUrl }}
              contentFit="cover"
              style={{ width: 56, height: 56, borderRadius: vm.kind === 'business' ? 14 : 28 }}
            />
          ) : (
            <StripeFill
              step={6}
              style={{
                width: 56,
                height: 56,
                borderRadius: vm.kind === 'business' ? 14 : 28,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: theme.rim,
              }}
            />
          )}
          <Text style={[sans(800, 18, 1.2), { color: theme.ink }]}>{vm.name}</Text>
          <Text style={[mono(600, 12), { color: theme.platinum, letterSpacing: 1 }]}>
            {idLabel}
          </Text>
        </View>

        <Card
          radius={20}
          style={{ alignItems: 'center', paddingVertical: 28, gap: 16 }}
        >
          <View
            style={{
              padding: 14,
              borderRadius: 16,
              backgroundColor: '#ffffff',
            }}
          >
            <QRCode
              value={vm.shareUrl}
              size={200}
              color={theme.bg}
              backgroundColor="#ffffff"
            />
          </View>
          <Text
            style={[mono(500, 11), { color: theme.ash, letterSpacing: 0.4 }]}
            numberOfLines={1}
          >
            {vm.shareUrl}
          </Text>
        </Card>

        <View style={{ gap: 10 }}>
          <GoldButton
            label={copied ? 'Nusxalandi' : 'Havolani nusxalash'}
            onPress={copyLink}
            sweep={false}
          />
          <GhostButton label="Ulashish" onPress={shareLink} />
        </View>
      </View>
    </View>
  );
}
