import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum BrandThemeMode { editorial, midnight }

@immutable
class BrandPalette {
  const BrandPalette({
    required this.mode,
    required this.background,
    required this.background2,
    required this.surface,
    required this.surfaceRaised,
    required this.ink,
    required this.ink2,
    required this.line,
    required this.accent,
    required this.accentSoft,
    required this.hero,
    required this.heroInk,
    required this.shadow,
    required this.brightness,
  });

  final BrandThemeMode mode;
  final Color background;
  final Color background2;
  final Color surface;
  final Color surfaceRaised;
  final Color ink;
  final Color ink2;
  final Color line;
  final Color accent;
  final Color accentSoft;
  final Color hero;
  final Color heroInk;
  final Color shadow;
  final Brightness brightness;

  static const editorial = BrandPalette(
    mode: BrandThemeMode.editorial,
    background: Color(0xFFF7F5F0),
    background2: Color(0xFFF0EDE6),
    surface: Color(0xFFFFFEFB),
    surfaceRaised: Color(0xFFFFFFFF),
    ink: Color(0xFF171716),
    ink2: Color(0xFF716D66),
    line: Color(0xFFE1DDD4),
    accent: Color(0xFFC4A164),
    accentSoft: Color(0xFFF1E5CF),
    hero: Color(0xFF171716),
    heroInk: Color(0xFFF6E1B7),
    shadow: Color(0x22000000),
    brightness: Brightness.light,
  );

  static const midnight = BrandPalette(
    mode: BrandThemeMode.midnight,
    background: Color(0xFF07111F),
    background2: Color(0xFF0A1728),
    surface: Color(0xFF0D1B2D),
    surfaceRaised: Color(0xFF12243B),
    ink: Color(0xFFF7F4ED),
    ink2: Color(0xFFA7B0BC),
    line: Color(0xFF223852),
    accent: Color(0xFFD0AA5B),
    accentSoft: Color(0xFF282823),
    hero: Color(0xFF08101A),
    heroInk: Color(0xFFF1D489),
    shadow: Color(0x77000000),
    brightness: Brightness.dark,
  );
}

class BrandThemeController extends ChangeNotifier {
  static const _key = 'nfcstore_v2_theme';
  BrandThemeMode _mode = BrandThemeMode.editorial;

  BrandThemeMode get mode => _mode;
  BrandPalette get palette =>
      _mode == BrandThemeMode.editorial ? BrandPalette.editorial : BrandPalette.midnight;

  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _mode = prefs.getString(_key) == 'midnight'
          ? BrandThemeMode.midnight
          : BrandThemeMode.editorial;
    } catch (_) {
      _mode = BrandThemeMode.editorial;
    }
    notifyListeners();
  }

  Future<void> setMode(BrandThemeMode value) async {
    if (_mode == value) return;
    _mode = value;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_key, value.name);
    } catch (_) {}
  }

  Future<void> toggle() => setMode(
        _mode == BrandThemeMode.editorial
            ? BrandThemeMode.midnight
            : BrandThemeMode.editorial,
      );
}

class BrandThemeScope extends InheritedNotifier<BrandThemeController> {
  const BrandThemeScope({
    super.key,
    required BrandThemeController controller,
    required super.child,
  }) : super(notifier: controller);

  static BrandThemeController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<BrandThemeScope>();
    assert(scope?.notifier != null);
    return scope!.notifier!;
  }
}

extension BrandContext on BuildContext {
  BrandPalette get brand => BrandThemeScope.of(this).palette;
}

ThemeData buildBrandTheme(BrandPalette p) {
  return ThemeData(
    useMaterial3: true,
    brightness: p.brightness,
    scaffoldBackgroundColor: p.background,
    canvasColor: p.background,
    fontFamily: 'Manrope',
    splashFactory: NoSplash.splashFactory,
    colorScheme: ColorScheme(
      brightness: p.brightness,
      primary: p.accent,
      onPrimary: const Color(0xFF14100A),
      secondary: p.accent,
      onSecondary: p.ink,
      error: const Color(0xFFD65D55),
      onError: Colors.white,
      surface: p.surface,
      onSurface: p.ink,
      outline: p.line,
    ),
    textTheme: TextTheme(
      displaySmall: TextStyle(
        fontFamily: 'InstrumentSerif',
        fontSize: 38,
        height: 1.0,
        letterSpacing: -.5,
        color: p.ink,
      ),
      headlineLarge: TextStyle(
        fontFamily: 'InstrumentSerif',
        fontSize: 31,
        height: 1.04,
        letterSpacing: -.3,
        color: p.ink,
      ),
      headlineMedium: TextStyle(
        fontFamily: 'InstrumentSerif',
        fontSize: 26,
        height: 1.08,
        color: p.ink,
      ),
      titleLarge: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        letterSpacing: -.35,
        color: p.ink,
      ),
      titleMedium: TextStyle(
        fontSize: 15.5,
        fontWeight: FontWeight.w700,
        color: p.ink,
      ),
      bodyLarge: TextStyle(fontSize: 15, height: 1.45, color: p.ink),
      bodyMedium: TextStyle(fontSize: 13.5, height: 1.45, color: p.ink2),
      labelLarge: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: p.ink),
    ),
  );
}

SystemUiOverlayStyle brandOverlay(BrandPalette p) => SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness:
          p.brightness == Brightness.light ? Brightness.dark : Brightness.light,
      statusBarBrightness:
          p.brightness == Brightness.light ? Brightness.light : Brightness.dark,
      systemNavigationBarColor: p.background,
      systemNavigationBarIconBrightness:
          p.brightness == Brightness.light ? Brightness.dark : Brightness.light,
      systemNavigationBarDividerColor: Colors.transparent,
    );
