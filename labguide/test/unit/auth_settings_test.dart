import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/core/storage/kv_store.dart';
import 'package:labguide/features/auth/auth_controller.dart';
import 'package:labguide/features/auth/otp_auth.dart';
import 'package:labguide/features/content/content_controller.dart';
import 'package:labguide/features/settings/settings_controller.dart';
import 'package:material_ui/material_ui.dart' show ThemeMode;

void main() {
  group('DemoOtpAdapter', () {
    late DateTime now;
    late DemoOtpAdapter adapter;

    setUp(() {
      now = DateTime(2026, 10, 8, 12);
      adapter = DemoOtpAdapter(releaseBuild: false, clock: () => now);
    });

    test('valid flow: request → verify once', () async {
      final r = await adapter.requestCode('Doc@Example.com ');
      expect(r.status, OtpRequestStatus.sent);
      expect(r.debugCode, '123456');
      final v = await adapter.verifyCode('doc@example.com', '123456');
      expect(v.status, OtpVerifyStatus.verified);
      // Kod bir martalik.
      final again = await adapter.verifyCode('doc@example.com', '123456');
      expect(again.status, OtpVerifyStatus.noActiveCode);
    });

    test('invalid email is rejected', () async {
      for (final e in ['', 'a@', '@b.c', 'no-at.example.com', 'a b@c.dd']) {
        expect(
          (await adapter.requestCode(e)).status,
          OtpRequestStatus.invalidEmail,
          reason: e,
        );
      }
    });

    test('code expires after TTL', () async {
      await adapter.requestCode('a@b.co');
      now = now.add(const Duration(minutes: 5));
      expect(
        (await adapter.verifyCode('a@b.co', '123456')).status,
        OtpVerifyStatus.expired,
      );
    });

    test('attempt limit: 5 wrong codes lock the challenge', () async {
      await adapter.requestCode('a@b.co');
      for (var left = 4; left >= 1; left--) {
        final v = await adapter.verifyCode('a@b.co', '000000');
        expect(v.status, OtpVerifyStatus.invalidCode);
        expect(v.attemptsLeft, left);
      }
      expect(
        (await adapter.verifyCode('a@b.co', '000000')).status,
        OtpVerifyStatus.tooManyAttempts,
      );
      // To'g'ri kod ham endi qabul qilinmaydi.
      expect(
        (await adapter.verifyCode('a@b.co', '123456')).status,
        OtpVerifyStatus.tooManyAttempts,
      );
    });

    test('resend is rate limited for 60 s', () async {
      await adapter.requestCode('a@b.co');
      now = now.add(const Duration(seconds: 20));
      final limited = await adapter.requestCode('a@b.co');
      expect(limited.status, OtpRequestStatus.rateLimited);
      expect(limited.retryAfter, const Duration(seconds: 40));
      now = now.add(const Duration(seconds: 40));
      expect(
        (await adapter.requestCode('a@b.co')).status,
        OtpRequestStatus.sent,
      );
    });

    test('cannot be constructed in a release build', () {
      expect(() => DemoOtpAdapter(releaseBuild: true), throwsStateError);
    });
  });

  group('createOtpAdapter', () {
    test('debug build (tests run in debug) → demo adapter', () {
      expect(createOtpAdapter().isDemo, isTrue);
      // Release buildda tekshiruv: PROGRESS.md — libapp.so da DemoOtpAdapter
      // yo'qligi `strings` bilan tasdiqlangan.
    });

    test('release adapter never accepts the demo code', () async {
      const adapter = UnconfiguredOtpAdapter();
      expect(adapter.isAvailable, isFalse);
      expect(
        (await adapter.requestCode('a@b.co')).status,
        OtpRequestStatus.unavailable,
      );
      expect(
        (await adapter.verifyCode('a@b.co', '123456')).status,
        OtpVerifyStatus.unavailable,
      );
    });
  });

  group('AuthController', () {
    test('guest session persists; demo email session does not', () async {
      final store = MemoryKeyValueStore();
      final auth = AuthController(store, DemoOtpAdapter(releaseBuild: false));
      await auth.continueAsGuest();
      expect(
        AuthController(store, const UnconfiguredOtpAdapter()).session,
        isA<GuestSession>(),
      );

      await auth.requestCode('a@b.co');
      final v = await auth.verifyCode('123456');
      expect(v.status, OtpVerifyStatus.verified);
      expect(auth.session, isA<EmailSession>());
      expect((auth.session! as EmailSession).isDemo, isTrue);
      // Qayta ochilganda demo hisob tiklanmaydi.
      final restored = AuthController(store, const UnconfiguredOtpAdapter());
      expect(restored.hasAccount, isFalse);
    });

    test('verify without a pending request', () async {
      final auth = AuthController(
        MemoryKeyValueStore(),
        DemoOtpAdapter(releaseBuild: false),
      );
      expect(
        (await auth.verifyCode('123456')).status,
        OtpVerifyStatus.noActiveCode,
      );
    });
  });

  group('SettingsController', () {
    test('language from system locale, falls back to uz', () {
      expect(
        SettingsController(
          MemoryKeyValueStore(),
          systemLocales: const [Locale('de'), Locale('ru', 'RU')],
        ).language,
        AppLanguage.ru,
      );
      expect(
        SettingsController(
          MemoryKeyValueStore(),
          systemLocales: const [Locale('fr')],
        ).language,
        AppLanguage.uz,
      );
    });

    test('choices persist across restarts', () async {
      final store = MemoryKeyValueStore();
      final s = SettingsController(store, systemLocales: const [Locale('en')]);
      await s.setLanguage(AppLanguage.ru);
      await s.setThemeMode(ThemeMode.dark);
      await s.setRole(AppRole.teacher);
      await s.completeOnboarding();
      final r = SettingsController(store, systemLocales: const [Locale('en')]);
      expect(r.language, AppLanguage.ru);
      expect(r.themeMode, ThemeMode.dark);
      expect(r.role, AppRole.teacher);
      expect(r.onboarded, isTrue);
    });
  });

  group('BookmarksController', () {
    test('toggle and restore on reopen', () async {
      final store = MemoryKeyValueStore();
      final b = BookmarksController(store);
      expect(await b.toggle('glucose-plasma-fasting'), isTrue);
      expect(await b.toggle('alt'), isTrue);
      expect(await b.toggle('alt'), isFalse);
      expect(BookmarksController(store).ids, ['glucose-plasma-fasting']);
    });
  });

  test('memory store rejects keys missing from the allow-list', () {
    expect(
      () => MemoryKeyValueStore().setString('unknown.key', 'x'),
      throwsArgumentError,
    );
  });
}
