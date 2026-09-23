import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Sessiya tokeni — Keystore/Keychain ichida.
///
/// NIMA UCHUN `SharedPreferences` EMAS: token hisobga to'liq kirish
/// demak. `SharedPreferences` oddiy XML fayl — root huquqli qurilmada
/// yoki zaxira nusxadan o'qish mumkin.
class SecureStore {
  SecureStore([FlutterSecureStorage? storage])
      : _s = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _s;

  static const _kToken = 'nova.session.token';

  Future<String?> readToken() async {
    try {
      return await _s.read(key: _kToken);
    } catch (_) {
      // Keystore buzilgan bo'lsa (OS yangilanishidan keyin uchraydi) —
      // token yo'q deb hisoblanadi va foydalanuvchi qayta kiradi.
      return null;
    }
  }

  Future<void> writeToken(String token) async {
    try {
      await _s.write(key: _kToken, value: token);
    } catch (_) {/* yozib bo'lmasa sessiya faqat shu ish seansida qoladi */}
  }

  Future<void> clear() async {
    try {
      await _s.delete(key: _kToken);
    } catch (_) {/* ignore */}
  }

  /// Lokal ilova qulfining PIN kodi.
  ///
  /// Token bilan bir joyda: u ham shu qurilmadagi sir va
  /// `SharedPreferences` da turishi mumkin emas.
  static const _kPin = 'nova.appLock.pin';

  Future<String?> readPin() async {
    try {
      return await _s.read(key: _kPin);
    } catch (_) {
      return null;
    }
  }

  Future<void> writePin(String pin) async {
    try {
      await _s.write(key: _kPin, value: pin);
    } catch (_) {/* ignore */}
  }

  Future<void> deletePin() async {
    try {
      await _s.delete(key: _kPin);
    } catch (_) {/* ignore */}
  }
}

/// Maxfiy BO'LMAGAN sozlamalar: mavzu, til, onboarding holati.
///
/// Bular Keystore'ga yozilmaydi — u sekin va bu ma'lumot sir emas.
class Prefs {
  Prefs(this._p);
  final SharedPreferences _p;

  static Future<Prefs> open() async => Prefs(await SharedPreferences.getInstance());

  static const _kTheme = 'nova.theme';
  static const _kLocale = 'nova.locale';
  static const _kMode = 'nova.mode';
  static const _kSearches = 'nova.recentSearches';
  static const _kRules = 'nova.contentRulesAccepted';
  static const _kLock = 'nova.appLock';
  static const _kLockBio = 'nova.appLockBiometric';
  static const _kNotif = 'nova.notif.';
  static const _kCatalogFav = 'nova.catalogFavorites';

  String? get themeId => _p.getString(_kTheme);
  Future<void> setThemeId(String v) => _p.setString(_kTheme, v);

  String? get localeCode => _p.getString(_kLocale);
  Future<void> setLocaleCode(String v) => _p.setString(_kLocale, v);

  /// `personal` yoki `business` — ilova qaysi rejimda ochilgani.
  String? get mode => _p.getString(_kMode);
  Future<void> setMode(String v) => _p.setString(_kMode, v);

  /// Kontent qoidalariga rozilik berilganmi.
  ///
  /// Bu FAQAT interfeys uchun: serverga rozilik har bir joylashda
  /// qaytadan yuboriladi (`agreed: true`), chunki dalil server
  /// tomonda qolishi kerak.
  bool get contentRulesAccepted => _p.getBool(_kRules) ?? false;
  Future<void> setContentRulesAccepted(bool v) => _p.setBool(_kRules, v);

  /// Lokal ilova qulfi yoqilganmi. Standart holat — O'CHIQ.
  bool get appLock => _p.getBool(_kLock) ?? false;
  Future<void> setAppLock(bool v) => _p.setBool(_kLock, v);

  /// Qulfni biometrika bilan ochishga ruxsat.
  bool get appLockBiometric => _p.getBool(_kLockBio) ?? true;
  Future<void> setAppLockBiometric(bool v) => _p.setBool(_kLockBio, v);

  /// BILDIRISHNOMA TANLOVLARI — QURILMADA.
  ///
  /// Backend'da push ro'yxati yo'q, shuning uchun serverga yuborish
  /// soxta bo'lardi. Ilgari bu tanlovlar UMUMAN saqlanmasdi: ekrandan
  /// chiqib qaytilsa, tugmalar o'z holiga qaytib qolardi va bu
  /// "buzuq" bo'lib ko'rinardi. Endi hech bo'lmasa qurilmada qoladi —
  /// ekrandagi yozuv ham aynan shuni aytadi.
  bool notif(String key, {bool fallback = true}) =>
      _p.getBool('$_kNotif$key') ?? fallback;

  Future<void> setNotif(String key, bool v) =>
      _p.setBool('$_kNotif$key', v);

  List<String> get recentSearches => _p.getStringList(_kSearches) ?? const [];

  /// Oxirgi 8 ta qidiruv, eng yangisi boshida, takrorlarsiz.
  Future<void> pushSearch(String q) async {
    final s = q.trim();
    if (s.isEmpty) return;
    final list = [s, ...recentSearches.where((e) => e != s)].take(8).toList();
    await _p.setStringList(_kSearches, list);
  }

  Future<void> clearSearches() => _p.remove(_kSearches);

  /// Tanlov katalogidagi sevimli tovarlar (`kompaniya/tovar`).
  /// Faqat shu qurilmada — serverda saqlash API'si yo'q.
  List<String> get catalogFavorites =>
      _p.getStringList(_kCatalogFav) ?? const [];
  Future<void> setCatalogFavorites(List<String> keys) =>
      _p.setStringList(_kCatalogFav, keys);
}
