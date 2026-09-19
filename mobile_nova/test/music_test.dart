import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/profile/music_player.dart';

import 'helpers.dart';

void main() {
  group('Musiqa manbasi — backend', () {
    test('musicUrls ro‘yxat sifatida o‘qiladi', () {
      final id = NfcId.fromJson(const {
        'code': '48210377',
        'musicUrls': ['https://a/1.mp3', 'https://a/2.mp3'],
      });
      expect(id.musicUrls, ['https://a/1.mp3', 'https://a/2.mp3']);
    });

    test('eski yozuvdagi bitta musicUrl ham qabul qilinadi', () {
      final id = NfcId.fromJson(const {
        'code': '48210377',
        'musicUrl': 'https://a/old.mp3',
      });
      expect(id.musicUrls, ['https://a/old.mp3']);
    });

    test('maydon bo‘lmasa ro‘yxat BO‘SH — to‘qilmaydi', () {
      final id = NfcId.fromJson(const {'code': '48210377'});
      expect(id.musicUrls, isEmpty);
    });

    test('server ko‘pi bilan 5 ta saqlaydi — ilova ham shuncha o‘qiydi', () {
      final id = NfcId.fromJson({
        'code': 'X',
        'musicUrls': List.generate(9, (i) => 'https://a/$i.mp3'),
      });
      expect(id.musicUrls.length, 5);
    });

    test('bo‘sh va noto‘g‘ri qiymatlar tashlab yuboriladi', () {
      final id = NfcId.fromJson(const {
        'code': 'X',
        'musicUrls': ['', '  ', 'https://a/ok.mp3', 42],
      });
      expect(id.musicUrls, ['https://a/ok.mp3']);
    });
  });

  group('MusicControl', () {
    testWidgets('musiqa YO‘Q bo‘lsa boshqaruv umuman chizilmaydi',
        (tester) async {
      await tester.pumpWidget(ProviderScope(
        child: wrapScreen(
          const Center(child: MusicControl(urls: [], size: 28)),
        ),
      ));
      await tester.pump();
      expect(find.byIcon(Icons.music_note_rounded), findsNothing);
      // Hech qanday bosiladigan yuza qoldirmaydi.
      expect(tester.getSize(find.byType(MusicControl)), Size.zero);
    });

    testWidgets('musiqa BOR bo‘lsa boshqaruv ko‘rinadi', (tester) async {
      await tester.pumpWidget(ProviderScope(
        child: wrapScreen(
          const Center(
            child: MusicControl(urls: ['https://a/1.mp3'], size: 28),
          ),
        ),
      ));
      await tester.pump();
      expect(find.byIcon(Icons.music_note_rounded), findsOneWidget);
    });
  });

  group('Audio egaligi', () {
    test('yangi egasi kelganda avvalgisi TO‘XTATILADI', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final owner = container.read(audioOwnerProvider.notifier);

      var musicStopped = 0;
      final music = Object();
      final reel = Object();

      owner.take(music, () => musicStopped++);
      expect(container.read(audioOwnerProvider), music);
      expect(musicStopped, 0);

      owner.take(reel, () {});
      expect(container.read(audioOwnerProvider), reel);
      expect(musicStopped, 1, reason: 'reels ovoz olganda musiqa to‘xtaydi');
    });

    test('o‘zini qayta olish to‘xtatmaydi', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final owner = container.read(audioOwnerProvider.notifier);
      var stopped = 0;
      final me = Object();
      owner.take(me, () => stopped++);
      owner.take(me, () => stopped++);
      expect(stopped, 0);
    });

    test('release faqat o‘z egaligini bo‘shatadi', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final owner = container.read(audioOwnerProvider.notifier);
      final a = Object(), b = Object();
      owner.take(a, () {});
      owner.take(b, () {});
      owner.release(a); // a endi ega emas — holat o‘zgarmasligi kerak
      expect(container.read(audioOwnerProvider), b);
      owner.release(b);
      expect(container.read(audioOwnerProvider), isNull);
    });
  });

  group('Qo‘shiq nomi', () {
    test('manzildan o‘qiladi, ijrochi TO‘QILMAYDI', () {
      // Backend'da nom/ijrochi maydoni yo'q — faqat manzil bor.
      expect(musicTitleOf('https://nfcstore.uz/uploads/night_drive.mp3'),
          'night drive');
      expect(musicTitleOf('/uploads/My%20Track.m4a'), 'My Track');
      expect(musicTitleOf('https://a/b/'), 'https://a/b/');
    });
  });
}
