import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/social/feed_card.dart';
import 'package:nfcstore_nova/features/social/inline_video.dart';
import 'package:nfcstore_nova/features/social/media_frame.dart';

import 'helpers.dart';

/// VIDEO UMRI — LENTADA.
///
/// Uchta qoida tekshiriladi:
///
///   1. Lentada video O'ZI BOSHLANMAYDI. Ilgari standart qiymat
///      `autoPlayVideo: true` edi: ekranda beshta video post
///      bo'lsa beshtasi ham ochilardi — beshta dekoder, beshta
///      tarmoq so'rovi va ketma-ket ovoz egaligini tortib olish.
///   2. Kontroller odam bosmaguncha QURILMAYDI (`lazy`). Mobil
///      internet qimmat: ko'rilmagan video uchun trafik sarflash
///      odamning pulini so'ramasdan ishlatish bo'lardi.
///   3. Mavjud joylar (profil panjarasi posteri, post ekrani)
///      O'ZGARMAYDI — `lazy` alohida bayroq, standarti `false`.
///
/// HAQIQIY VIDEO O'YNATILMAYDI: `video_player` platforma plagini
/// va test muhitida u yo'q. Tekshirilayotgan narsa — ILOVANING
/// QARORI: qaysi rejim uzatiladi va kontroller umuman
/// quriladimi.
void main() {
  Post videoPost(int id) => Post(
        id: id,
        code: 'VIP001',
        authorName: 'Muallif',
        mediaUrls: const ['https://example.com/a.mp4'],
        isVideo: true,
      );

  Future<void> pumpCard(WidgetTester tester, Post p) async {
    await tester.pumpWidget(ProviderScope(
      overrides: await testOverrides(),
      child: wrapScreen(
        Scaffold(body: ListView(children: [FeedCard(post: p)])),
      ),
    ));
    await settle(tester, frames: 12);
  }

  group('Lentada video o‘zi boshlanmaydi', () {
    testWidgets('AdaptiveMedia avtomatik ijrosiz uzatiladi', (tester) async {
      await pumpCard(tester, videoPost(1));
      final media = tester.widget<AdaptiveMedia>(find.byType(AdaptiveMedia));
      expect(media.isVideo, isTrue);
      expect(media.autoPlayVideo, isFalse,
          reason: 'lentadagi video o‘zi boshlanadi — beshta post '
              'beshta dekoder ochadi va trafik sarflaydi');
    });

    testWidgets('bosish bilan ijro YOQILGAN', (tester) async {
      await pumpCard(tester, videoPost(1));
      final media = tester.widget<AdaptiveMedia>(find.byType(AdaptiveMedia));
      expect(media.tapToToggleVideo, isTrue,
          reason: 'avtomatik ijro o‘chirilgan, lekin bosish ham '
              'ishlamaydi — video umuman ko‘rib bo‘lmaydi');
    });

    testWidgets('kontroller DANGASA — bosilmaguncha qurilmaydi',
        (tester) async {
      await pumpCard(tester, videoPost(1));
      final media = tester.widget<AdaptiveMedia>(find.byType(AdaptiveMedia));
      expect(media.lazyVideo, isTrue);

      final inline = tester.widget<InlineVideo>(find.byType(InlineVideo));
      expect(inline.lazy, isTrue);
      expect(inline.autoPlay, isFalse);
    });

    testWidgets('dangasa holatda IJRO tugmasi ko‘rinadi', (tester) async {
      // Bo'sh kulrang quti "yuklanmadi" degan taassurot qoldirardi;
      // aslida video joyida va bir bosishda ochiladi.
      await pumpCard(tester, videoPost(1));
      expect(find.byIcon(Icons.play_circle_fill_rounded), findsOneWidget);
    });

    testWidgets('rasm postida video kontrolleri UMUMAN yo‘q',
        (tester) async {
      await pumpCard(tester, const Post(
        id: 2,
        code: 'VIP001',
        mediaUrls: ['https://example.com/a.jpg'],
      ));
      expect(find.byType(InlineVideo), findsNothing);
    });
  });

  group('`lazy` MAVJUD joylarni buzmaydi', () {
    test('standart qiymat — false', () {
      // Profil panjarasi `autoPlay: false` ni POSTER sifatida
      // ishlatadi: kontroller ochiladi va birinchi kadr ko‘rinadi.
      // `lazy` ni `autoPlay` ga bog‘lash uni kulrang qutiga
      // aylantirib qo‘yardi.
      const v = InlineVideo(url: 'x', autoPlay: false);
      expect(v.lazy, isFalse);
      expect(v.autoPlay, isFalse);
    });

    test('AdaptiveMedia standarti ham false', () {
      const m = AdaptiveMedia(url: 'x', isVideo: true);
      expect(m.lazyVideo, isFalse);
      expect(m.autoPlayVideo, isTrue);
    });
  });

  group('Ilova fonga ketganda', () {
    testWidgets('InlineVideo lifecycle kuzatuvchisi RO‘YXATDAN O‘TADI',
        (tester) async {
      // `story_viewer.dart` va `music_player.dart` fonni
      // kuzatardi, ichki video esa yo‘q — ya'ni lentadagi video
      // o‘ynayotganda telefon boshqa ilovaga o‘tsa OVOZ DAVOM
      // ETARDI.
      await tester.pumpWidget(ProviderScope(
        overrides: await testOverrides(),
        child: wrapScreen(const Scaffold(
          body: SizedBox(
            height: 200,
            child: InlineVideo(url: 'https://example.com/a.mp4', lazy: true),
          ),
        )),
      ));
      await settle(tester, frames: 8);

      // Holat obyekti `WidgetsBindingObserver` ni aralashtirganmi.
      final state = tester.state(find.byType(InlineVideo));
      expect(state, isA<WidgetsBindingObserver>(),
          reason: 'ichki video ilova fonga ketganini kuzatmaydi');

      // Fonga o‘tkazish qulatmasligi kerak.
      tester.binding
          .handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await settle(tester, frames: 4);
      expect(tester.takeException(), isNull);

      tester.binding
          .handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await settle(tester, frames: 4);
      expect(tester.takeException(), isNull);
    });
  });
}
