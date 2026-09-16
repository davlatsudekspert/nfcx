import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'tokens.dart';
import 'type.dart';

/// FLUTTER WIDGETLARI UCHUN MAVZU — ilovaning o'z dizayni EMAS.
///
/// Ilova komponentlari `C` va `T` ni bevosita o'qiydi; `ThemeData`
/// faqat Flutter o'zi chizadigan narsalar uchun kerak: klaviatura
/// ustidagi panel, matn tanlash menyusi, skrollbar, kursor rangi.
/// Ular `ThemeData` siz tizim ko'k rangida chiqib, dizayndan
/// ajralib turadi.
ThemeData buildTheme() {
  final scheme = ColorScheme.dark(
    primary: C.accent,
    onPrimary: C.onAccent,
    secondary: C.accentSecondary,
    onSecondary: C.onAccent,
    surface: C.surface,
    onSurface: C.ink,
    error: C.fail,
    onError: C.ink,
    outline: C.line,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: C.bg,
    canvasColor: C.bg,
    fontFamily: 'PlusJakartaSans',
    // Kirill zaxirasi — izohi `type.dart` da.
    fontFamilyFallback: const ['ManropeCyr'],

    // Material'ning to'lqin effekti bu dizaynda begona: bosish
    // `Press` orqali masshtab bilan ko'rsatiladi.
    splashFactory: NoSplash.splashFactory,
    splashColor: const Color(0x00000000),
    highlightColor: const Color(0x00000000),
    hoverColor: const Color(0x00000000),

    textSelectionTheme: TextSelectionThemeData(
      cursorColor: C.accent,
      selectionColor: C.accent.withValues(alpha: .26),
      selectionHandleColor: C.accent,
    ),

    // Ekran o'tishlari `SlidePage` orqali boradi; bu esa Flutter
    // o'zi ochadigan marshrutlar uchun zaxira. Har ikki platformada
    // ham xiralik: ilova Android uchun quriladi va o'tish tili
    // butun ilovada bitta bo'lishi kerak.
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: FadeForwardsPageTransitionsBuilder(),
      },
    ),

    textTheme: TextTheme(
      bodyMedium: T.body,
      bodyLarge: T.bodyStrong,
      titleMedium: T.cardTitle,
      labelLarge: T.button,
    ),
  );
}

/// TIZIM PANELLARI — status bar shaffof, pastki navigatsiya foni
/// ekran foniga qo'shilib ketadi.
SystemUiOverlayStyle get systemOverlay => SystemUiOverlayStyle(
      statusBarColor: const Color(0x00000000),
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: C.bg,
      systemNavigationBarIconBrightness: Brightness.light,
      systemNavigationBarDividerColor: const Color(0x00000000),
    );
