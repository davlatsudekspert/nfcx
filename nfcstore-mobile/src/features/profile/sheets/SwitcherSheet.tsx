import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CardBackdrop } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { StripeFill } from '@/components/StripeFill';
import { TapScale } from '@/components/TapScale';
import { A120 } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';
import { activeIdEquals, type ActiveId } from '@/store/activeIdStore';

import type { AccountEntry } from '../useProfileData';

/**
 * Profil almashtirgich — spetsifikatsiya 2-bo'limi va egasining
 * keyingi aniqlashtirishi:
 *
 *   "the account switcher bottom sheet must list ALL of the user's IDs
 *    together — regardless of type — clearly labeled … Selecting an
 *    entry switches the entire screen to that ID's correct layout
 *    (Personal → Personal UI, Business → Business UI) in one tap"
 *
 * Shu sababli ro'yxat turlarga BO'LINMAYDI: hammasi bitta ro'yxatda,
 * har birida turini ko'rsatuvchi yorliq — biznes uchun gold chip,
 * shaxsiy uchun neytral chip. Faol yozuvda belgi (✓) turadi.
 */
export function SwitcherSheet({
  visible,
  onClose,
  accounts,
  active,
  onPick,
  onCreateCompany,
}: {
  visible: boolean;
  onClose: () => void;
  accounts: AccountEntry[];
  active: ActiveId | null;
  onPick: (id: ActiveId) => void;
  onCreateCompany?: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title="Profilni almashtirish">
      <ScrollView
        style={{ maxHeight: 420 }}
        contentContainerStyle={{ gap: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {accounts.map((account) => {
          const isActive = activeIdEquals(active, account.id);
          return (
            <TapScale
              key={account.key}
              radius={14}
              onPress={() => {
                // Bir bosishda: tanlanadi VA varaq yopiladi. Ikki
                // harakat talab qilish (tanla, keyin yop) maketdagi
                // xatti-harakatga qarshi.
                onPick(account.id);
                onClose();
              }}
              accessibilityLabel={`${account.name}, ${account.kind}`}
              accessibilityState={{ selected: isActive }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 11,
                paddingHorizontal: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.rim,
                overflow: 'hidden',
              }}
            >
              <CardBackdrop radius={14} />

              {account.photoUrl ? (
                <Image
                  source={{ uri: account.photoUrl }}
                  contentFit="cover"
                  style={{ width: 42, height: 42, borderRadius: 21 }}
                />
              ) : (
                <StripeFill
                  step={6}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: theme.rim,
                  }}
                />
              )}

              <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
                <Text style={[sans(700, 13), { color: theme.ink }]} numberOfLines={1}>
                  {account.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <KindTag kind={account.kind} />
                  <Text
                    style={[mono(500, 11), { color: 'rgba(255,255,255,.42)' }]}
                    numberOfLines={1}
                  >
                    {account.handle}
                  </Text>
                </View>
              </View>

              {isActive ? (
                <Svg width={14} height={14} viewBox="0 0 24 24">
                  <Path
                    d="M5 12.5l4.5 4.5L19 7"
                    stroke={theme.a1}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </Svg>
              ) : null}
            </TapScale>
          );
        })}

        <TapScale
          radius={14}
          onPress={() => {
            onClose();
            onCreateCompany?.();
          }}
          accessibilityLabel="Yangi Company ID ochish"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 13,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.rim,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
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
          <Text style={[sans(600, 13), { color: theme.ink }]}>
            Yangi Company ID ochish
          </Text>
        </TapScale>
      </ScrollView>
    </Sheet>
  );
}

/** Tur yorlig'i — biznes gold, shaxsiy neytral. */
function KindTag({ kind }: { kind: 'Personal' | 'Business' }) {
  const { theme } = useTheme();
  const isBusiness = kind === 'Business';
  const label = isBusiness ? 'BIZNES' : 'SHAXSIY';

  if (isBusiness) {
    return (
      <LinearGradient
        colors={[theme.a1, theme.a2]}
        start={A120.start}
        end={A120.end}
        style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 7 }}
      >
        <Text style={[mono(600, 9.5), { color: theme.onAccent, letterSpacing: 0.76 }]}>
          {label}
        </Text>
      </LinearGradient>
    );
  }

  return (
    <View
      style={{
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 7,
        backgroundColor: 'rgba(255,255,255,.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,.12)',
      }}
    >
      <Text
        style={[mono(600, 9.5), { color: 'rgba(255,255,255,.62)', letterSpacing: 0.76 }]}
      >
        {label}
      </Text>
    </View>
  );
}
