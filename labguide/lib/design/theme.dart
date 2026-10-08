import 'package:material_ui/material_ui.dart';

import 'tokens.dart';
import 'transitions.dart';

/// Tipografika shkalasi: 39 / 30 / 25 / 18 / 16 / 14 / 12 / 11 px.
/// Asosiy o'qish matni 16 px (bodyLarge). 11 px faqat qisqa yordamchi
/// yozuvlar (eyebrow, tab nomi) uchun — undan kichik matn ishlatilmaydi.
TextTheme _textTheme(LgPalette p) {
  const family = 'Inter';
  return TextTheme(
    // Sahifa sarlavhasi.
    displaySmall: TextStyle(
      fontFamily: family,
      fontSize: 39,
      height: 1.08,
      letterSpacing: -1.7,
      fontWeight: FontWeight.w600,
      color: p.ink,
    ),
    // Hero sarlavhasi.
    headlineMedium: TextStyle(
      fontFamily: family,
      fontSize: 30,
      height: 1.15,
      letterSpacing: -1.2,
      fontWeight: FontWeight.w600,
      color: p.ink,
    ),
    // Ekran ichidagi katta sarlavha.
    headlineSmall: TextStyle(
      fontFamily: family,
      fontSize: 25,
      height: 1.2,
      letterSpacing: -0.9,
      fontWeight: FontWeight.w600,
      color: p.ink,
    ),
    // Bo'lim sarlavhasi va ixcham toolbar sarlavhasi.
    titleLarge: TextStyle(
      fontFamily: family,
      fontSize: 18,
      height: 1.3,
      letterSpacing: -0.3,
      fontWeight: FontWeight.w600,
      color: p.ink,
    ),
    titleMedium: TextStyle(
      fontFamily: family,
      fontSize: 16,
      height: 1.35,
      letterSpacing: -0.1,
      fontWeight: FontWeight.w600,
      color: p.ink,
    ),
    titleSmall: TextStyle(
      fontFamily: family,
      fontSize: 16,
      height: 1.35,
      fontWeight: FontWeight.w500,
      color: p.ink,
    ),
    bodyLarge: TextStyle(
      fontFamily: family,
      fontSize: 16,
      height: 1.55,
      fontWeight: FontWeight.w400,
      color: p.ink,
    ),
    bodyMedium: TextStyle(
      fontFamily: family,
      fontSize: 14,
      height: 1.6,
      fontWeight: FontWeight.w400,
      color: p.sub,
    ),
    bodySmall: TextStyle(
      fontFamily: family,
      fontSize: 12,
      height: 1.5,
      fontWeight: FontWeight.w400,
      color: p.sub,
    ),
    labelLarge: TextStyle(
      fontFamily: family,
      fontSize: 15,
      height: 1.3,
      fontWeight: FontWeight.w600,
      color: p.ink,
    ),
    labelMedium: TextStyle(
      fontFamily: family,
      fontSize: 12,
      height: 1.3,
      fontWeight: FontWeight.w500,
      color: p.ink,
    ),
    labelSmall: TextStyle(
      fontFamily: family,
      fontSize: 11,
      height: 1.3,
      letterSpacing: 1.3,
      fontWeight: FontWeight.w600,
      color: p.sub,
    ),
  );
}

ThemeData buildLgTheme(Brightness brightness) {
  final p = brightness == Brightness.light ? LgPalette.light : LgPalette.dark;
  final scheme = ColorScheme(
    brightness: brightness,
    primary: p.brand,
    onPrimary: p.onBrand,
    primaryContainer: p.soft,
    onPrimaryContainer: p.brand,
    secondary: p.brand,
    onSecondary: p.onBrand,
    secondaryContainer: p.soft,
    onSecondaryContainer: p.brand,
    tertiary: p.amber,
    onTertiary: p.amberBg,
    error: p.danger,
    onError: p.paper,
    surface: p.bg,
    onSurface: p.ink,
    onSurfaceVariant: p.sub,
    surfaceContainerLowest: p.paper,
    surfaceContainerLow: p.paper,
    surfaceContainer: p.paper,
    surfaceContainerHigh: p.paper,
    surfaceContainerHighest: p.soft,
    outline: p.line,
    outlineVariant: p.line,
    shadow: p.shadow,
    inverseSurface: p.ink,
    onInverseSurface: p.bg,
    inversePrimary: p.soft,
  );
  final text = _textTheme(p);

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    fontFamily: 'Inter',
    textTheme: text,
    scaffoldBackgroundColor: p.bg,
    canvasColor: p.bg,
    dividerColor: p.line,
    splashFactory: InkSparkle.splashFactory,
    extensions: [p],
    materialTapTargetSize: MaterialTapTargetSize.padded,
    visualDensity: VisualDensity.standard,
    focusColor: p.brand.withValues(alpha: 0.12),
    dividerTheme: DividerThemeData(color: p.line, thickness: 1, space: 1),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: p.ink,
      contentTextStyle: text.bodyMedium!.copyWith(color: p.bg),
      actionTextColor: p.soft,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: p.paper,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(LgRadius.card),
      ),
      titleTextStyle: text.headlineSmall,
      contentTextStyle: text.bodyLarge,
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: p.paper,
      surfaceTintColor: Colors.transparent,
      textStyle: text.titleSmall,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: p.brand,
      linearTrackColor: p.line,
      circularTrackColor: Colors.transparent,
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.selected) ? p.brand : null,
      ),
      checkColor: WidgetStatePropertyAll(p.onBrand),
      side: BorderSide(color: p.sub, width: 1.5),
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: p.brand,
      selectionColor: p.brand.withValues(alpha: 0.25),
      selectionHandleColor: p.brand,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.paper,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      hintStyle: text.bodyLarge!.copyWith(color: p.sub),
      errorStyle: text.bodySmall!.copyWith(color: p.danger),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LgRadius.field),
        borderSide: BorderSide(color: p.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LgRadius.field),
        borderSide: BorderSide(color: p.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LgRadius.field),
        borderSide: BorderSide(color: p.brand, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LgRadius.field),
        borderSide: BorderSide(color: p.danger),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LgRadius.field),
        borderSide: BorderSide(color: p.danger, width: 2),
      ),
    ),
    pageTransitionsTheme: lgPageTransitions,
  );
}
