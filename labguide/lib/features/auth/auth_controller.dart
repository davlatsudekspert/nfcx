import 'package:flutter/foundation.dart';

import '../../core/storage/kv_store.dart';
import 'otp_auth.dart';

/// Joriy sessiya. Kontentni o'qish uchun sessiya shart emas: mehmon ham
/// barcha o'qish ekranlarini ko'radi. Hisob faqat sinxronlash, guruh va
/// xaridni bog'lash uchun kerak.
sealed class AuthSession {
  const AuthSession();
}

class GuestSession extends AuthSession {
  const GuestSession();
}

class EmailSession extends AuthSession {
  const EmailSession(this.email, {required this.isDemo});

  final String email;

  /// Debug demo adapter orqali ochilgan sessiya — server hisob emas.
  final bool isDemo;
}

class AuthController extends ChangeNotifier {
  AuthController(this._store, this.adapter) : _session = _restore(_store);

  final KeyValueStore _store;
  final OtpAuthAdapter adapter;

  AuthSession? _session;
  String? _pendingEmail;
  OtpRequestResult? _lastRequest;

  AuthSession? get session => _session;
  bool get hasAccount => _session is EmailSession;
  String? get pendingEmail => _pendingEmail;
  OtpRequestResult? get lastRequest => _lastRequest;

  Future<void> continueAsGuest() async {
    _session = const GuestSession();
    notifyListeners();
    await _store.setString(StoreKeys.session, 'guest');
  }

  Future<OtpRequestResult> requestCode(String email) async {
    final result = await adapter.requestCode(email);
    if (result.status == OtpRequestStatus.sent) {
      _pendingEmail = normalizeEmail(email);
      _lastRequest = result;
      notifyListeners();
    }
    return result;
  }

  Future<OtpVerifyResult> verifyCode(String code) async {
    final email = _pendingEmail;
    if (email == null) {
      return const OtpVerifyResult(OtpVerifyStatus.noActiveCode);
    }
    final result = await adapter.verifyCode(email, code);
    if (result.status == OtpVerifyStatus.verified) {
      _session = EmailSession(email, isDemo: adapter.isDemo);
      _pendingEmail = null;
      _lastRequest = null;
      notifyListeners();
      // Demo sessiya qayta ochilganda tiklanmaydi: release foydalanuvchisi
      // hech qachon demo hisob bilan qolmasligi uchun faqat haqiqiy
      // sessiya belgisi saqlanadi (token keyingi bosqichda secure storage).
      if (!adapter.isDemo) {
        await _store.setString(StoreKeys.session, 'email:$email');
      } else {
        await _store.setString(StoreKeys.session, 'guest');
      }
    }
    return result;
  }

  Future<void> signOut() async {
    _session = null;
    _pendingEmail = null;
    _lastRequest = null;
    notifyListeners();
    await _store.remove(StoreKeys.session);
  }

  static AuthSession? _restore(KeyValueStore store) {
    final raw = store.getString(StoreKeys.session);
    if (raw == 'guest') return const GuestSession();
    if (raw != null && raw.startsWith('email:')) {
      return EmailSession(raw.substring(6), isDemo: false);
    }
    return null;
  }
}
