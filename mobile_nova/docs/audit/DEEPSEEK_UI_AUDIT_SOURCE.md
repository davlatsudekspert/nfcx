# NFCSTORE Nova — UI audit uchun manba kod


Bu fayl **avtomatik yig‘ilgan**: quyidagi 19 ta Dart fayli to‘liq
matni bilan, o‘zgartirishsiz birlashtirilgan.

| | |
|---|---|
| Commit | `8d09964c05dd8ea3603970174a54654c16590810` |
| Branch | `claude/vibrant-einstein-p5lo1i` |
| Paket | `uz.nfcstore.nova` · `1.0.0 (2)` |
| CI run | #35430822764 — 17/17 muvaffaqiyatli |

**Maqsad:** `DEEPSEEK_CONCEPT_B_REFERENCE.md` dagi Concept B Final
qoidalari bilan solishtirish.

Izohlar o‘zbek tilida — ular kodning bir qismi va qaror SABABINI
tushuntiradi, shuning uchun olib tashlanmagan.


## Fayllar ro‘yxati

| # | Path | Qatorlar | Nima |
|---|---|---|---|
| 1 | `lib/design/tokens/nfc_tokens.dart` | 376 | Beshala mavzu — ThemeExtension, lerp, onAccent |
| 2 | `lib/design/theme/app_theme.dart` | 140 | ThemeData qurish, Material komponentlarini moslash |
| 3 | `lib/design/theme/typography.dart` | 149 | Serif sarlavha + sans matn + mono raqam, kirill zaxirasi |
| 4 | `lib/design/tokens/shapes.dart` | 44 | Radius shkalasi va bo‘shliq (Gap) |
| 5 | `lib/design/motion/motion.dart` | 35 | Tezlik va egri chiziqlar (--dur-*, --ease-*) |
| 6 | `lib/design/tokens/palette.dart` | 21 | CSS qiymatlarini Color ga o‘girish |
| 7 | `lib/design/widgets/nfc_orb.dart` | 317 | NFC orb: nafas, halo, 3 pulse halqasi, organik yadro, orbit |
| 8 | `lib/features/nfc/nfc_center_screen.dart` | 273 | NFC markazi ekrani |
| 9 | `lib/features/home/home_screen.dart` | 546 | Home kompozitsiyasi |
| 10 | `lib/features/home/widgets/identity_card.dart` | 236 | Identity obyekti — organik nosimmetrik shakl |
| 11 | `lib/features/home/widgets/mode_switch.dart` | 127 | Shaxsiy ↔ Biznes almashtirgich |
| 12 | `lib/design/widgets/bottom_nav.dart` | 164 | Suzuvchi nav, markazda ko‘tarilgan NFC tugmasi |
| 13 | `lib/features/profile/profile_screen.dart` | 456 | Digital Identity Canvas |
| 14 | `lib/design/widgets/surfaces.dart` | 224 | FloatingSurface, Capsule, PressableScale, SectionHeader |
| 15 | `lib/design/widgets/buttons.dart` | 157 | NovaButton, NovaIconButton |
| 16 | `lib/design/widgets/backdrop.dart` | 141 | Ambient fon — sekin suzuvchi dog‘lar |
| 17 | `lib/design/widgets/brand_logo.dart` | 175 | Logotip qoidalari — cho‘zilmaydi, doira qilinmaydi |
| 18 | `lib/features/discover/discover_screen.dart` | 391 | Kashfiyot + qidiruv (debounce) |
| 19 | `lib/features/social/reels_screen.dart` | 425 | Reels — vertikal lenta, video hayot sikli |

**Jami: 19 fayl, 4397 qator.**


---


===== FILE: lib/design/tokens/nfc_tokens.dart =====

<!-- Beshala mavzu — ThemeExtension, lerp, onAccent -->

```dart
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
    accent1: hex('#E0CDA9'),
    accent2: hex('#C4A47C'),
    accent3: hex('#8E7550'),
    accentB: hex('#C5D8CB'),
    accentBDark: hex('#6E8A7A'),
    accentC: hex('#D5CFE4'),
    accentCDark: hex('#8E7FB8'),
    accentD: hex('#CBDCE8'),
    accentDDark: hex('#6B8FA8'),
    glow: rgba(196, 164, 124, .35),
    glowB: rgba(159, 184, 168, .35),
    border1: rgba(255, 255, 255, .95),
    border2: rgba(196, 164, 124, .22),
    error: hex('#D88A8A'),
    success: hex('#8FB89A'),
    warn: hex('#DDB878'),
    ambient1: rgba(224, 205, 169, .45),
    ambient2: rgba(197, 216, 203, .4),
    shadowFloat: [
      BoxShadow(color: rgba(160, 140, 110, .16), blurRadius: 50, offset: const Offset(0, 22)),
      BoxShadow(color: rgba(160, 140, 110, .08), blurRadius: 20, offset: const Offset(0, 8)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(160, 140, 110, .10), blurRadius: 32, offset: const Offset(0, 12)),
      BoxShadow(color: rgba(160, 140, 110, .06), blurRadius: 12, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(160, 140, 110, .08), blurRadius: 12, offset: const Offset(0, 4)),
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
    accent1: hex('#DDDDDE'),
    accent2: hex('#BEBEC0'),
    accent3: hex('#8E8E92'),
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
      BoxShadow(color: rgba(0, 0, 0, .55), blurRadius: 50, offset: const Offset(0, 22)),
      BoxShadow(color: rgba(0, 0, 0, .35), blurRadius: 20, offset: const Offset(0, 8)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(0, 0, 0, .40), blurRadius: 32, offset: const Offset(0, 12)),
      BoxShadow(color: rgba(0, 0, 0, .20), blurRadius: 12, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(0, 0, 0, .30), blurRadius: 12, offset: const Offset(0, 4)),
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
    accent1: hex('#A8D8E8'),
    accent2: hex('#6FC7E0'),
    accent3: hex('#4A8FB0'),
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
      BoxShadow(color: rgba(0, 10, 25, .6), blurRadius: 50, offset: const Offset(0, 22)),
      BoxShadow(color: rgba(0, 10, 25, .4), blurRadius: 20, offset: const Offset(0, 8)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(0, 10, 25, .45), blurRadius: 32, offset: const Offset(0, 12)),
      BoxShadow(color: rgba(0, 10, 25, .25), blurRadius: 12, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(0, 10, 25, .35), blurRadius: 12, offset: const Offset(0, 4)),
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
    accent1: hex('#D5C4EC'),
    accent2: hex('#B8A0E0'),
    accent3: hex('#8A6FB0'),
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
      BoxShadow(color: rgba(10, 5, 25, .6), blurRadius: 50, offset: const Offset(0, 22)),
      BoxShadow(color: rgba(10, 5, 25, .4), blurRadius: 20, offset: const Offset(0, 8)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(10, 5, 25, .45), blurRadius: 32, offset: const Offset(0, 12)),
      BoxShadow(color: rgba(10, 5, 25, .25), blurRadius: 12, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(10, 5, 25, .35), blurRadius: 12, offset: const Offset(0, 4)),
    ],
  );

  // ------------------------------------------------------------- 5 MIDNIGHT
  // Brend logotipi aynan shu mavzu uchun yaratilgandek: chuqur ko'k fon,
  // champagne oltin aksent. `shadowFloat` ichidagi uchinchi qatlam —
  // juda yengil oltin nur; usiz mavzu shunchaki "qorong'i ko'k" bo'lardi.
  static final midnight = NfcTokens(
    id: 'midnight',
    isDark: true,
    bg1: hex('#0A1428'),
    bg2: hex('#050A18'),
    bgVignette: rgba(212, 179, 106, .10),
    surface: rgba(18, 32, 54, .72),
    surface2: rgba(18, 32, 54, .45),
    surfaceSolid: hex('#0F1E38'),
    text1: hex('#F5EFE2'),
    text2: hex('#B8B4A6'),
    text3: hex('#6E6A60'),
    accent1: hex('#E8D4A0'),
    accent2: hex('#C9A96A'),
    accent3: hex('#8E7340'),
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
      BoxShadow(color: rgba(0, 5, 15, .7), blurRadius: 50, offset: const Offset(0, 22)),
      BoxShadow(color: rgba(0, 5, 15, .5), blurRadius: 20, offset: const Offset(0, 8)),
      BoxShadow(color: rgba(201, 169, 106, .10), blurRadius: 60),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(0, 5, 15, .55), blurRadius: 32, offset: const Offset(0, 12)),
      BoxShadow(color: rgba(0, 5, 15, .35), blurRadius: 12, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(0, 5, 15, .4), blurRadius: 12, offset: const Offset(0, 4)),
    ],
  );

  static final all = <NfcTokens>[pearl, graphite, ocean, aurora, midnight];

  static NfcTokens byId(String? id) =>
      all.firstWhere((t) => t.id == id, orElse: () => pearl);
}

/// `context.tokens` — har widget ichida `Theme.of(context).extension<...>()`
/// yozmaslik uchun.
extension NfcTokensX on BuildContext {
  NfcTokens get tokens => Theme.of(this).extension<NfcTokens>() ?? NfcTokens.pearl;
}
```


===== FILE: lib/design/theme/app_theme.dart =====

<!-- ThemeData qurish, Material komponentlarini moslash -->

```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';
import 'typography.dart';

/// `NfcTokens` dan to'liq `ThemeData` yasaydi.
///
/// Material komponentlari (dialog, snackbar, input) ham shu yerda
/// sozlanadi: aks holda ular o'z standart ko'k rangi bilan chiqib,
/// mavzudan ajralib turardi.
ThemeData buildTheme(NfcTokens t) {
  final scheme = ColorScheme(
    brightness: t.isDark ? Brightness.dark : Brightness.light,
    primary: t.accent2,
    onPrimary: t.isDark ? t.bg2 : t.bg1,
    secondary: t.accentB,
    onSecondary: t.bg2,
    error: t.error,
    onError: Colors.white,
    surface: t.surfaceSolid,
    onSurface: t.text1,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: t.bg1,
    canvasColor: t.bg1,
    splashFactory: InkSparkle.splashFactory,
    fontFamily: AppType.sans,
    textTheme: AppType.textTheme(t.text1, t.text2),
    extensions: [t],
    iconTheme: IconThemeData(color: t.text1, size: 21),
    dividerTheme: DividerThemeData(color: t.border2, thickness: 1, space: 1),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: t.surfaceSolid,
      contentTextStyle: TextStyle(
        fontFamily: AppType.sans,
        fontSize: 13.5,
        fontWeight: FontWeight.w600,
        color: t.text1,
      ),
      behavior: SnackBarBehavior.floating,
      shape: const RoundedRectangleBorder(borderRadius: R.gentle),
      elevation: 0,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: t.surfaceSolid,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(borderRadius: R.soft),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: t.surfaceSolid,
      surfaceTintColor: Colors.transparent,
      modalBarrierColor: Colors.black.withValues(alpha: .45),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(34)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: t.surface2,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      hintStyle: TextStyle(
        fontFamily: AppType.sans,
        fontSize: 14.5,
        fontWeight: FontWeight.w500,
        color: t.text3,
      ),
      border: OutlineInputBorder(
        borderRadius: R.gentle,
        borderSide: BorderSide(color: t.border2),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: R.gentle,
        borderSide: BorderSide(color: t.border2),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: R.gentle,
        borderSide: BorderSide(color: t.accent2, width: 1.6),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: R.gentle,
        borderSide: BorderSide(color: t.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: R.gentle,
        borderSide: BorderSide(color: t.error, width: 1.6),
      ),
      errorStyle: TextStyle(
        fontFamily: AppType.sans,
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: t.error,
      ),
    ),
    // Sahifa o'tishi: Concept B "fade + scale" ni talab qiladi, Android'ning
    // pastdan sirg'alishi emas.
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: _FadeScaleTransitions(),
      TargetPlatform.iOS: _FadeScaleTransitions(),
    }),
  );
}

/// Status paneli piktogrammalari fon yorug'ligiga qarab qorayadi/oqaradi.
SystemUiOverlayStyle overlayFor(NfcTokens t) => SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: t.isDark ? Brightness.light : Brightness.dark,
      statusBarBrightness: t.isDark ? Brightness.dark : Brightness.light,
      systemNavigationBarColor: t.bg2,
      systemNavigationBarIconBrightness:
          t.isDark ? Brightness.light : Brightness.dark,
    );

class _FadeScaleTransitions extends PageTransitionsBuilder {
  const _FadeScaleTransitions();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
    return FadeTransition(
      opacity: curved,
      child: ScaleTransition(
        // 0.97 dan boshlash — sezilmaydigan, lekin "chuqurlik" beradigan miqdor.
        scale: Tween(begin: .97, end: 1.0).animate(curved),
        child: child,
      ),
    );
  }
}
```


===== FILE: lib/design/theme/typography.dart =====

<!-- Serif sarlavha + sans matn + mono raqam, kirill zaxirasi -->

```dart
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
```


===== FILE: lib/design/tokens/shapes.dart =====

<!-- Radius shkalasi va bo‘shliq (Gap) -->

```dart
import 'package:flutter/widgets.dart';

/// Concept B'dagi radius shkalasi. Ilovada `BorderRadius.circular(12)` kabi
/// tasodifiy sonlar yozilmaydi — faqat shu to'rt qiymat ishlatiladi.
abstract final class R {
  /// Kapsula — tugma, chip, nav element.
  static const pill = BorderRadius.all(Radius.circular(100));

  /// "Blob" — organik, katta yumshoq shakl (identity obyekti, hero karta).
  static const blob = BorderRadius.all(Radius.circular(44));

  /// Kartalar va bottom sheet.
  static const soft = BorderRadius.all(Radius.circular(28));

  /// Kichik plitkalar, input, rasm.
  static const gentle = BorderRadius.all(Radius.circular(22));

  static const tile = BorderRadius.all(Radius.circular(16));

  /// Organik nosimmetrik shakl — bir burchagi boshqalaridan yumshoqroq.
  /// HTML'dagi `border-radius:44px 44px 44px 18px` ko'rinishlari uchun.
  static BorderRadius organic({double a = 44, double b = 44, double c = 44, double d = 18}) =>
      BorderRadius.only(
        topLeft: Radius.circular(a),
        topRight: Radius.circular(b),
        bottomRight: Radius.circular(c),
        bottomLeft: Radius.circular(d),
      );
}

/// Bo'shliq shkalasi — 4pt panjara.
abstract final class Gap {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 20.0;
  static const xxl = 26.0;
  static const section = 34.0;

  /// Ekranning yon hoshiyasi. 360px kenglikda ham matn siqilib qolmaydi.
  static const screenX = 20.0;
}
```


===== FILE: lib/design/motion/motion.dart =====

<!-- Tezlik va egri chiziqlar (--dur-*, --ease-*) -->

```dart
import 'package:flutter/widgets.dart';

/// Harakat tizimi — HTML'dagi `--ease-*` va `--dur-*` qiymatlari.
///
/// QOIDA: ilovada `Duration(milliseconds: 300)` qo'lda yozilmaydi. Har bir
/// animatsiya shu yerdagi uchta tezlikdan birini oladi, shuning uchun butun
/// ilova bir maromda "nafas oladi".
abstract final class Motion {
  static const fast = Duration(milliseconds: 250);
  static const med = Duration(milliseconds: 450);
  static const slow = Duration(milliseconds: 700);

  /// Mavzu almashuvi — sezilarli, lekin shoshmaydigan.
  static const theme = Duration(milliseconds: 520);

  /// `cubic-bezier(.34,1.4,.5,1)` — bosilganda yengil "qaytish".
  static const spring = Cubic(.34, 1.4, .5, 1);

  /// `cubic-bezier(.4,0,.2,1)` — standart material tezlanish.
  static const smooth = Cubic(.4, 0, .2, 1);

  /// Nafas olish sikli: NFC orb, halo va ambient gradient.
  static const breathe = Duration(milliseconds: 5000);

  /// NFC to'lqinlari — uchtasi 1/3 siklga surilib chiqadi.
  static const wave = Duration(milliseconds: 3200);
}

/// Tizimda "harakatni kamaytirish" yoqilganmi.
///
/// Yoqilgan bo'lsa takrorlanuvchi animatsiyalar (nafas, to'lqin, shimmer)
/// to'xtaydi: ular bezak, ma'no tashimaydi.
bool reduceMotion(BuildContext context) =>
    MediaQuery.maybeDisableAnimationsOf(context) ?? false;
```


===== FILE: lib/design/tokens/palette.dart =====

<!-- CSS qiymatlarini Color ga o‘girish -->

```dart
/// Concept B Final dizaynidagi CSS o'zgaruvchilarining Dart ko'chirmasi.
///
/// NIMA UCHUN ALOHIDA FAYL: ranglar bitta joyda tursa, HTML manbasi bilan
/// yonma-yon solishtirish mumkin. Bu yerdagi har bir qiymat
/// `nfcstore_concept_b_final` dagi `html[data-theme=...]` blokidan
/// ko'chirilgan — taxmin qilingan rang yo'q.
library;

import 'dart:ui';

/// `#RRGGBB` yoki `#AARRGGBB` ni `Color` ga aylantiradi.
Color hex(String v) {
  final s = v.replaceFirst('#', '');
  return Color(int.parse(s.length == 6 ? 'FF$s' : s, radix: 16));
}

/// CSS `rgba(r,g,b,a)` ekvivalenti — opacity qiymatlari HTML bilan
/// bir xil qolishi uchun qo'lda hisoblanmaydi.
Color rgba(int r, int g, int b, double a) =>
    Color.fromRGBO(r, g, b, a);
```


===== FILE: lib/design/widgets/nfc_orb.dart =====

<!-- NFC orb: nafas, halo, 3 pulse halqasi, organik yadro, orbit -->

```dart
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';
import 'surfaces.dart';

/// Orb qanday holatda.
enum OrbState { idle, scanning, success, error }

/// NFC markazining yuragi: nafas oluvchi organik shakl, yumshoq halo va
/// uchta ketma-ket chiqadigan pulse halqasi.
///
/// TEXNIK QAROR: hamma narsa BITTA `CustomPainter` ichida chiziladi.
/// Har halqa alohida widget bo'lganda 4 ta `AnimationController` va
/// 4 ta layout o'tishi kerak bo'lardi; bu yerda bitta kontroller va
/// bitta repaint. 60fps'da farqi sezilarli.
class NfcOrb extends StatefulWidget {
  const NfcOrb({
    super.key,
    this.size = 260,
    this.state = OrbState.idle,
    this.onTap,
    this.child,
  });

  final double size;
  final OrbState state;
  final VoidCallback? onTap;

  /// Markazdagi belgi — odatda `BrandLogo` yoki NFC ikonkasi.
  final Widget? child;

  @override
  State<NfcOrb> createState() => _NfcOrbState();
}

class _NfcOrbState extends State<NfcOrb> with TickerProviderStateMixin {
  late final AnimationController _breath = AnimationController(
    vsync: this,
    duration: Motion.breathe,
  );
  late final AnimationController _waves = AnimationController(
    vsync: this,
    duration: Motion.wave,
  );

  @override
  void initState() {
    super.initState();
    _breath.repeat(reverse: true);
    _waves.repeat();
  }

  @override
  void didUpdateWidget(covariant NfcOrb old) {
    super.didUpdateWidget(old);
    // Skanerlashda to'lqinlar tezlashadi — foydalanuvchi "ilova eshitmoqda"
    // ekanini ko'radi. Yakunlanganda esa tinchiydi.
    final wantFast = widget.state == OrbState.scanning;
    final target = wantFast ? const Duration(milliseconds: 1500) : Motion.wave;
    if (_waves.duration != target) {
      _waves
        ..duration = target
        ..repeat();
    }
  }

  @override
  void dispose() {
    _breath.dispose();
    _waves.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final still = reduceMotion(context);

    final accent = switch (widget.state) {
      OrbState.success => t.success,
      OrbState.error => t.error,
      _ => t.accent2,
    };

    return PressableScale(
      onTap: widget.onTap,
      scale: .95,
      child: SizedBox(
        width: widget.size,
        height: widget.size,
        child: AnimatedBuilder(
          animation: Listenable.merge([_breath, _waves]),
          builder: (context, child) => CustomPaint(
            painter: _OrbPainter(
              t: t,
              accent: accent,
              breath: still ? .5 : Curves.easeInOut.transform(_breath.value),
              wave: still ? 0 : _waves.value,
              showWaves: !still,
            ),
            child: child,
          ),
          child: Center(child: widget.child),
        ),
      ),
    );
  }
}

class _OrbPainter extends CustomPainter {
  _OrbPainter({
    required this.t,
    required this.accent,
    required this.breath,
    required this.wave,
    required this.showWaves,
  });

  final NfcTokens t;
  final Color accent;

  /// 0..1 — nafas fazasi.
  final double breath;

  /// 0..1 — to'lqin fazasi.
  final double wave;
  final bool showWaves;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final base = size.width * .30;

    // --- pulse halqalari: uchtasi siklning 1/3 qismiga surilgan ---------
    if (showWaves) {
      for (var i = 0; i < 3; i++) {
        final p = (wave + i / 3) % 1.0;
        final r = base * (1 + p * 1.55);
        // Chiqib borgan sari so'nadi; boshida ham to'liq emas — "portlash"
        // taassuroti bo'lmasligi uchun.
        final o = (1 - p) * .45 * math.min(1, p * 6);
        canvas.drawCircle(
          c,
          r,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5
            ..color = accent.withValues(alpha: o),
        );
      }
    }

    // --- halo: markazdan tarqaladigan yumshoq nur ------------------------
    final haloR = base * (1.34 + breath * .12);
    canvas.drawCircle(
      c,
      haloR,
      Paint()
        ..shader = RadialGradient(
          colors: [t.glow, t.glow.withValues(alpha: 0)],
          stops: const [.35, 1],
        ).createShader(Rect.fromCircle(center: c, radius: haloR))
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18),
    );

    // --- organik yadro ---------------------------------------------------
    // Doira EMAS: radius burchak bo'ylab ikkita sinus bilan biroz
    // o'zgaradi, shuning uchun shakl "tirik" ko'rinadi va nafas bilan
    // sekin aylanadi.
    final r = base * (.95 + breath * .06);
    final path = Path();
    const steps = 72;
    for (var i = 0; i <= steps; i++) {
      final a = i / steps * 2 * math.pi;
      final wobble = 1 +
          math.sin(a * 3 + breath * math.pi * 2) * .035 +
          math.sin(a * 5 - breath * math.pi) * .018;
      final p = c + Offset(math.cos(a) * r * wobble, math.sin(a) * r * wobble);
      i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
    }
    path.close();

    canvas.drawPath(
      path,
      Paint()
        ..shader = LinearGradient(
          begin: const Alignment(-.7, -1),
          end: const Alignment(.7, 1),
          colors: [t.accent1, accent],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );

    // Yuqori chetdagi nozik yorug'lik — shakl yassi qog'oz emas, hajmli.
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.white.withValues(alpha: .45), Colors.white.withValues(alpha: 0)],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );
  }

  @override
  bool shouldRepaint(_OrbPainter old) =>
      old.breath != breath ||
      old.wave != wave ||
      old.accent != accent ||
      old.t.id != t.id ||
      old.showWaves != showWaves;
}

/// Orb atrofida aylanma joylashgan tezkor amallar — Concept B "orbit".
class OrbitActions extends StatelessWidget {
  const OrbitActions({
    super.key,
    required this.size,
    required this.actions,
  });

  final double size;
  final List<OrbitAction> actions;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final radius = size * .40;
    final tones = [t.accent2, t.accentBDark, t.accentCDark, t.accentDDark];

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          for (var i = 0; i < actions.length; i++)
            Builder(builder: (context) {
              // Yuqoridan boshlab teng taqsimlanadi.
              final a = -math.pi / 2 + i * 2 * math.pi / actions.length;
              return Transform.translate(
                offset: Offset(math.cos(a) * radius, math.sin(a) * radius),
                child: _OrbitChip(
                  action: actions[i],
                  tone: tones[i % tones.length],
                ),
              );
            }),
        ],
      ),
    );
  }
}

class OrbitAction {
  const OrbitAction({required this.icon, required this.label, this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
}

class _OrbitChip extends StatelessWidget {
  const _OrbitChip({required this.action, required this.tone});

  final OrbitAction action;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Semantics(
      button: true,
      label: action.label,
      child: PressableScale(
        onTap: action.onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: t.surfaceSolid,
                shape: BoxShape.circle,
                border: Border.all(color: tone.withValues(alpha: .5), width: 1.4),
                boxShadow: t.shadowTiny,
              ),
              child: Icon(action.icon, size: 21, color: tone),
            ),
            const SizedBox(height: 7),
            SizedBox(
              width: 74,
              child: Text(
                action.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Manrope',
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: t.text2,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```


===== FILE: lib/features/nfc/nfc_center_screen.dart =====

<!-- NFC markazi ekrani -->

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/nfc_orb.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../../data/models/models.dart';
import '../auth/session.dart';
import '../home/home_screen.dart';
import '../home/widgets/identity_card.dart';
import 'nfc_service.dart';
import 'qr_sheet.dart';

/// NFC markazi — ilovaning vizual o'zagi.
///
/// Markazda nafas oluvchi orb, atrofida to'rtta spatial amal. Yuqorida
/// qurilmaning HAQIQIY NFC holati: apparati yo'q bo'lsa yoki o'chirilgan
/// bo'lsa buni yashirmaydi.
class NfcCenterScreen extends ConsumerWidget {
  const NfcCenterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final id = ref.watch(activeIdProvider);
    final ids = ref.watch(myIdsProvider);
    final availability = ref.watch(nfcAvailabilityProvider);
    final width = MediaQuery.sizeOf(context).width;

    // Orbit orb'dan kattaroq: amallar uning atrofida joylashadi.
    final orbit = (width * .92).clamp(300.0, 400.0);
    final orb = orbit * .52;

    return NovaScaffold(
      title: l.nfcCenter,
      actions: [
        NovaIconButton(
          icon: Icons.history_rounded,
          tooltip: l.nfcHistory,
          onPressed: () => context.push(Routes.nfcHistory),
        ),
      ],
      body: NovaScroll(
        children: [
          availability.when(
            loading: () => const SizedBox(height: Gap.sm),
            error: (_, __) => const SizedBox(height: Gap.sm),
            data: (a) => _StatusStrip(availability: a),
          ),
          const SizedBox(height: Gap.sm),
          Center(
            child: SizedBox(
              width: orbit,
              height: orbit,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  OrbitActions(
                    size: orbit,
                    actions: [
                      OrbitAction(
                        icon: Icons.badge_rounded,
                        label: l.nfcMyIds,
                        onTap: () => context.push(Routes.nfcIds),
                      ),
                      OrbitAction(
                        icon: Icons.credit_card_rounded,
                        label: l.nfcCards,
                        onTap: () => context.push(Routes.nfcCards),
                      ),
                      OrbitAction(
                        icon: Icons.card_giftcard_rounded,
                        label: l.nfcGift,
                        onTap: id == null
                            ? null
                            : () => context.push(Routes.nfcGift(id.code)),
                      ),
                      OrbitAction(
                        icon: Icons.shield_outlined,
                        label: l.nfcSecurity,
                        onTap: () => context.push(Routes.nfcSecurity),
                      ),
                    ],
                  ),
                  NfcOrb(
                    size: orb,
                    onTap: () => context.push(Routes.nfcScan),
                    // Orb sirti OLTIN: shaffof oltin belgi unda
                    // yo'qolardi, shuning uchun logotip o'zining
                    // qorong'i plastinasi bilan qo'yiladi.
                    child: BrandLogo(size: orb * .40, halo: false),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: Gap.sm),
          Center(
            child: Column(
              children: [
                Text(l.nfcTapToScan,
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 3),
                Text(l.nfcHoldCard,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          if (id != null) ...[
            const SizedBox(height: Gap.section),
            FloatingSurface(
              onTap: () => context.push(Routes.nfcId(id.code)),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: t.accentGradient,
                      borderRadius: R.tile,
                    ),
                    child: const Icon(Icons.nfc_rounded, size: 21, color: kOnAccent),
                  ),
                  const SizedBox(width: Gap.lg),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.homeActiveId,
                            style: Theme.of(context).textTheme.labelSmall),
                        const SizedBox(height: 2),
                        Text(
                          id.code,
                          style: AppType.monoStyle(
                              color: t.text1, size: 16, letterSpacing: 1.8),
                        ),
                      ],
                    ),
                  ),
                  NovaIconButton(
                    icon: Icons.qr_code_rounded,
                    tooltip: l.nfcShowQr,
                    onPressed: () => showQrSheet(context, id),
                  ),
                ],
              ),
            ),
          ],
          SectionHeader(
            title: l.nfcMyIds,
            action: ids.length > 3 ? l.actionSeeAll : null,
            onAction: () => context.push(Routes.nfcIds),
          ),
          if (ids.isEmpty)
            FloatingSurface(
              solid: true,
              child: Text(l.homeNoIdHint,
                  style: Theme.of(context).textTheme.bodyMedium),
            )
          else
            for (final e in ids.take(3))
              Padding(
                padding: const EdgeInsets.only(bottom: Gap.md),
                child: FloatingSurface(
                  solid: true,
                  padding: const EdgeInsets.all(Gap.lg),
                  onTap: () => context.push(Routes.nfcId(e.code)),
                  child: Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: (e.kind == NfcIdKind.business ? t.accentB : t.accent1)
                              .withValues(alpha: .22),
                          borderRadius: R.tile,
                        ),
                        child: Icon(
                          e.kind == NfcIdKind.business
                              ? Icons.storefront_rounded
                              : Icons.person_rounded,
                          size: 18,
                          color: t.text1,
                        ),
                      ),
                      const SizedBox(width: Gap.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              e.name.isEmpty ? e.code : e.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                            Text(
                              e.code,
                              style: AppType.monoStyle(color: t.text3, size: 11),
                            ),
                          ],
                        ),
                      ),
                      if (e.primary)
                        Capsule(label: l.nfcPrimary, selected: true, dense: true)
                      else if (!e.active)
                        Capsule(label: l.nfcInactive, dense: true),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }
}

/// Qurilmaning NFC holati — yashirilmaydi.
class _StatusStrip extends StatelessWidget {
  const _StatusStrip({required this.availability});
  final NfcAvailability availability;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    final (icon, text, tone) = switch (availability) {
      NfcAvailability.ready => (Icons.check_circle_rounded, l.nfcActive, t.success),
      NfcAvailability.disabled => (Icons.nfc_rounded, l.nfcDisabled, t.warn),
      NfcAvailability.unsupported =>
        (Icons.do_not_disturb_on_outlined, l.nfcUnsupported, t.text3),
      NfcAvailability.unknown => (Icons.hourglass_empty_rounded, l.stateLoading, t.text3),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: Gap.md),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: .11),
        borderRadius: R.pill,
        border: Border.all(color: tone.withValues(alpha: .3)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: tone),
          const SizedBox(width: Gap.sm),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontFamily: 'Manrope',
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: t.text1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
```


===== FILE: lib/features/home/home_screen.dart =====

<!-- Home kompozitsiyasi -->

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/utils/sharing.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../data/models/models.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import '../nfc/qr_sheet.dart';
import 'widgets/avatar.dart';
import 'widgets/identity_card.dart';
import 'widgets/mode_switch.dart';

/// Faol NFC ID ning story'lari.
final homeStoriesProvider =
    FutureProvider.autoDispose<List<StoryItem>>((ref) async {
  final id = ref.watch(activeIdProvider);
  if (id == null) return const [];
  final res = await ref.watch(socialRepositoryProvider).storiesOf(id.code);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Lentaning boshidagi postlar.
final homeFeedProvider = FutureProvider.autoDispose<List<Post>>((ref) async {
  final res = await ref.watch(socialRepositoryProvider).feed();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Joriy rejimga mos NFC ID.
///
/// Biznes rejimida biznes ID'si, shaxsiyda shaxsiysi tanlanadi; mos
/// keladigani bo'lmasa asosiy ID qaytadi.
final activeIdProvider = Provider<NfcId?>((ref) {
  final ids = ref.watch(myIdsProvider);
  if (ids.isEmpty) return null;
  final mode = ref.watch(modeProvider);
  final want =
      mode == AppMode.business ? NfcIdKind.business : NfcIdKind.personal;
  final match = ids.where((e) => e.kind == want);
  if (match.isNotEmpty) {
    return match.firstWhere((e) => e.primary, orElse: () => match.first);
  }
  return ids.firstWhere((e) => e.primary, orElse: () => ids.first);
});

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final user = ref.watch(currentUserProvider);
    final mode = ref.watch(modeProvider);
    final id = ref.watch(activeIdProvider);

    if (user == null) return const SizedBox.shrink();

    return NovaScaffold(
      body: RefreshIndicator(
        color: t.accent2,
        backgroundColor: t.surfaceSolid,
        onRefresh: () async {
          await ref.read(sessionProvider.notifier).refresh();
          ref.invalidate(homeStoriesProvider);
          ref.invalidate(homeFeedProvider);
        },
        child: NovaScroll(
          padding: const EdgeInsets.only(bottom: 120),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(Gap.screenX, Gap.sm, Gap.screenX, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_greeting(l), style: Theme.of(context).textTheme.bodySmall),
                        Text(
                          user.displayName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ],
                    ),
                  ),
                  NovaIconButton(
                    icon: Icons.notifications_none_rounded,
                    tooltip: l.activityTitle,
                    onPressed: () => context.push(Routes.activity),
                  ),
                  const SizedBox(width: Gap.sm),
                  NovaIconButton(
                    icon: Icons.settings_outlined,
                    tooltip: l.settings,
                    onPressed: () => context.push(Routes.settings),
                  ),
                ],
              ),
            ),
            const SizedBox(height: Gap.lg),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: ModeSwitch(
                mode: mode,
                onChanged: (m) => ref.read(modeProvider.notifier).set(m),
              ),
            ),
            const SizedBox(height: Gap.xl),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: id == null
                  ? _NoIdCard(onShop: () => context.push(Routes.shop))
                  : IdentityCard(
                      user: user,
                      id: id,
                      mode: mode,
                      onTap: () => context.push(Routes.nfcId(id.code)),
                      onQr: () => showQrSheet(context, id),
                      onShare: () => shareLink(id.publicUrl(kApiBase)),
                    ),
            ),
            const SizedBox(height: Gap.xxl),
            _QuickActions(mode: mode),
            _StoriesRow(user: user),
            SectionHeader(
              title: l.homePosts,
              action: l.actionSeeAll,
              onAction: () => context.go(Routes.discover),
            ),
            const _FeedPreview(),
            SectionHeader(title: l.homeActivity, action: l.actionSeeAll,
                onAction: () => context.push(Routes.activity)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: _ActivityPreview(id: id),
            ),
          ],
        ),
      ),
    );
  }

  String _greeting(L l) {
    final h = DateTime.now().hour;
    if (h < 12) return l.homeGreetingMorning;
    if (h < 18) return l.homeGreetingDay;
    return l.homeGreetingEvening;
  }
}

/// NFC ID hali yo'q — do'konga yo'naltiruvchi holat.
class _NoIdCard extends StatelessWidget {
  const _NoIdCard({required this.onShop});
  final VoidCallback onShop;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return FloatingSurface(
      borderRadius: R.organic(a: 40, b: 40, c: 40, d: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.nfc_rounded, size: 30, color: t.accent2),
          const SizedBox(height: Gap.md),
          Text(l.homeNoId, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(l.homeNoIdHint, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: Gap.xl),
          NovaButton(label: l.homeShop, onPressed: onShop, icon: Icons.storefront_rounded),
        ],
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.mode});
  final AppMode mode;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    // Biznes rejimida tezkor amallar BOSHQACHA — bu rejim almashuvi
    // shunchaki rang o'zgarishi emasligining amaliy isboti.
    final actions = mode == AppMode.business
        ? [
            (Icons.dashboard_rounded, l.bizDashboard, Routes.businessDashboard, t.accentB),
            (Icons.inventory_2_rounded, l.bizCatalog, Routes.businessCatalog, t.accentC),
            (Icons.insights_rounded, l.bizAnalytics, Routes.businessAnalytics, t.accentD),
            (Icons.storefront_rounded, l.bizStorefront, Routes.business, t.accent1),
          ]
        : [
            (Icons.nfc_rounded, l.nfcScanShort, Routes.nfcScan, t.accent1),
            (Icons.badge_rounded, l.nfcMyIds, Routes.nfcIds, t.accentB),
            (Icons.add_circle_outline_rounded, l.postCreate, Routes.postCreate, t.accentC),
            (Icons.storefront_rounded, l.homeShop, Routes.shop, t.accentD),
          ];

    return SizedBox(
      height: 98,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
        itemCount: actions.length,
        separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
        itemBuilder: (context, i) {
          final (icon, label, route, tone) = actions[i];
          return PressableScale(
            onTap: () => context.push(route),
            child: Container(
              // 104px — uch tilning eng uzun yorlig'i ("Сканировать")
              // ikki qatorga kesilmasdan sig'adigan kenglik.
              width: 104,
              padding: const EdgeInsets.all(Gap.md),
              decoration: BoxDecoration(
                color: t.surface,
                borderRadius: R.gentle,
                border: Border.all(color: t.border2),
                boxShadow: t.shadowTiny,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: tone.withValues(alpha: .22),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(icon, size: 19, color: t.isDark ? tone : t.text1),
                  ),
                  const SizedBox(height: Gap.sm),
                  Text(
                    label,
                    maxLines: 2,
                    textAlign: TextAlign.center,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: 'Manrope',
                      fontSize: 10,
                      height: 1.15,
                      fontWeight: FontWeight.w700,
                      color: t.text2,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _StoriesRow extends ConsumerWidget {
  const _StoriesRow({required this.user});
  final User user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final stories = ref.watch(homeStoriesProvider);
    final id = ref.watch(activeIdProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: l.homeStories),
        SizedBox(
          height: 92,
          child: stories.when(
            loading: () => ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              itemCount: 5,
              separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
              itemBuilder: (_, __) => const Skeleton(height: 62, circle: true),
            ),
            error: (_, __) => const SizedBox.shrink(),
            data: (items) => ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              itemCount: items.length + 1,
              separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
              itemBuilder: (context, i) {
                if (i == 0) {
                  return _StoryBubble(
                    label: l.homeYourStory,
                    avatarUrl: user.avatarUrl,
                    initials: user.initials,
                    add: true,
                    onTap: () => context.push(Routes.storyCreate),
                  );
                }
                final s = items[i - 1];
                return _StoryBubble(
                  label: s.authorName.isEmpty ? (id?.name ?? '') : s.authorName,
                  avatarUrl: s.authorAvatar.isEmpty ? s.mediaUrl : s.authorAvatar,
                  initials: user.initials,
                  seen: s.seen,
                  onTap: () => context.push(Routes.story(s.code.isEmpty ? (id?.code ?? '') : s.code)),
                );
              },
            ),
          ),
        ),
        if (stories.hasError) const SizedBox(height: Gap.sm),
      ],
    );
  }
}

class _StoryBubble extends StatelessWidget {
  const _StoryBubble({
    required this.label,
    required this.avatarUrl,
    required this.initials,
    this.add = false,
    this.seen = false,
    this.onTap,
  });

  final String label;
  final String avatarUrl;
  final String initials;
  final bool add;
  final bool seen;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return PressableScale(
      onTap: onTap,
      child: SizedBox(
        width: 66,
        child: Column(
          children: [
            Stack(
              children: [
                Avatar(
                  url: avatarUrl,
                  initials: initials,
                  size: 62,
                  ringColor: seen ? t.border2 : null,
                ),
                if (add)
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 21,
                      height: 21,
                      decoration: BoxDecoration(
                        gradient: t.accentGradient,
                        shape: BoxShape.circle,
                        border: Border.all(color: t.bg1, width: 2),
                      ),
                      child: const Icon(Icons.add_rounded, size: 12, color: kOnAccent),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontFamily: 'Manrope',
                fontSize: 9.5,
                fontWeight: FontWeight.w600,
                color: t.text2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeedPreview extends ConsumerWidget {
  const _FeedPreview();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(homeFeedProvider);
    final t = context.tokens;

    return SizedBox(
      height: 160,
      child: feed.when(
        loading: () => ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
          itemCount: 3,
          separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
          itemBuilder: (_, __) => const Skeleton(width: 128, height: 160, radius: R.gentle),
        ),
        error: (e, __) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
          child: FloatingSurface(
            solid: true,
            child: Text(
              L.of(context).stateEmpty,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ),
        data: (items) => items.isEmpty
            ? Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: FloatingSurface(
                  solid: true,
                  child: Text(
                    L.of(context).stateEmpty,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              )
            : ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                itemCount: items.length.clamp(0, 10),
                separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
                itemBuilder: (context, i) {
                  final p = items[i];
                  return PressableScale(
                    onTap: () => context.push(Routes.post(p.id)),
                    child: Container(
                      width: 128,
                      decoration: BoxDecoration(
                        color: t.surface,
                        borderRadius: R.gentle,
                        border: Border.all(color: t.border2),
                        boxShadow: t.shadowTiny,
                      ),
                      padding: const EdgeInsets.all(Gap.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              p.text,
                              maxLines: 5,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                          Row(
                            children: [
                              Icon(Icons.favorite_rounded, size: 12, color: t.accent2),
                              const SizedBox(width: 4),
                              Text(
                                formatCount(p.likes),
                                style: Theme.of(context).textTheme.labelMedium,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class _ActivityPreview extends StatelessWidget {
  const _ActivityPreview({required this.id});
  final NfcId? id;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    if (id == null) {
      return FloatingSurface(
        solid: true,
        child: Text(l.activityEmpty, style: Theme.of(context).textTheme.bodyMedium),
      );
    }
    return FloatingSurface(
      solid: true,
      child: Column(
        children: [
          _Row(icon: Icons.nfc_rounded, label: l.nfcScans, value: id!.taps, tone: t.accent2),
          const SizedBox(height: Gap.md),
          _Row(icon: Icons.visibility_rounded, label: l.nfcViews, value: id!.views, tone: t.accentBDark),
          const SizedBox(height: Gap.md),
          _Row(icon: Icons.group_rounded, label: l.profileFollowers, value: id!.followers, tone: t.accentCDark),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.label, required this.value, required this.tone});

  final IconData icon;
  final String label;
  final int value;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(color: tone.withValues(alpha: .18), shape: BoxShape.circle),
          child: Icon(icon, size: 16, color: t.isDark ? tone : t.text1),
        ),
        const SizedBox(width: Gap.md),
        Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
        Text(formatCount(value), style: Theme.of(context).textTheme.titleSmall),
      ],
    );
  }
}
```


===== FILE: lib/features/home/widgets/identity_card.dart =====

<!-- Identity obyekti — organik nosimmetrik shakl -->

```dart
import 'package:flutter/material.dart';

import '../../../app/providers.dart';
import '../../../data/models/models.dart';
import '../../../design/motion/motion.dart';
import '../../../design/theme/typography.dart';
import '../../../design/tokens/nfc_tokens.dart';
import '../../../design/tokens/shapes.dart';
import '../../../design/widgets/brand_logo.dart';
import '../../../design/widgets/surfaces.dart';
import '../../../l10n/gen/app_localizations.dart';
import 'avatar.dart';

/// `NfcTokens.onAccent` ga qisqa murojaat — aksent sirti ustidagi siyoh.
const kOnAccent = Color(0xFF1A1A1F);

/// Home'ning markaziy obyekti: foydalanuvchi + faol NFC ID.
///
/// Bu oddiy karta emas — Concept B'dagi "identity object": organik
/// nosimmetrik shakl, ichida brend belgisi va NFC kodi. Shaxsiy va
/// Biznes rejimida uning RANGI ham, TARKIBI ham o'zgaradi.
class IdentityCard extends StatelessWidget {
  const IdentityCard({
    super.key,
    required this.user,
    required this.id,
    required this.mode,
    this.onTap,
    this.onQr,
    this.onShare,
  });

  final User user;
  final NfcId? id;
  final AppMode mode;
  final VoidCallback? onTap;
  final VoidCallback? onQr;
  final VoidCallback? onShare;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final business = mode == AppMode.business;

    // Biznes rejimida sovuqroq ikkilamchi aksent — rejim almashgani
    // faqat yozuvdan emas, RANGDAN ham bilinadi.
    final tone = business ? t.accentB : t.accent1;
    final toneDark = business ? t.accentBDark : t.accent2;

    return PressableScale(
      onTap: onTap,
      child: AnimatedContainer(
        duration: Motion.med,
        curve: Motion.smooth,
        padding: const EdgeInsets.all(Gap.xl),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: const Alignment(-.8, -1),
            end: const Alignment(.9, 1),
            colors: [tone, toneDark],
          ),
          // Nosimmetrik radius — bir burchak boshqacha, shakl "yasalgan"
          // emas, o'sgandek ko'rinadi.
          borderRadius: R.organic(a: 40, b: 40, c: 40, d: 18),
          boxShadow: t.shadowFloat,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Avatar(
                  url: business ? '' : user.avatarUrl,
                  initials: user.initials,
                  size: 46,
                  ring: false,
                ),
                const SizedBox(width: Gap.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        id != null && id!.name.isNotEmpty
                            ? id!.name
                            : user.displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppType.displayStyle(color: kOnAccent, size: 21),
                      ),
                      Text(
                        business
                            ? l.modeBusiness
                            : (id != null && id!.role.isNotEmpty
                                ? id!.role
                                : l.modePersonal),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: kOnAccent.withValues(alpha: .72),
                        ),
                      ),
                    ],
                  ),
                ),
                // Logotip karta ustida.
                //
                // Bu sirt OLTIN — shaffof oltin belgi unda YO'QOLADI.
                // Shuning uchun logotip o'zining qorong'i plastinasi
                // bilan qo'yiladi: aktiv o'zgarmaydi, atrofi esa
                // kontrastni ta'minlaydi (texnik topshiriq, 8-bo'lim).
                const BrandLogo(size: 36, halo: false),
              ],
            ),
            const SizedBox(height: Gap.xl),
            Text(
              l.homeActiveId.toUpperCase(),
              style: TextStyle(
                fontFamily: AppType.sans,
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.3,
                color: kOnAccent.withValues(alpha: .6),
              ),
            ),
            const SizedBox(height: 5),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Text(
                    id?.code ?? '—',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppType.monoStyle(
                      color: kOnAccent,
                      size: 23,
                      weight: FontWeight.w700,
                      letterSpacing: 2.2,
                    ),
                  ),
                ),
                _MiniAction(icon: Icons.qr_code_rounded, onTap: onQr),
                const SizedBox(width: Gap.sm),
                _MiniAction(icon: Icons.ios_share_rounded, onTap: onShare),
              ],
            ),
            if (id != null) ...[
              const SizedBox(height: Gap.lg),
              Row(
                children: [
                  _Stat(value: id!.taps, label: l.nfcScans),
                  const SizedBox(width: Gap.xl),
                  _Stat(value: id!.views, label: l.nfcViews),
                  const SizedBox(width: Gap.xl),
                  _Stat(value: id!.followers, label: l.profileFollowers),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MiniAction extends StatelessWidget {
  const _MiniAction({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => PressableScale(
        onTap: onTap,
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: .32),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white.withValues(alpha: .4)),
          ),
          child: Icon(icon, size: 18, color: kOnAccent),
        ),
      );
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});

  final int value;
  final String label;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            formatCount(value),
            style: AppType.monoStyle(
              color: kOnAccent,
              size: 15,
              weight: FontWeight.w700,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
              color: kOnAccent.withValues(alpha: .62),
            ),
          ),
        ],
      );
}

/// 1 200 → `1.2K`. Uzun raqamlar kapsulani kengaytirib yubormaydi.
String formatCount(int n) {
  if (n < 1000) return '$n';
  if (n < 1000000) {
    final v = n / 1000;
    return '${v.toStringAsFixed(v < 10 ? 1 : 0)}K';
  }
  final v = n / 1000000;
  return '${v.toStringAsFixed(v < 10 ? 1 : 0)}M';
}
```


===== FILE: lib/features/home/widgets/mode_switch.dart =====

<!-- Shaxsiy ↔ Biznes almashtirgich -->

```dart
import 'package:flutter/material.dart';

import '../../../app/providers.dart';
import '../../../design/motion/motion.dart';
import '../../../design/tokens/nfc_tokens.dart';
import '../../../design/tokens/shapes.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Shaxsiy ↔ Biznes almashtirgich.
///
/// Sirg'aluvchi indikator ikki holat orasida "oqib" o'tadi
/// (`AnimatedAlign`), shuning uchun almashuv keskin emas — bu
/// texnik topshiriqdagi "morphing transition" talabining
/// boshqaruv elementidagi ko'rinishi.
class ModeSwitch extends StatelessWidget {
  const ModeSwitch({super.key, required this.mode, required this.onChanged});

  final AppMode mode;
  final ValueChanged<AppMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final business = mode == AppMode.business;

    return Semantics(
      label: business ? l.modeBusiness : l.modePersonal,
      child: Container(
        height: 40,
        padding: const EdgeInsets.all(3.5),
        decoration: BoxDecoration(
          color: t.surface2,
          borderRadius: R.pill,
          border: Border.all(color: t.border2),
        ),
        child: LayoutBuilder(
          builder: (context, c) {
            final w = (c.maxWidth - 7) / 2;
            return Stack(
              children: [
                AnimatedAlign(
                  duration: Motion.med,
                  curve: Motion.spring,
                  alignment:
                      business ? Alignment.centerRight : Alignment.centerLeft,
                  child: AnimatedContainer(
                    duration: Motion.med,
                    curve: Motion.smooth,
                    width: w,
                    height: 33,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: business
                            ? [t.accentB, t.accentBDark]
                            : [t.accent1, t.accent2],
                      ),
                      borderRadius: R.pill,
                      boxShadow: t.shadowTiny,
                    ),
                  ),
                ),
                Row(
                  children: [
                    _Label(
                      text: l.modePersonal,
                      selected: !business,
                      width: w,
                      onTap: () => onChanged(AppMode.personal),
                    ),
                    const SizedBox(width: 7),
                    _Label(
                      text: l.modeBusiness,
                      selected: business,
                      width: w,
                      onTap: () => onChanged(AppMode.business),
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label({
    required this.text,
    required this.selected,
    required this.width,
    required this.onTap,
  });

  final String text;
  final bool selected;
  final double width;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: width,
        height: 33,
        child: Center(
          child: AnimatedDefaultTextStyle(
            duration: Motion.fast,
            style: TextStyle(
              fontFamily: 'Manrope',
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: selected ? const Color(0xFF1A1A1F) : t.text2,
            ),
            child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ),
      ),
    );
  }
}
```


===== FILE: lib/design/widgets/bottom_nav.dart =====

<!-- Suzuvchi nav, markazda ko‘tarilgan NFC tugmasi -->

```dart
import 'dart:ui';

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';
import 'surfaces.dart';

class NavItem {
  const NavItem({required this.icon, required this.label, required this.route});
  final IconData icon;
  final String label;
  final String route;
}

/// Suzuvchi pastki navigatsiya — markazda ko'tarilgan NFC tugmasi.
///
/// Concept B'da nav ekran tubiga yopishmaydi, u ustida SUZADI va
/// orqasidan kontent xiralashib ko'rinadi. `extendBody: true` bilan
/// birga ishlaydi.
class NovaBottomNav extends StatelessWidget {
  const NovaBottomNav({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onSelect,
    this.centerIndex = 2,
  });

  final List<NavItem> items;
  final int currentIndex;
  final ValueChanged<int> onSelect;

  /// Qaysi element ko'tarilgan dumaloq tugma bo'lishi.
  final int centerIndex;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.lg, 0, Gap.lg, Gap.md),
      child: ClipRRect(
        borderRadius: R.pill,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
          child: AnimatedContainer(
            duration: Motion.theme,
            curve: Motion.smooth,
            height: 64,
            decoration: BoxDecoration(
              color: t.surface,
              borderRadius: R.pill,
              border: Border.all(color: t.border2),
              boxShadow: t.shadowFloat,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                for (var i = 0; i < items.length; i++)
                  Expanded(
                    child: _NavButton(
                      item: items[i],
                      selected: i == currentIndex,
                      center: i == centerIndex,
                      onTap: () => onSelect(i),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.item,
    required this.selected,
    required this.center,
    required this.onTap,
  });

  final NavItem item;
  final bool selected;
  final bool center;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;

    if (center) {
      return Semantics(
        button: true,
        selected: selected,
        label: item.label,
        child: PressableScale(
          onTap: onTap,
          scale: .9,
          child: Center(
            child: AnimatedContainer(
              duration: Motion.theme,
              // Navdan yuqoriga chiqadi — eng muhim amal ekani shundan bilinadi.
              transform: Matrix4.translationValues(0, -14, 0),
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                gradient: t.accentGradient,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: t.glow, blurRadius: 24, offset: const Offset(0, 10)),
                ],
              ),
              child: Icon(item.icon, size: 23, color: t.onAccent),
            ),
          ),
        ),
      );
    }

    final color = selected ? t.accent2 : t.text3;
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: PressableScale(
        onTap: onTap,
        child: SizedBox(
          height: 64,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedScale(
                scale: selected ? 1.1 : 1,
                duration: Motion.fast,
                curve: Motion.spring,
                child: Icon(item.icon, size: 21, color: color),
              ),
              const SizedBox(height: 3),
              AnimatedDefaultTextStyle(
                duration: Motion.fast,
                style: TextStyle(
                  fontFamily: 'Manrope',
                  fontSize: 9.5,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  color: color,
                ),
                child: Text(
                  item.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```


===== FILE: lib/features/profile/profile_screen.dart =====

<!-- Digital Identity Canvas -->

```dart
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/utils/sharing.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../data/models/models.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import '../home/home_screen.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';
import '../home/widgets/mode_switch.dart';
import '../nfc/qr_sheet.dart';
import 'profile_repository.dart';

final profilePostsProvider =
    FutureProvider.autoDispose.family<List<Post>, String>((ref, code) async {
  final res = await ref.watch(socialRepositoryProvider).postsOf(code);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Digital Identity Canvas.
///
/// Bir xil katta to'rtburchak kartalar TO'PLAMI EMAS: muqova, suzuvchi
/// avatar, kapsula shaklidagi statistika va ixcham plitkalar — har biri
/// boshqa shakl va o'lchamda. Kompozitsiya ataylab nosimmetrik.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key, this.code});

  /// `null` — o'z profili. Aks holda boshqa foydalanuvchi.
  final String? code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final user = ref.watch(currentUserProvider);
    final mode = ref.watch(modeProvider);
    final ids = ref.watch(myIdsProvider);

    final id = code == null
        ? ref.watch(activeIdProvider)
        : ids.where((e) => e.code == code).firstOrNull;
    final isMe = code == null || ids.any((e) => e.code == code);

    if (user == null) return const SizedBox.shrink();

    return NovaScaffold(
      showBack: code != null,
      actions: code != null
          ? null
          : [
              NovaIconButton(
                icon: Icons.settings_outlined,
                tooltip: l.settings,
                onPressed: () => context.push(Routes.settings),
              ),
              const SizedBox(width: Gap.sm),
            ],
      body: RefreshIndicator(
        color: t.accent2,
        backgroundColor: t.surfaceSolid,
        onRefresh: () async {
          await ref.read(sessionProvider.notifier).refresh();
          if (id != null) ref.invalidate(profilePostsProvider(id.code));
        },
        child: NovaScroll(
          padding: const EdgeInsets.only(bottom: 120),
          children: [
            _Hero(user: user, id: id, mode: mode),
            const SizedBox(height: Gap.xl),
            if (isMe && code == null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: ModeSwitch(
                  mode: mode,
                  onChanged: (m) => ref.read(modeProvider.notifier).set(m),
                ),
              ),
            const SizedBox(height: Gap.xl),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: _StatCapsules(id: id),
            ),
            const SizedBox(height: Gap.xl),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: Row(
                children: [
                  Expanded(
                    child: NovaButton(
                      label: isMe ? l.profileEdit : l.actionFollow,
                      icon: isMe ? Icons.edit_rounded : Icons.person_add_alt_rounded,
                      onPressed: isMe
                          ? () => context.push(Routes.profileEdit)
                          : () => ref
                              .read(profileFollowProvider.notifier)
                              .toggle(code!),
                    ),
                  ),
                  const SizedBox(width: Gap.md),
                  NovaIconButton(
                    icon: Icons.qr_code_rounded,
                    tooltip: l.nfcShowQr,
                    size: 52,
                    onPressed: id == null ? null : () => showQrSheet(context, id),
                  ),
                  const SizedBox(width: Gap.sm),
                  NovaIconButton(
                    icon: Icons.ios_share_rounded,
                    tooltip: l.actionShare,
                    size: 52,
                    onPressed: id == null
                        ? null
                        : () => shareLink(id.publicUrl(kApiBase)),
                  ),
                ],
              ),
            ),
            if (mode == AppMode.business && isMe) ...[
              SectionHeader(title: l.bizTitle),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: _BusinessTiles(),
              ),
            ],
            SectionHeader(title: l.profilePosts),
            if (id == null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: FloatingSurface(
                  solid: true,
                  child: Text(l.homeNoIdHint,
                      style: Theme.of(context).textTheme.bodyMedium),
                ),
              )
            else
              _PostsGrid(code: id.code),
          ],
        ),
      ),
    );
  }
}

/// Kuzatish holati — optimistik.
class ProfileFollow extends StateNotifier<Set<String>> {
  ProfileFollow(this._ref) : super(const {});
  final Ref _ref;

  Future<void> toggle(String code) async {
    final following = state.contains(code);
    state = following ? (state.toSet()..remove(code)) : (state.toSet()..add(code));
    final repo = _ref.read(profileRepositoryProvider);
    final res = following ? await repo.unfollow(code) : await repo.follow(code);
    res.when(
      ok: (_) {},
      err: (_) => state =
          following ? (state.toSet()..add(code)) : (state.toSet()..remove(code)),
    );
  }
}

final profileFollowProvider =
    StateNotifierProvider<ProfileFollow, Set<String>>(ProfileFollow.new);

class _Hero extends StatelessWidget {
  const _Hero({required this.user, required this.id, required this.mode});

  final User user;
  final NfcId? id;
  final AppMode mode;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final cover = id?.coverUrl ?? '';

    return SizedBox(
      // Muqova + avatarning pastga chiqib turgan qismi.
      height: 210,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            child: ClipRRect(
              borderRadius: R.organic(a: 34, b: 34, c: 34, d: 14),
              child: SizedBox(
                height: 150,
                width: double.infinity,
                child: cover.isEmpty
                    ? DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: mode == AppMode.business
                                ? [t.accentB, t.accentCDark]
                                : [t.accent1, t.accentDDark],
                          ),
                        ),
                      )
                    : CachedNetworkImage(
                        imageUrl: cover,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => ColoredBox(color: t.surface2),
                        errorWidget: (_, __, ___) => ColoredBox(color: t.surface2),
                      ),
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Column(
              children: [
                Avatar(
                  url: user.avatarUrl,
                  initials: user.initials,
                  size: 92,
                ),
                const SizedBox(height: Gap.sm),
                Text(
                  id != null && id!.name.isNotEmpty ? id!.name : user.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                if (id != null)
                  Text(
                    id!.code,
                    style: AppType.monoStyle(color: t.accent2, size: 12, letterSpacing: 1.6),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Statistika — katta karta emas, uchta kapsula.
class _StatCapsules extends StatelessWidget {
  const _StatCapsules({required this.id});
  final NfcId? id;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final items = [
      (formatCount(id?.posts ?? 0), l.profilePosts),
      (formatCount(id?.followers ?? 0), l.profileFollowers),
      (formatCount(id?.following ?? 0), l.profileFollowing),
    ];

    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: Gap.sm),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: Gap.md),
              decoration: BoxDecoration(
                color: t.surface2,
                borderRadius: R.pill,
                border: Border.all(color: t.border2),
              ),
              child: Column(
                children: [
                  Text(items[i].$1,
                      style: Theme.of(context).textTheme.titleMedium),
                  Text(
                    items[i].$2,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelMedium,
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _BusinessTiles extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final tiles = [
      (Icons.dashboard_rounded, l.bizDashboard, Routes.businessDashboard),
      (Icons.inventory_2_rounded, l.bizCatalog, Routes.businessCatalog),
      (Icons.insights_rounded, l.bizAnalytics, Routes.businessAnalytics),
      (Icons.storefront_rounded, l.bizStorefront, Routes.business),
    ];
    return Wrap(
      spacing: Gap.md,
      runSpacing: Gap.md,
      children: [
        for (final e in tiles)
          PressableScale(
            onTap: () => context.push(e.$3),
            child: Container(
              width: (MediaQuery.sizeOf(context).width - Gap.screenX * 2 - Gap.md) / 2,
              padding: const EdgeInsets.all(Gap.lg),
              decoration: BoxDecoration(
                color: t.surface,
                borderRadius: R.gentle,
                border: Border.all(color: t.border2),
                boxShadow: t.shadowTiny,
              ),
              child: Row(
                children: [
                  Icon(e.$1, size: 19, color: t.accentBDark),
                  const SizedBox(width: Gap.sm),
                  Expanded(
                    child: Text(
                      e.$2,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _PostsGrid extends ConsumerWidget {
  const _PostsGrid({required this.code});
  final String code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final posts = ref.watch(profilePostsProvider(code));

    return posts.when(
      loading: () => Padding(
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
        child: Wrap(
          spacing: 6,
          runSpacing: 6,
          children: List.generate(
            6,
            (_) => Skeleton(
              width: (MediaQuery.sizeOf(context).width - Gap.screenX * 2 - 12) / 3,
              height: (MediaQuery.sizeOf(context).width - Gap.screenX * 2 - 12) / 3,
              radius: R.tile,
            ),
          ),
        ),
      ),
      error: (e, __) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
        child: StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(profilePostsProvider(code))),
      ),
      data: (items) {
        if (items.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            child: FloatingSurface(
              solid: true,
              child: Column(
                children: [
                  Icon(Icons.photo_library_outlined, size: 27, color: t.text3),
                  const SizedBox(height: Gap.sm),
                  Text(l.stateEmpty, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
          );
        }
        final side =
            (MediaQuery.sizeOf(context).width - Gap.screenX * 2 - 12) / 3;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
          child: Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final p in items)
                PressableScale(
                  onTap: () => context.push(Routes.post(p.id)),
                  child: ClipRRect(
                    borderRadius: R.tile,
                    child: SizedBox(
                      width: side,
                      height: side,
                      child: p.mediaUrls.isEmpty
                          ? Container(
                              color: t.surface2,
                              padding: const EdgeInsets.all(Gap.sm),
                              child: Text(
                                p.text,
                                maxLines: 4,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            )
                          : Stack(
                              fit: StackFit.expand,
                              children: [
                                CachedNetworkImage(
                                  imageUrl: p.mediaUrls.first,
                                  fit: BoxFit.cover,
                                  placeholder: (_, __) =>
                                      ColoredBox(color: t.surface2),
                                  errorWidget: (_, __, ___) =>
                                      ColoredBox(color: t.surface2),
                                ),
                                if (p.isVideo)
                                  const Positioned(
                                    right: 5,
                                    top: 5,
                                    child: Icon(Icons.play_circle_fill_rounded,
                                        size: 15, color: Colors.white),
                                  ),
                              ],
                            ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
```


===== FILE: lib/design/widgets/surfaces.dart =====

<!-- FloatingSurface, Capsule, PressableScale, SectionHeader -->

```dart
import 'dart:ui';

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';

/// Suzuvchi sirt — Concept B'dagi asosiy konteyner.
///
/// Orqa fon YARIM SHAFFOF va orqasidagi ambient dog'lar bulut kabi
/// ko'rinib turadi (`BackdropFilter`). Shuning uchun bir xil kartalar
/// ham har ekranda biroz boshqacha ko'rinadi — maket "yopishqoq"
/// bo'lib qolmaydi.
class FloatingSurface extends StatelessWidget {
  const FloatingSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(Gap.xl),
    this.borderRadius = R.soft,
    this.elevated = false,
    this.solid = false,
    this.onTap,
    this.border = true,
  });

  final Widget child;
  final EdgeInsets padding;
  final BorderRadius borderRadius;

  /// Kuchliroq soya — modal va hero obyektlar uchun.
  final bool elevated;

  /// Shaffoflikni o'chiradi: ro'yxat ichidagi ko'p elementda `BackdropFilter`
  /// qimmatga tushadi, shuning uchun uzun ro'yxatlarda `solid: true`.
  final bool solid;
  final bool border;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final body = AnimatedContainer(
      duration: Motion.theme,
      curve: Motion.smooth,
      padding: padding,
      decoration: BoxDecoration(
        color: solid ? t.surfaceSolid : t.surface,
        borderRadius: borderRadius,
        border: border ? Border.all(color: t.border2, width: 1) : null,
        boxShadow: elevated ? t.shadowFloat : t.shadowSoft,
      ),
      child: child,
    );

    final clipped = solid
        ? body
        : ClipRRect(
            borderRadius: borderRadius,
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
              child: body,
            ),
          );

    if (onTap == null) return clipped;
    return PressableScale(onTap: onTap!, child: clipped);
  }
}

/// Kapsula — Concept B'ning "chip" i: yorliq, filtr, statistika, harakat.
class Capsule extends StatelessWidget {
  const Capsule({
    super.key,
    required this.label,
    this.icon,
    this.selected = false,
    this.onTap,
    this.tone,
    this.dense = false,
  });

  final String label;
  final IconData? icon;
  final bool selected;
  final VoidCallback? onTap;

  /// Aksent rangi — `null` bo'lsa mavzuning asosiy aksenti.
  final Color? tone;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final accent = tone ?? t.accent2;
    final fg = selected ? t.onAccent : t.text2;

    return PressableScale(
      onTap: onTap,
      child: AnimatedContainer(
        duration: Motion.fast,
        curve: Motion.smooth,
        padding: EdgeInsets.symmetric(
          horizontal: dense ? 12 : 15,
          vertical: dense ? 7 : 9.5,
        ),
        decoration: BoxDecoration(
          color: selected ? accent : t.surface2,
          borderRadius: R.pill,
          border: Border.all(color: selected ? accent : t.border2),
          boxShadow: selected ? t.shadowTiny : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: dense ? 13 : 15, color: fg),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                fontFamily: 'Manrope',
                fontSize: dense ? 11.5 : 12.5,
                fontWeight: FontWeight.w700,
                color: fg,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bosilganda yengil kichrayadigan o'ram.
///
/// NIMA UCHUN `InkWell` EMAS: Material to'lqini bu dizayn tiliga begona.
/// Bu yerda javob "spring" — jismoniy tugmaga o'xshaydi.
class PressableScale extends StatefulWidget {
  const PressableScale({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.scale = .965,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double scale;

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    if (widget.onTap == null && widget.onLongPress == null) return widget.child;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      onLongPress: widget.onLongPress,
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: Motion.fast,
        curve: Motion.spring,
        child: widget.child,
      ),
    );
  }
}

/// Bo'lim sarlavhasi: kichik katta-harfli yorliq + ixtiyoriy "Hammasi".
class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.action, this.onAction});

  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screenX, Gap.xxl, Gap.screenX, Gap.md),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title.toUpperCase(),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(color: t.text3),
            ),
          ),
          if (action != null)
            PressableScale(
              onTap: onAction,
              child: Padding(
                // Barmoq uchun 44px minimal nishon: matnning o'zi juda kichik.
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
                child: Text(
                  action!,
                  style: TextStyle(
                    fontFamily: 'Manrope',
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: t.accent2,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
```


===== FILE: lib/design/widgets/buttons.dart =====

<!-- NovaButton, NovaIconButton -->

```dart
import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';
import 'surfaces.dart';

enum ButtonTone { accent, quiet, outline, danger }

/// Ilovaning yagona tugmasi.
///
/// `ElevatedButton`/`TextButton` ishlatilmaydi: ularning holat ranglari,
/// to'lqin effekti va balandligi Material'dan keladi va mavzu bilan
/// to'liq moslashmaydi.
class NovaButton extends StatelessWidget {
  const NovaButton({
    super.key,
    required this.label,
    this.onPressed,
    this.tone = ButtonTone.accent,
    this.icon,
    this.busy = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final ButtonTone tone;
  final IconData? icon;

  /// Yuklanayotganda tugma yozuvi joyida qoladi, ustiga aylanma chiqadi:
  /// matnni olib tashlash tugma kengligini sakratardi.
  final bool busy;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final disabled = onPressed == null || busy;

    final (bg, fg, border, gradient) = switch (tone) {
      ButtonTone.accent => (null, t.onAccent, null, t.accentGradient),
      ButtonTone.quiet => (t.surface2, t.text1, t.border2, null),
      ButtonTone.outline => (Colors.transparent, t.accent2, t.accent2, null),
      ButtonTone.danger => (t.error.withValues(alpha: .14), t.error, t.error.withValues(alpha: .4), null),
    };

    return Semantics(
      button: true,
      enabled: !disabled,
      label: label,
      child: PressableScale(
        onTap: disabled ? null : onPressed,
        child: AnimatedOpacity(
          opacity: disabled && !busy ? .45 : 1,
          duration: Motion.fast,
          child: AnimatedContainer(
            duration: Motion.theme,
            curve: Motion.smooth,
            width: expand ? double.infinity : null,
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
            decoration: BoxDecoration(
              color: bg,
              gradient: gradient,
              borderRadius: R.pill,
              border: border == null ? null : Border.all(color: border, width: 1.4),
              boxShadow: tone == ButtonTone.accent ? t.shadowSoft : null,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (busy) ...[
                  SizedBox(
                    width: 15,
                    height: 15,
                    child: CircularProgressIndicator(strokeWidth: 2, color: fg),
                  ),
                  const SizedBox(width: 10),
                ] else if (icon != null) ...[
                  Icon(icon, size: 17, color: fg),
                  const SizedBox(width: 9),
                ],
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'Manrope',
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: .2,
                      color: fg,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Dumaloq ikonka tugmasi — sarlavha qatori va suzuvchi boshqaruvlar.
class NovaIconButton extends StatelessWidget {
  const NovaIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.tooltip,
    this.size = 42,
    this.filled = false,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final String? tooltip;
  final double size;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Tooltip(
      message: tooltip ?? '',
      child: Semantics(
        button: true,
        label: tooltip,
        child: PressableScale(
          onTap: onPressed,
          child: AnimatedContainer(
            duration: Motion.theme,
            width: size,
            height: size,
            decoration: BoxDecoration(
              color: filled ? null : t.surface2,
              gradient: filled ? t.accentGradient : null,
              shape: BoxShape.circle,
              border: Border.all(color: t.border2),
              boxShadow: filled ? t.shadowTiny : null,
            ),
            child: Icon(
              icon,
              size: size * .44,
              color: filled ? t.onAccent : t.text1,
            ),
          ),
        ),
      ),
    );
  }
}
```


===== FILE: lib/design/widgets/backdrop.dart =====

<!-- Ambient fon — sekin suzuvchi dog‘lar -->

```dart
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';

/// Har ekranning orqa foni: gradient + sekin suzuvchi ikkita ambient dog'.
///
/// Concept B'da fon statik emas — u juda sekin "nafas oladi". Bu ilovaga
/// chuqurlik beradi, lekin diqqatni tortmaydi: to'liq sikl 22 soniya.
class AmbientBackdrop extends StatefulWidget {
  const AmbientBackdrop({super.key, required this.child, this.animate = true});

  final Widget child;
  final bool animate;

  @override
  State<AmbientBackdrop> createState() => _AmbientBackdropState();
}

class _AmbientBackdropState extends State<AmbientBackdrop>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 22),
  );

  /// Ilova ekranda ko'rinib turibdimi.
  ///
  /// Fon animatsiyasi bezak: ilova fonga o'tganda uni davom ettirish
  /// batareyani bekorga yeydi va hech kim ko'rmaydi.
  bool _foreground = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _sync();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final next = state == AppLifecycleState.resumed;
    if (next == _foreground) return;
    _foreground = next;
    _sync();
  }

  @override
  void didUpdateWidget(covariant AmbientBackdrop old) {
    super.didUpdateWidget(old);
    _sync();
  }

  void _sync() {
    final shouldRun = widget.animate && _foreground;
    if (shouldRun && !_c.isAnimating) {
      _c.repeat();
    } else if (!shouldRun && _c.isAnimating) {
      _c.stop();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    // "Harakatni kamaytirish" yoqilgan bo'lsa dog'lar joyida qotadi.
    final still = reduceMotion(context) || !widget.animate;
    return AnimatedContainer(
      duration: Motion.theme,
      curve: Motion.smooth,
      decoration: BoxDecoration(gradient: t.backdrop),
      child: Stack(
        children: [
          Positioned.fill(
            child: IgnorePointer(
              child: still
                  ? CustomPaint(painter: _AmbientPainter(t, 0))
                  : AnimatedBuilder(
                      animation: _c,
                      builder: (_, __) =>
                          CustomPaint(painter: _AmbientPainter(t, _c.value)),
                    ),
            ),
          ),
          widget.child,
        ],
      ),
    );
  }
}

class _AmbientPainter extends CustomPainter {
  _AmbientPainter(this.t, this.phase);

  final NfcTokens t;
  final double phase;

  @override
  void paint(Canvas canvas, Size size) {
    void blob(Color color, Offset base, double r, double drift) {
      final a = (phase + drift) * 2 * math.pi;
      final c = base + Offset(math.cos(a) * size.width * .09,
          math.sin(a * .8) * size.height * .05);
      canvas.drawCircle(
        c,
        r,
        Paint()
          ..shader = RadialGradient(colors: [color, color.withValues(alpha: 0)])
              .createShader(Rect.fromCircle(center: c, radius: r))
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 40),
      );
    }

    blob(t.ambient1, Offset(size.width * .18, size.height * .16), size.width * .52, 0);
    blob(t.ambient2, Offset(size.width * .86, size.height * .34), size.width * .46, .45);
    // Pastki vinyetka — bottom nav ostidagi kontent yumshoq so'nadi.
    canvas.drawRect(
      Rect.fromLTWH(0, size.height * .6, size.width, size.height * .4),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [t.bgVignette.withValues(alpha: 0), t.bgVignette],
        ).createShader(Rect.fromLTWH(0, size.height * .6, size.width, size.height * .4)),
    );
  }

  @override
  bool shouldRepaint(_AmbientPainter old) =>
      old.phase != phase || old.t.id != t.id;
}
```


===== FILE: lib/design/widgets/brand_logo.dart =====

<!-- Logotip qoidalari — cho‘zilmaydi, doira qilinmaydi -->

```dart
import 'package:flutter/material.dart';

import '../theme/typography.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';

/// Logotipni qanday ko'rsatish.
enum BrandLogoStyle {
  /// ORIGINAL fayl o'z foni bilan, yumshoq burchakli plastina ichida.
  /// Splash, Welcome va Auth kabi logotip "qahramon" bo'lgan joylarda.
  plate,

  /// Faqat oltin belgi — foni shaffof. Atrofdagi sirt allaqachon
  /// qorong'i bo'lgan joylarda (masalan Midnight'dagi karta ustida).
  mark,
}

/// NFCSTORE brend logotipi.
///
/// ## Logotip QAT'IY o'zgarmaydi
///
/// `assets/brand/nfcstore_logo.jpg` — yakuniy brend aktivi. U:
///
/// * qayta chizilmaydi;
/// * cho'zilmaydi (har doim `BoxFit.contain`, nisbati 1:1);
/// * DUMALOQ QILIB KESILMAYDI — belgi keng, gorizontal lokap
///   (2000px kanvasda 1311x668), doira maskasi tashqi to'lqinlarni
///   kesib tashlardi;
/// * mavzu bo'yicha avtomatik ranglanmaydi.
///
/// ## Mavzuga moslashish ATROFDA bo'ladi
///
/// Aktiv qora fonli JPG. Uni Pearl'ning krem foniga to'g'ridan-to'g'ri
/// qo'yish qora kvadrat bo'lib ko'rinardi. Shuning uchun mavzu bilan
/// FAQAT shular o'zgaradi: plastina rangi, chegara, nur (halo) va soya.
/// Logotipning o'zi har mavzuda bir xil piksel.
class BrandLogo extends StatelessWidget {
  const BrandLogo({
    super.key,
    this.size = 96,
    this.style = BrandLogoStyle.plate,
    this.halo = true,
    this.semanticLabel = 'NFCSTORE',
  });

  /// Plastinaning tomoni (logotip 1:1 nisbatda ichiga joylanadi).
  final double size;
  final BrandLogoStyle style;

  /// Orqadagi yumshoq nur. Kichik o'lchamlarda (nav, ro'yxat) o'chiriladi.
  final bool halo;
  final String semanticLabel;

  static const assetLogo = 'assets/brand/nfcstore_logo.jpg';
  static const assetMark = 'assets/brand/nfcstore_mark.png';

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;

    if (style == BrandLogoStyle.mark) {
      return Semantics(
        label: semanticLabel,
        image: true,
        child: Image.asset(
          assetMark,
          width: size,
          // Belgi keng lokap — balandligi kengligidan hisoblanadi,
          // shuning uchun `height` berilmaydi: cho'zilish imkonsiz.
          fit: BoxFit.contain,
          filterQuality: FilterQuality.medium,
        ),
      );
    }

    // Plastina radiusi o'lchamga mutanosib: kichik logotip 44px radius
    // bilan deyarli doiraga aylanib qolardi.
    final radius = Radius.circular((size * .28).clamp(10.0, 34.0));

    return Semantics(
      label: semanticLabel,
      image: true,
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          alignment: Alignment.center,
          clipBehavior: Clip.none,
          children: [
            if (halo)
              Positioned.fill(
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.all(radius),
                      boxShadow: [
                        // Yorug' mavzuda plastina fonga singib ketmasligi
                        // uchun soya kuchliroq; qorong'ida esa aksentli nur
                        // chekkani yoritadi.
                        BoxShadow(
                          color: t.isDark
                              ? t.glow
                              : Colors.black.withValues(alpha: .16),
                          blurRadius: size * .34,
                          spreadRadius: size * .02,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            Container(
              decoration: BoxDecoration(
                color: t.logoPlate,
                borderRadius: BorderRadius.all(radius),
                border: Border.all(color: t.border2, width: 1),
              ),
              clipBehavior: Clip.antiAlias,
              child: Image.asset(
                assetLogo,
                width: size,
                height: size,
                // `contain` — nisbat hech qachon buzilmaydi.
                fit: BoxFit.contain,
                filterQuality: FilterQuality.medium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Logotip + so'z belgisi — Welcome va Splash sarlavhasi uchun.
class BrandLockup extends StatelessWidget {
  const BrandLockup({super.key, this.size = 104, this.showWordmark = true});

  final double size;
  final bool showWordmark;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        BrandLogo(size: size),
        if (showWordmark) ...[
          const SizedBox(height: Gap.lg),
          Text(
            'NFCSTORE',
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: size * .155,
              fontWeight: FontWeight.w800,
              letterSpacing: size * .055,
              color: t.text1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'NOVA',
            style: AppType.displayStyle(
              color: t.accent2,
              size: size * .19,
              letterSpacing: size * .04,
            ),
          ),
        ],
      ],
    );
  }
}
```


===== FILE: lib/features/discover/discover_screen.dart =====

<!-- Kashfiyot + qidiruv (debounce) -->

```dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../data/models/models.dart';
import '../../data/repositories/discover_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';

enum DiscoverTab { people, businesses, posts }

/// Qidiruv so'rovi — `debounce` bilan.
///
/// Har bosilgan harfga so'rov yuborish serverni ham, batareyani ham
/// behuda sarflaydi. Shuning uchun 350 ms tinchlikdan keyin yuboriladi.
class SearchQuery extends StateNotifier<String> {
  SearchQuery() : super('');
  Timer? _debounce;

  void update(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) state = v.trim();
    });
  }

  void submit(String v) {
    _debounce?.cancel();
    state = v.trim();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }
}

final searchQueryProvider =
    StateNotifierProvider.autoDispose<SearchQuery, String>((_) => SearchQuery());

final discoverTabProvider =
    StateProvider.autoDispose<DiscoverTab>((_) => DiscoverTab.people);

final discoverResultsProvider = FutureProvider.autoDispose((ref) async {
  final q = ref.watch(searchQueryProvider);
  final tab = ref.watch(discoverTabProvider);
  final repo = ref.watch(discoverRepositoryProvider);

  if (q.isEmpty) {
    return switch (tab) {
      DiscoverTab.people => (await repo.suggested()).when(
          ok: (v) => <Object>[...v], err: (e) => throw e),
      DiscoverTab.businesses => <Object>[],
      DiscoverTab.posts =>
        (await repo.trending()).when(ok: (v) => <Object>[...v], err: (e) => throw e),
    };
  }

  return switch (tab) {
    DiscoverTab.people => (await repo.searchPeople(q))
        .when(ok: (v) => <Object>[...v], err: (e) => throw e),
    DiscoverTab.businesses => (await repo.searchBusinesses(q))
        .when(ok: (v) => <Object>[...v], err: (e) => throw e),
    DiscoverTab.posts => (await repo.trending()).when(
        ok: (v) => <Object>[
              ...v.where((p) =>
                  p.text.toLowerCase().contains(q.toLowerCase()) ||
                  p.authorName.toLowerCase().contains(q.toLowerCase()))
            ],
        err: (e) => throw e),
  };
});

class DiscoverScreen extends ConsumerStatefulWidget {
  const DiscoverScreen({super.key});

  @override
  ConsumerState<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends ConsumerState<DiscoverScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final tab = ref.watch(discoverTabProvider);
    final results = ref.watch(discoverResultsProvider);
    final query = ref.watch(searchQueryProvider);
    final prefs = ref.watch(prefsProvider);

    return NovaScaffold(
      title: l.discoverTitle,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(Gap.screenX, Gap.sm, Gap.screenX, Gap.md),
            child: Container(
              decoration: BoxDecoration(
                color: t.surface2,
                borderRadius: R.pill,
                border: Border.all(color: t.border2),
              ),
              padding: const EdgeInsets.symmetric(horizontal: Gap.lg),
              child: Row(
                children: [
                  Icon(Icons.search_rounded, size: 19, color: t.text3),
                  const SizedBox(width: Gap.md),
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      onChanged: ref.read(searchQueryProvider.notifier).update,
                      onSubmitted: (v) {
                        ref.read(searchQueryProvider.notifier).submit(v);
                        prefs.pushSearch(v);
                      },
                      textInputAction: TextInputAction.search,
                      style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 14.5,
                        fontWeight: FontWeight.w600,
                        color: t.text1,
                      ),
                      decoration: InputDecoration(
                        isDense: true,
                        filled: false,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 15),
                        hintText: l.searchHint,
                      ),
                    ),
                  ),
                  if (query.isNotEmpty)
                    GestureDetector(
                      onTap: () {
                        _controller.clear();
                        ref.read(searchQueryProvider.notifier).submit('');
                      },
                      child: Icon(Icons.close_rounded, size: 18, color: t.text3),
                    ),
                ],
              ),
            ),
          ),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              children: [
                for (final e in [
                  (DiscoverTab.people, l.discoverPeople, Icons.person_rounded),
                  (DiscoverTab.businesses, l.discoverBusinesses, Icons.storefront_rounded),
                  (DiscoverTab.posts, l.homePosts, Icons.article_rounded),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: Gap.sm),
                    child: Capsule(
                      label: e.$2,
                      icon: e.$3,
                      selected: tab == e.$1,
                      onTap: () =>
                          ref.read(discoverTabProvider.notifier).state = e.$1,
                    ),
                  ),
              ],
            ),
          ),
          if (query.isEmpty && prefs.recentSearches.isNotEmpty)
            _RecentSearches(
              items: prefs.recentSearches,
              onPick: (v) {
                _controller.text = v;
                ref.read(searchQueryProvider.notifier).submit(v);
              },
              onClear: () async {
                await prefs.clearSearches();
                if (mounted) setState(() {});
              },
            ),
          Expanded(
            child: results.when(
              loading: () => const SkeletonList(),
              error: (e, __) => StatePanel.fromError(
                context,
                asAppError(e),
                onRetry: () => ref.invalidate(discoverResultsProvider),
              ),
              data: (items) => items.isEmpty
                  ? StatePanel(
                      icon: Icons.search_off_rounded,
                      title: query.isEmpty ? l.stateEmpty : l.stateNoResults,
                      message: query.isEmpty ? l.stateEmptyHint : l.stateNoResultsHint,
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(
                          Gap.screenX, Gap.md, Gap.screenX, 120),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
                      itemBuilder: (context, i) => _ResultTile(item: items[i]),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RecentSearches extends StatelessWidget {
  const _RecentSearches({
    required this.items,
    required this.onPick,
    required this.onClear,
  });

  final List<String> items;
  final ValueChanged<String> onPick;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: l.searchRecent, action: l.searchClear, onAction: onClear),
        SizedBox(
          height: 36,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            children: [
              for (final e in items)
                Padding(
                  padding: const EdgeInsets.only(right: Gap.sm),
                  child: Capsule(
                    label: e,
                    icon: Icons.history_rounded,
                    dense: true,
                    onTap: () => onPick(e),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ResultTile extends StatelessWidget {
  const _ResultTile({required this.item});
  final Object item;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;

    if (item is NfcId) {
      final e = item as NfcId;
      return FloatingSurface(
        solid: true,
        padding: const EdgeInsets.all(Gap.lg),
        onTap: () => context.push(Routes.user(e.code)),
        child: Row(
          children: [
            Avatar(url: e.avatarUrl, initials: _initials(e.name, e.code), size: 46),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(e.name.isEmpty ? e.code : e.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall),
                  Text(e.code,
                      style: AppType.monoStyle(color: t.text3, size: 11)),
                ],
              ),
            ),
            Text(formatCount(e.followers),
                style: Theme.of(context).textTheme.labelMedium),
          ],
        ),
      );
    }

    if (item is Business) {
      final e = item as Business;
      return FloatingSurface(
        solid: true,
        padding: const EdgeInsets.all(Gap.lg),
        onTap: () => context.push(Routes.storefront(e.companyId)),
        child: Row(
          children: [
            Avatar(
                url: e.logoUrl,
                initials: _initials(e.displayName, e.companyId),
                size: 46,
                ring: false),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(e.displayName.isEmpty ? e.companyId : e.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall),
                  Text(
                    [e.city, e.subcategory].where((s) => s.isNotEmpty).join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 20, color: t.text3),
          ],
        ),
      );
    }

    final e = item as Post;
    return FloatingSurface(
      solid: true,
      padding: const EdgeInsets.all(Gap.lg),
      onTap: () => context.push(Routes.post(e.id)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Avatar(
                  url: e.authorAvatar,
                  initials: _initials(e.authorName, e.code),
                  size: 34,
                  ring: false),
              const SizedBox(width: Gap.sm),
              Expanded(
                child: Text(e.authorName.isEmpty ? e.code : e.authorName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall),
              ),
              if (e.isVideo)
                Icon(Icons.play_circle_outline_rounded, size: 18, color: t.accent2),
            ],
          ),
          if (e.text.isNotEmpty) ...[
            const SizedBox(height: Gap.sm),
            Text(e.text,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium),
          ],
        ],
      ),
    );
  }

  String _initials(String name, String fallback) {
    final s = name.trim().isEmpty ? fallback : name.trim();
    return (s.length >= 2 ? s.substring(0, 2) : s).toUpperCase();
  }
}
```


===== FILE: lib/features/social/reels_screen.dart =====

<!-- Reels — vertikal lenta, video hayot sikli -->

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../data/models/models.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';

final reelsProvider = FutureProvider.autoDispose<List<Post>>((ref) async {
  final res = await ref.watch(socialRepositoryProvider).feed();
  return res.when(
    ok: (items) => items.where((p) => p.isVideo && p.mediaUrls.isNotEmpty).toList(),
    err: (e) => throw e,
  );
});

/// Vertikal Reels lentasi.
///
/// XOTIRA BOSHQARUVI: bir vaqtda FAQAT ko'rinib turgan video
/// yaratiladi va o'ynaydi. Qo'shni sahifalar `PageView` tomonidan
/// qurilsa ham, ularning kontrolleri `visible: false` bo'lgani uchun
/// hech narsa yuklamaydi. Shusiz o'nta 1080p video RAM'ni to'ldirib,
/// ilova o'lardi.
class ReelsScreen extends ConsumerStatefulWidget {
  const ReelsScreen({super.key});

  @override
  ConsumerState<ReelsScreen> createState() => _ReelsScreenState();
}

class _ReelsScreenState extends ConsumerState<ReelsScreen> {
  final _page = PageController();
  int _index = 0;

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final reels = ref.watch(reelsProvider);

    return Scaffold(
      backgroundColor: t.bg2,
      extendBody: true,
      body: reels.when(
        loading: () => Center(
          child: CircularProgressIndicator(color: t.accent2, strokeWidth: 2),
        ),
        error: (e, __) => StatePanel.fromError(
          context,
          asAppError(e),
          onRetry: () => ref.invalidate(reelsProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return Stack(
              children: [
                StatePanel(
                  icon: Icons.videocam_off_rounded,
                  title: l.reelsEmpty,
                  message: l.stateEmptyHint,
                  actionLabel: l.reelCreate,
                  onAction: () => context.push(Routes.reelCreate),
                ),
                _TopBar(onCreate: () => context.push(Routes.reelCreate)),
              ],
            );
          }
          return Stack(
            children: [
              PageView.builder(
                controller: _page,
                scrollDirection: Axis.vertical,
                itemCount: items.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) => _ReelPage(
                  post: items[i],
                  visible: i == _index,
                ),
              ),
              _TopBar(onCreate: () => context.push(Routes.reelCreate)),
            ],
          );
        },
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onCreate});
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: Gap.sm),
        child: Row(
          children: [
            Text(
              l.navReels,
              style: AppType.displayStyle(
                color: Colors.white,
                size: 25,
                shadows: const [Shadow(color: Colors.black54, blurRadius: 12)],
              ),
            ),
            const Spacer(),
            NovaIconButton(
              icon: Icons.add_rounded,
              tooltip: l.reelCreate,
              onPressed: onCreate,
              filled: true,
            ),
          ],
        ),
      ),
    );
  }
}

class _ReelPage extends ConsumerStatefulWidget {
  const _ReelPage({required this.post, required this.visible});

  final Post post;
  final bool visible;

  @override
  ConsumerState<_ReelPage> createState() => _ReelPageState();
}

class _ReelPageState extends ConsumerState<_ReelPage> {
  VideoPlayerController? _controller;
  bool _ready = false;
  bool _failed = false;
  bool _liked = false;
  int _likes = 0;

  @override
  void initState() {
    super.initState();
    _liked = widget.post.liked;
    _likes = widget.post.likes;
    if (widget.visible) _open();
  }

  @override
  void didUpdateWidget(covariant _ReelPage old) {
    super.didUpdateWidget(old);
    if (widget.visible && !old.visible) {
      _open();
    } else if (!widget.visible && old.visible) {
      _close();
    }
  }

  Future<void> _open() async {
    if (_controller != null) {
      await _controller!.play();
      return;
    }
    final url = widget.post.mediaUrls.first;
    final c = VideoPlayerController.networkUrl(Uri.parse(url));
    _controller = c;
    try {
      await c.initialize();
      if (!mounted) return;
      await c.setLooping(true);
      await c.play();
      setState(() => _ready = true);
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  Future<void> _close() async {
    // Kontroller YO'Q QILINADI, faqat to'xtatilmaydi: to'xtatilgan
    // video ham dekoder va bufer xotirasini ushlab turadi.
    final c = _controller;
    _controller = null;
    _ready = false;
    await c?.pause();
    await c?.dispose();
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _like() async {
    // Optimistik yangilanish: bosilgan zahoti raqam o'zgaradi. Xato
    // bo'lsa eski holatga qaytariladi.
    setState(() {
      _liked = !_liked;
      _likes += _liked ? 1 : -1;
    });
    final res = await ref.read(socialRepositoryProvider).like(widget.post.id);
    if (!mounted) return;
    res.when(
      ok: (_) {},
      err: (_) => setState(() {
        _liked = !_liked;
        _likes += _liked ? 1 : -1;
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final p = widget.post;

    return GestureDetector(
      onTap: () {
        final c = _controller;
        if (c == null) return;
        setState(() => c.value.isPlaying ? c.pause() : c.play());
      },
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(color: t.bg2),
          if (_ready && _controller != null)
            FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: _controller!.value.size.width,
                height: _controller!.value.size.height,
                child: VideoPlayer(_controller!),
              ),
            )
          else if (_failed)
            Center(
              child: Icon(Icons.videocam_off_rounded, size: 40, color: t.text3),
            )
          else
            Center(
              child: CircularProgressIndicator(color: t.accent2, strokeWidth: 2),
            ),
          // Pastdagi matn o'qilishi uchun gradient — videoning rangidan
          // qat'i nazar kontrast saqlanadi.
          Positioned.fill(
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.center,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black.withValues(alpha: .72)],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            right: Gap.md,
            bottom: 150,
            child: Column(
              children: [
                _Action(
                  icon: _liked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  label: formatCount(_likes),
                  tint: _liked ? t.error : Colors.white,
                  onTap: _like,
                ),
                const SizedBox(height: Gap.xl),
                _Action(
                  icon: Icons.mode_comment_outlined,
                  label: formatCount(p.comments),
                  onTap: () => context.push(Routes.post(p.id)),
                ),
                const SizedBox(height: Gap.xl),
                _Action(
                  icon: Icons.ios_share_rounded,
                  label: l.actionShare,
                  onTap: () => context.push(Routes.post(p.id)),
                ),
              ],
            ),
          ),
          Positioned(
            left: Gap.lg,
            right: 80,
            bottom: 120,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                PressableScale(
                  onTap: p.code.isEmpty ? null : () => context.push(Routes.user(p.code)),
                  child: Row(
                    children: [
                      Avatar(
                        url: p.authorAvatar,
                        initials: p.authorName.isEmpty
                            ? 'N'
                            : p.authorName.substring(0, 1).toUpperCase(),
                        size: 40,
                      ),
                      const SizedBox(width: Gap.sm),
                      Flexible(
                        child: Text(
                          p.authorName.isEmpty ? p.code : p.authorName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: AppType.sans,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (p.code.isNotEmpty) ...[
                  const SizedBox(height: Gap.sm),
                  // NFC ID — Reels ham identity tizimining bir qismi
                  // ekanini ko'rsatadi; bu TikTok'da yo'q bog'lanish.
                  PressableScale(
                    onTap: () => context.push(Routes.user(p.code)),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .16),
                        borderRadius: R.pill,
                        border: Border.all(color: Colors.white.withValues(alpha: .3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.nfc_rounded, size: 13, color: Colors.white),
                          const SizedBox(width: 5),
                          Text(
                            p.code,
                            style: AppType.monoStyle(
                                color: Colors.white, size: 11, letterSpacing: 1.2),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                if (p.text.isNotEmpty) ...[
                  const SizedBox(height: Gap.sm),
                  Text(
                    p.text,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      height: 1.35,
                      color: Colors.white,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({
    required this.icon,
    required this.label,
    this.tint = Colors.white,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final Color tint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => PressableScale(
        onTap: onTap,
        child: Column(
          children: [
            Icon(icon, size: 28, color: tint, shadows: const [
              Shadow(color: Colors.black54, blurRadius: 10),
            ]),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(
                fontFamily: AppType.sans,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                shadows: [Shadow(color: Colors.black54, blurRadius: 10)],
              ),
            ),
          ],
        ),
      );
}
```

