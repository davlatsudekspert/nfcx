import 'package:material_ui/material_ui.dart';

/// LabGuide rang tokenlari — prototype.html (v5) dagi `--bg/--paper/...`
/// o'zgaruvchilarining aynan o'zi. Kunduzgi: iliq ivory + forest yashil;
/// tungi: chuqur yashil-qora + yumshoq lime aksent.
@immutable
class LgPalette extends ThemeExtension<LgPalette> {
  const LgPalette({
    required this.bg,
    required this.paper,
    required this.ink,
    required this.sub,
    required this.line,
    required this.brand,
    required this.onBrand,
    required this.soft,
    required this.amber,
    required this.amberBg,
    required this.danger,
    required this.shadow,
  });

  /// Ekran foni.
  final Color bg;

  /// Karta/panel foni.
  final Color paper;

  /// Asosiy matn.
  final Color ink;

  /// Ikkinchi darajali matn.
  final Color sub;

  /// Ajratuvchi chiziq (kam ishlatiladi).
  final Color line;

  /// Aksent: kunduzi forest, tunda lime.
  final Color brand;

  /// Aksent ustidagi matn.
  final Color onBrand;

  /// Yumshoq aksent foni (chip, tanlangan holat, hero).
  final Color soft;

  /// Ogohlantirish matni.
  final Color amber;

  /// Ogohlantirish foni.
  final Color amberBg;

  /// Xato matni.
  final Color danger;

  /// Soyalar uchun asosiy rang (shaffofligi alohida beriladi).
  final Color shadow;

  static const light = LgPalette(
    bg: Color(0xFFF3F3EC),
    paper: Color(0xFFFFFEF9),
    ink: Color(0xFF183A36),
    sub: Color(0xFF536C65),
    line: Color(0xFFDCE4D9),
    brand: Color(0xFF194C40),
    onBrand: Color(0xFFF7FAEE),
    soft: Color(0xFFE8EEDB),
    amber: Color(0xFF7B4D0B),
    amberBg: Color(0xFFFFF1DB),
    danger: Color(0xFF9A2B1F),
    shadow: Color(0xFF194C40),
  );

  static const dark = LgPalette(
    bg: Color(0xFF0D1919),
    paper: Color(0xFF172828),
    ink: Color(0xFFECF4E9),
    sub: Color(0xFFAABFB5),
    line: Color(0xFF304641),
    brand: Color(0xFFC5E8A1),
    onBrand: Color(0xFF163222),
    soft: Color(0xFF253F31),
    amber: Color(0xFFF0C586),
    amberBg: Color(0xFF3F3324),
    danger: Color(0xFFFFB4A6),
    shadow: Color(0xFF000000),
  );

  static LgPalette of(BuildContext context) =>
      Theme.of(context).extension<LgPalette>()!;

  @override
  LgPalette copyWith({
    Color? bg,
    Color? paper,
    Color? ink,
    Color? sub,
    Color? line,
    Color? brand,
    Color? onBrand,
    Color? soft,
    Color? amber,
    Color? amberBg,
    Color? danger,
    Color? shadow,
  }) {
    return LgPalette(
      bg: bg ?? this.bg,
      paper: paper ?? this.paper,
      ink: ink ?? this.ink,
      sub: sub ?? this.sub,
      line: line ?? this.line,
      brand: brand ?? this.brand,
      onBrand: onBrand ?? this.onBrand,
      soft: soft ?? this.soft,
      amber: amber ?? this.amber,
      amberBg: amberBg ?? this.amberBg,
      danger: danger ?? this.danger,
      shadow: shadow ?? this.shadow,
    );
  }

  @override
  LgPalette lerp(ThemeExtension<LgPalette>? other, double t) {
    if (other is! LgPalette) return this;
    return LgPalette(
      bg: Color.lerp(bg, other.bg, t)!,
      paper: Color.lerp(paper, other.paper, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      sub: Color.lerp(sub, other.sub, t)!,
      line: Color.lerp(line, other.line, t)!,
      brand: Color.lerp(brand, other.brand, t)!,
      onBrand: Color.lerp(onBrand, other.onBrand, t)!,
      soft: Color.lerp(soft, other.soft, t)!,
      amber: Color.lerp(amber, other.amber, t)!,
      amberBg: Color.lerp(amberBg, other.amberBg, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      shadow: Color.lerp(shadow, other.shadow, t)!,
    );
  }
}

/// Burchak radiuslari (DESIGN_REQUIREMENTS: 27 hero / 23 karta / 18 tugma).
abstract final class LgRadius {
  static const double hero = 27;
  static const double card = 23;
  static const double button = 18;
  static const double chip = 14;
  static const double field = 14;
  static const double tag = 20;
}

/// Bo'shliqlar. Telefon gutteri 24, tor ekranda (<=360) 18.
abstract final class LgSpace {
  static const double xs = 6;
  static const double sm = 10;
  static const double md = 14;
  static const double lg = 20;
  static const double xl = 28;

  static double gutter(double width) => width <= 360 ? 18 : 24;

  /// Planshetda kontent juda kengayib ketmasligi uchun.
  static const double maxContentWidth = 640;
}

/// Harakat davomiyliklari. Reduced motion yoqilganda hammasi nolga tushadi.
abstract final class LgMotion {
  static const press = Duration(milliseconds: 160);
  static const page = Duration(milliseconds: 200);
  static const header = Duration(milliseconds: 200);

  static bool reduced(BuildContext context) =>
      MediaQuery.maybeDisableAnimationsOf(context) ?? false;

  static Duration of(BuildContext context, Duration d) =>
      reduced(context) ? Duration.zero : d;
}

/// Minimal bosiladigan maydon (Apple HIG 44pt / Material 48dp — 44 dan kam emas).
const double kMinTap = 44;
