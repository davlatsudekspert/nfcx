import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/features/settings/app_lock.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Xotiradagi Keystore o'rinbosari.
class _FakeSecure extends SecureStore {
  _FakeSecure() : super(const FlutterSecureStorage());
  String? _pin;

  @override
  Future<String?> readPin() async => _pin;
  @override
  Future<void> writePin(String pin) async => _pin = pin;
  @override
  Future<void> deletePin() async => _pin = null;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<ProviderContainer> container({bool locked = false}) async {
    SharedPreferences.setMockInitialValues(
      locked ? {'nova.appLock': true} : {},
    );
    final prefs = await Prefs.open();
    final c = ProviderContainer(overrides: [
      prefsProvider.overrideWithValue(prefs),
      secureStoreProvider.overrideWithValue(_FakeSecure()),
    ]);
    addTearDown(c.dispose);
    return c;
  }

  group('App Lock', () {
    test('STANDART HOLAT — o‘chiq va qulflanmagan', () async {
      final c = await container();
      final s = c.read(appLockProvider);
      expect(s.enabled, isFalse);
      expect(s.locked, isFalse);
    });

    test('yoqilgan bo‘lsa ilova QULFLANGAN holda ochiladi', () async {
      final c = await container(locked: true);
      expect(c.read(appLockProvider).locked, isTrue);
    });

    test('PIN o‘rnatilgandan keyin qulf yoqiladi va ekran ochiq qoladi',
        () async {
      final c = await container();
      await c.read(appLockProvider.notifier).enable('1234');
      final s = c.read(appLockProvider);
      expect(s.enabled, isTrue);
      // Sozlamada turib qulflab qo'yish mantiqsiz bo'lardi.
      expect(s.locked, isFalse);
    });

    test('to‘g‘ri PIN ochadi, noto‘g‘risi ochmaydi', () async {
      final c = await container();
      final lock = c.read(appLockProvider.notifier);
      await lock.enable('1234');
      lock.lockNow();
      expect(c.read(appLockProvider).locked, isTrue);

      expect(await lock.verify('9999'), isFalse);
      expect(c.read(appLockProvider).locked, isTrue,
          reason: 'noto‘g‘ri PIN qulfni ochmasligi kerak');

      expect(await lock.verify('1234'), isTrue);
      expect(c.read(appLockProvider).locked, isFalse);
    });

    test('qulf o‘chirilsa PIN ham o‘chadi', () async {
      final c = await container();
      final lock = c.read(appLockProvider.notifier);
      await lock.enable('1234');
      await lock.disable();
      expect(c.read(appLockProvider).enabled, isFalse);
      // PIN o'chgani uchun eski kod endi ishlamaydi.
      expect(await lock.verify('1234'), isFalse);
    });

    test('PIN `SharedPreferences` ga YOZILMAYDI', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await Prefs.open();
      final c = ProviderContainer(overrides: [
        prefsProvider.overrideWithValue(prefs),
        secureStoreProvider.overrideWithValue(_FakeSecure()),
      ]);
      addTearDown(c.dispose);
      await c.read(appLockProvider.notifier).enable('4321');

      final raw = await SharedPreferences.getInstance();
      for (final k in raw.getKeys()) {
        expect('${raw.get(k)}', isNot(contains('4321')),
            reason: 'PIN ochiq saqlanmasligi kerak: $k');
      }
    });

    test('qulf yoqilmagan bo‘lsa lockNow hech narsa qilmaydi', () async {
      final c = await container();
      c.read(appLockProvider.notifier).lockNow();
      expect(c.read(appLockProvider).locked, isFalse);
    });
  });

  group('AppLockGate', () {
    testWidgets('qulf o‘chiq bo‘lsa kontent ko‘rinadi', (tester) async {
      final c = await container();
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: const MaterialApp(
          home: AppLockGate(child: Text('kontent')),
        ),
      ));
      expect(find.text('kontent'), findsOneWidget);
    });
  });
}
