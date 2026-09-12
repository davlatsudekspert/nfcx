import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

/**
 * Tasdiqlangan kompaniya nishoni.
 *
 * HOZIRCHA BIZNES PROFILDA KO'RSATILMAYDI. Sababi: `companies`
 * jadvalida `verified` ustuni YO'Q (u faqat `cards` da bor —
 * hosting/worker.js, rowToRecord). Nishonni `status === 'active'` ga
 * bog'lash yolg'on signal berardi: "faol" va "haqiqatan tekshirilgan
 * brend" — boshqa-boshqa narsa.
 *
 * TODO: `companies.verified` backend ustuni qo'shilgach yoqiladi —
 * o'sha paytda `businessVerified()` ichidagi `false` o'rniga
 * `company.verified` qaytariladi, boshqa hech narsa o'zgarmaydi.
 */
export function businessVerified(_company: { status?: string }): boolean {
  return false;
}

/** Shaxsiy kartada `verified` ustuni BOR — u to'g'ridan-to'g'ri ishlatiladi. */
export function personalVerified(card: { verified?: boolean }): boolean {
  return !!card.verified;
}

export function VerifiedBadge({ size = 17 }: { size?: number }) {
  const { theme } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Tasdiqlangan">
      <Path
        d="M12 2.6l2.4 1.8 3-.2.9 2.9 2.4 1.8-1.2 2.8 1.2 2.8-2.4 1.8-.9 2.9-3-.2L12 21l-2.4-1.8-3 .2-.9-2.9L3.3 14.7l1.2-2.8-1.2-2.8 2.4-1.8.9-2.9 3 .2L12 2.6z"
        fill={theme.a1}
      />
      <Path
        d="M8.6 12.2l2.4 2.4 4.5-4.8"
        stroke={theme.bg}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * "Hozir ochiq / Yopiq" + ish vaqti.
 *
 * `openNow` SERVERDA Toshkent vaqti bo'yicha hisoblanadi
 * (companyOpenStateD1) — telefonning vaqt mintaqasiga tayanmaymiz,
 * aks holda chet elda turgan odam "yopiq" deb ko'rardi.
 *
 * Maketda faqat "Open now" holati chizilgan edi; "Yopiq" varianti
 * spetsifikatsiyaning 3-bo'limi talabi bo'yicha shu yerda qo'shildi va
 * bir xil shaklni saqlaydi, faqat rang so'ngan qizilga o'tadi.
 */
export function OpenNowBadge({
  openNow,
  hours,
}: {
  openNow: boolean;
  hours: string;
}) {
  const tone = openNow
    ? { fg: '#63d694', bg: 'rgba(64,190,120,.12)', rim: 'rgba(64,190,120,.28)' }
    : { fg: '#d98b8b', bg: 'rgba(190,80,80,.12)', rim: 'rgba(190,80,80,.26)' };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingVertical: 4,
          paddingHorizontal: 9,
          borderRadius: 8,
          backgroundColor: tone.bg,
          borderWidth: 1,
          borderColor: tone.rim,
        }}
      >
        <View
          style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: tone.fg }}
        />
        <Text style={[sans(600, 10.5), { color: tone.fg }]}>
          {openNow ? 'Hozir ochiq' : 'Yopiq'}
        </Text>
      </View>
      {hours ? (
        <Text style={[sans(500, 11.5), { color: 'rgba(255,255,255,.45)' }]}>{hours}</Text>
      ) : null}
    </View>
  );
}

/** Shaxsiy profildagi rol qatori — ish vaqti o'rniga. */
export function RoleLine({ role }: { role: string }) {
  const { theme } = useTheme();
  if (!role) return null;
  return (
    <Text
      // line-height 1.4 ATAYLAB: maketda bu qator telefon/shahar
      // qatoriga tegib ketgan edi, shu bilan tuzatilgan.
      style={[
        sans(600, 12, 1.4),
        { color: theme.a1, marginTop: 8 },
      ]}
      numberOfLines={1}
    >
      {role}
    </Text>
  );
}
