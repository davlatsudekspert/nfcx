import { Image, type ImageContentFit } from 'expo-image';
import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { StripeFill } from '@/components/StripeFill';
import { mediaUrl } from '@/lib/media';

/**
 * Ilovadagi YAGONA rasm komponenti.
 *
 * Nega har joyda `<Image>` ni to'g'ridan-to'g'ri ishlatmaymiz:
 *
 *  1. MANZIL. Backend rasmlarni nisbiy yo'l bilan qaytaradi
 *     (`/uploads/…`) va ilova uni ocha olmaydi. `mediaUrl()` shu yerda,
 *     bitta joyda qo'llanadi — yangi ekran qo'shilganda uni unutib
 *     bo'lmaydi.
 *  2. KESH. `cachePolicy="memory-disk"` — bir marta yuklangan rasm
 *     qayta ochilganda darhol chiqadi. Lentani pastga-yuqoriga
 *     aylantirganda rasm har safar qaytadan yuklanmaydi.
 *  3. PAYDO BO'LISH. `transition` bilan rasm silliq ochiladi —
 *     "qars" etib paydo bo'lmaydi.
 *  4. O'RINBOSAR. Rasm yo'q bo'lsa yoki yuklanmasa, chiziqli
 *     o'rinbosar chiziladi — bo'sh qora quti qolmaydi.
 */
export function Photo({
  uri,
  width,
  height,
  radius = 0,
  contentFit = 'cover',
  /** O'rinbosar chiziqlarining qadami. */
  step = 6,
  /** O'rinbosar ichida ko'rsatiladigan narsa (masalan bosh harflar). */
  placeholder,
  style,
}: {
  uri?: string | null;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  radius?: number;
  contentFit?: ImageContentFit;
  step?: number;
  placeholder?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const src = mediaUrl(uri);
  const box: ViewStyle = {
    width,
    height,
    borderRadius: radius,
    overflow: 'hidden',
  };

  if (!src) {
    return (
      <StripeFill
        step={step}
        style={[box, { alignItems: 'center', justifyContent: 'center' }, style]}
      >
        {placeholder}
      </StripeFill>
    );
  }

  return (
    <View style={[box, style]}>
      <Image
        source={{ uri: src }}
        contentFit={contentFit}
        // 180ms — ko'z ilg'aydigan, lekin kutish hissini bermaydigan
        // eng qisqa oraliq.
        transition={180}
        cachePolicy="memory-disk"
        recyclingKey={src}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}
