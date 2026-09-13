import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'tokens.dart';
import 'type.dart';

/// Material mavzusi — asosan Flutter'ning o'z komponentlarini (klaviatura
/// ustidagi panel, matn tanlash menyusi, scrollbar) ilova ranglariga
/// moslash uchun. Ilovaning o'z komponentlari `design/components/` da
/// va ular ThemeData'ga BOG'LIQ EMAS — dizayn tokenlaridan to'g'ridan
/// to'g'ri o'qiydi, shuning uchun tasodifan Material ranglariga
/// "sirg'alib" ketmaydi.
ThemeData buildTheme() {
  final scheme = ColorScheme.dark(
    primary: C.champagne,
    onPrimary: C.ink,
    secondary: C.platinum,
    surface: C.graphite,
    onSurface: C.offWhite,
    error: C.signal,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: C.obsidian,
    canvasColor: C.obsidian,
    fontFamily: 'Manrope',
    splashFactory: NoSplash.splashFactory,
    highlightColor: const Color(0x00000000),
    splashColor: const Color(0x00000000),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: C.champagne,
      selectionColor: Color(0x33E8CFA0),
      selectionHandleColor: C.champagne,
    ),
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
    }),
    textTheme: const TextTheme(
      bodyMedium: T.body,
      bodyLarge: T.body,
      titleMedium: T.cardTitle,
    ),
  );
}

/// Tizim panellari — status bar shaffof, ikonkalari oq (fon qorong'i).
/// Tizim paneli uslubi. MAVZUGA BOG'LIQ (pastki panel rangi), shuning
/// uchun `const` emas — funksiya.
SystemUiOverlayStyle get systemOverlay => SystemUiOverlayStyle(
      statusBarColor: const Color(0x00000000),
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: C.obsidian,
      systemNavigationBarIconBrightness: Brightness.light,
    );
