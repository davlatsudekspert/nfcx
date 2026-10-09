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
              // `resetOnError` — shifrlangan fayl ochilmasa (zaxiradan
              // boshqa qurilmaga tiklangan, Keystore kaliti yo'q) plagin
              // uni tozalaydi. Aks holda o'qish HAM, yozish HAM har safar
              // xato berib, sessiya hech qachon saqlanmasdi. Qo'shimcha
              // himoya: token fayli zaxiradan chiqarilgan
              // (`res/xml/backup_rules.xml`, `data_extraction_rules.xml`).
              aOptions: AndroidOptions(
                encryptedSharedPreferences: true,
                resetOnError: true,
              ),
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
      await _s.delete(key: _kSnapshot);
    } catch (_) {/* ignore */}
  }

  /// OXIRGI TASDIQLANGAN SESSIYA (`/api/auth/me` javobi) — tez start
  /// uchun. Token bilan bir joyda (Keychain/Keystore): unda email va
  /// telefon bor. Token o'chirilganda ([clear]) u ham o'chadi.
  static const _kSnapshot = 'nova.session.me';

  Future<String?> readSnapshot() async {
    try {
      return await _s.read(key: _kSnapshot);
    } catch (_) {
      return null;
    }
  }

  Future<void> writeSnapshot(String json) async {
    try {
      await _s.write(key: _kSnapshot, value: json);
    } catch (_) {/* saqlanmasa — keyingi start oddiy yo'l bilan */}
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
  static const _kSelPersonal = 'nova.selectedPersonal';
  static const _kSelBusiness = 'nova.selectedBusiness';
  static const _kSearches = 'nova.recentSearches';
  /// `.v2` — rozilik endi Google Gemini (sun'iy intellekt) bilan
  /// avtomatik tekshiruvni ham o'z ichiga oladi (App Store 5.1.2(i):
  /// uchinchi tomon AI'ga ma'lumot berishga ANIQ rozilik). Eski kalit
  /// (`nova.contentRulesAccepted`) bunga rozilik emas edi, shuning
  /// uchun avval rozi bo'lganlar ham darvozani BIR MARTA qayta ko'radi.
  static const _kRules = 'nova.contentRulesAccepted.v2';
  static const _kLock = 'nova.appLock';
  static const _kLockBio = 'nova.appLockBiometric';
  static const _kNotif = 'nova.notif.';
  static const _kCatalogFav = 'nova.catalogFavorites';
  static const _kSavedReels = 'nova.savedReels';
  static const _kAppFlags = 'nova.appFlags';
  /// `.v2` (TestFlight 331): 330–331 da saqlangan 🔇 BIR MARTA
  /// tashlanadi. Egasining telefonida u yoqilib qolgan edi (burchakda
  /// chizilgan karnay) va butun Ko'rgazma ilova qayta ochilsa ham jim
  /// turardi — o'sha paytda iPhone'da musiqa boshqa sababdan (audio
  /// sessiya, `audio_session.dart`) eshitilmasdi, ya'ni tugma "ovozni
  /// yoqish" deb bosilgan bo'lishi mumkin. Yangi kalitda standart —
  /// ovoz bor; keyin bosilgan 🔇 avvalgidek saqlanadi.
  static const _kShowcaseMuted = 'nova.showcaseMuted.v2';
  static const _kShowcaseMutedLegacy = 'nova.showcaseMuted';
  static const _kHomeAdHidden = 'nova.homeAdHiddenDay';
  static const _kHomeAdLaunch = 'nova.homeAdLaunch';

  String? get themeId => _p.getString(_kTheme);
  Future<void> setThemeId(String v) => _p.setString(_kTheme, v);

  String? get localeCode => _p.getString(_kLocale);
  Future<void> setLocaleCode(String v) => _p.setString(_kLocale, v);

  /// `personal` yoki `business` — ilova qaysi rejimda ochilgani.
  String? get mode => _p.getString(_kMode);
  Future<void> setMode(String v) => _p.setString(_kMode, v);

  /// Tanlangan shaxsiy NFC ID va kompaniya — ilova qayta ochilganda
  /// ham o'sha profil faol bo'lsin (Instagram hisob tanlovi kabi).
  String? get selectedPersonal => _p.getString(_kSelPersonal);
  Future<void> setSelectedPersonal(String? v) =>
      v == null ? _p.remove(_kSelPersonal) : _p.setString(_kSelPersonal, v);
  String? get selectedBusiness => _p.getString(_kSelBusiness);
  Future<void> setSelectedBusiness(String? v) =>
      v == null ? _p.remove(_kSelBusiness) : _p.setString(_kSelBusiness, v);

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

  // ── HISOBGA BOG'LANGAN KESH (audit 2026-10-06) ─────────────────
  //
  // Qidiruvlar, saqlangan Reels va katalog sevimlilari ilgari BITTA
  // umumiy kalitda turardi: bir telefonda hisob almashtirilsa, oldingi
  // odamning ro'yxati yangi hisobga "oqib" o'tardi (va keyingi sinxronda
  // uning serveriga yozilardi). Endi har biri `.u<id>` kalitida.
  //
  // ESKI UMUMIY KALIT: yangilanishdan keyin uni BIRINCHI ochgan hisob
  // oladi (u o'sha telefondagi hisob edi), kalit o'chiriladi.

  String _u(String base, int uid) => '$base.u$uid';

  List<String> _ofUser(String legacy, int uid) {
    final key = _u(legacy, uid);
    final mine = _p.getStringList(key);
    if (mine != null) return mine;
    final old = _p.getStringList(legacy);
    if (old == null) return const [];
    _p.setStringList(key, old);
    _p.remove(legacy);
    return old;
  }

  /// Joriy hisobning oxirgi qidiruvlari. Hisob yo'q — bo'sh.
  List<String> recentSearchesOf(int? uid) =>
      uid == null ? const [] : _ofUser(_kSearches, uid);

  /// Oxirgi 8 ta qidiruv, eng yangisi boshida, takrorlarsiz.
  Future<void> pushSearchFor(int? uid, String q) async {
    final s = q.trim();
    if (s.isEmpty || uid == null) return;
    final list =
        [s, ...recentSearchesOf(uid).where((e) => e != s)].take(8).toList();
    await _p.setStringList(_u(_kSearches, uid), list);
  }

  Future<void> clearSearchesFor(int? uid) async {
    if (uid == null) return;
    await _p.setStringList(_u(_kSearches, uid), const []);
  }

  String _savesKey(String kind) =>
      kind == 'reel' ? _kSavedReels : _kCatalogFav;

  /// Saqlanganlar keshi (`reel` / `listing`) — hisob bo'yicha.
  List<String> savesOf(String kind, int uid) => _ofUser(_savesKey(kind), uid);
  Future<void> setSavesOf(String kind, int uid, List<String> keys) =>
      _p.setStringList(_u(_savesKey(kind), uid), keys);

  /// Eski (faqat telefondagi) yozuvlar serverga BIR MARTA ko'chirildimi.
  bool savesMigrated(String kind, int uid) =>
      _p.getBool(_u('${_savesKey(kind)}.migrated', uid)) ?? false;
  Future<void> setSavesMigrated(String kind, int uid) =>
      _p.setBool(_u('${_savesKey(kind)}.migrated', uid), true);

  /// Serverga yetmagan bosishlar (`1:key` — saqlash, `0:key` — olib
  /// tashlash) — keyingi sinxronda qayta yuboriladi.
  List<String> savesPending(String kind, int uid) =>
      _p.getStringList(_u('${_savesKey(kind)}.pending', uid)) ?? const [];
  Future<void> setSavesPending(String kind, int uid, List<String> ops) =>
      _p.setStringList(_u('${_savesKey(kind)}.pending', uid), ops);

  /// ESKI umumiy kalit (hisobsiz) — faqat ko'chirish va sinov uchun.
  /// Ishlatiladigani: [savesOf].
  List<String> get catalogFavorites =>
      _p.getStringList(_kCatalogFav) ?? const [];
  Future<void> setCatalogFavorites(List<String> keys) =>
      _p.setStringList(_kCatalogFav, keys);

  /// ESKI umumiy kalit (hisobsiz) — faqat ko'chirish va sinov uchun.
  List<String> get savedReels => _p.getStringList(_kSavedReels) ?? const [];
  Future<void> setSavedReels(List<String> keys) =>
      _p.setStringList(_kSavedReels, keys);

  /// Server kalitlarining (`/api/app/config`) oxirgi muvaffaqiyatli
  /// javobi — JSON. Ilova tarmoqsiz ochilsa ham oxirgi holat bilan
  /// boshlanadi.
  String? get appFlagsJson => _p.getString(_kAppFlags);
  Future<void> setAppFlagsJson(String v) => _p.setString(_kAppFlags, v);

  /// Ko'rgazma musiqasi o'chirilganmi (burchakdagi 🔇). Sahifalar va
  /// ilova qayta ochilishi orasida saqlanadi. Standart — ovoz bor.
  bool get showcaseMuted => _p.getBool(_kShowcaseMuted) ?? false;
  Future<void> setShowcaseMuted(bool v) async {
    await _p.setBool(_kShowcaseMuted, v);
    // Eski kalit qolmasin (o'qilmaydi, faqat tozalanadi).
    if (_p.containsKey(_kShowcaseMutedLegacy)) {
      await _p.remove(_kShowcaseMutedLegacy);
    }
  }

  /// Asosiydagi Ko'rgazma reklama kartasi "×" bilan yopilgan kun
  /// (`YYYY-MM-DD`, telefon vaqti). Shu kun tugaguncha karta chiqmaydi.
  String get homeAdHiddenDay => _p.getString(_kHomeAdHidden) ?? '';
  Future<void> setHomeAdHiddenDay(String v) => _p.setString(_kHomeAdHidden, v);

  /// Ilova necha marta ochilgani — reklama kartasi navbat bilan
  /// almashishi uchun (BOY777, LOL707, ...).
  int get homeAdLaunch => _p.getInt(_kHomeAdLaunch) ?? 0;
  Future<void> setHomeAdLaunch(int v) => _p.setInt(_kHomeAdLaunch, v);
}
