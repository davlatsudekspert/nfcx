import 'package:flutter/material.dart';

/// Ikki oilali tipografiya — Concept B'dagi serif sarlavha + sans matn.
///
/// HTML'da sarlavhalar uchun Georgia ishlatilgan; mobil ilovada tizim
/// shriftiga ishonib bo'lmaydi (Android'da Georgia yo'q), shuning uchun
/// **Instrument Serif** paket ichiga qo'shilgan — har qurilmada bir xil.
/// Matn uchun **Manrope**, NFC ID va narx kabi raqamlar uchun
/// **IBM Plex Mono** (bir xil kenglikdagi raqamlar sakramaydi).
/// ## YUMSHOQLIK QOIDASI
///
/// Talab: hech qayerda qattiq, qirrali yoki "arzon" ko'rinish
/// bo'lmasin. Tipografiyada bu uchta o'lchov bilan hal qilinadi:
///
///   * OG'IRLIK — sarlavhalar va tugmalar `w700` edi. Manrope
///     700 da harf tanasi qalinlashib, ekranda "qo'pol" bo'lib
///     ko'rinadi. Hammasi `w600` ga tushirildi: ierarxiya
///     saqlanadi, bosim yo'qoladi;
///   * NAFAS — qator balandligi 1.3–1.45 dan 1.38–1.55 ga
///     ko'tarildi. Matn siqilmaydi, sahifa tinchroq ko'rinadi;
///   * ORALIQ — matnga ozgina musbat `letterSpacing` berildi,
///     sarlavhalardagi manfiy oraliq esa yumshatildi (-0.5 →
///     -0.2). Juda siqilgan serif "texnik" his beradi.
///
/// Mono (NFC kodlar) ham `w600` dan `w500` ga tushdi va oralig'i
/// kengaydi: kod texnik bo'lsa ham og'ir bo'lmasligi kerak.
///
/// ## UCH QATLAM (2026-09, egasining qarori)
///
/// Har bir shriftning BITTA vazifasi bor — aralashtirilmaydi:
///
///   * [display] — Instrument Serif. Katta ekran sarlavhalari, odam
///     va kompaniya ismi, editorial sarlavhalar. Hech qachon tugma
///     yoki kichik matnda emas;
///   * [sans] — Manrope. Tugmalar, menyu, oddiy matn, katalog,
///     filtrlar, formalar — ya'ni ilovaning "ishchi" matni;
///   * [mono] — IBM Plex Mono. NFC ID kodi, qidiruv natijasidagi kod,
///     narx jadvali kabi texnik joylar.
///
/// [heroIdFamily] (Playfair Display) — FAQAT bitta joyda: bosh
/// sahifadagi katta dekorativ ID. Kichik ID chip, qidiruv, profil va
/// katalogda u ISHLATILMAYDI: serifli kichik matnda `0/O` va `1/I`
/// bir-biriga o'xshab qoladi, NFC ID esa odam og'zaki aytib
/// beradigan kod. Katta o'lchamda farq aniq ko'rinadi, kichikda —
/// yo'q.
abstract final class AppType {
  static const display = 'InstrumentSerif';
  static const sans = 'Manrope';
  static const mono = 'IBMPlexMono';

  /// Faqat [heroId] uchun — sababini sinf izohida qarang.
  static const heroIdFamily = 'PlayfairDisplay';

  /// Sarlavhalar uchun ZAXIRA oila.
  ///
  /// Instrument Serif'da KIRILL ALIFBOSI YO'Q — usiz rus tilidagi har
  /// bir sarlavha `▯▯▯▯` bo'lib chiqardi. Playfair Display butun kirill
  /// alifbosini qamraydi va u ham yuqori kontrastli display serif,
  /// shuning uchun uslub buzilmaydi.
  ///
  /// Flutter zaxirani HAR BIR BELGI uchun alohida qo'llaydi: lotin
  /// harflar Instrument Serif'da, kirill harflar Playfair'da chiziladi.
  static const displayFallback = ['PlayfairDisplay'];

  static TextTheme textTheme(Color text1, Color text2) => TextTheme(
        // Hero sarlavha — Welcome, Splash, bo'sh holat.
        displayLarge: TextStyle(
          fontFamily: display,
          fontFamilyFallback: displayFallback,
          fontSize: 40,
          height: 1.14,
          letterSpacing: -0.2,
          color: text1,
        ),
        displayMedium: TextStyle(
          fontFamily: display,
          fontFamilyFallback: displayFallback,
          fontSize: 32,
          height: 1.18,
          letterSpacing: -0.2,
          color: text1,
        ),
        // Ekran sarlavhasi.
        titleLarge: TextStyle(
          fontFamily: display,
          fontFamilyFallback: displayFallback,
          fontSize: 25,
          height: 1.26,
          letterSpacing: -0.1,
          color: text1,
        ),
        titleMedium: TextStyle(
          fontFamily: sans,
          fontSize: 16,
          fontWeight: FontWeight.w600,
          height: 1.38,
          letterSpacing: -0.1,
          color: text1,
        ),
        titleSmall: TextStyle(
          fontFamily: sans,
          fontSize: 14,
          fontWeight: FontWeight.w600,
          height: 1.38,
          letterSpacing: -0.05,
          color: text1,
        ),
        // Uzun matn (bodyLarge) — 400, yengil o'qiladi. Kichik matnlar
        // (bodyMedium/Small) — 500: 400 da ular ivory fonda xira
        // ko'rinardi (egasi, 2026-09: "mayda yozuvlar ham oson o'qilsin").
        bodyLarge: TextStyle(
          fontFamily: sans,
          fontSize: 15,
          fontWeight: FontWeight.w400,
          height: 1.55,
          letterSpacing: 0.05,
          color: text1,
        ),
        bodyMedium: TextStyle(
          fontFamily: sans,
          fontSize: 13.5,
          fontWeight: FontWeight.w500,
          height: 1.55,
          letterSpacing: 0.05,
          color: text2,
        ),
        bodySmall: TextStyle(
          fontFamily: sans,
          fontSize: 12,
          fontWeight: FontWeight.w500,
          height: 1.5,
          letterSpacing: 0.1,
          color: text2,
        ),
        // Kapsula va tugma yozuvi.
        labelLarge: TextStyle(
          fontFamily: sans,
          fontSize: 14,
          fontWeight: FontWeight.w600,
          letterSpacing: .25,
          color: text1,
        ),
        labelMedium: TextStyle(
          fontFamily: sans,
          fontSize: 12,
          fontWeight: FontWeight.w500,
          letterSpacing: .3,
          color: text2,
        ),
        // Bo'lim sarlavhasi ustidagi kichik yozuv — katta harflar.
        labelSmall: TextStyle(
          fontFamily: sans,
          fontSize: 10.5,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.7,
          color: text2,
        ),
      );

  /// Sarlavha uslubi — zaxira oila bilan.
  ///
  /// QOIDA: ilovada `fontFamily: AppType.display` QO'LDA yozilmaydi.
  /// Aks holda o'sha joyda kirill zaxirasi tushib qolardi va rus
  /// tilidagi matn `▯▯▯▯` bo'lib chiqardi.
  static TextStyle displayStyle({
    required Color color,
    double size = 21,
    double? height,
    double? letterSpacing,
    List<Shadow>? shadows,
  }) =>
      TextStyle(
        fontFamily: display,
        fontFamilyFallback: displayFallback,
        fontSize: size,
        height: height,
        letterSpacing: letterSpacing,
        color: color,
        shadows: shadows,
      );

  /// BOSH SAHIFADAGI KATTA NFC ID — dekorativ, gravyura hissi.
  ///
  /// RAQAMLAR TO'LIQ BALANDLIKDA (`lnum`). Playfair sukut bo'yicha
  /// "eski uslub" raqamlarini chizadi: `0` kichik `o` harfidek
  /// pastga tushadi va `VIP001` ko'zga `VIPoo1` bo'lib ko'rinadi.
  /// Bu jurnal sarlavhasida chiroyli, lekin ID — odam o'qib, og'zaki
  /// aytib beradigan KOD. Shuning uchun raqamlar harflar bilan bir
  /// balandlikda turadi va `0` harf `O` dan torroq oval bo'lib
  /// qoladi.
  ///
  /// [size] 40 dan kichik bo'lsa ishlatmang — [monoStyle] ni oling.
  static TextStyle heroId({required Color color, double size = 52}) =>
      TextStyle(
        fontFamily: heroIdFamily,
        fontSize: size,
        fontWeight: FontWeight.w500,
        height: 1.0,
        letterSpacing: size * .02,
        color: color,
        fontFeatures: const [FontFeature.liningFigures()],
      );

  /// Bo'lim ustidagi kichik yozuv: `BU HAFTA`, `NFC ID · SHAXSIY`.
  ///
  /// Katta harf va keng oraliq bilan u sarlavha bilan raqobat
  /// qilmaydi, lekin ierarxiyani belgilaydi — editorial uslubning
  /// asosiy "ritm" elementi.
  static TextStyle eyebrow({required Color color, double size = 10.5}) =>
      TextStyle(
        fontFamily: sans,
        fontSize: size,
        fontWeight: FontWeight.w600,
        letterSpacing: size * .19,
        height: 1.2,
        color: color,
      );

  /// NFC ID, narx, sana — raqamlar qatori "sakramasligi" uchun monospace.
  static TextStyle monoStyle({
    required Color color,
    double size = 13,
    FontWeight weight = FontWeight.w500,
    double letterSpacing = .9,
  }) =>
      TextStyle(
        fontFamily: mono,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: letterSpacing,
        color: color,
      );
}
