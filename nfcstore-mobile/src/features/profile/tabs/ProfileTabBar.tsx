import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { GoldSweep } from '@/components/GoldSweep';
import { A145 } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';

export type ProfileTab = 'feed' | 'catalog' | 'reels' | 'info';

/**
 * Profil tab bari — spetsifikatsiya 4-bo'limi.
 *
 *   1. Feed    — postlar (3 ustunli to'r)
 *   2. Catalog — mahsulotlar (2 ustun). Shaxsiy profilda LINKS bo'ladi
 *                va ikonka zanjirga o'zgaradi.
 *   3. Reels   — 9:16 video muqovalar
 *   4. Info    — tavsif, ish vaqti, manzil, kontaktlar
 *
 * Egasiga Catalog va Reels ikonkalarida "+" nishoni ko'rinadi — MAHSULOT
 * VA VIDEO AYNAN SHU YERDAN qo'shiladi, alohida suzuvchi "+" tugmasi
 * kerak emas (spetsifikatsiya shunday talab qiladi).
 *
 * Faol tab ostidagi chiziq gold gradient va uning ustidan yorug'lik
 * o'tadi (maketda `sweep 4.5s`).
 */
export function ProfileTabBar({
  active,
  onChange,
  isOwner,
  isBusiness,
}: {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  isOwner: boolean;
  isBusiness: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,.07)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,.07)',
      }}
    >
      <TabButton tab="feed" active={active} onChange={onChange} label="Postlar" />
      <TabButton
        tab="catalog"
        active={active}
        onChange={onChange}
        label={isBusiness ? 'Katalog' : 'Havolalar'}
        // Shaxsiy profilda ikonka zanjirga o'zgaradi (maketda ham
        // shunday), chunki bu tab mahsulot emas, havolalar ro'yxati.
        icon={(color) => (isBusiness ? <BoxIcon color={color} /> : <ChainIcon color={color} />)}
        // "+" faqat biznesda: shaxsiy havolalar "Profilni tahrirlash"
        // orqali o'zgartiriladi, tab ikonkasidan emas.
        plusBadge={isOwner && isBusiness}
      />
      <TabButton
        tab="reels"
        active={active}
        onChange={onChange}
        label="Reels"
        plusBadge={isOwner && isBusiness}
      />
      <TabButton tab="info" active={active} onChange={onChange} label="Ma’lumot" />
    </View>
  );
}

function TabButton({
  tab,
  active,
  onChange,
  label,
  plusBadge = false,
  icon,
}: {
  tab: ProfileTab;
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  label: string;
  plusBadge?: boolean;
  /** Berilmasa `TabIcon` dagi standart ikonka chiziladi. */
  icon?: (color: string) => React.ReactNode;
}) {
  const { theme } = useTheme();
  const isActive = active === tab;
  const color = isActive ? theme.a1 : theme.off;

  return (
    <Pressable
      onPress={() => onChange(tab)}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
      style={{
        flex: 1,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {icon ? icon(color) : <TabIcon tab={tab} color={color} />}

      {isActive ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: '22%',
            right: '22%',
            bottom: 0,
            height: 2.5,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <LinearGradient
            colors={[theme.a1, theme.a2]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
          <GoldSweep duration={4500} radius={2} />
        </View>
      ) : null}

      {plusBadge ? (
        <LinearGradient
          colors={[theme.a1, theme.a2]}
          start={A145.start}
          end={A145.end}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 10,
            right: 29,
            width: 15,
            height: 15,
            borderRadius: 7.5,
            borderWidth: 2,
            borderColor: theme.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={7} height={7} viewBox="0 0 8 8">
            <Path
              d="M4 .8v6.4M.8 4h6.4"
              stroke={theme.onAccent}
              strokeWidth={1.8}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </LinearGradient>
      ) : null}
    </Pressable>
  );
}

/**
 * Tab ikonkalari. `catalog` tabi profil turiga qarab ikki xil chiziladi:
 * biznesda quti (mahsulot), shaxsiyda zanjir (havola) — maketda ham
 * shunday.
 */
function TabIcon({ tab, color }: { tab: ProfileTab; color: string }) {
  const s = 21;

  if (tab === 'feed') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        {[
          { x: 3, y: 3 },
          { x: 13.5, y: 3 },
          { x: 3, y: 13.5 },
          { x: 13.5, y: 13.5 },
        ].map((p) => (
          <Rect
            key={`${p.x}-${p.y}`}
            x={p.x}
            y={p.y}
            width={7.5}
            height={7.5}
            rx={1.6}
            stroke={color}
            strokeWidth={1.7}
            fill="none"
          />
        ))}
      </Svg>
    );
  }

  if (tab === 'reels') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Rect x={3} y={3} width={18} height={18} rx={5} stroke={color} strokeWidth={1.7} fill="none" />
        <Path d="M3.6 8.5h16.8M9.2 3.3l3 5.2M14.6 3.3l3 5.2" stroke={color} strokeWidth={1.5} fill="none" />
        <Path d="M10.4 12.3l4.4 2.5-4.4 2.5v-5z" fill={color} />
      </Svg>
    );
  }

  if (tab === 'info') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.7} fill="none" />
        <Path d="M12 11v5.5" stroke={color} strokeWidth={1.9} strokeLinecap="round" fill="none" />
        <Circle cx={12} cy={7.8} r={1.15} fill={color} />
      </Svg>
    );
  }

  // catalog — chaqiruvchi `icon` prop'i orqali quti yoki zanjirni
  // beradi; bu yerda zaxira variant quti (biznes).
  return <BoxIcon color={color} />;
}

export function BoxIcon({ color, size = 21 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 8.2l8-4.2 8 4.2v7.6L12 20l-8-4.2V8.2z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M4 8.2l8 4.2 8-4.2M12 12.4V20"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function ChainIcon({ color, size = 21 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M10.2 13.8a3.6 3.6 0 005.4.4l2.6-2.6a3.6 3.6 0 10-5.1-5.1l-1.4 1.4"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M13.8 10.2a3.6 3.6 0 00-5.4-.4l-2.6 2.6a3.6 3.6 0 105.1 5.1l1.4-1.4"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
