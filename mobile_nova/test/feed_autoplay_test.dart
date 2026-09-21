import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/profile/music_player.dart';
import 'package:nfcstore_nova/features/social/visible_fraction.dart';

/// LENTADAGI VIDEO — "BIR VAQTDA BITTA" QOIDASI.
///
/// Qurilmada topilgan shikoyat: lentadagi video Instagram kabi
/// ishlamasdi — ko'ringanda o'zi boshlanmasdi, keyingisiga
/// o'tilganda avvalgisi to'xtamasdi.
void main() {
  group('dominantIndex', () {
    test('chegaradan past — hech kim o‘ynamaydi', () {
      expect(dominantIndex(const {0: 0.2, 1: 0.5, 2: 0.64}), isNull);
    });

    test('faqat chegaradan o‘tgani', () {
      expect(dominantIndex(const {0: 0.10, 1: 0.90}), 1);
    });

    test('bir nechta nomzoddan ENG KO‘RINGANI', () {
      expect(dominantIndex(const {0: 0.70, 1: 0.95, 2: 0.66}), 1);
    });

    test('ulush TENG bo‘lsa tepadagisi — natija BARQAROR', () {
      // Sekin siljishda ikki karta bir xil ulushda bo‘lishi mumkin.
      // Tartib `Map` ga qo‘shilish tartibiga bog‘liq bo‘lsa,
      // dominantlik ikkisi orasida sakrardi va video takror-takror
      // qayta boshlanardi.
      expect(dominantIndex(const {2: 0.8, 0: 0.8, 1: 0.8}), 0);
      expect(dominantIndex(const {0: 0.8, 1: 0.8, 2: 0.8}), 0);
    });

    test('bo‘sh ro‘yxat', () => expect(dominantIndex(const {}), isNull));

    test('chegara aynan — o‘tadi', () {
      expect(dominantIndex(const {0: 0.65}), 0);
      expect(dominantIndex(const {0: 0.6499}), isNull);
    });

    test('dominant ekrandan chiqsa boshqasiga o‘tadi', () {
      var f = {0: 0.95, 1: 0.10};
      expect(dominantIndex(f), 0);
      // Pastga siljidi: 0 chiqib ketdi, 1 to‘ldi.
      f = {0: 0.20, 1: 0.88};
      expect(dominantIndex(f), 1);
      // Ikkalasi ham yarim — HECH KIM o‘ynamaydi.
      f = {0: 0.45, 1: 0.45};
      expect(dominantIndex(f), isNull);
    });
  });

  group('VisibleFraction', () {
    testWidgets('ekrandagi ulushni o‘lchaydi va o‘zgarishni xabar qiladi',
        (tester) async {
      tester.view.physicalSize = const Size(400, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final seen = <double>[];
      final controller = ScrollController();
      addTearDown(controller.dispose);

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: ListView(
            controller: controller,
            children: [
              const SizedBox(height: 700),
              VisibleFraction(
                onChanged: seen.add,
                child: const SizedBox(height: 400, child: Text('video')),
              ),
              const SizedBox(height: 900),
            ],
          ),
        ),
      ));
      await tester.pumpAndSettle();

      // Boshida element deyarli ko‘rinmaydi (700px dan keyin
      // boshlanadi, ekran 800px).
      expect(seen.isNotEmpty, isTrue, reason: 'birinchi o‘lchov kelmadi');
      expect(seen.last, lessThan(0.4));

      // Pastga siljitamiz — element to‘liq ko‘rinadi.
      controller.jumpTo(700);
      await tester.pumpAndSettle();
      expect(seen.last, greaterThan(0.9),
          reason: 'to‘liq ko‘ringanda ulush ~1 bo‘lishi kerak');

      // Yana pastga — element tepadan chiqib ketadi.
      controller.jumpTo(1400);
      await tester.pumpAndSettle();
      expect(seen.last, lessThan(0.2));
    });
  });

  group('AudioOwner — bitta ovoz', () {
    test('yangi video egalikni olganda avvalgisi to‘xtaydi', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final owner = container.read(audioOwnerProvider);

      final stopped = <String>[];
      owner.take('video1', () => stopped.add('video1'));
      owner.take('video2', () => stopped.add('video2'));

      expect(stopped, ['video1'],
          reason: 'keyingi video dominant bo‘lganda oldingisi to‘xtashi kerak');
      expect(owner.current, 'video2');

      // Tab almashdi — HAMMASI to‘xtaydi.
      //
      // `video1` ikkinchi marta to‘xtatiladi va bu TO‘G‘RI: u
      // hali ekranda, reyestrda turibdi va yana dominant bo‘lishi
      // mumkin. To‘xtatuvchi idempotent, ya‘ni zarari yo‘q.
      stopped.clear();
      owner.stopAll();
      expect(stopped..sort(), ['video1', 'video2']);
      expect(owner.current, 'video2',
          reason: 'stopAll ijroni to‘xtatadi, egalikni tozalamaydi');
    });
  });
}
