import 'package:flutter/widgets.dart';

import 'tokens.dart';

/// TIPOGRAFIKA — dizaynning o'zi.
///
/// UCH SHRIFT, UCH VAZIFA. Aralashtirilmaydi:
///
/// • **Playfair Display** — display va bo'lim sarlavhalari. Bu
///   ilovaning "ovozi": katta, nafis, kursiv urg'u bilan. Faqat
///   sarlavha va raqamli urg'u (narx). Tugma yoki forma matnida
///   ISHLATILMAYDI.
/// • **Plus Jakarta Sans** — butun funksional matn: tugma, tana
///   matni, yorliq, navigatsiya. O'zbek lotin belgilarini (o', g',
///   sh, ch) to'liq qamraydi.
/// • **Space Mono** — ID kodlari, narx raqamlari, meta va holat
///   yozuvlari. Mono tanlanishining sababi: `GLD777` va `149 000`
///   kabi qiymatlar ustma-ust turganda tekis ko'rinsin va raqamlar
///   sakramasin.
///
/// Uchalasi ham PROTOTIPDAN: maketda aynan shu uchligi ishlatilgan
/// va o'lchamlar shularning metrikasiga qarab tanlangan.
///
/// SARLAVHA BILAN TANA MATNI ORASIDA KESKIN FARQ BO'LSIN — bu
/// dizaynning asosiy qoidasi. Oraliq o'lchamlar shkalada yo'q.
///
/// MAVZUGA BOG'LIQ USLUBLAR `static get` — `const` emas (sabab
/// `tokens.dart` da yozilgan).
class T {
  const T._();

  static const _serif = 'PlayfairDisplay';
  static const _sans = 'PlusJakartaSans';
  static const _mono = 'SpaceMono';

  /// KIRILL ZAXIRASI.
  ///
  /// Plus Jakarta Sans va Space Mono'da kirill YO'Q — ruscha matn
  /// ularda bo'sh kvadratlar bo'lib chiqardi (ilova uch tilda
  /// ishlaydi, ya'ni bu jim emas, ko'rinadigan nosozlik). Shrift
  /// ALMASHTIRILMADI: prototip aynan shu ikkisini belgilaydi.
  /// O'rniga zaxira oila beriladi va u FAQAT o'z belgisi bo'lmagan
  /// harflarga ishlaydi — lotin matnga tegmaydi.
  static const _sansFallback = ['ManropeCyr'];
  static const _monoFallback = ['PlexMonoCyr'];
  static const _serifFallback = ['ManropeCyr'];

  // ── Display · Instrument Serif ──────────────────────────────

  /// Onboarding va hero sarlavhalari. 46/1.02.
  static TextStyle get display => TextStyle(
    fontFamilyFallback: _serifFallback,
    fontFamily: _serif,
    fontSize: 46,
    height: 1.02,
    letterSpacing: -.4,
    color: C.ink,
  );

  /// Ekran sarlavhasi — "NFC markazi", "Qidiruv", "ID katalogi".
  static TextStyle get title => TextStyle(
    fontFamilyFallback: _serifFallback,
    fontFamily: _serif,
    fontSize: 34,
    height: 1.04,
    letterSpacing: -.3,
    color: C.ink,
  );

  /// Ixcham ekran sarlavhasi (forma va sozlamalar ekranlari).
  static TextStyle get titleSm => TextStyle(
    fontFamilyFallback: _serifFallback,
    fontFamily: _serif,
    fontSize: 27,
    height: 1.06,
    letterSpacing: -.2,
    color: C.ink,
  );

  /// Bo'lim sarlavhasi — "Lenta", "Katalog", "Postlarim".
  static TextStyle get section => TextStyle(
    fontFamilyFallback: _serifFallback,
    fontFamily: _serif,
    fontSize: 22,
    height: 1.1,
    color: C.ink,
  );

  /// Profil ismi.
  static TextStyle get profileName => TextStyle(
    fontFamilyFallback: _serifFallback,
    fontFamily: _serif,
    fontSize: 30,
    height: 1.08,
    letterSpacing: .2,
    color: C.ink,
  );

  /// Kursiv urg'u so'zi — "Assalom, *Dilshod*".
  /// Rang chaqiruv joyida beriladi (odatda `C.accent`).
  static TextStyle get displayItalic => const TextStyle(
    fontFamilyFallback: _serifFallback,
    fontFamily: _serif,
    fontSize: 46,
    height: 1.02,
    letterSpacing: -.4,
    fontStyle: FontStyle.italic,
  );

  /// Katta narx — "149 000".
  static TextStyle get price => TextStyle(
    fontFamilyFallback: _serifFallback,
    fontFamily: _serif,
    fontSize: 42,
    height: 1,
    letterSpacing: -.5,
    color: C.ink,
  );

  // ── Funksional · Plus Jakarta Sans ──────────────────────────

  /// Kuchli sarlavha — sheet va dialog ustida.
  static TextStyle get h1 => TextStyle(
    fontFamilyFallback: _sansFallback,
    fontFamily: _sans,
    fontWeight: FontWeight.w800,
    fontSize: 26,
    height: 1.14,
    letterSpacing: -.7,
    color: C.ink,
  );

  static TextStyle get h2 => TextStyle(
    fontFamilyFallback: _sansFallback,
    fontFamily: _sans,
    fontWeight: FontWeight.w800,
    fontSize: 21,
    height: 1.18,
    letterSpacing: -.45,
    color: C.ink,
  );

  /// Karta va qator sarlavhasi.
  static TextStyle get cardTitle => TextStyle(
    fontFamilyFallback: _sansFallback,
    fontFamily: _sans,
    fontWeight: FontWeight.w700,
    fontSize: 15.5,
    height: 1.24,
    letterSpacing: -.1,
    color: C.ink,
  );

  /// Tana matni. Qator balandligi 1.55 — uzun o'zbekcha jumlalar
  /// siqilib qolmasin.
  static TextStyle get body => TextStyle(
    fontFamilyFallback: _sansFallback,
    fontFamily: _sans,
    fontWeight: FontWeight.w400,
    fontSize: 15,
    height: 1.55,
    color: C.ink2,
  );

  /// Kuchliroq tana matni — asosiy qiymat, javob matni.
  static TextStyle get bodyStrong => TextStyle(
    fontFamilyFallback: _sansFallback,
    fontFamily: _sans,
    fontWeight: FontWeight.w500,
    fontSize: 15,
    height: 1.45,
    color: C.ink,
  );

  /// Izoh va ikkilamchi tushuntirish.
  static TextStyle get caption => TextStyle(
    fontFamilyFallback: _sansFallback,
    fontFamily: _sans,
    fontWeight: FontWeight.w400,
    fontSize: 13,
    height: 1.5,
    color: C.ink2,
  );

  /// Forma yorliqlari — KATTA HARFDA yoziladi.
  static TextStyle get label => TextStyle(
    fontFamilyFallback: _sansFallback,
    fontFamily: _sans,
    fontWeight: FontWeight.w700,
    fontSize: 11,
    height: 1.2,
    letterSpacing: 1.3,
    color: C.ink3,
  );

  /// Asosiy tugma matni.
  static TextStyle get button => TextStyle(
    fontFamilyFallback: _sansFallback,
    fontFamily: _sans,
    fontWeight: FontWeight.w700,
    fontSize: 16.5,
    height: 1.1,
    letterSpacing: -.1,
    color: C.ink,
  );

  /// Kichik tugma va chip matni.
  static TextStyle get buttonSm => TextStyle(
    fontFamilyFallback: _sansFallback,
    fontFamily: _sans,
    fontWeight: FontWeight.w700,
    fontSize: 13.5,
    height: 1.1,
    color: C.ink,
  );

  /// Tab yorlig'i.
  static TextStyle get navLabel => TextStyle(
    fontFamilyFallback: _sansFallback,
    fontFamily: _sans,
    fontWeight: FontWeight.w600,
    fontSize: 10.5,
    height: 1.1,
    letterSpacing: .1,
    color: C.ink3,
  );

  /// Statistika yorlig'i — "Ko'rish", "Kontakt", "Obunachi".
  static TextStyle get statLabel => TextStyle(
    fontFamilyFallback: _sansFallback,
    fontFamily: _sans,
    fontWeight: FontWeight.w600,
    fontSize: 10.5,
    height: 1.2,
    letterSpacing: .3,
    color: C.ink3,
  );

  // ── Mono · IBM Plex Mono ────────────────────────────────────

  /// Statistika qiymati — "4 812".
  static TextStyle get statValue => TextStyle(
    fontFamilyFallback: _monoFallback,
    fontFamily: _mono,
    fontWeight: FontWeight.w600,
    fontSize: 21,
    height: 1.1,
    letterSpacing: -.3,
    color: C.ink,
  );

  /// Meta yozuvi — sana, vaqt, holat.
  static TextStyle get meta => TextStyle(
    fontFamilyFallback: _monoFallback,
    fontFamily: _mono,
    fontWeight: FontWeight.w500,
    fontSize: 11.5,
    height: 1.3,
    letterSpacing: .2,
    color: C.ink3,
  );

  /// Mono summa — to'lov tarixidagi raqamlar ustma-ust tekis
  /// turishi uchun.
  static TextStyle get amount => TextStyle(
    fontFamilyFallback: _monoFallback,
    fontFamily: _mono,
    fontWeight: FontWeight.w600,
    fontSize: 15,
    height: 1.2,
    letterSpacing: -.2,
    color: C.ink,
  );

  /// Holat yorlig'i — "TAYYOR · TEGIZING", "HOLAT: KUTILMOQDA".
  static TextStyle get statusLabel => TextStyle(
    fontFamilyFallback: _monoFallback,
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
    fontFamilyFallback: _monoFallback,
        fontFamily: _mono,
        fontWeight: FontWeight.w500,
        fontSize: 10.5,
        height: 1.2,
        letterSpacing: 1.8,
        color: C.accent.withValues(alpha: .9),
      );

  /// Wordmark — "N F C S T O R E".
  static TextStyle get wordmark => TextStyle(
    fontFamilyFallback: _monoFallback,
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
    fontFamilyFallback: _monoFallback,
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

/// Katta sonni qisqartiradi: `12.4k`, `31.4M`.
///
/// Statistika kartalarida joy cheklangan; to'liq son esa tafsilot
/// ekranida ko'rsatiladi.
///
/// QOIDALAR:
/// • 100 dan kichik qisqartmada bitta kasr qoladi (`12.4k`) —
///   aks holda `12k` va `12.9k` farqi yo'qoladi;
/// • 100 dan katta qisqartmada kasr tashlanadi (`125k`) — u yerda
///   bitta raqamning ahamiyati yo'q;
/// • ortiqcha `.0` hech qachon chiqmaydi (`12k`, `12.0k` emas).
String compact(num value) {
  final n = value.abs();
  if (n < 1000) return value.round().toString();

  final divisor = n < 1000000 ? 1000 : 1000000;
  final suffix = n < 1000000 ? 'k' : 'M';
  final v = value / divisor;
  final text = v.abs() < 100 ? v.toStringAsFixed(1) : v.toStringAsFixed(0);
  return '${text.endsWith('.0') ? text.substring(0, text.length - 2) : text}'
      '$suffix';
}
