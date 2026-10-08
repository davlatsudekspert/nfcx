import 'package:flutter/foundation.dart';

/// Email OTP autentifikatsiyasi uchun adapter shartnomasi.
///
/// Production adapter kodni **serverda** yaratadi va tekshiradi: muddat,
/// urinishlar soni va qayta yuborish limiti server tomonida majburiy.
/// Ilova kodni hech qachon o'zi tekshirmaydi.
abstract interface class OtpAuthAdapter {
  /// Debug demo adapterimi (UI buni aniq belgilaydi).
  bool get isDemo;

  /// Xizmat umuman sozlanganmi. `false` bo'lsa UI kirish formasini emas,
  /// "hali ulanmagan" holatini ko'rsatadi.
  bool get isAvailable;

  Future<OtpRequestResult> requestCode(String email);

  Future<OtpVerifyResult> verifyCode(String email, String code);
}

enum OtpRequestStatus { sent, invalidEmail, rateLimited, unavailable, failed }

@immutable
class OtpRequestResult {
  const OtpRequestResult(
    this.status, {
    this.retryAfter,
    this.validFor,
    this.debugCode,
  });

  final OtpRequestStatus status;

  /// [OtpRequestStatus.rateLimited] yoki muvaffaqiyatli yuborishdan keyingi
  /// qayta yuborish oralig'i.
  final Duration? retryAfter;

  /// Kodning amal qilish muddati.
  final Duration? validFor;

  /// Faqat demo adapter to'ldiradi; release buildda doim `null`.
  final String? debugCode;
}

enum OtpVerifyStatus {
  verified,
  invalidCode,
  expired,
  tooManyAttempts,
  noActiveCode,
  unavailable,
  failed,
}

@immutable
class OtpVerifyResult {
  const OtpVerifyResult(this.status, {this.attemptsLeft});

  final OtpVerifyStatus status;
  final int? attemptsLeft;
}

final _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');

String normalizeEmail(String raw) => raw.trim().toLowerCase();

bool isValidEmail(String raw) {
  final email = normalizeEmail(raw);
  return email.length <= 254 && _emailPattern.hasMatch(email);
}

/// Haqiqiy email xizmati hali sozlanmagan buildlar (jumladan release)
/// uchun. Hech qanday kodni qabul qilmaydi.
class UnconfiguredOtpAdapter implements OtpAuthAdapter {
  const UnconfiguredOtpAdapter();

  @override
  bool get isDemo => false;

  @override
  bool get isAvailable => false;

  @override
  Future<OtpRequestResult> requestCode(String email) async =>
      const OtpRequestResult(OtpRequestStatus.unavailable);

  @override
  Future<OtpVerifyResult> verifyCode(String email, String code) async =>
      const OtpVerifyResult(OtpVerifyStatus.unavailable);
}

/// Faqat debug buildda ishlaydigan demo adapter: email yubormaydi, kodni
/// UI ga ko'rsatadi. Server xatti-harakatini taqlid qiladi — muddat,
/// urinish limiti va qayta yuborish oralig'i — shunda ekran holatlarini
/// backendsiz ham tekshirish mumkin.
class DemoOtpAdapter implements OtpAuthAdapter {
  DemoOtpAdapter({
    required bool releaseBuild,
    DateTime Function()? clock,
    this.code = '123456',
    this.ttl = const Duration(minutes: 5),
    this.resendCooldown = const Duration(seconds: 60),
    this.maxAttempts = 5,
  }) : _clock = clock ?? DateTime.now {
    if (releaseBuild) {
      throw StateError('DemoOtpAdapter must never be created in release.');
    }
  }

  final DateTime Function() _clock;
  final String code;
  final Duration ttl;
  final Duration resendCooldown;
  final int maxAttempts;

  final Map<String, _DemoChallenge> _challenges = {};

  @override
  bool get isDemo => true;

  @override
  bool get isAvailable => true;

  @override
  Future<OtpRequestResult> requestCode(String email) async {
    if (!isValidEmail(email)) {
      return const OtpRequestResult(OtpRequestStatus.invalidEmail);
    }
    final key = normalizeEmail(email);
    final now = _clock();
    final existing = _challenges[key];
    if (existing != null) {
      final nextAllowed = existing.issuedAt.add(resendCooldown);
      if (now.isBefore(nextAllowed)) {
        return OtpRequestResult(
          OtpRequestStatus.rateLimited,
          retryAfter: nextAllowed.difference(now),
        );
      }
    }
    _challenges[key] = _DemoChallenge(issuedAt: now);
    return OtpRequestResult(
      OtpRequestStatus.sent,
      retryAfter: resendCooldown,
      validFor: ttl,
      debugCode: code,
    );
  }

  @override
  Future<OtpVerifyResult> verifyCode(String email, String input) async {
    final key = normalizeEmail(email);
    final challenge = _challenges[key];
    if (challenge == null || challenge.consumed) {
      return const OtpVerifyResult(OtpVerifyStatus.noActiveCode);
    }
    if (!_clock().isBefore(challenge.issuedAt.add(ttl))) {
      return const OtpVerifyResult(OtpVerifyStatus.expired);
    }
    if (challenge.attempts >= maxAttempts) {
      return const OtpVerifyResult(OtpVerifyStatus.tooManyAttempts);
    }
    challenge.attempts++;
    if (input.trim() != code) {
      final left = maxAttempts - challenge.attempts;
      return left <= 0
          ? const OtpVerifyResult(OtpVerifyStatus.tooManyAttempts)
          : OtpVerifyResult(OtpVerifyStatus.invalidCode, attemptsLeft: left);
    }
    challenge.consumed = true;
    return const OtpVerifyResult(OtpVerifyStatus.verified);
  }
}

class _DemoChallenge {
  _DemoChallenge({required this.issuedAt});

  final DateTime issuedAt;
  int attempts = 0;
  bool consumed = false;
}

/// Buildga mos adapterni tanlaydi. Release va profile buildlarda demo
/// adapter hech qachon qaytmaydi — demo kod qabul qilinmaydi.
OtpAuthAdapter createOtpAdapter({
  bool debugBuild = kDebugMode,
  bool releaseBuild = kReleaseMode,
}) {
  if (debugBuild && !releaseBuild) {
    return DemoOtpAdapter(releaseBuild: releaseBuild);
  }
  return const UnconfiguredOtpAdapter();
}
