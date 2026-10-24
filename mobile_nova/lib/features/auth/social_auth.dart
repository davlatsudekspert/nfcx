/// "Apple bilan" va "Google bilan" kirish — IKKALA SDK BITTA JOYDA.
///
/// Ekranlar bu yerdan faqat [SocialCredential] oladi. Qaysi SDK qanday
/// chaqiriladi, nonce qanday hisoblanadi, bekor qilish qanday xatodan
/// ajratiladi — hammasi shu faylda qoladi. Aks holda bu tafsilotlar
/// kirish va ro'yxat ekranlarida ikki nusxa bo'lardi.
///
/// ────────────────────────────────────────────────────────────────
/// MIJOZ HECH NARSANI HAL QILMAYDI
///
/// Bu fayl hisobni OCHMAYDI va kimligini ANIQLAMAYDI. U faqat
/// provayderdan imzolangan `idToken` oladi va serverga uzatadi.
/// Kim ekanini, hisob yangimi yoki eskimi — buni FAQAT server,
/// imzoni tekshirgandan keyin aytadi (`POST /api/auth/social`).
///
/// ────────────────────────────────────────────────────────────────
/// MIJOZ ID'LARI QOTIRILMAGAN
///
/// Ular [SocialAuthConfig] da, serverdan keladi
/// (`GET /api/auth/social/config`). Sabab: ID sir emas, lekin
/// ALMASHISHI mumkin — client qayta yaratilsa yoki iOS uchun yangisi
/// qo'shilsa, qotirilgan qiymat bilan yangi versiya chiqarishga
/// to'g'ri kelardi va yangilamagan odam hisobiga kira olmay qolardi.
library;

import 'dart:convert';
import 'dart:io' show Platform;

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart' show kIsWeb, visibleForTesting;
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';


/// Serverdan kelgan sozlama.
class SocialAuthConfig {
  const SocialAuthConfig({
    this.googleEnabled = false,
    this.googleServerClientId = '',
    this.googleIosClientId = '',
    this.appleEnabled = false,
    this.appleServiceId = '',
    this.appleRedirectUri = '',
  });

  factory SocialAuthConfig.fromJson(Map<String, dynamic> json) {
    // `as Map?` EMAS, `is Map`. Server kutilmagan narsa qaytarsa
    // (eski versiya, proksi xato sahifasi) tur almashtirish ISTISNO
    // tashlardi va kirish ekrani umuman ochilmasdi. Test shuni
    // topdi (`social_login_test.dart`: "bo'sh yoki buzuq JSON").
    final rawG = json['google'];
    final rawA = json['apple'];
    final g = rawG is Map ? rawG.cast<String, dynamic>() : const <String, dynamic>{};
    final a = rawA is Map ? rawA.cast<String, dynamic>() : const <String, dynamic>{};
    String s(Object? v) => v is String ? v : '';
    return SocialAuthConfig(
      googleEnabled: g['enabled'] == true,
      googleServerClientId: s(g['serverClientId']),
      googleIosClientId: s(g['iosClientId']),
      appleEnabled: a['enabled'] == true,
      appleServiceId: s(a['serviceId']),
      appleRedirectUri: s(a['redirectUri']),
    );
  }

  final bool googleEnabled;

  /// Android AYNAN shu (Web) client ID bilan ishlaydi — Android client
  /// ID bilan EMAS. Android client faqat ilova imzosini Google'ga
  /// tanitadi, token esa Web ID ga tegishli bo'ladi. Google'ning eng
  /// ko'p chalkashtiradigan joyi aynan shu.
  final String googleServerClientId;

  /// iOS'da `google_sign_in` ilovaning O'Z client ID sini ham so'raydi.
  final String googleIosClientId;

  final bool appleEnabled;

  /// Apple'ning "Services ID" si — ANDROID va sayt uchun. iOS'da Apple
  /// ilovaning bundle ID sini o'zi biladi, bu yerda hech narsa kerak emas.
  final String appleServiceId;
  final String appleRedirectUri;

  /// Tugma KO'RSATILADIMI.
  ///
  /// Ishlamaydigan tugmani ko'rsatib qo'yish — eng yomon variant: odam
  /// bosadi, hech narsa bo'lmaydi va u ilovani buzuq deb o'ylaydi.
  bool get showGoogle {
    if (!googleEnabled || googleServerClientId.isEmpty) return false;
    // iOS'da o'z client ID siz SDK umuman ishga tushmaydi.
    if (!kIsWeb && Platform.isIOS && googleIosClientId.isEmpty) return false;
    return true;
  }

  bool get showApple {
    if (!appleEnabled) return false;
    if (kIsWeb) return false;
    // iOS/macOS — tizimning o'zi, qo'shimcha sozlama kerak emas.
    if (Platform.isIOS || Platform.isMacOS) return true;
    // Android — veb oqimi: Services ID va qaytish manzili SHART.
    return appleServiceId.isNotEmpty && appleRedirectUri.isNotEmpty;
  }
}

enum SocialProvider {
  apple('apple'),
  google('google');

  const SocialProvider(this.wire);

  /// Serverga yuboriladigan nom (`{"provider": "..."}`).
  final String wire;
}

/// Provayderdan olingan, SERVERDA tekshiriladigan dalil.
class SocialCredential {
  const SocialCredential({
    required this.provider,
    required this.idToken,
    this.nonce,
    this.name,
    this.authorizationCode,
  });

  final SocialProvider provider;
  final String idToken;

  /// XOM nonce. Server uning SHA-256 ini hisoblab, token ichidagi
  /// `nonce` bilan solishtiradi — ya'ni tokenni ushlab qolgan odam
  /// uni qayta ishlata olmaydi.
  final String? nonce;

  /// APPLE: bir martalik kod. Server uni `refresh_token` ga
  /// almashtiradi va hisob o'chirilganda Apple'dan tokenni BEKOR
  /// QILISH uchun ishlatadi — bu App Store'ning talabi (5.1.1(v)),
  /// usiz ilova App Review'dan o'tmaydi.
  ///
  /// Kodni faqat SERVER ishlata oladi: almashtirish uchun `.p8`
  /// kaliti bilan imzolangan mijoz siri kerak, u esa ilovada yo'q
  /// va bo'lmasligi ham kerak.
  final String? authorizationCode;

  /// Apple ismni FAQAT BIR MARTA, eng birinchi ruxsatda beradi.
  /// Keyingi kirishlarda u umuman kelmaydi — shuning uchun server
  /// uni aynan hisob ochilayotganda saqlaydi.
  final String? name;
}

/// Odam oynani yopdi. Bu XATO EMAS: ekranda qizil yozuv chiqmasligi
/// kerak, shunchaki hech narsa bo'lmaydi.
class SocialCancelled implements Exception {
  const SocialCancelled();
}

/// Kirib bo'lmadi va sababi odamga ko'rsatiladi.
class SocialFailed implements Exception {
  const SocialFailed(this.detail);

  /// Faqat tuzatuvchi uchun texnik qator — ekranda kichik kulrang
  /// yozuv bo'lib turadi. Odamga mo'ljallangan jumla ekranning o'zida.
  final String detail;

  @override
  String toString() => 'SocialFailed($detail)';
}

/// Ikkala SDK ustidagi yupqa qobiq.
class SocialAuth {
  SocialAuth({SocialAuthConfig? config}) : _config = config;

  SocialAuthConfig? _config;

  /// `GoogleSignIn.instance.initialize` ni paket FAQAT BIR MARTA
  /// chaqirishni talab qiladi ("undefined behavior" deb yozilgan).
  bool _googleReady = false;

  set config(SocialAuthConfig? value) => _config = value;

  /// Testlar uchun: SDK chaqirilmasdan natija beriladi.
  @visibleForTesting
  Future<SocialCredential?> Function(SocialProvider)? override;

  Future<SocialCredential?> signIn(SocialProvider provider) {
    final stub = override;
    if (stub != null) return stub(provider);
    return switch (provider) {
      SocialProvider.apple => _apple(),
      SocialProvider.google => _google(),
    };
  }

  // ── APPLE ────────────────────────────────────────────────────────
  Future<SocialCredential?> _apple() async {
    final cfg = _config;
    if (cfg == null || !cfg.showApple) throw const SocialFailed('apple_not_configured');

    // XOM nonce bizda qoladi, Apple'ga uning SHA-256 i beriladi.
    // Server xomidan xeshni qayta hisoblab solishtiradi.
    final raw = generateNonce();
    final hashed = sha256.convert(utf8.encode(raw)).toString();

    try {
      final cred = await SignInWithApple.getAppleIDCredential(
        scopes: const [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: hashed,
        // FAQAT ANDROID uchun. iOS'da bu berilsa, tizim oynasi
        // o'rniga brauzer ochilib ketardi — ya'ni xulq yomonlashardi.
        webAuthenticationOptions: _needsWebFlow
            ? WebAuthenticationOptions(
                clientId: cfg.appleServiceId,
                redirectUri: Uri.parse(cfg.appleRedirectUri),
              )
            : null,
      );

      final token = cred.identityToken;
      if (token == null || token.isEmpty) {
        throw const SocialFailed('apple_no_identity_token');
      }
      return SocialCredential(
        provider: SocialProvider.apple,
        idToken: token,
        nonce: raw,
        name: _joinName(cred.givenName, cred.familyName),
        authorizationCode: cred.authorizationCode,
      );
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) throw const SocialCancelled();
      throw SocialFailed('apple_${e.code.name}');
    } on SignInWithAppleNotSupportedException {
      throw const SocialFailed('apple_not_supported');
    } on SignInWithAppleException catch (e) {
      throw SocialFailed('apple_${e.runtimeType}');
    }
  }

  bool get _needsWebFlow => !kIsWeb && !Platform.isIOS && !Platform.isMacOS;

  // ── GOOGLE ───────────────────────────────────────────────────────
  Future<SocialCredential?> _google() async {
    final cfg = _config;
    if (cfg == null || !cfg.showGoogle) throw const SocialFailed('google_not_configured');

    try {
      if (!_googleReady) {
        // NONCE BERILMAYDI — ATAYLAB.
        //
        // `initialize` nonce'ni qabul qiladi, lekin paket uni FAQAT
        // BIR MARTA chaqirishni talab qiladi. Ya'ni nonce butun ilova
        // umriga bitta bo'lib qolardi — bu "har urinishga yangi
        // nonce" qoidasini buzadi va hech qanday himoya bermaydi.
        //
        // Himoya yo'qolmaydi: token baribir imzolangan, qisqa
        // muddatli va BIZNING `aud` ga bog'langan. Server nonce'siz
        // tokenni shu sababdan qabul qiladi (`api/auth-social.js`).
        await GoogleSignIn.instance.initialize(
          serverClientId: cfg.googleServerClientId,
          clientId: cfg.googleIosClientId.isEmpty ? null : cfg.googleIosClientId,
        );
        _googleReady = true;
      }

      if (!GoogleSignIn.instance.supportsAuthenticate()) {
        throw const SocialFailed('google_not_supported');
      }

      final account = await GoogleSignIn.instance.authenticate();
      final token = account.authentication.idToken;
      if (token == null || token.isEmpty) {
        throw const SocialFailed('google_no_id_token');
      }
      return SocialCredential(
        provider: SocialProvider.google,
        idToken: token,
        name: account.displayName,
      );
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) throw const SocialCancelled();
      throw SocialFailed('google_${e.code.name}');
    }
  }

  /// Chiqish: keyingi safar hisob tanlash oynasi qaytib chiqsin.
  ///
  /// Bu Google tomoni; bizning sessiyani `SessionController` yopadi.
  /// Apple'da bunday chaqiruv yo'q va kerak emas — u tizim hisobi.
  Future<void> signOut() async {
    if (!_googleReady) return;
    try {
      await GoogleSignIn.instance.signOut();
    } catch (_) {
      // Chiqish o'xshamasa ham ilovadagi sessiya baribir yopiladi.
    }
  }

  static String? _joinName(String? given, String? family) {
    final parts = [given, family].where((p) => p != null && p.trim().isNotEmpty);
    if (parts.isEmpty) return null;
    return parts.map((p) => p!.trim()).join(' ');
  }
}
