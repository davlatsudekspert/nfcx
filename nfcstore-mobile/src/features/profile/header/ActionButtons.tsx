import { Share, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { GhostButton, GoldButton } from '@/components/GoldButton';
import { TapScale } from '@/components/TapScale';
import { useTheme } from '@/theme/ThemeProvider';
import { mono } from '@/theme/type';

/**
 * Sarlavha ostidagi amal tugmalari — spetsifikatsiya 5-bo'limi:
 *
 *   EGASI       biznes:  [Dashboard] [Profilni tahrirlash] [Ulashish]
 *               shaxsiy: [Profilni tahrirlash] [Ulashish]
 *   TASHRIFCHI           [Obuna bo'lish] [Ulashish]
 *
 * "Xabar yozish" tugmasi ATAYLAB yo'q — NFCSTORE da ichki messaging
 * mavjud emas. Uning o'rniga telefon va manzil sarlavhadagi kontakt
 * ikonkalari orqali beriladi.
 *
 * "Dashboard" har doim faol temaning aksentida — maketdagi "ko'k
 * Dashboard" muammosi tema Midnight Blue da qolganidan edi, kodda
 * qattiq yozilgan ko'k rangdan emas. Bu yerda hech qanday qattiq rang
 * yo'q.
 */
export function ActionButtons({
  isOwner,
  isBusiness,
  following,
  onFollow,
  onDashboard,
  onEdit,
  shareUrl,
  shareTitle,
}: {
  isOwner: boolean;
  isBusiness: boolean;
  following: boolean;
  onFollow?: () => void;
  onDashboard?: () => void;
  onEdit?: () => void;
  shareUrl: string;
  shareTitle: string;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, width: '100%' }}>
      {isOwner ? (
        <>
          {isBusiness ? (
            <GoldButton label="Dashboard" onPress={onDashboard} style={{ flex: 1 }} />
          ) : null}
          <GhostButton label="Profilni tahrirlash" onPress={onEdit} style={{ flex: 1 }} />
        </>
      ) : following ? (
        <GhostButton label="Obuna bo’lingan" onPress={onFollow} style={{ flex: 1 }} />
      ) : (
        <GoldButton
          label="Obuna bo’lish"
          onPress={onFollow}
          sweep={false}
          style={{ flex: 1 }}
        />
      )}

      <TapScale
        radius={13}
        accessibilityLabel="Ulashish"
        onPress={() => {
          Share.share({ message: `${shareTitle} — ${shareUrl}`, url: shareUrl }).catch(
            () => {},
          );
        }}
        style={{
          width: 44,
          height: 40,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,.06)',
          borderWidth: 1,
          borderColor: theme.rim,
        }}
      >
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path
            d="M12 3v12M12 3L7.5 7.6M12 3l4.5 4.6M4.5 13.6V19a2 2 0 002 2h11a2 2 0 002-2v-5.4"
            stroke={theme.ink}
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </TapScale>
    </View>
  );
}

/**
 * Sarlavha yuqorisidagi handle + chevron — PROFIL ALMASHTIRGICHNING
 * kirish nuqtasi.
 *
 * Spetsifikatsiya talabi: u Personal va Business ekranlarda BIR XIL
 * joyda va bir xil ishlashi kerak. Shuning uchun bu komponent profil
 * turiga umuman qaramaydi — ikkala ko'rinish ham shu bitta qatordan
 * foydalanadi. Home / Katalog / Company ekranlarida ham xuddi shu
 * komponent ishlatiladi.
 */
export function HandleChip({
  handle,
  onPress,
  bordered = false,
}: {
  handle: string;
  onPress: () => void;
  /** Home/Katalog/Company da maketda chegara bor, profilda yo'q. */
  bordered?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <TapScale
      radius={12}
      onPress={onPress}
      accessibilityLabel={`${handle} — profilni almashtirish`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,.04)',
        ...(bordered ? { borderWidth: 1, borderColor: theme.rim } : null),
      }}
    >
      <Text
        style={[
          mono(600, bordered ? 12 : 13),
          { color: 'rgba(255,255,255,.72)', letterSpacing: bordered ? 0.6 : 0.78 },
        ]}
      >
        {handle}
      </Text>
      <Svg width={10} height={6} viewBox="0 0 10 6">
        <Path
          d="M1 1l4 4 4-4"
          stroke={theme.a1}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </TapScale>
  );
}

/** Sozlamalar tishli g'ildiragi — profil ekranining o'ng yuqori burchagida. */
export function SettingsButton({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <TapScale
      radius={12}
      onPress={onPress}
      accessibilityLabel="Sozlamalar"
      style={{
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,.04)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={17} height={17} viewBox="0 0 24 24">
        <Path
          d="M12 2.8v2.6M12 18.6v2.6M4.5 4.5l1.9 1.9M17.6 17.6l1.9 1.9M2.8 12h2.6M18.6 12h2.6M4.5 19.5l1.9-1.9M17.6 6.4l1.9-1.9"
          stroke={theme.ink}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M15.2 12a3.2 3.2 0 11-6.4 0 3.2 3.2 0 016.4 0z"
          stroke={theme.ink}
          strokeWidth={1.6}
          fill="none"
        />
      </Svg>
    </TapScale>
  );
}
