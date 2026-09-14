import { Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { SHADOW } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

export type InfoRow = { k: string; v: string };

/**
 * Info tabi — "ABOUT" kartasi va ostida kalit/qiymat qatorlari
 * (spetsifikatsiya 4-bo'lim: to'liq tavsif, ish vaqti, manzil,
 * kontaktlar).
 */
export function InfoList({
  about,
  rows,
}: {
  about: string;
  rows: InfoRow[];
}) {
  const { theme } = useTheme();

  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 26, gap: 10 }}>
      {about ? (
        <Card style={{ paddingHorizontal: 15, paddingVertical: 14 }}>
          <Text
            style={[
              mono(600, 11),
              { color: theme.a1, letterSpacing: 1.1, marginBottom: 9 },
            ]}
          >
            HAQIDA
          </Text>
          <Text style={[sans(400, 13, 1.55), { color: 'rgba(255,255,255,.72)' }]}>
            {about}
          </Text>
        </Card>
      ) : null}

      {rows.map((row) => (
        <Card
          key={row.k}
          shadow="soft"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingHorizontal: 15,
            paddingVertical: 14,
          }}
        >
          <Text style={[sans(500, 12, 1.3), { color: 'rgba(255,255,255,.45)' }]}>
            {row.k}
          </Text>
          <Text
            style={[
              sans(600, 12.5, 1.3),
              { color: theme.ink, textAlign: 'right', flexShrink: 1 },
            ]}
          >
            {row.v}
          </Text>
        </Card>
      ))}
    </View>
  );
}

/**
 * Shaxsiy profilning havolalar ro'yxati — biznesdagi Katalog tabining
 * o'rnini bosadi. Maketda har bir havola bitta keng karta: chapda nom,
 * o'ngda qiymat.
 */
export function LinksList({ links }: { links: InfoRow[] }) {
  const { theme } = useTheme();

  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 26, gap: 10 }}>
      {links.map((link) => (
        <Card
          key={`${link.k}-${link.v}`}
          shadow="soft"
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingHorizontal: 15,
              paddingVertical: 14,
            },
            SHADOW.soft,
          ]}
        >
          <Text style={[sans(600, 12.5, 1.3), { color: theme.ink }]}>{link.k}</Text>
          <Text
            style={[mono(500, 11.5, 1.3), { color: theme.a1, flexShrink: 1 }]}
            numberOfLines={1}
          >
            {link.v}
          </Text>
        </Card>
      ))}
    </View>
  );
}
