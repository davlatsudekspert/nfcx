import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/repo.dart';
import 'package:nfcstore/state/app_lock.dart';
import 'widget_test.dart' show FakeStore;

void main() {
  group('Ilova qulfi', () {
    test('standart holatda qulf YO‘Q', () async {
      final lock = AppLock(storage: FakeStore());
      await lock.load();
      expect(lock.enabled, isFalse);
      expect(lock.locked, isFalse);
    });

    test('PIN kodning O‘ZI saqlanmaydi', () async {
      // Saqlangan qiymatdan PIN ni tiklab bo‘lmasligi kerak.
      final store = FakeStore();
      final lock = AppLock(storage: store);
      await lock.setPin('1234');

      final saved = await store.read(key: 'app_lock_pin');
      expect(saved, isNotNull);
      expect(saved, isNot('1234'));
      expect(saved, isNot(contains('1234')));
      expect(saved!.length, 64); // SHA-256 o‘n oltilik ko‘rinishda
    });

    test('bir xil PIN har qurilmada BOSHQA hash beradi', () async {
      // Tuz tasodifiy — ya'ni tayyor jadval bilan topib bo‘lmaydi.
      final a = FakeStore();
      final b = FakeStore();
      await AppLock(storage: a).setPin('1234');
      await AppLock(storage: b).setPin('1234');
      expect(await a.read(key: 'app_lock_pin'), isNot(await b.read(key: 'app_lock_pin')));
    });

    test('to‘g‘ri kod ochadi, xato kod ochmaydi', () async {
      final lock = AppLock(storage: FakeStore());
      await lock.setPin('4729');
      lock.lock();
      expect(lock.locked, isTrue);

      expect(await lock.verifyPin('0000'), isFalse);
      expect(lock.locked, isTrue);

      expect(await lock.verifyPin('4729'), isTrue);
      expect(lock.locked, isFalse);
    });

    test('beshta xatodan keyin kutish vaqti qo‘yiladi', () async {
      // Cheksiz urinishga yo‘l qo‘yilsa, 4 xonali kodni ketma-ket
      // terib topish mumkin (10 000 variant).
      final lock = AppLock(storage: FakeStore());
      await lock.setPin('1111');
      lock.lock();

      for (var i = 0; i < AppLock.maxAttempts; i++) {
        expect(await lock.verifyPin('9999'), isFalse);
      }
      expect(lock.lockoutLeft, greaterThan(0));
      // Kutish davomida TO‘G‘RI kod ham qabul qilinmaydi.
      expect(await lock.verifyPin('1111'), isFalse);
      expect(lock.locked, isTrue);
    });

    test('o‘chirilganda hamma iz tozalanadi', () async {
      final store = FakeStore();
      final lock = AppLock(storage: store);
      await lock.setPin('1234');
      await lock.setBiometric(true);
      await lock.disable();

      expect(lock.enabled, isFalse);
      expect(lock.biometricEnabled, isFalse);
      expect(await store.read(key: 'app_lock_pin'), isNull);
      expect(await store.read(key: 'app_lock_salt'), isNull);
      expect(await store.read(key: 'app_lock_biometric'), isNull);
    });

    test('PIN yo‘q bo‘lsa biometrika yoqilmaydi', () async {
      // Biometrika PIN ning O‘RNINI bosmaydi — u zaxira sifatida
      // doim kerak (barmoq ho‘l, qorong‘i va h.k.).
      final lock = AppLock(storage: FakeStore());
      await lock.setBiometric(true);
      expect(lock.biometricEnabled, isFalse);
    });

    test('fondan qaytganda qayta qulflanadi', () async {
      final lock = AppLock(storage: FakeStore());
      await lock.setPin('1234');
      expect(lock.locked, isFalse);
      lock.lock();
      expect(lock.locked, isTrue);
    });

    test('qulf yoqilmagan bo‘lsa `lock()` hech narsa qilmaydi', () async {
      final lock = AppLock(storage: FakeStore());
      await lock.load();
      lock.lock();
      expect(lock.locked, isFalse);
    });

    test('saqlangan qulf ilova ochilganda tiklanadi', () async {
      final store = FakeStore();
      await AppLock(storage: store).setPin('5555');

      // Yangi nusxa — ilova qaytadan ishga tushgandek.
      final fresh = AppLock(storage: store);
      await fresh.load();
      expect(fresh.enabled, isTrue);
      expect(fresh.locked, isTrue);
      expect(await fresh.verifyPin('5555'), isTrue);
    });
  });

  group('Katalog keshi', () {
    test('bir vaqtda kelgan ikki so‘rov BITTA so‘rov yuboradi', () async {
      // Home va Discover ilova ochilishida deyarli bir vaqtda
      // so‘raydi — 500 qatorlik javob ikki marta yuklanmasin.
      var calls = 0;
      final repo = Repo(Api(client: MockClient((_) async {
        calls++;
        await Future<void>.delayed(const Duration(milliseconds: 20));
        return http.Response(jsonEncode([{'code': 'AAA111', 'name': 'X'}]), 200);
      })));

      final results = await Future.wait([repo.catalog(), repo.catalog()]);
      expect(calls, 1);
      expect(results[0].length, 1);
      expect(results[1].length, 1);
    });

    test('ketma-ket so‘rov keshdan olinadi', () async {
      var calls = 0;
      final repo = Repo(Api(client: MockClient((_) async {
        calls++;
        return http.Response(jsonEncode([{'code': 'AAA111', 'name': 'X'}]), 200);
      })));

      await repo.catalog();
      await repo.catalog();
      await repo.catalog();
      expect(calls, 1);
    });

    test('tortib yangilash keshni chetlab o‘tadi', () async {
      var calls = 0;
      final repo = Repo(Api(client: MockClient((_) async {
        calls++;
        return http.Response(jsonEncode([{'code': 'AAA111', 'name': 'X'}]), 200);
      })));

      await repo.catalog();
      await repo.catalog(force: true);
      expect(calls, 2);
    });

    test('xato keshlanmaydi', () async {
      // Xato javob saqlanib qolsa, tarmoq tiklangandan keyin ham
      // ilova bo‘sh ro‘yxat ko‘rsatib turardi.
      var calls = 0;
      final repo = Repo(Api(client: MockClient((_) async {
        calls++;
        if (calls == 1) return http.Response('{"error":"boom"}', 500);
        return http.Response(jsonEncode([{'code': 'AAA111', 'name': 'X'}]), 200);
      })));

      await expectLater(repo.catalog(), throwsA(isA<ApiError>()));
      final list = await repo.catalog();
      expect(calls, 2);
      expect(list.length, 1);
    });
  });
}
