// TORTIB YANGILASH RO'YXATNI UZOQ USHLAB TURMAYDIMI.
//
// EGASI BUNI UCH MARTA XABAR QILDI: "bosh sahifa to'liq tepaga
// qaytmaydi", "tepaga tortsam dirillab tortilmayapti".
//
// Sabab `RefreshIndicator` ning tabiatida: u o'ziga berilgan
// `Future` tugaguncha ro'yxatni ushlab turadi. Ekranning yangilash
// funksiyasi esa serverdan javob kutadi va so'rov muddati 20
// soniya. Ya'ni odam eng tepaga yetishi bilan yangilash ishga
// tushib, ro'yxat o'sha joyda qotib qolardi.
//
// Bu test o'sha o'lchovni qo'riqlaydi: so'rov qancha cho'zilsa ham
// belgi bir necha soniyadan ortiq ushlanmasligi kerak.
import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/design/refresh.dart';

void main() {
  group('pullRefresh', () {
    test('SO‘ROV CHO‘ZILSA — belgi baribir bo‘shaydi', () {
      fakeAsync((async) {
        void elapse(Duration d) => async.elapse(d);
        // Hech qachon tugamaydigan so'rov — eng yomon holat.
        var released = false;
        pullRefresh(() => Completer<void>().future).then((_) {
          released = true;
        });

        elapse(const Duration(seconds: 3));
        expect(released, isFalse, reason: 'erta bo‘shatmasin');

        elapse(const Duration(seconds: 3));
        expect(
          released,
          isTrue,
          reason: 'so‘rov tugamasa ham belgi bo‘shashi SHART — aks holda '
              'ro‘yxat qotib qoladi va tepaga qaytib bo‘lmaydi',
        );
      });
    });

    test('SO‘ROV TEZ TUGASA — darhol bo‘shaydi', () async {
      final sw = Stopwatch()..start();
      await pullRefresh(() async {});
      sw.stop();
      expect(sw.elapsed, lessThan(const Duration(seconds: 1)));
    });

    test('SO‘ROV XATO BERSA — xato yutilmaydi', () async {
      // Yangilash yiqilsa ekran buni ko'rsatishi kerak. Bu yerda
      // xato yutilsa, ekran "yangilandi" deb o'ylab eski
      // ma'lumotni ko'rsatib turardi.
      await expectLater(
        pullRefresh(() async => throw StateError('server')),
        throwsA(isA<StateError>()),
      );
    });
  });
}
