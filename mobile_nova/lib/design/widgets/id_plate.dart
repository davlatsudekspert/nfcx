import 'package:flutter/material.dart';

import '../theme/typography.dart';
import '../tokens/nfc_tokens.dart';
import 'id_lux.dart';

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

  /// TOIFA RANGLARI — SAYT BILAN AYNAN BIR XIL.
  ///
  /// Manba: `src/lib/pricing.js` dagi `TIER_COLOR`. Qiymatlar
  /// KO'CHIRILGAN, qaytadan o'ylab topilmagan — aks holda bitta
  /// kod saytda bir xil, ilovada boshqa xil ko'rinardi va odam
  /// "qaysi biri to'g'ri" deb o'ylardi.
  ///
  /// Bular metall ierarxiyasi, shunchaki chiroyli ranglar emas:
  /// bronza < kumush < tilla < issiq oltin < titan oltin. Odam
  /// yonma-yon turgan ikki kodni ko'rib qaysi biri qimmatroq
  /// ekanini O'QIMASDAN tushunadi.
  static const tierColors = <String, Color>{
    'exclusive': Color(0xFFD4AF37), // Titanium Gold
    'premium': Color(0xFFD8A34A), //   Bronza-oltin
    'gold': Color(0xFFF0C419), //      Pure Gold
    'silver': Color(0xFF9AA3AD), //    Chrome Silver
    'free': Color(0xFFC58A55), //      Bronza
  };

  /// BREND OLTINI — istoriya halqasi va "musiqa o'ynayapti" nishoni.
  ///
  /// Egasining talabi (2026-09): istoriya halqasi Instagramdagidek
  /// aniq, rangi esa OLTIN — har mavzuda bir xil (mavzu aksenti
  /// ba'zi mavzularda ko'k yoki binafsha). Titan oltin (`exclusive`)
  /// bilan bir oila.
  static const goldDeep = Color(0xFFB8862B);
  static const gold = Color(0xFFD4AF37);
  static const goldLight = Color(0xFFF6DE8D);

  /// ISTORIYA HALQASI — OLTIN + ZUMRAD (egasining tanlovi, 2026-09,
  /// "3-variant"). Instagramdagidek butun, qalin halqa; rangi bizniki.
  static const emeraldLight = Color(0xFF5FD3A5);
  static const emerald = Color(0xFF0E8A67);
  static const storyRingColors = <Color>[
    Color(0xFF8C6A1F), goldDeep, gold, goldLight, emeraldLight, emerald,
    emeraldLight, goldLight, gold, goldDeep, Color(0xFF8C6A1F),
  ];
  static const storyRing = SweepGradient(
    colors: storyRingColors,
    // Oltin yuqori-chapdan boshlanadi, zumrad o'ng tomonda — namunadagi
    // kabi.
    transform: GradientRotation(3.49),
  );

  /// FON QANCHA RANGLI BO'LADI.
  ///
  /// Birinchi urinishda .22 qo'yilgan edi va egasi darhol aytdi:
  /// "bo'g'adigan rang bo'lib qolmasin". Haq edi — ro'yxatda
  /// o'nlab qator bor, har birida to'la bo'yalgan kapsula tursa
  /// ekran shovqinga aylanadi va hech biri ajralib turmaydi.
  ///
  /// Saytda ham fon atigi 8% (`--tier-fill` = rang + `14`).
  /// Toifani MATN va CHEGARA aytadi, fon esa faqat ishora qiladi.
  static const _fillAlphaDark = .10;
  static const _fillAlphaLight = .09;

  /// PLASTINKA RANGLARI — BITTA JOYDA.
  ///
  /// Profil kapsulasi (`_IdPill`) ham shu funksiyadan o'qiydi.
  /// Ilgari mantiq ikki faylda ko'chirilgan edi va biri
  /// o'zgarganda ikkinchisi orqada qolardi: profil va Tanlov
  /// bitta kod haqida boshqa-boshqa gapirardi.
  static ({Color fill, Color line, Color ink}) skin(
    NfcTokens t,
    String tier, {
    bool active = true,
  }) {
    // `mono` — oq-qora mavzu. Egasining qat'iy talabi: u yerda
    // FAQAT oq va qora. Ierarxiya rang bilan emas, TONNI
    // ALMASHTIRISH bilan beriladi — qimmat kod to'la quyuq
    // plastinkada, ustida yorug' harflar.
    if (t.id == 'mono') {
      final invert = active && isPrecious(tier);
      return (
        fill: invert ? t.accent2 : t.surface2,
        line: invert ? t.accent2 : t.border2,
        ink: !active ? t.text3 : (invert ? t.onAccent : t.text1),
      );
    }

    final tone = active ? tierColors[tier] : null;
    if (tone == null) {
      return (
        fill: t.surface2,
        line: t.border2,
        ink: active ? t.text1 : t.text3,
      );
    }
    return (
      fill: tone.withValues(
          alpha: t.isDark ? _fillAlphaDark : _fillAlphaLight),
      line: tone.withValues(alpha: t.isDark ? .55 : .48),
      // Yorug' mavzuda oltin matn oqish fon ustida o'qilmaydi,
      // shuning uchun siyoh qoraga tortiladi. Toifa baribir
      // ko'rinadi: rangning o'zi saqlanadi, faqat quyuqlashadi.
      ink: t.isDark ? tone : Color.lerp(tone, Colors.black, .52)!,
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;

    final (fs, hp, vp, ls) = switch (size) {
      IdPlateSize.small => (11.5, 9.0, 5.0, 1.6),
      IdPlateSize.medium => (13.5, 12.0, 7.0, 2.2),
      IdPlateSize.large => (16.0, 15.0, 9.0, 3.0),
    };

    // Ranglar `skin()` dan keladi — profil kapsulasi ham AYNAN
    // shu funksiyadan o'qiydi, shuning uchun ikkisi hech qachon
    // ajralib ketmaydi.
    final c = skin(t, tier, active: active);

    // PULLIK ID — METALL PLASTINKA (Gold / Premium / Exclusive).
    //
    // Endi faqat rangli yozuv emas: material yuza, metall hoshiya va
    // (Premium/Exclusive'da) folga raqam. Exclusive — qora oniks
    // ustida oltin: ro'yxatda uni hech narsa bilan adashtirib
    // bo'lmaydi. Bepul/kumush — o'sha sodda plastinka.
    final lux = active ? IdLux.of(t, tier) : null;
    if (lux != null) {
      return Container(
        key: ValueKey('id-plate-lux-$tier'),
        padding: const EdgeInsets.all(1),
        decoration: BoxDecoration(
          gradient: lux.edge,
          borderRadius: BorderRadius.circular(999),
          boxShadow: [
            BoxShadow(
              color: lux.depth.first.color.withValues(
                  alpha: lux.depth.first.color.a * .6),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: hp - 1, vertical: vp - 1),
          decoration: BoxDecoration(
            gradient: lux.surface,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(lux.icon, size: fs * .82, color: lux.soft),
              SizedBox(width: fs * .4),
              Flexible(
                child: LuxIdNumber(code: code, lux: lux, size: fs)
              ),
            ],
          ),
        ),
      );
    }

    return Container(
      padding: EdgeInsets.symmetric(horizontal: hp, vertical: vp),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: c.fill,
        border: Border.all(color: c.line),
      ),
      child: Text(
        code,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppType.monoStyle(color: c.ink, size: fs).copyWith(
          // HARF ORALIG'I — plastinka hissini beradigan asosiy
          // narsa. Usiz kod oddiy matn bo'lib qoladi.
          letterSpacing: ls,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
