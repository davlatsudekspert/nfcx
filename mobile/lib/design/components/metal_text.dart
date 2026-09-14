import 'package:flutter/widgets.dart';
import '../tokens.dart';

/// METALL MATN — gradient bilan bo'yalgan yozuv.
///
/// Saytdagi brend nomi `background:var(--gold-face)` + `background-clip:text`
/// bilan chiziladi, ya'ni harflar tekis oltin emas: ular bo'ylab
/// yorug'lik o'zgaradi. Ilovada esa nom oddiy oq matn edi va yonma-yon
/// qo'yilganda sayt boy, ilova quruq ko'rinardi.
///
/// Flutter'da buning yagona yo'li — `ShaderMask`: matn OQ chiziladi,
/// ustiga gradient shader qo'yiladi va `srcIn` rejimi faqat harflar
/// turgan joyni bo'yaydi.
///
/// DIQQAT: `style` ning rangi ahamiyatsiz, lekin SHAFFOFMAS bo'lishi
/// shart — `srcIn` matnning alfa qiymatini saqlaydi, shaffof matn
/// gradientni ham ko'rinmas qilardi.
class MetalText extends StatelessWidget {
  const MetalText(
    this.text, {
    super.key,
    required this.style,
    this.maxLines = 1,
    this.overflow = TextOverflow.ellipsis,
    this.textAlign,
    this.gradient,
  });

  final String text;
  final TextStyle style;
  final int maxLines;
  final TextOverflow overflow;
  final TextAlign? textAlign;

  /// Standarti `C.metalText` — matn uchun sozlangan gradient.
  /// Boshqa metall kerak bo'lsa (masalan tarif rangi) shu yerdan
  /// beriladi.
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) => ShaderMask(
        blendMode: BlendMode.srcIn,
        shaderCallback: (rect) => (gradient ?? C.metalText).createShader(rect),
        child: Text(
          text,
          maxLines: maxLines,
          overflow: overflow,
          textAlign: textAlign,
          style: style.copyWith(color: const Color(0xFFFFFFFF)),
        ),
      );
}
