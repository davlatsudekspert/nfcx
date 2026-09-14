import 'package:flutter/widgets.dart';

import '../tokens.dart';

/// METALL MATN — oltin gradient bilan bo'yalgan yozuv.
///
/// Faqat URG'U so'zlarda: narx, ID kodi, hero sarlavhasidagi bitta
/// so'z. Butun paragrafda ishlatilsa matn o'qilmay qoladi —
/// gradient kontrastni tushiradi.
///
/// `ShaderMask` matnni rastrga aylantiradi, shuning uchun u
/// `saveLayer` ishlatadi. Ro'yxat ichida har qatorda emas, bitta
/// ekranda bir-ikki joyda.
class MetalText extends StatelessWidget {
  const MetalText(
    this.text, {
    super.key,
    required this.style,
    this.gradient,
    this.maxLines = 1,
    this.overflow = TextOverflow.ellipsis,
    this.textAlign,
  });

  final String text;
  final TextStyle style;
  final Gradient? gradient;
  final int maxLines;
  final TextOverflow overflow;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) => ShaderMask(
        blendMode: BlendMode.srcIn,
        shaderCallback: (bounds) =>
            (gradient ?? C.accentText).createShader(bounds),
        child: Text(
          text,
          maxLines: maxLines,
          overflow: overflow,
          textAlign: textAlign,
          // Rang oq bo'lishi SHART: `srcIn` maskasi matnning
          // shaffofligini oladi, rangi esa gradientdan keladi.
          style: style.copyWith(color: const Color(0xFFFFFFFF)),
        ),
      );
}
