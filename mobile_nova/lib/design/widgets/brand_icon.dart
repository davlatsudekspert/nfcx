import 'package:flutter/material.dart';

import 'brand_logo.dart';

/// Android'ning standart NFC/kontaktsiz belgilari.
///
/// Ular har ilovada bir xil va NFCSTORE'ga aloqasi yo'q. Egasi
/// (2026-09-24): "NFC o'chirilgan degi logo bizning logo emas — qolgan
/// joylarda ham shunaqa logolar bo'lsa N ga almashtiring, logotipimiz
/// bilan bir xil bo'lsin".
bool isNfcGlyph(IconData icon) =>
    icon == Icons.nfc ||
    icon == Icons.nfc_rounded ||
    icon == Icons.nfc_outlined ||
    icon == Icons.nfc_sharp ||
    icon == Icons.contactless ||
    icon == Icons.contactless_outlined ||
    icon == Icons.contactless_rounded ||
    icon == Icons.contactless_sharp;

/// `Icon` o'rniga: NFC belgisi kelsa — BRENDIMIZNING N belgisi (asl
/// oltinida, bo'yalmaydi), boshqa har qanday belgi — o'zgarishsiz.
///
/// Ekranlar belgini `IconData` sifatida uzatadi (sozlama qatori, holat
/// paneli, metrika...). Shuning uchun almashtirish shu bitta joyda:
/// komponent `Icon` o'rniga `BrandAwareIcon` chizadi va ekran kodi
/// o'zgarmaydi.
class BrandAwareIcon extends StatelessWidget {
  const BrandAwareIcon(this.icon, {super.key, this.size, this.color});

  final IconData icon;
  final double? size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    if (!isNfcGlyph(icon)) return Icon(icon, size: size, color: color);
    final s = size ?? IconTheme.of(context).size ?? 24;
    // Belgi keng lokap (≈1.9:1): kvadrat katakka sig'adi, balandligi
    // kengligidan hisoblanadi — cho'zilmaydi.
    return SizedBox(
      key: const ValueKey('brand-nfc-icon'),
      width: s,
      height: s,
      child: Center(
        child: BrandLogo(
          style: BrandLogoStyle.markOnly,
          size: s * 1.18,
          halo: false,
        ),
      ),
    );
  }
}
