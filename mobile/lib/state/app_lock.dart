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

  bool _enabled = false;
  bool _biometricEnabled = false;
  bool _loaded = false;
  bool _unlocked = false;
  int _attempts = 0;
  DateTime? _lockedUntil;

  bool get enabled => _enabled;
  bool get biometricEnabled => _biometricEnabled;

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

  /// Ilova fondan qaytganda qayta qulflash.
  void lock() {
    if (!_enabled) return;
    _unlocked = false;
    notifyListeners();
  }
}
