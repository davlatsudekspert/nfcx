import 'package:flutter/material.dart';

import 'palette.dart';

/// Ilovadagi BARCHA rang va soya qiymatlari shu bitta kengaytmadan olinadi.
///
/// NIMA UCHUN `ThemeExtension`: mavzu almashganda Flutter ikkita
/// `NfcTokens` orasida `lerp` qiladi, ya'ni 5 ta mavzu o'rtasidagi o'tish
/// bepul animatsiyalanadi. Agar ranglar global `const` bo'lganida,
/// almashish keskin "chaqnab" ketardi.
@immutable
class NfcTokens extends ThemeExtension<NfcTokens> {
  const NfcTokens({
    required this.id,
    required this.isDark,
    required this.bg1,
    required this.bg2,
    required this.bgVignette,
    required this.surface,
    required this.surface2,
    required this.surfaceSolid,
    required this.text1,
    required this.text2,
    required this.text3,
    required this.accent1,
    required this.accent2,
    required this.accent3,
    required this.goldDeep,
    required this.accentB,
    required this.accentBDark,
    required this.accentC,
    required this.accentCDark,
    required this.accentD,
    required this.accentDDark,
    required this.glow,
    required this.glowB,
    required this.border1,
    required this.border2,
    required this.error,
    required this.success,
    required this.warn,
    required this.ambient1,
    required this.ambient2,
    required this.shadowFloat,
    required this.shadowSoft,
    required this.shadowTiny,
  });

  /// Saqlashda ishlatiladigan barqaror kalit (`pearl`, `midnight`, ...).
  final String id;

  /// Matn ustidagi status paneli piktogrammalari uchun. Pearl'dan boshqa
  /// hamma mavzu qorong'i.
  final bool isDark;

  final Color bg1, bg2, bgVignette;
  final Color surface, surface2, surfaceSolid;
  final Color text1, text2, text3;
  final Color accent1, accent2, accent3;

  /// Aksentning CHUQURROQ ohangi — faqat katta, yaxlit aksent yuzalar
  /// uchun (hozircha NFC orbning yadrosi).
  ///
  /// NIMA UCHUN ALOHIDA TOKEN: orb ham, identity karta ham bir xil
  /// `[accent1, accent2]` gradientidan foydalanardi. Natijada bitta
  /// ekranda ikkita katta yuza AYNAN bir xil oltinda turardi va
  /// oltin aksent bo'lishdan to'xtab, fon rangiga aylanardi.
  ///
  /// Endi karta yumshoq shampan ohangida (`accent1 -> accent2`)
  /// qoladi, orb esa undan bir pog'ona chuqurroq
  /// (`accent2 -> goldDeep`) — ierarxiya rang bilan ham o'qiladi.
  final Color goldDeep;
  final Color accentB, accentBDark;
  final Color accentC, accentCDark;
  final Color accentD, accentDDark;
  final Color glow, glowB;
  final Color border1, border2;
  final Color error, success, warn;
  final Color ambient1, ambient2;
  final List<BoxShadow> shadowFloat, shadowSoft, shadowTiny;

  /// Ekran orqa foni — yuqoridan pastga yumshoq gradient.
  LinearGradient get backdrop => LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [bg1, bg2],
      );

  /// Asosiy aksent gradienti: tugma, NFC orb va faol nav elementi.
  LinearGradient get accentGradient => LinearGradient(
        begin: const Alignment(-0.7, -1),
        end: const Alignment(0.7, 1),
        colors: [accent1, accent2],
      );

  /// Aksent SIRTI ustidagi matn/ikonka rangi.
  ///
  /// Beshala mavzuda ham aksent OCHIQ rang (champagne, platina, muz,
  /// siyohrang, oltin), shuning uchun ustida oq emas, QORONG'I siyoh
  /// o'qiladi. Bu qiymat mavzu bilan o'zgarmaydi — aynan shu sababdan.
  Color get onAccent => const Color(0xFF1A1A1F);

  /// Logotip orqasidagi plastina rangi.
  ///
  /// Brend logotipi QORA fonli JPG. Yorug' mavzuda uni to'g'ridan-to'g'ri
  /// oq fonga qo'yib bo'lmaydi — qora kvadrat bo'lib ko'rinadi. Shuning
  /// uchun logotipning O'ZI emas, ATROFIDAGI plastina mavzuga moslashadi.
  Color get logoPlate => isDark ? surfaceSolid : const Color(0xFF14131A);

  @override
  NfcTokens copyWith({String? id, bool? isDark}) => this;

  @override
  NfcTokens lerp(covariant NfcTokens? other, double t) {
    if (other == null) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    List<BoxShadow> s(List<BoxShadow> a, List<BoxShadow> b) =>
        BoxShadow.lerpList(a, b, t) ?? b;
    return NfcTokens(
      id: t < 0.5 ? id : other.id,
      isDark: t < 0.5 ? isDark : other.isDark,
      bg1: c(bg1, other.bg1),
      bg2: c(bg2, other.bg2),
      bgVignette: c(bgVignette, other.bgVignette),
      surface: c(surface, other.surface),
      surface2: c(surface2, other.surface2),
      surfaceSolid: c(surfaceSolid, other.surfaceSolid),
      text1: c(text1, other.text1),
      text2: c(text2, other.text2),
      text3: c(text3, other.text3),
      accent1: c(accent1, other.accent1),
      accent2: c(accent2, other.accent2),
      accent3: c(accent3, other.accent3),
      goldDeep: c(goldDeep, other.goldDeep),
      accentB: c(accentB, other.accentB),
      accentBDark: c(accentBDark, other.accentBDark),
      accentC: c(accentC, other.accentC),
      accentCDark: c(accentCDark, other.accentCDark),
      accentD: c(accentD, other.accentD),
      accentDDark: c(accentDDark, other.accentDDark),
      glow: c(glow, other.glow),
      glowB: c(glowB, other.glowB),
      border1: c(border1, other.border1),
      border2: c(border2, other.border2),
      error: c(error, other.error),
      success: c(success, other.success),
      warn: c(warn, other.warn),
      ambient1: c(ambient1, other.ambient1),
      ambient2: c(ambient2, other.ambient2),
      shadowFloat: s(shadowFloat, other.shadowFloat),
      shadowSoft: s(shadowSoft, other.shadowSoft),
      shadowTiny: s(shadowTiny, other.shadowTiny),
    );
  }

  // ---------------------------------------------------------------- 1 PEARL
  static final pearl = NfcTokens(
    id: 'pearl',
    isDark: false,
    bg1: hex('#FAF7F2'),
    bg2: hex('#EFE7DA'),
    bgVignette: rgba(196, 164, 124, .14),
    surface: rgba(253, 251, 247, .82),
    surface2: rgba(253, 251, 247, .55),
    surfaceSolid: hex('#FDFBF7'),
    text1: hex('#2A2A2E'),
    text2: hex('#5A5A62'),
    text3: hex('#9A9AA2'),
    accent1: hex('#E4D2AB'),
    accent2: hex('#CBAA78'),
    accent3: hex('#8E7550'),
    goldDeep: hex('#B89552'),
    accentB: hex('#C5D8CB'),
    accentBDark: hex('#6E8A7A'),
    accentC: hex('#D5CFE4'),
    accentCDark: hex('#8E7FB8'),
    accentD: hex('#CBDCE8'),
    accentDDark: hex('#6B8FA8'),
    glow: rgba(203, 170, 120, .33),
    glowB: rgba(159, 184, 168, .35),
    border1: rgba(255, 255, 255, .95),
    border2: rgba(196, 164, 124, .22),
    error: hex('#D88A8A'),
    success: hex('#8FB89A'),
    warn: hex('#DDB878'),
    ambient1: rgba(228, 210, 171, .44),
    ambient2: rgba(197, 216, 203, .4),
    shadowFloat: [
      BoxShadow(color: rgba(160, 140, 110, .12), blurRadius: 72, offset: const Offset(0, 23)),
      BoxShadow(color: rgba(160, 140, 110, .06), blurRadius: 29, offset: const Offset(0, 8)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(160, 140, 110, .08), blurRadius: 46, offset: const Offset(0, 13)),
      BoxShadow(color: rgba(160, 140, 110, .05), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(160, 140, 110, .06), blurRadius: 17, offset: const Offset(0, 4)),
    ],
  );

  // ------------------------------------------------------------- 2 GRAPHITE
  static final graphite = NfcTokens(
    id: 'graphite',
    isDark: true,
    bg1: hex('#1A1B1F'),
    bg2: hex('#0A0B0E'),
    bgVignette: rgba(200, 200, 210, .08),
    surface: rgba(38, 40, 46, .72),
    surface2: rgba(38, 40, 46, .45),
    surfaceSolid: hex('#22232A'),
    text1: hex('#F0EFEB'),
    text2: hex('#B8B8BE'),
    text3: hex('#7A7A82'),
    accent1: hex('#DFDCD6'),
    accent2: hex('#C0BBB2'),
    accent3: hex('#8E8E92'),
    goldDeep: hex('#A7A199'),
    accentB: hex('#8FA0B0'),
    accentBDark: hex('#A8BDD0'),
    accentC: hex('#A8B0C4'),
    accentCDark: hex('#8A94B0'),
    accentD: hex('#8898A8'),
    accentDDark: hex('#A0B4C4'),
    glow: rgba(220, 220, 224, .22),
    glowB: rgba(143, 160, 176, .22),
    border1: rgba(255, 255, 255, .14),
    border2: rgba(200, 200, 210, .14),
    error: hex('#E09494'),
    success: hex('#94C4A0'),
    warn: hex('#E0C088'),
    ambient1: rgba(180, 180, 190, .14),
    ambient2: rgba(143, 160, 176, .14),
    shadowFloat: [
      BoxShadow(color: rgba(0, 0, 0, .43), blurRadius: 72, offset: const Offset(0, 23)),
      BoxShadow(color: rgba(0, 0, 0, .27), blurRadius: 29, offset: const Offset(0, 8)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(0, 0, 0, .31), blurRadius: 46, offset: const Offset(0, 13)),
      BoxShadow(color: rgba(0, 0, 0, .16), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(0, 0, 0, .23), blurRadius: 17, offset: const Offset(0, 4)),
    ],
  );

  // ---------------------------------------------------------------- 3 OCEAN
  static final ocean = NfcTokens(
    id: 'ocean',
    isDark: true,
    bg1: hex('#0F1E30'),
    bg2: hex('#04101C'),
    bgVignette: rgba(111, 199, 224, .14),
    surface: rgba(30, 54, 82, .7),
    surface2: rgba(30, 54, 82, .45),
    surfaceSolid: hex('#152B44'),
    text1: hex('#E8F0F8'),
    text2: hex('#A8C0D8'),
    text3: hex('#6A88A8'),
    accent1: hex('#AFD6E0'),
    accent2: hex('#6FB3C6'),
    accent3: hex('#4A8FB0'),
    goldDeep: hex('#4E8FA6'),
    accentB: hex('#A8D4C4'),
    accentBDark: hex('#88C0B0'),
    accentC: hex('#B8C8E8'),
    accentCDark: hex('#8AA4CC'),
    accentD: hex('#D0E8F4'),
    accentDDark: hex('#A8C8E0'),
    glow: rgba(111, 199, 224, .3),
    glowB: rgba(168, 212, 196, .3),
    border1: rgba(200, 230, 255, .15),
    border2: rgba(111, 199, 224, .2),
    error: hex('#E09494'),
    success: hex('#94C4A0'),
    warn: hex('#E0C088'),
    ambient1: rgba(111, 199, 224, .28),
    ambient2: rgba(168, 212, 196, .22),
    shadowFloat: [
      BoxShadow(color: rgba(0, 10, 25, .47), blurRadius: 72, offset: const Offset(0, 23)),
      BoxShadow(color: rgba(0, 10, 25, .31), blurRadius: 29, offset: const Offset(0, 8)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(0, 10, 25, .35), blurRadius: 46, offset: const Offset(0, 13)),
      BoxShadow(color: rgba(0, 10, 25, .20), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(0, 10, 25, .27), blurRadius: 17, offset: const Offset(0, 4)),
    ],
  );

  // --------------------------------------------------------------- 4 AURORA
  static final aurora = NfcTokens(
    id: 'aurora',
    isDark: true,
    bg1: hex('#1E1832'),
    bg2: hex('#0A0716'),
    bgVignette: rgba(184, 160, 224, .16),
    surface: rgba(50, 38, 78, .72),
    surface2: rgba(50, 38, 78, .45),
    surfaceSolid: hex('#2A2040'),
    text1: hex('#F4EDF8'),
    text2: hex('#C8B8E0'),
    text3: hex('#8A7AA8'),
    accent1: hex('#D3C6E4'),
    accent2: hex('#AE9BCB'),
    accent3: hex('#8A6FB0'),
    goldDeep: hex('#927CB0'),
    accentB: hex('#9ED8E0'),
    accentBDark: hex('#7EC0CC'),
    accentC: hex('#E0B8D8'),
    accentCDark: hex('#C090B8'),
    accentD: hex('#B8C4E8'),
    accentDDark: hex('#8A9AC8'),
    glow: rgba(184, 160, 224, .35),
    glowB: rgba(158, 216, 224, .3),
    border1: rgba(220, 200, 240, .15),
    border2: rgba(184, 160, 224, .22),
    error: hex('#E09494'),
    success: hex('#94C4A0'),
    warn: hex('#E0C088'),
    ambient1: rgba(184, 160, 224, .32),
    ambient2: rgba(158, 216, 224, .24),
    shadowFloat: [
      BoxShadow(color: rgba(10, 5, 25, .47), blurRadius: 72, offset: const Offset(0, 23)),
      BoxShadow(color: rgba(10, 5, 25, .31), blurRadius: 29, offset: const Offset(0, 8)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(10, 5, 25, .35), blurRadius: 46, offset: const Offset(0, 13)),
      BoxShadow(color: rgba(10, 5, 25, .20), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(10, 5, 25, .27), blurRadius: 17, offset: const Offset(0, 4)),
    ],
  );

  // ------------------------------------------------------------- 5 MIDNIGHT
  // Brend logotipi aynan shu mavzu uchun yaratilgandek: chuqur ko'k fon,
  // champagne oltin aksent. `shadowFloat` ichidagi uchinchi qatlam —
  // juda yengil oltin nur; usiz mavzu shunchaki "qorong'i ko'k" bo'lardi.
  static final midnight = NfcTokens(
    id: 'midnight',
    isDark: true,
    bg1: hex('#0C1526'),
    bg2: hex('#070C18'),
    bgVignette: rgba(212, 179, 106, .10),
    surface: rgba(22, 34, 52, .72),
    surface2: rgba(22, 34, 52, .45),
    surfaceSolid: hex('#121F34'),
    text1: hex('#F5EFE2'),
    text2: hex('#B8B4A6'),
    text3: hex('#6E6A60'),
    accent1: hex('#E8D4A0'),
    accent2: hex('#C9A96A'),
    accent3: hex('#8E7340'),
    goldDeep: hex('#B08F4E'),
    accentB: hex('#A8B8C4'),
    accentBDark: hex('#C4D0D8'),
    accentC: hex('#B8B0C8'),
    accentCDark: hex('#8E88A0'),
    accentD: hex('#C4C8D0'),
    accentDDark: hex('#9AA0A8'),
    glow: rgba(201, 169, 106, .32),
    glowB: rgba(168, 184, 196, .22),
    border1: rgba(212, 179, 106, .14),
    border2: rgba(201, 169, 106, .24),
    error: hex('#E0A0A0'),
    success: hex('#A8C4A8'),
    warn: hex('#E0C088'),
    ambient1: rgba(201, 169, 106, .22),
    ambient2: rgba(50, 90, 140, .24),
    shadowFloat: [
      BoxShadow(color: rgba(0, 5, 15, .55), blurRadius: 72, offset: const Offset(0, 23)),
      BoxShadow(color: rgba(0, 5, 15, .39), blurRadius: 29, offset: const Offset(0, 8)),
      BoxShadow(color: rgba(201, 169, 106, .08), blurRadius: 60),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(0, 5, 15, .43), blurRadius: 46, offset: const Offset(0, 13)),
      BoxShadow(color: rgba(0, 5, 15, .27), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(0, 5, 15, .31), blurRadius: 17, offset: const Offset(0, 4)),
    ],
  );

  static final all = <NfcTokens>[pearl, graphite, ocean, aurora, midnight];

  /// STANDART MAVZU — `ocean`.
  ///
  /// Foydalanuvchi hali tanlamagan bo'lsa (birinchi ochilish yoki
  /// saqlangan qiymat noma'lum bo'lsa) shu ishlatiladi. Egasining
  /// qarori: ilova birinchi ochilganda `ocean` ko'rinsin.
  static NfcTokens get fallback => ocean;

  static NfcTokens byId(String? id) =>
      all.firstWhere((t) => t.id == id, orElse: () => fallback);
}

/// `context.tokens` — har widget ichida `Theme.of(context).extension<...>()`
/// yozmaslik uchun.
extension NfcTokensX on BuildContext {
  NfcTokens get tokens =>
      Theme.of(this).extension<NfcTokens>() ?? NfcTokens.fallback;
}
