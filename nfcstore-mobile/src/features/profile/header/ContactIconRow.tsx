import { LinearGradient } from 'expo-linear-gradient';
import { Linking, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { TapScale } from '@/components/TapScale';
import { useSvgId } from '@/lib/svgId';
import { A160 } from '@/theme/css';
import { BRAND } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeProvider';
import { SHADOW } from '@/theme/css';

/**
 * Kontakt ikonkalari qatori — spetsifikatsiya 3-bo'limi:
 * call, Telegram, WhatsApp, Instagram, Facebook.
 *
 * RANG QOIDASI (egasining aniq talabi): faqat GLIFning o'zi brend
 * rangini oladi — Telegram ko'k, WhatsApp yashil, Instagram gradient,
 * Facebook ko'k. Ikonkani o'rab turgan doira/kvadrat esa ilovaning qora
 * karta uslubida qoladi. Shunda premium ko'rinish saqlanadi va ekran
 * "kamalak" bo'lib ketmaydi.
 *
 * Qo'ng'iroq ikonkasi brendsiz, shuning uchun u temaning aksent rangida
 * (gold) — maketda ham shunday.
 *
 * "Xabar yozish" tugmasi YO'Q: NFCSTORE da ichki messaging mavjud emas,
 * shuning uchun uni o'ylab qo'shmaymiz (spetsifikatsiya 5-bo'lim).
 */

type Contact = {
  key: 'call' | 'telegram' | 'whatsapp' | 'instagram' | 'facebook';
  url: string;
  label: string;
};

export function ContactIconRow({
  phone,
  telegram,
  whatsapp,
  instagram,
  facebook,
}: {
  phone?: string;
  telegram?: string;
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
}) {
  const contacts: Contact[] = [];

  if (phone) contacts.push({ key: 'call', url: `tel:${phone.replace(/\s/g, '')}`, label: 'Qo’ng’iroq' });
  if (telegram) contacts.push({ key: 'telegram', url: tgUrl(telegram), label: 'Telegram' });
  if (whatsapp) contacts.push({ key: 'whatsapp', url: waUrl(whatsapp), label: 'WhatsApp' });
  if (instagram) contacts.push({ key: 'instagram', url: igUrl(instagram), label: 'Instagram' });
  if (facebook) contacts.push({ key: 'facebook', url: fbUrl(facebook), label: 'Facebook' });

  if (!contacts.length) return null;

  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
      {contacts.map((c) => (
        <ContactTile key={c.key} contact={c} />
      ))}
    </View>
  );
}

function ContactTile({ contact }: { contact: Contact }) {
  const { theme } = useTheme();

  return (
    <TapScale
      radius={13}
      accessibilityLabel={contact.label}
      onPress={() => {
        Linking.openURL(contact.url).catch(() => {
          // Mos ilova o'rnatilmagan bo'lsa jim qolamiz: xato oynasi
          // chiqarish bu yerda foydadan ko'ra bezovtalik.
        });
      }}
      style={[
        {
          width: 44,
          height: 42,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: theme.rim,
          overflow: 'hidden',
        },
        SHADOW.tile,
      ]}
    >
      {/* Konteyner — qora karta uslubi, brend rangi YO'Q. */}
      <LinearGradient
        colors={
          contact.key === 'call'
            ? ['rgba(255,255,255,.09)', 'rgba(255,255,255,.02)']
            : ['rgba(255,255,255,.07)', 'rgba(255,255,255,.02)']
        }
        start={A160.start}
        end={A160.end}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <ContactGlyph kind={contact.key} accent={theme.a1} />
    </TapScale>
  );
}

function ContactGlyph({
  kind,
  accent,
}: {
  kind: Contact['key'];
  accent: string;
}) {
  const size = 18;
  const igId = useSvgId('igGrad');

  if (kind === 'call') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M6.2 3.6l3 .6 1 3.6-2.1 1.7a12.5 12.5 0 006 6l1.7-2.1 3.6 1 .6 3c0 1.1-.9 2-2 2A16.6 16.6 0 014.2 5.6c0-1.1.9-2 2-2z"
          stroke={accent}
          strokeWidth={1.6}
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    );
  }

  if (kind === 'telegram') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M21 4L3 11l5 1.8L18 7l-7.6 7.2L10 21l3-3.6L17.5 20 21 4z"
          stroke={BRAND.telegram}
          strokeWidth={1.5}
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    );
  }

  if (kind === 'whatsapp') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M4.2 20l1.3-3.7A7.6 7.6 0 1112 19.6a7.7 7.7 0 01-3.6-.9L4.2 20z"
          stroke={BRAND.whatsapp}
          strokeWidth={1.6}
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d="M9.4 9.1c.2 1.7 2.1 3.7 3.9 4.1l.9-1.1 1.7.6.2 1.4c-.1.5-.6.9-1.2.8-2.8-.4-5.3-2.8-5.8-5.6-.1-.5.3-1 .8-1.1l1.4.2.6 1.7-1 .9"
          stroke={BRAND.whatsapp}
          strokeWidth={1.3}
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    );
  }

  if (kind === 'instagram') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <SvgGradient id={igId} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={BRAND.instagram[0]} />
            <Stop offset="0.35" stopColor={BRAND.instagram[1]} />
            <Stop offset="0.65" stopColor={BRAND.instagram[2]} />
            <Stop offset="1" stopColor={BRAND.instagram[3]} />
          </SvgGradient>
        </Defs>
        <Rect
          x={3}
          y={3}
          width={18}
          height={18}
          rx={5.5}
          stroke={`url(#${igId})`}
          strokeWidth={1.7}
          fill="none"
        />
        <Circle
          cx={12}
          cy={12}
          r={4.2}
          stroke={`url(#${igId})`}
          strokeWidth={1.7}
          fill="none"
        />
        <Circle cx={17.4} cy={6.6} r={1.3} fill={BRAND.instagramDot} />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M14.5 21v-7.3h2.5l.4-2.9h-2.9V9c0-.85.25-1.4 1.45-1.4H17.5V5a19 19 0 0 0-2.3-.12c-2.3 0-3.85 1.4-3.85 3.95v2.2H8.8v2.9h2.55V21"
        stroke={BRAND.facebook}
        strokeWidth={1.5}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/* ── Manzil yasovchilar ───────────────────────────────────────────────
   Backend bu maydonlarni xom holda saqlaydi: "@aziz", "aziz",
   "https://t.me/aziz" — uchalasi ham uchraydi. Shuning uchun har biri
   normallashtiriladi.                                                */

const stripAt = (v: string) => v.trim().replace(/^@/, '');
const isUrl = (v: string) => /^https?:\/\//i.test(v.trim());

function tgUrl(v: string): string {
  return isUrl(v) ? v.trim() : `https://t.me/${stripAt(v)}`;
}

function waUrl(v: string): string {
  if (isUrl(v)) return v.trim();
  const digits = v.replace(/\D/g, '');
  return `https://wa.me/${digits}`;
}

function igUrl(v: string): string {
  return isUrl(v) ? v.trim() : `https://instagram.com/${stripAt(v)}`;
}

function fbUrl(v: string): string {
  return isUrl(v) ? v.trim() : `https://facebook.com/${stripAt(v)}`;
}
