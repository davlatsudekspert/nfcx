import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/settings/app_lock.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

/// AUDIT 2026-10-06 (2-qism): hisob almashganda shaxsiy ma'lumot
/// (qidiruvlar, ilova qulfi PIN'i) keyingi odamga o'tmaydi.

class _FakeSecure extends SecureStore {
  _FakeSecure([this.pin]) : super(const FlutterSecureStorage());
  String? pin;

  @override
  Future<String?> readPin() async => pin;
  @override
  Future<void> writePin(String p) async => pin = p;
  @override
  Future<void> deletePin() async => pin = null;
}

Future<void> _flush() => Future<void>.delayed(const Duration(milliseconds: 10));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('12. oxirgi qidiruvlar — hisob bo‘yicha', () {
    test('har hisobniki alohida; hisobsiz — bo‘sh', () async {
      SharedPreferences.setMockInitialValues({});
      final p = await Prefs.open();
      await p.pushSearchFor(1, 'yoga');
      await p.pushSearchFor(2, 'kafe');
      expect(p.recentSearchesOf(1), ['yoga']);
      expect(p.recentSearchesOf(2), ['kafe']);
      expect(p.recentSearchesOf(null), isEmpty);
      await p.clearSearchesFor(1);
      expect(p.recentSearchesOf(1), isEmpty);
      expect(p.recentSearchesOf(2), ['kafe']);
    });

    test('eski umumiy ro‘yxat — birinchi ochgan hisobga, bir marta', () async {
      SharedPreferences.setMockInitialValues({
        'nova.recentSearches': ['Tashkent'],
      });
      final p = await Prefs.open();
      expect(p.recentSearchesOf(7), ['Tashkent']);
      expect(p.recentSearchesOf(8), isEmpty,
          reason: 'keyingi hisobga oqib o‘tmaydi');
      expect(p.recentSearchesOf(7), ['Tashkent']);
    });
  });

  group('12. ilova qulfi chiqishda o‘chadi', () {
    Future<(ProviderContainer, _FakeSecure)> boot() async {
      final base = await testOverrides();
      final prefs = await Prefs.open();
      await prefs.setAppLock(true);
      final secure = _FakeSecure('1234');
      final c = ProviderContainer(overrides: [
        ...base,
        secureStoreProvider.overrideWithValue(secure),
      ]);
      addTearDown(c.dispose);
      c.listen(appLockSessionGuardProvider, (_, __) {});
      c.read(sessionProvider);
      await _flush();
      expect(c.read(sessionProvider), isA<SessionActive>());
      expect(c.read(appLockProvider).enabled, isTrue);
      return (c, secure);
    }

    test('qo‘lda chiqish — PIN va qulf o‘chadi', () async {
      final (c, secure) = await boot();
      await c.read(sessionProvider.notifier).logout();
      await _flush();
      expect(c.read(appLockProvider).enabled, isFalse);
      expect(c.read(prefsProvider).appLock, isFalse);
      expect(secure.pin, isNull);
    });

    test('sessiya tugadi (401) — PIN va qulf o‘chadi', () async {
      final (c, secure) = await boot();
      c.read(sessionProvider.notifier).expire();
      await _flush();
      expect(c.read(appLockProvider).enabled, isFalse);
      expect(secure.pin, isNull);
    });

    test('sessiya yangilanishi (refresh) qulfga tegmaydi', () async {
      final (c, secure) = await boot();
      await c.read(sessionProvider.notifier).refresh();
      await _flush();
      expect(c.read(appLockProvider).enabled, isTrue);
      expect(secure.pin, '1234');
    });
  });
}
