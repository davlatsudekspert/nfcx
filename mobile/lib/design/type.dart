import 'package:flutter/widgets.dart';

import 'tokens.dart';

/// TIPOGRAFIKA — dizaynning o'zi.
///
/// UCH SHRIFT, UCH VAZIFA. Aralashtirilmaydi:
///
/// • **Instrument Serif** — display va bo'lim sarlavhalari. Bu
///   ilovaning "ovozi": katta, nafis, kursiv urg'u bilan. Faqat
///   sarlavha va raqamli urg'u (narx). Tugma yoki forma matnida
///   ISHLATILMAYDI.
/// • **Manrope** — butun funksional matn: tugma, tana matni,
///   yorliq, navigatsiya. O'zbek lotin belgilarini (o', g', sh,
///   ch) to'liq qamraydi.
/// • **IBM Plex Mono** — ID kodlari, narx raqamlari, meta va
///   holat yozuvlari. Mono tanlanishining sababi: `GLD777` va
///   `149 000` kabi qiymatlar ustma-ust turganda tekis
///   ko'rinsin va raqamlar sakramasin.
///
/// SARLAVHA BILAN TANA MATNI ORASIDA KESKIN FARQ BO'LSIN — bu
/// dizaynning asosiy qoidasi. Oraliq o'lchamlar shkalada yo'q.
///
/// MAVZUGA BOG'LIQ USLUBLAR `static get` — `const` emas (sabab
/// `tokens.dart` da yozilgan).
class T {
  const T._();

  static const _serif = 'InstrumentSerif';
  static const _sans = 'Manrope';
  static const _mono = 'IBMPlexMono';

  // ── Display · Instrument Serif ──────────────────────────────

  /// Onboarding va hero sarlavhalari. 46/1.02.
  static const TextStyle display = TextStyle(
    fontFamily: _serif,
    fontSize: 46,
    height: 1.02,
    letterSpacing: -.4,
    color: C.ink,
  );

  /// Ekran sarlavhasi — "NFC markazi", "Qidiruv", "ID katalogi".
  static const TextStyle title = TextStyle(
    fontFamily: _serif,
    fontSize: 34,
    height: 1.04,
    letterSpacing: -.3,
    color: C.ink,
  );

  /// Ixcham ekran sarlavhasi (forma va sozlamalar ekranlari).
  static const TextStyle titleSm = TextStyle(
    fontFamily: _serif,
    fontSize: 27,
    height: 1.06,
    letterSpacing: -.2,
    color: C.ink,
  );

  /// Bo'lim sarlavhasi — "Lenta", "Katalog", "Postlarim".
  static const TextStyle section = TextStyle(
    fontFamily: _serif,
    fontSize: 22,
    height: 1.1,
    color: C.ink,
  );

  /// Profil ismi.
  static const TextStyle profileName = TextStyle(
    fontFamily: _serif,
    fontSize: 30,
    height: 1.08,
    letterSpacing: .2,
    color: C.ink,
  );

  /// Kursiv urg'u so'zi — "Assalom, *Dilshod*".
  /// Rang chaqiruv joyida beriladi (odatda `C.accent`).
  static const TextStyle displayItalic = TextStyle(
    fontFamily: _serif,
    fontSize: 46,
    height: 1.02,
    letterSpacing: -.4,
    fontStyle: FontStyle.italic,
  );

  /// Katta narx — "149 000".
  static const TextStyle price = TextStyle(
    fontFamily: _serif,
    fontSize: 42,
    height: 1,
    letterSpacing: -.5,
    color: C.ink,
  );

  // ── Funksional · Manrope ────────────────────────────────────

  /// Kuchli sarlavha — sheet va dialog ustida.
  static const TextStyle h1 = TextStyle(
    fontFamily: _sans,
    fontWeight: FontWeight.w800,
    fontSize: 26,
    height: 1.14,
    letterSpacing: -.7,
    color: C.ink,
  );

  static const TextStyle h2 = TextStyle(
    fontFamily: _sans,
    fontWeight: FontWeight.w800,
    fontSize: 21,
    height: 1.18,
    letterSpacing: -.45,
    color: C.ink,
  );

  /// Karta va qator sarlavhasi.
  static const TextStyle cardTitle = TextStyle(
    fontFamily: _sans,
    fontWeight: FontWeight.w700,
    fontSize: 15.5,
    height: 1.24,
    letterSpacing: -.1,
    color: C.ink,
  );

  /// Tana matni. Qator balandligi 1.55 — uzun o'zbekcha jumlalar
  /// siqilib qolmasin.
  static const TextStyle body = TextStyle(
    fontFamily: _sans,
    fontWeight: FontWeight.w400,
    fontSize: 15,
    height: 1.55,
    color: C.ink2,
  );

  /// Kuchliroq tana matni — asosiy qiymat, javob matni.
  static const TextStyle bodyStrong = TextStyle(
    fontFamily: _sans,
    fontWeight: FontWeight.w500,
    fontSize: 15,
    height: 1.45,
    color: C.ink,
  );

  /// Izoh va ikkilamchi tushuntirish.
  static const TextStyle caption = TextStyle(
    fontFamily: _sans,
    fontWeight: FontWeight.w400,
    fontSize: 13,
    height: 1.5,
    color: C.ink2,
  );

  /// Forma yorliqlari — KATTA HARFDA yoziladi.
  static const TextStyle label = TextStyle(
    fontFamily: _sans,
    fontWeight: FontWeight.w700,
    fontSize: 11,
    height: 1.2,
    letterSpacing: 1.3,
    color: C.ink3,
  );

  /// Asosiy tugma matni.
  static const TextStyle button = TextStyle(
    fontFamily: _sans,
    fontWeight: FontWeight.w700,
    fontSize: 16.5,
    height: 1.1,
    letterSpacing: -.1,
    color: C.ink,
  );

  /// Kichik tugma va chip matni.
  static const TextStyle buttonSm = TextStyle(
    fontFamily: _sans,
    fontWeight: FontWeight.w700,
    fontSize: 13.5,
    height: 1.1,
    color: C.ink,
  );

  /// Tab yorlig'i.
  static const TextStyle navLabel = TextStyle(
    fontFamily: _sans,
    fontWeight: FontWeight.w600,
    fontSize: 10.5,
    height: 1.1,
    letterSpacing: .1,
    color: C.ink3,
  );

  /// Statistika yorlig'i — "Ko'rish", "Kontakt", "Obunachi".
  static const TextStyle statLabel = TextStyle(
    fontFamily: _sans,
    fontWeight: FontWeight.w600,
    fontSize: 10.5,
    height: 1.2,
    letterSpacing: .3,
    color: C.ink3,
  );

  // ── Mono · IBM Plex Mono ────────────────────────────────────

  /// Statistika qiymati — "4 812".
  static const TextStyle statValue = TextStyle(
    fontFamily: _mono,
    fontWeight: FontWeight.w600,
    fontSize: 21,
    height: 1.1,
    letterSpacing: -.3,
    color: C.ink,
  );

  /// Meta yozuvi — sana, vaqt, holat.
  static const TextStyle meta = TextStyle(
    fontFamily: _mono,
    fontWeight: FontWeight.w500,
    fontSize: 11.5,
    height: 1.3,
    letterSpacing: .2,
    color: C.ink3,
  );

  /// Mono summa — to'lov tarixidagi raqamlar ustma-ust tekis
  /// turishi uchun.
  static const TextStyle amount = TextStyle(
    fontFamily: _mono,
    fontWeight: FontWeight.w600,
    fontSize: 15,
    height: 1.2,
    letterSpacing: -.2,
    color: C.ink,
  );

  /// Holat yorlig'i — "TAYYOR · TEGIZING", "HOLAT: KUTILMOQDA".
  static const TextStyle statusLabel = TextStyle(
    fontFamily: _mono,
    fontWeight: FontWeight.w600,
    fontSize: 11,
    height: 1.2,
    letterSpacing: 1.6,
    color: C.ink2,
  );

  /// EYEBROW — bo'lim ustidagi kichik oltin yozuv.
  /// Mavzuga bog'liq, shuning uchun getter.
  static TextStyle get eyebrow => TextStyle(
        fontFamily: _mono,
        fontWeight: FontWeight.w500,
        fontSize: 10.5,
        height: 1.2,
        letterSpacing: 1.8,
        color: C.accent.withValues(alpha: .9),
      );

  /// Wordmark — "N F C S T O R E".
  static TextStyle get wordmark => TextStyle(
        fontFamily: _mono,
        fontWeight: FontWeight.w600,
        fontSize: 11,
        height: 1.2,
        letterSpacing: 3.4,
        color: C.accent.withValues(alpha: .85),
      );

  /// ID KODI — kartaning va profilning o'zagi. O'lcham chaqiruv
  /// joyida beriladi, chunki u joyiga qarab 13 dan 34 gacha
  /// o'zgaradi.
  static TextStyle code(double size, {Color? color, FontWeight? weight}) =>
      TextStyle(
        fontFamily: _mono,
        fontWeight: weight ?? FontWeight.w600,
        fontSize: size,
        height: 1.05,
        letterSpacing: size >= 24 ? 1.4 : .6,
        color: color ?? C.ink,
      );

  /// Profil havolasi — `nfcstore.uz/gld777`.
  static TextStyle get link => TextStyle(
        fontFamily: _mono,
        fontWeight: FontWeight.w400,
        fontSize: 12,
        height: 1.3,
        letterSpacing: .2,
        color: C.ink2,
      );
}

// ─────────────────────────────────────────────────────────────
// RAQAM FORMATLARI
// ─────────────────────────────────────────────────────────────

/// Summani o'zbekcha ko'rinishda yozadi: `149 000`.
///
/// Ajratgich sifatida ODDIY probel emas, U+202F (tor uzilmas
/// probel) ishlatiladi: shunda raqam qator oxirida ikkiga
/// bo'linib ketmaydi va mono shriftda ham ixcham ko'rinadi.
String som(num value) {
  final n = value.round();
  final neg = n < 0;
  final digits = n.abs().toString();
  final out = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) out.write(' ');
    out.write(digits[i]);
  }
  return neg ? '-$out' : out.toString();
}

/// Katta sonni qisqartiradi: `12.4k`, `3.1M`.
///
/// Statistika kartalarida joy cheklangan; to'liq son esa
/// tafsilot ekranida ko'rsatiladi.
String compact(num value) {
  final n = value.abs();
  if (n < 1000) return value.round().toString();
  if (n < 1000000) {
    final v = value / 1000;
    return '${v.toStringAsFixed(v.abs() < 10 ? 1 : 0)}k';
  }
  final v = value / 1000000;
  return '${v.toStringAsFixed(v.abs() < 10 ? 1 : 0)}M';
}
