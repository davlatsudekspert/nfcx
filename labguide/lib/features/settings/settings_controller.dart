import 'package:material_ui/material_ui.dart';

import '../../core/storage/kv_store.dart';

/// Foydalanuvchi tanlagan yo'nalish. Bu faqat UI afzalligi: hech qanday
/// ruxsat bermaydi (haqiqiy vakolat serverda tekshiriladi).
enum AppRole { doctor, lab, student, teacher }

/// Qo'llab-quvvatlanadigan interfeys tillari.
enum AppLanguage {
  uz,
  ru,
  en;

  Locale get locale => Locale(name);

  String get shortLabel => name.toUpperCase();

  static AppLanguage? tryParse(String? code) {
    for (final l in values) {
      if (l.name == code) return l;
    }
    return null;
  }

  /// Tizim tili qo'llab-quvvatlansa — o'sha, aks holda o'zbekcha.
  static AppLanguage fromSystem(Iterable<Locale> systemLocales) {
    for (final locale in systemLocales) {
      final match = tryParse(locale.languageCode);
      if (match != null) return match;
    }
    return AppLanguage.uz;
  }
}

class SettingsController extends ChangeNotifier {
  SettingsController(this._store, {required Iterable<Locale> systemLocales})
    : _language =
          AppLanguage.tryParse(_store.getString(StoreKeys.language)) ??
          AppLanguage.fromSystem(systemLocales),
      _themeMode = _parseTheme(_store.getString(StoreKeys.themeMode)),
      _role = _parseRole(_store.getString(StoreKeys.role)),
      _onboarded = _store.getBool(StoreKeys.onboarded) ?? false;

  final KeyValueStore _store;

  AppLanguage _language;
  ThemeMode _themeMode;
  AppRole? _role;
  bool _onboarded;

  AppLanguage get language => _language;
  ThemeMode get themeMode => _themeMode;

  /// Onboardingda hali tanlanmagan bo'lsa `null`.
  AppRole? get role => _role;

  /// Bosh sahifa uchun: tanlanmagan bo'lsa laborant ko'rinishi.
  AppRole get effectiveRole => _role ?? AppRole.lab;

  /// Welcome → (mehmon yoki email) → rol oqimi yakunlanganmi.
  bool get onboarded => _onboarded;

  Future<void> setLanguage(AppLanguage value) async {
    if (_language == value) return;
    _language = value;
    notifyListeners();
    await _store.setString(StoreKeys.language, value.name);
  }

  Future<void> setThemeMode(ThemeMode value) async {
    if (_themeMode == value) return;
    _themeMode = value;
    notifyListeners();
    await _store.setString(StoreKeys.themeMode, value.name);
  }

  Future<void> setRole(AppRole value) async {
    if (_role == value) return;
    _role = value;
    notifyListeners();
    await _store.setString(StoreKeys.role, value.name);
  }

  Future<void> completeOnboarding() async {
    if (_onboarded) return;
    _onboarded = true;
    notifyListeners();
    await _store.setBool(StoreKeys.onboarded, true);
  }

  /// Chiqishda: welcome qayta ko'rsatiladi, til va mavzu saqlanadi.
  Future<void> resetOnboarding() async {
    _onboarded = false;
    notifyListeners();
    await _store.setBool(StoreKeys.onboarded, false);
  }

  /// Lokal ma'lumotlar o'chirilgandan keyin xotiradagi holatni tozalash.
  void resetToDefaults(Iterable<Locale> systemLocales) {
    _language = AppLanguage.fromSystem(systemLocales);
    _themeMode = ThemeMode.system;
    _role = null;
    _onboarded = false;
    notifyListeners();
  }

  static ThemeMode _parseTheme(String? raw) => switch (raw) {
    'light' => ThemeMode.light,
    'dark' => ThemeMode.dark,
    _ => ThemeMode.system,
  };

  static AppRole? _parseRole(String? raw) {
    for (final r in AppRole.values) {
      if (r.name == raw) return r;
    }
    return null;
  }
}
