import 'package:flutter/material.dart';

import '../theme/typography.dart';
import '../tokens/nfc_tokens.dart';

/// NFC ID — O'YILGAN PLASTINKA.
///
/// ## NIMA UCHUN ALOHIDA VIDJET
///
/// NFC ID — ilovaning SOTILADIGAN mahsuloti. Shunga qaramay u
/// Tanlov ro'yxatida, profilda va "Mening ID'larim" da uchta xil
/// ko'rinishda, hammasi kichkina kulrang yorliq bo'lib chizilardi.
/// Odam uni mahsulot emas, texnik yorliq deb o'qiydi va sotib
/// olish istagi tug'ilmaydi.
///
/// Endi kod hamma joyda BIR XIL va qimmat ko'rinadi: monoshrift,
/// keng harf oralig'i, yumshoq plastinka — avtomobil raqami yoki
/// o'yilgan plastinka kabi.
///
/// ## DARAJA RANG BILAN GAPIRADI
///
/// Server har kod uchun `tier` yuboradi (`personalIdTierD1`).
/// Qisqa va nodir kod qimmatroq turadi, lekin ekranda buni hech
/// narsa ko'rsatmasdi. Endi ko'rsatadi — va aynan shu odamni
/// "menikiniyam shunday bo'lsin" degan fikrga olib keladi.
///
/// Ranglar MAVZUDAN olinadi, qattiq yozilmaydi: oq-qora mavzuda
/// oltin bo'lmasligi kerak.
enum IdPlateSize { small, medium, large }

class IdPlate extends StatelessWidget {
  const IdPlate({
    super.key,
    required this.code,
    this.tier = '',
    this.size = IdPlateSize.medium,
    this.active = true,
  });

  final String code;

  /// `free` | `silver` | `gold` | `premium` | `exclusive`.
  final String tier;

  final IdPlateSize size;

  /// Faol emas — so'nik chiziladi (masalan biriktirilmagan karta).
  final bool active;

  /// Daraja qimmatbaho deb hisoblanadimi.
  ///
  /// Faqat shular oltin bo'ladi: hammasi oltin bo'lsa, oltin
  /// ma'nosini yo'qotadi.
  static bool isPrecious(String tier) =>
      tier == 'gold' || tier == 'premium' || tier == 'exclusive';

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final precious = active && isPrecious(tier);

    final (fs, hp, vp, ls) = switch (size) {
      IdPlateSize.small => (11.5, 9.0, 5.0, 1.6),
      IdPlateSize.medium => (13.5, 12.0, 7.0, 2.2),
      IdPlateSize.large => (16.0, 15.0, 9.0, 3.0),
    };

    final ink = !active
        ? t.text3
        : precious
            ? t.accent1
            : t.text1;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: hp, vertical: vp),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        // Qimmat kod yumshoq aksent yuzasida turadi. `wash`
        // ishlatiladi, chunki oq-qora mavzuda to'g'ridan-to'g'ri
        // aksent kulrang dog' berardi.
        color: precious
            ? t.wash(t.accent2, .12)
            : t.surface2,
        border: Border.all(
          color: precious
              ? t.accent2.withValues(alpha: .45)
              : t.border2,
        ),
      ),
      child: Text(
        code,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppType.monoStyle(color: ink, size: fs).copyWith(
          // HARF ORALIG'I — plastinka hissini beradigan asosiy
          // narsa. Usiz kod oddiy matn bo'lib qoladi.
          letterSpacing: ls,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
