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
      final owner = container.read(audioOwnerProvider);

      var musicStopped = 0;
      final music = Object();
      final reel = Object();

      owner.take(music, () => musicStopped++);
      expect(container.read(audioOwnerProvider).current, music);
      expect(musicStopped, 0);

      owner.take(reel, () {});
      expect(container.read(audioOwnerProvider).current, reel);
      expect(musicStopped, 1, reason: 'reels ovoz olganda musiqa to‘xtaydi');
    });

    test('o‘zini qayta olish to‘xtatmaydi', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final owner = container.read(audioOwnerProvider);
      var stopped = 0;
      final me = Object();
      owner.take(me, () => stopped++);
      owner.take(me, () => stopped++);
      expect(stopped, 0);
    });

    // REELS SHU YERDA YIQILGANDI.
    //
    // `AudioOwner` ilgari `StateNotifier` edi va egalik `state`
    // ichida turardi. `_ReelPage.initState` -> `_open()` ->
    // `take()` zanjiri esa vidjet daraxti QURILAYOTGAN paytda
    // ishlardi, Riverpod esa buni taqiqlaydi:
    //
    //     Tried to modify a provider while the widget tree was building.
    //
    // E2E da u "failed after test completion" bo'lib chiqardi:
    // to'plamdagi har bir tekshiruv o'tsa ham ish qizil edi va
    // sabab matritsada UMUMAN ko'rinmasdi.
    //
    // Endi reyestr oddiy obyekt, shuning uchun uni hayot siklidan
    // chaqirish xavfsiz. Bu test aynan o'sha zanjirni takrorlaydi
    // va eski tuzilish qaytarilsa YIQILADI (o'lchab tekshirilgan).
    testWidgets('hayot siklidan chaqirish istisno OTMAYDI',
        (tester) async {
      var stopped = 0;
      await tester.pumpWidget(ProviderScope(
        child: MaterialApp(
          home: _LifecycleAudioProbe(onStop: () => stopped++),
        ),
      ));
      await tester.pump();
      expect(tester.takeException(), isNull,
          reason: '`initState` dan `take()` provayderni o‘zgartirdi');

      // `dispose()` dan `release()` ham xavfsiz bo‘lishi kerak.
      await tester.pumpWidget(ProviderScope(
        child: const MaterialApp(home: SizedBox.shrink()),
      ));
      await tester.pump();
      expect(tester.takeException(), isNull,
          reason: '`dispose` dan `release()` provayderni o‘zgartirdi');
      expect(stopped, 0);
    });

    test('release faqat o‘z egaligini bo‘shatadi', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final owner = container.read(audioOwnerProvider);
      final a = Object(), b = Object();
      owner.take(a, () {});
      owner.take(b, () {});
      owner.release(a); // a endi ega emas — holat o‘zgarmasligi kerak
      expect(container.read(audioOwnerProvider).current, b);
      owner.release(b);
      expect(container.read(audioOwnerProvider).current, isNull);
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


/// `_ReelPage` ning hayot siklini takrorlaydi: `initState` da
/// egalikni oladi, `dispose` da bo'shatadi.
class _LifecycleAudioProbe extends ConsumerStatefulWidget {
  const _LifecycleAudioProbe({required this.onStop});

  final VoidCallback onStop;

  @override
  ConsumerState<_LifecycleAudioProbe> createState() =>
      _LifecycleAudioProbeState();
}

class _LifecycleAudioProbeState extends ConsumerState<_LifecycleAudioProbe> {
  late final AudioOwner _owner;

  @override
  void initState() {
    super.initState();
    _owner = ref.read(audioOwnerProvider);
    _owner.take(this, widget.onStop);
  }

  @override
  void dispose() {
    _owner.release(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
