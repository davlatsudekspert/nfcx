import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import '../l10n/strings.dart';

/// ILOVA QULFI — PIN kod va barmoq izi / yuz.
///
/// NIMA UCHUN KERAK: NFCSTORE hisobida odamning shaxsiy kontaktlari,
/// biznesi va to'lov tarixi turadi. Telefon birov qo'liga tushsa,
/// ilova ochiq qolgan bo'lsa — hammasi ochiq.
///
/// PIN QANDAY SAQLANADI: kodning O'ZI hech qayerda saqlanmaydi.
/// Tasodifiy "tuz" (salt) bilan birga SHA-256 hash olinadi va faqat u
/// saqlanadi — ya'ni saqlangan qiymatdan PIN ni tiklab bo'lmaydi.
/// Hash Keystore/Keychain ichida turadi (SharedPreferences EMAS).
///
/// BIOMETRIK MA'LUMOT ILOVAGA BERILMAYDI: tizim faqat
/// "tasdiqlandi/yo'q" javobini qaytaradi, barmoq izining o'zi hech
/// qachon ilovaga kelmaydi.
class AppLock extends ChangeNotifier {
  AppLock({FlutterSecureStorage? storage, LocalAuthentication? auth})
      : _storage = storage ?? const FlutterSecureStorage(),
        _auth = auth ?? LocalAuthentication();

  final FlutterSecureStorage _storage;
  final LocalAuthentication _auth;

  static const _pinKey = 'app_lock_pin';
  static const _saltKey = 'app_lock_salt';
  static const _bioKey = 'app_lock_biometric';
  static const _delayKey = 'app_lock_delay';

  /// PIN uzunligi. To'rt raqam — telefon qulfi bilan bir xil odat.
  static const pinLength = 4;

  /// Noto'g'ri urinishlar chegarasi.
  ///
  /// Cheksiz urinishga yo'l qo'yilsa, 4 xonali PIN ni ketma-ket terib
  /// topish mumkin (10 000 variant). Beshta xatodan keyin kutish
  /// vaqti qo'yiladi — bu qurilmani qo'lga kiritgan odamni to'xtatadi,
  /// haqiqiy egaga esa deyarli sezilmaydi.
  static const maxAttempts = 5;
  static const lockoutSeconds = 30;

  /// AVTO-QULF KECHIKISHI — ilova fonga ketgandan keyin qancha
  /// vaqt o'tib qulflanadi.
  ///
  /// NIMA UCHUN TANLOV KERAK: ilgari qulf DOIM darhol tushardi.
  /// Bu eng xavfsizi, lekin kun bo'yi kartalarni ulashib yurgan
  /// odam uchun azob: har safar kameraga yoki xabarga chiqib
  /// qaytganda PIN terishga majbur. Natijada odam qulfni butunlay
  /// o'chirib qo'yadi — ya'ni qattiq sozlama xavfsizlikni
  /// OSHIRMAYDI, kamaytiradi.
  ///
  /// `null` — hech qachon (faqat ilova butunlay yopilganda).
  static const delays = <({String id, String label, Duration? after})>[
    (id: 'now', label: 'Darhol', after: Duration.zero),
    (id: '30s', label: '30 soniyadan keyin', after: Duration(seconds: 30)),
    (id: '1m', label: '1 daqiqadan keyin', after: Duration(minutes: 1)),
    (id: '5m', label: '5 daqiqadan keyin', after: Duration(minutes: 5)),
    (id: 'never', label: 'Hech qachon', after: null),
  ];

  bool _enabled = false;
  bool _biometricEnabled = false;
  bool _loaded = false;
  bool _unlocked = false;
  int _attempts = 0;
  DateTime? _lockedUntil;

  /// Joriy kechikish. Standart — darhol: xavfsizroq tomoni.
  String _delayId = 'now';

  /// Ilova fonga ketgan payt. `lock()` emas, aynan shu vaqt
  /// saqlanadi: qaytishda qancha o'tgani shundan hisoblanadi.
  DateTime? _backgroundAt;

  bool get enabled => _enabled;
  bool get biometricEnabled => _biometricEnabled;
  String get delayId => _delayId;

  Duration? get delay =>
      delays.firstWhere((d) => d.id == _delayId, orElse: () => delays.first)
          .after;

  String get delayLabel =>
      delays.firstWhere((d) => d.id == _delayId, orElse: () => delays.first)
          .label;

  /// Qulf sozlamasi saqlagichdan O'QIB BO'LINDIMI.
  ///
  /// NIMA UCHUN KERAK: `load()` asinxron. Uni kutmasdan turib
  /// `locked` `false` qaytaradi — ya'ni bir lahza uchun qulflangan
  /// ilova ochiq ko'rinadi. Tashqi havola (NFC karta) aynan shu
  /// lahzada kelsa, qulf ustidan o'tib ketardi.
  bool get loaded => _loaded;

  /// Qulf yoqilgan bo'lsa va hali ochilmagan bo'lsa — ekran to'siladi.
  bool get locked => _enabled && !_unlocked;

  int get attemptsLeft => maxAttempts - _attempts;

  /// Kutish tugashiga qolgan soniya. 0 — kutish yo'q.
  int get lockoutLeft {
    final until = _lockedUntil;
    if (until == null) return 0;
    final left = until.difference(DateTime.now()).inSeconds;
    return left > 0 ? left : 0;
  }

  Future<void> load() async {
    try {
      _enabled = (await _storage.read(key: _pinKey))?.isNotEmpty ?? false;
      _biometricEnabled = (await _storage.read(key: _bioKey)) == '1';
      final d = await _storage.read(key: _delayKey);
      if (d != null && delays.any((e) => e.id == d)) _delayId = d;
    } catch (_) {
      // Keystore vaqtincha ochilmasa — qulf yo'q deb hisoblaymiz.
      // Aks holda odam o'z ilovasidan butunlay chiqib qolardi.
      _enabled = false;
      _biometricEnabled = false;
    }
    _unlocked = !_enabled;
    _loaded = true;
    notifyListeners();
  }

  /// Qurilmada barmoq izi yoki yuz sozlanganmi.
  Future<bool> biometricAvailable() async {
    try {
      if (!await _auth.isDeviceSupported()) return false;
      if (!await _auth.canCheckBiometrics) return false;
      return (await _auth.getAvailableBiometrics()).isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  String _hash(String pin, String salt) =>
      sha256.convert(utf8.encode('$salt:$pin')).toString();

  /// Tasodifiy tuz — har qurilmada boshqacha, ya'ni bir xil PIN ikki
  /// telefonda bir xil hash bermaydi.
  String _newSalt() {
    final now = DateTime.now().microsecondsSinceEpoch;
    final rnd = Object().hashCode ^ identityHashCode(this);
    return sha256.convert(utf8.encode('$now:$rnd')).toString().substring(0, 32);
  }

  Future<void> setPin(String pin) async {
    final salt = _newSalt();
    await _storage.write(key: _saltKey, value: salt);
    await _storage.write(key: _pinKey, value: _hash(pin, salt));
    _enabled = true;
    _unlocked = true;
    _attempts = 0;
    notifyListeners();
  }

  Future<void> disable() async {
    await _storage.delete(key: _pinKey);
    await _storage.delete(key: _saltKey);
    await _storage.delete(key: _bioKey);
    _enabled = false;
    _biometricEnabled = false;
    _unlocked = true;
    notifyListeners();
  }

  Future<void> setBiometric(bool on) async {
    // Biometrika PIN ning O'RNINI bosmaydi, ustiga qo'shiladi: tizim
    // biometrikani tanimay qolsa (barmoq ho'l, qorong'i) PIN doim
    // zaxira bo'lib qoladi.
    if (on && !_enabled) return;
    await _storage.write(key: _bioKey, value: on ? '1' : '0');
    _biometricEnabled = on;
    notifyListeners();
  }

  /// PIN tekshirish. `false` — noto'g'ri yoki kutish vaqti hali tugamagan.
  Future<bool> verifyPin(String pin) async {
    if (lockoutLeft > 0) return false;
    String? salt;
    String? stored;
    try {
      salt = await _storage.read(key: _saltKey);
      stored = await _storage.read(key: _pinKey);
    } catch (_) {
      return false;
    }
    if (salt == null || stored == null) return false;

    if (_hash(pin, salt) != stored) {
      _attempts++;
      if (_attempts >= maxAttempts) {
        _lockedUntil = DateTime.now().add(const Duration(seconds: lockoutSeconds));
        _attempts = 0;
      }
      notifyListeners();
      return false;
    }
    _attempts = 0;
    _lockedUntil = null;
    _unlocked = true;
    notifyListeners();
    return true;
  }

  /// Barmoq izi / yuz bilan ochish.
  Future<bool> unlockWithBiometric() async {
    if (!_biometricEnabled) return false;
    try {
      final ok = await _auth.authenticate(
        localizedReason: tr('NFCSTORE ni ochish uchun tasdiqlang'),
        options: const AuthenticationOptions(
          biometricOnly: false,
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );
      if (ok) {
        _unlocked = true;
        _attempts = 0;
        _lockedUntil = null;
        notifyListeners();
      }
      return ok;
    } catch (_) {
      return false;
    }
  }

  Future<void> setDelay(String id) async {
    if (!delays.any((d) => d.id == id)) return;
    _delayId = id;
    notifyListeners();
    try {
      await _storage.write(key: _delayKey, value: id);
    } catch (_) {
      // Saqlanmasa joriy sessiyada baribir amal qiladi.
    }
  }

  /// ILOVA FONGA KETDI — vaqt belgilanadi.
  ///
  /// Qulf SHU YERDA tushmaydi (kechikish "darhol" bo'lmasa):
  /// qaytishda qancha vaqt o'tgani hisoblanadi.
  void onBackground() {
    if (!_enabled) return;
    _backgroundAt = DateTime.now();
    if (delay == Duration.zero) lock();
  }

  /// ILOVA QAYTDI — kechikish o'tgan bo'lsa qulflanadi.
  void onForeground() {
    if (!_enabled) return;
    final d = delay;
    final at = _backgroundAt;
    _backgroundAt = null;
    // "Hech qachon" — faqat ilova butunlay yopilganda qulflanadi
    // (u holda `load()` `_unlocked` ni yolg'on qoldiradi).
    if (d == null || at == null) return;
    if (DateTime.now().difference(at) >= d) lock();
  }

  /// Darhol qulflash — chiqish va sozlamalar uchun.
  void lock() {
    if (!_enabled) return;
    _unlocked = false;
    notifyListeners();
  }
}
