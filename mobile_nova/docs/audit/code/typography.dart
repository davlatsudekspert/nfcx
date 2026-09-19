import 'package:flutter/material.dart';

/// Ikki oilali tipografiya — Concept B'dagi serif sarlavha + sans matn.
///
/// HTML'da sarlavhalar uchun Georgia ishlatilgan; mobil ilovada tizim
/// shriftiga ishonib bo'lmaydi (Android'da Georgia yo'q), shuning uchun
/// **Instrument Serif** paket ichiga qo'shilgan — har qurilmada bir xil.
/// Matn uchun **Manrope**, NFC ID va narx kabi raqamlar uchun
/// **IBM Plex Mono** (bir xil kenglikdagi raqamlar sakramaydi).
abstract final class AppType {
  static const display = 'InstrumentSerif';
  static const sans = 'Manrope';
  static const mono = 'IBMPlexMono';

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
          height: 1.08,
          letterSpacing: -0.5,
          color: text1,
        ),
        displayMedium: TextStyle(
          fontFamily: display,
          fontFamilyFallback: displayFallback,
          fontSize: 32,
          height: 1.12,
          letterSpacing: -0.4,
          color: text1,
        ),
        // Ekran sarlavhasi.
        titleLarge: TextStyle(
          fontFamily: display,
          fontFamilyFallback: displayFallback,
          fontSize: 25,
          height: 1.2,
          color: text1,
        ),
        titleMedium: TextStyle(
          fontFamily: sans,
          fontSize: 16,
          fontWeight: FontWeight.w700,
          height: 1.3,
          color: text1,
        ),
        titleSmall: TextStyle(
          fontFamily: sans,
          fontSize: 14,
          fontWeight: FontWeight.w700,
          height: 1.3,
          color: text1,
        ),
        bodyLarge: TextStyle(
          fontFamily: sans,
          fontSize: 15,
          fontWeight: FontWeight.w500,
          height: 1.45,
          color: text1,
        ),
        bodyMedium: TextStyle(
          fontFamily: sans,
          fontSize: 13.5,
          fontWeight: FontWeight.w500,
          height: 1.45,
          color: text2,
        ),
        bodySmall: TextStyle(
          fontFamily: sans,
          fontSize: 12,
          fontWeight: FontWeight.w500,
          height: 1.4,
          color: text2,
        ),
        // Kapsula va tugma yozuvi.
        labelLarge: TextStyle(
          fontFamily: sans,
          fontSize: 14,
          fontWeight: FontWeight.w700,
          letterSpacing: .1,
          color: text1,
        ),
        labelMedium: TextStyle(
          fontFamily: sans,
          fontSize: 12,
          fontWeight: FontWeight.w600,
          letterSpacing: .2,
          color: text2,
        ),
        // Bo'lim sarlavhasi ustidagi kichik yozuv — katta harflar.
        labelSmall: TextStyle(
          fontFamily: sans,
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.4,
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

  /// NFC ID, narx, sana — raqamlar qatori "sakramasligi" uchun monospace.
  static TextStyle monoStyle({
    required Color color,
    double size = 13,
    FontWeight weight = FontWeight.w600,
    double letterSpacing = .6,
  }) =>
      TextStyle(
        fontFamily: mono,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: letterSpacing,
        color: color,
      );
}
