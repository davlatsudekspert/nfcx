// GRAFIK KALIT — PIN BILAN BIR XIL DARAJADA HIMOYALANGANMI.
//
// Egasi dizayndagi "Xavfsizlik" ekranini ko'rsatib so'radi: u
// yerda PIN, GRAFIK KALIT, barmoq izi va Face ID bor edi —
// ilovada esa grafik kalit yo'q edi.
//
// Uni qo'shishda eng katta xavf: naqshni "yengilroq" saqlash
// (masalan ochiq matn bilan) yoki unga urinishlar chegarasini
// qo'ymaslik. O'shanda ilovada ikkita qulf bo'lardi — biri
// mustahkam, biri yo'q. Bu testlar aynan shuni qo'riqlaydi.
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/state/app_lock.dart';

import 'widget_test.dart' show FakeStore;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('NAQSHNING O‘ZI SAQLANMAYDI', () async {
    final data = <String, String>{};
    final lock = AppLock(storage: FakeStore(data));
    await lock.setPattern('01245');

    final saved = data.values.join(' ');
    expect(
      saved.contains('01245'),
      isFalse,
      reason: 'naqsh ochiq matnda saqlansa, qurilmani ochgan odam uni '
          'shundoq o‘qib olardi',
    );
  });

  test('TO‘G‘RI NAQSH OCHADI, XATOSI OCHMAYDI', () async {
    final lock = AppLock(storage: FakeStore());
    await lock.setPattern('01245');

    expect(await lock.verifyPattern('0124'), isFalse);
    expect(await lock.verifyPattern('54210'), isFalse);
    expect(await lock.verifyPattern('01245'), isTrue);
  });

  test('QISQA NAQSH QABUL QILINMAYDI', () async {
    final lock = AppLock(storage: FakeStore());
    expect(await lock.setPattern('012'), isFalse);
    expect(
      lock.enabled,
      isFalse,
      reason: 'uch nuqtali naqsh uzoqdan ham ko‘rinadi',
    );
  });

  test('URINISHLAR CHEGARASI NAQSHGA HAM AMAL QILADI', () async {
    // PIN va naqsh bitta hisoblagichni ishlatadi — aks holda
    // naqshni ketma-ket terib topish mumkin bo'lardi.
    final lock = AppLock(storage: FakeStore());
    await lock.setPattern('01245');

    for (var i = 0; i < AppLock.maxAttempts; i++) {
      expect(await lock.verifyPattern('87654'), isFalse);
    }
    expect(lock.lockoutLeft, greaterThan(0));
    expect(
      await lock.verifyPattern('01245'),
      isFalse,
      reason: 'kutish vaqtida to‘g‘ri naqsh ham ishlamasligi kerak',
    );
  });

  test('QULF TURI SAQLANADI — qayta ochilganda naqsh so‘raladi', () async {
    final store = FakeStore();
    await AppLock(storage: store).setPattern('01245');

    // Ilova qayta ishga tushdi.
    final again = AppLock(storage: store);
    await again.load();
    expect(again.enabled, isTrue);
    expect(again.isPattern, isTrue);
  });

  test('PIN GA QAYTISH — naqsh o‘chadi', () async {
    final store = FakeStore();
    final lock = AppLock(storage: store);
    await lock.setPattern('01245');
    await lock.setPin('4729');

    expect(lock.isPattern, isFalse);
    expect(await lock.verifyPin('4729'), isTrue);
    expect(
      await lock.verifyPattern('01245'),
      isFalse,
      reason: 'eski naqsh ishlab tursa, qulf ikki yo‘l bilan ochilardi',
    );
  });

  test('QULFNI O‘CHIRISH — tur ham tozalanadi', () async {
    final store = FakeStore();
    final lock = AppLock(storage: store);
    await lock.setPattern('01245');
    await lock.disable();

    final again = AppLock(storage: store);
    await again.load();
    expect(again.enabled, isFalse);
    expect(again.isPattern, isFalse);
  });
}
