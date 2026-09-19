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
