import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum LuxThemeMode { editorial, midnight }

@immutable
class LuxPalette {
  const LuxPalette({
    required this.mode,
    required this.background,
    required this.backgroundAlt,
    required this.surface,
    required this.surfaceRaised,
    required this.ink,
    required this.inkMuted,
    required this.line,
    required this.accent,
    required this.accentSoft,
    required this.hero,
    required this.heroInk,
    required this.shadow,
    required this.brightness,
  });

  final LuxThemeMode mode;
  final Color background;
  final Color backgroundAlt;
  final Color surface;
  final Color surfaceRaised;
  final Color ink;
  final Color inkMuted;
  final Color line;
  final Color accent;
  final Color accentSoft;
  final Color hero;
  final Color heroInk;
  final Color shadow;
  final Brightness brightness;

  static const editorial = LuxPalette(
    mode: LuxThemeMode.editorial,
    background: Color(0xFFF7F5F0),
    backgroundAlt: Color(0xFFF0EDE6),
    surface: Color(0xFFFFFEFB),
    surfaceRaised: Color(0xFFFFFFFF),
    ink: Color(0xFF151515),
    inkMuted: Color(0xFF716D66),
    line: Color(0xFFE2DED5),
    accent: Color(0xFFC5A469),
    accentSoft: Color(0xFFF2E7D2),
    hero: Color(0xFF171716),
    heroInk: Color(0xFFF7E7C4),
    shadow: Color(0x22000000),
    brightness: Brightness.light,
  );

  static const midnight = LuxPalette(
    mode: LuxThemeMode.midnight,
    background: Color(0xFF07111F),
    backgroundAlt: Color(0xFF0B1728),
    surface: Color(0xFF0E1D31),
    surfaceRaised: Color(0xFF13253D),
    ink: Color(0xFFF7F4ED),
    inkMuted: Color(0xFFAAB3C0),
    line: Color(0xFF243954),
    accent: Color(0xFFD0AA5B),
    accentSoft: Color(0xFF2A2A27),
    hero: Color(0xFF09111B),
    heroInk: Color(0xFFF2D58F),
    shadow: Color(0x66000000),
    brightness: Brightness.dark,
  );
}

class LuxThemeController extends ChangeNotifier {
  static const _key = 'nfcstore_v2_theme';
  LuxThemeMode _mode = LuxThemeMode.editorial;
  bool _loaded = false;

  LuxThemeMode get mode => _mode;
  bool get loaded => _loaded;
  LuxPalette get palette =>
      _mode == LuxThemeMode.editorial ? LuxPalette.editorial : LuxPalette.midnight;

  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _mode = prefs.getString(_key) == 'midnight'
          ? LuxThemeMode.midnight
          : LuxThemeMode.editorial;
    } catch (_) {
      _mode = LuxThemeMode.editorial;
    }
    _loaded = true;
    notifyListeners();
  }

  Future<void> setMode(LuxThemeMode value) async {
    if (_mode == value) return;
    _mode = value;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_key, value.name);
    } catch (_) {}
  }

  Future<void> toggle() =>
      setMode(_mode == LuxThemeMode.editorial ? LuxThemeMode.midnight : LuxThemeMode.editorial);
}

class LuxThemeScope extends InheritedNotifier<LuxThemeController> {
  const LuxThemeScope({
    super.key,
    required LuxThemeController controller,
    required super.child,
  }) : super(notifier: controller);

  static LuxThemeController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<LuxThemeScope>();
    assert(scope?.notifier != null, 'LuxThemeScope topilmadi');
    return scope!.notifier!;
  }
}

extension LuxContext on BuildContext {
  LuxPalette get lux => LuxThemeScope.of(this).palette;
}

ThemeData buildLuxTheme(LuxPalette p) {
  final scheme = ColorScheme(
    brightness: p.brightness,
    primary: p.accent,
    onPrimary: p.mode == LuxThemeMode.editorial ? const Color(0xFF17130C) : const Color(0xFF0A0D12),
    secondary: p.accent,
    onSecondary: p.ink,
    error: const Color(0xFFD85E57),
    onError: Colors.white,
    surface: p.surface,
    onSurface: p.ink,
    surfaceContainerHighest: p.backgroundAlt,
    outline: p.line,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: p.brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: p.background,
    canvasColor: p.background,
    fontFamily: 'Manrope',
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    textTheme: TextTheme(
      displaySmall: TextStyle(
        fontFamily: 'InstrumentSerif',
        fontSize: 38,
        height: 1.0,
        letterSpacing: -0.5,
        color: p.ink,
      ),
      headlineLarge: TextStyle(
        fontFamily: 'InstrumentSerif',
        fontSize: 31,
        height: 1.04,
        letterSpacing: -0.3,
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
        letterSpacing: -0.35,
        color: p.ink,
      ),
      titleMedium: TextStyle(
        fontSize: 15.5,
        fontWeight: FontWeight.w700,
        color: p.ink,
      ),
      bodyLarge: TextStyle(
        fontSize: 15,
        height: 1.45,
        color: p.ink,
      ),
      bodyMedium: TextStyle(
        fontSize: 13.5,
        height: 1.45,
        color: p.inkMuted,
      ),
      labelLarge: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        color: p.ink,
      ),
    ),
  );
}

SystemUiOverlayStyle luxOverlay(LuxPalette p) => SystemUiOverlayStyle(
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
