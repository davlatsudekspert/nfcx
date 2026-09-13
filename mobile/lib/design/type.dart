import 'package:flutter/widgets.dart';
import 'tokens.dart';

/// Tipografika — handoff jadvalining aynan o'zi.
///
/// UCH SHRIFT, uchta aniq vazifa:
///   InstrumentSerif — FAQAT display sarlavha, hero matn va NFC ID o'qilishi.
///                     Boshqa joyda ishlatilsa u "bezak" ga aylanadi va
///                     interfeys o'qilishini yo'qotadi.
///   Manrope         — funksional hamma narsa: nav, tugma, ro'yxat, matn.
///   IBMPlexMono     — ID kodlari, narx, vaqt, eyebrow yozuvlari.
class T {
  T._();

  static const _serif = 'InstrumentSerif';
  static const _sans = 'Manrope';
  static const _mono = 'IBMPlexMono';

  // ── Display (Instrument Serif) ─────────────────────────────────────
  static const display = TextStyle(
    fontFamily: _serif, fontSize: 38, height: 1.06, letterSpacing: -0.38,
    color: C.offWhite,
  );
  static const displaySm = TextStyle(
    fontFamily: _serif, fontSize: 30, height: 1.08, letterSpacing: -0.3,
    color: C.offWhite,
  );

  /// NFC ID o'qilishi — har doim champagne, harflar orasi ochiq.
  static TextStyle nfcId(double size) => TextStyle(
        fontFamily: _serif, fontSize: size, height: 1,
        letterSpacing: size * 0.045, color: C.champagne,
      );

  // ── Manrope ────────────────────────────────────────────────────────
  static const screenTitle = TextStyle(
    fontFamily: _sans, fontWeight: FontWeight.w800, fontSize: 29, height: 1.1,
    letterSpacing: -0.87, color: C.offWhite,
  );
  static const screenSub = TextStyle(
    fontFamily: _sans, fontWeight: FontWeight.w500, fontSize: 12, color: C.ash,
  );
  static const profileName = TextStyle(
    fontFamily: _sans, fontWeight: FontWeight.w800, fontSize: 21, height: 1.2,
    letterSpacing: -0.42, color: C.offWhite,
  );
  static const section = TextStyle(
    fontFamily: _sans, fontWeight: FontWeight.w700, fontSize: 16, height: 1,
    color: C.offWhite,
  );
  static const cardTitle = TextStyle(
    fontFamily: _sans, fontWeight: FontWeight.w700, fontSize: 14, height: 1.25,
    color: C.offWhite,
  );
  static const body = TextStyle(
    fontFamily: _sans, fontWeight: FontWeight.w400, fontSize: 13.5, height: 1.62,
    color: C.ash,
  );
  static const caption = TextStyle(
    fontFamily: _sans, fontWeight: FontWeight.w400, fontSize: 11.5, height: 1.45,
    color: C.ash,
  );
  static const button = TextStyle(
    fontFamily: _sans, fontWeight: FontWeight.w700, fontSize: 15, height: 1,
    letterSpacing: -0.1,
  );
  static const navLabel = TextStyle(
    fontFamily: _sans, fontWeight: FontWeight.w600, fontSize: 9.5, height: 1,
  );

  // ── IBM Plex Mono ──────────────────────────────────────────────────
  /// Eyebrow — bo'lim ustidagi kichik antiqua-oltin yozuv.
  static const eyebrow = TextStyle(
    fontFamily: _mono, fontWeight: FontWeight.w500, fontSize: 10,
    letterSpacing: 1.6, color: C.antiqueGold,
  );
  static const meta = TextStyle(
    fontFamily: _mono, fontWeight: FontWeight.w500, fontSize: 11.5, color: C.ash,
  );
  static const price = TextStyle(
    fontFamily: _mono, fontWeight: FontWeight.w600, fontSize: 12.5,
    color: C.champagne,
  );
  static const code = TextStyle(
    fontFamily: _mono, fontWeight: FontWeight.w600, fontSize: 12,
    letterSpacing: 0.6, color: C.champagne,
  );
  static const statusLabel = TextStyle(
    fontFamily: _mono, fontWeight: FontWeight.w600, fontSize: 9.5,
    letterSpacing: 0.76,
  );
}

/// Narxni o'zbekcha yozish: 1200000 -> "1 200 000".
///
/// Ajratgich — TOR BO'SHLIQ (U+202F), oddiy probel emas: oddiy probelda
/// raqam qator oxirida ikkiga bo'linib ketishi mumkin.
String som(num value) {
  final s = value.round().abs().toString();
  final b = StringBuffer(value < 0 ? '-' : '');
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(' ');
    b.write(s[i]);
  }
  return b.toString();
}

/// Katta sonni qisqartirish: 12400 -> "12.4k", 31400000 -> "31.4M".
///
/// Statistika kartochkalari uchun — to'liq son u yerda sig'maydi va
/// o'qilmaydi ham.
///
/// BITTA KASR RAQAM 100 dan kichik qiymatlarda saqlanadi: dizaynda
/// "12.4k" va "48.2k" ko'rsatilgan, ya'ni aniqlik muhim. 100 dan
/// kattasida kasr ortiqcha ("124.6k" o'rniga "125k" tinchroq
/// o'qiladi). Ortiqcha ".0" hech qachon chiqmaydi.
String compact(num value) {
  if (value.abs() < 1000) return value.round().toString();
  final (v, suffix) = value.abs() < 1000000
      ? (value / 1000, 'k')
      : (value / 1000000, 'M');
  if (v.abs() >= 100) return '${v.round()}$suffix';
  final one = v.toStringAsFixed(1);
  return '${one.endsWith('.0') ? one.substring(0, one.length - 2) : one}$suffix';
}
