import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/showcase/ad_video_loader.dart';
import 'package:nfcstore_nova/features/social/inline_video.dart';
import 'package:nfcstore_nova/features/social/media_sound.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:video_player/video_player.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// KO'RGAZMA: MINIMAL BELGILAR + REKLAMA BUTUN EKRANDA + LENTA VIDEOSI
/// (egasi, 2026-10-10, iPhone):
///
/// * "ekranda yozuv ko'p" — sahifada faqat muallif, sarlavha va BITTA
///   tugma; izoh, musiqa, aloqa, narx, qo'shimcha havolalar — varaqda;
/// * "reklama to'liqroq chiqishi kerak, bosganda ovozli" — video reklamani
///   bosish butun ekranli pleer (musiqa o'ynaydi, × bilan yopiladi);
/// * Asosiydagi LOL707 posti: pushti kadr + cheksiz aylana, 🔊 ovoz
///   bermaydi (video ovozsiz, musiqani esa hech kim o'ynatmasdi).

Map<String, dynamic> _music(int id) => {
      'id': id,
      'title': 'Yurak',
      'artist': 'NeomSongs',
      'audioUrl': '/uploads/music_$id.mp3',
      'clipUrl': '',
      'start': 0,
    };

final _rich = Post.fromJson({
  'id': 50,
  'code': 'C7',
  'authorName': 'Ali Market',
  'authorKind': 'company',
  'showcase': true,
  'title': 'Qizil ko‘ylak',
  'priceUzs': 125000,
  'text': 'Yangi kolleksiya keldi',
  'linkUrl': 'https://youtu.be/dQw4w9WgXcQ',
  'catalogItem': {
    'id': 'b9fa1d77-794a-4b7a-b972-aecb1dce7c02',
    'companyId': 'C7',
    'name': 'Ko‘ylak',
  },
  'contact': {'phone': '+998901234567', 'telegram': 'https://t.me/ali'},
  'mediaUrls': ['/uploads/p50.jpg'],
  'imageUrl': '/uploads/p50.jpg',
  'music': _music(61),
});

final _lol = Post.fromJson({
  'id': 55,
  'code': 'NFCSTOREUZ',
  'authorKind': 'company',
  'showcase': true,
  'ad': true,
  'featured': true,
  'title': 'LOL707 — chiroyli NFC ID',
  'text': 'Reklama matni — varaqda',
  'imageUrl': '/promo/nfcstore-lol707.jpg',
  'videoUrl': '/uploads/promo_lol707_720.mp4',
  'mediaUrls': ['/uploads/promo_lol707_720.mp4'],
  'mediaItems': [
    {'url': '/uploads/promo_lol707_720.mp4', 'type': 'video'},
  ],
  'linkUrl': 'https://www.instagram.com/reel/Ddy4e1cjVY9/',
  'music': _music(29),
});

class _Repo extends FakeSocialRepository {
  _Repo(this.items);
  final List<Post> items;

  @override
  Future<Result<ReelsPage>> showcasePage(
          {String? cursor, int limit = 10}) async =>
      Ok(ReelsPage(items: items));

  @override
  Future<Result<ReelsPage>> showcaseAds({int limit = 4}) async =>
      const Ok(ReelsPage());
}

Future<void> _frames(WidgetTester tester, [int n = 30]) async {
  for (var i = 0; i < n; i++) {
    await tester.pump(const Duration(milliseconds: 50));
    if (i % 5 == 0) {
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 5)));
    }
  }
}

String _name(FakeVideoPlatform v, int id) => v.urls[id]!.split('/').last;

Set<String> _playing(FakeVideoPlatform v) =>
    {for (final id in v.playing) _name(v, id)};

int _player(FakeVideoPlatform v, String file) =>
    v.urls.entries.lastWhere((e) => e.value.endsWith(file)).key;

Future<({ProviderContainer c, FakeVideoPlatform v})> _app(
  WidgetTester tester,
  List<Post> items, {
  void Function(FakeVideoPlatform v)? setup,
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final v = FakeVideoPlatform();
  setup?.call(v);
  VideoPlayerPlatform.instance = v;
  final base = await testOverrides();
  final c = ProviderContainer(overrides: [
    ...base,
    socialRepositoryProvider.overrideWithValue(_Repo(items)),
  ]);
  addTearDown(c.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(container: c, child: const NovaApp()),
  );
  await _frames(tester, 40);
  c.read(routerProvider).go(Routes.showcase);
  await _frames(tester, 40);
  return (c: c, v: v);
}

Future<void> _end(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(minutes: 1));
}

Finder _k(String key) => find.byKey(ValueKey(key));

double _posterOpacity(WidgetTester tester, String key) =>
    tester.widget<AnimatedOpacity>(find.descendant(
        of: _k(key), matching: find.byKey(const ValueKey('poster-until-playing')))).opacity;

void main() {
  setUpAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/path_provider'),
            (_) async => Directory.systemTemp.createTempSync('nova').path);
  });

  testWidgets(
      'Rasm sahifasi MINIMAL: izoh, musiqa, narx, qo‘shimcha havola '
      'ko‘rinmaydi (biznes aloqasi sahifada); «Batafsil» varag‘ida qolgani', (tester) async {
    await _app(tester, [_rich]);
    // Sahifada: sarlavha, «Batafsil» va BITTA tugma (tovar).
    expect(_k('showcase-title'), findsOneWidget);
    expect(_k('showcase-info-button'), findsOneWidget);
    expect(_k('showcase-product'), findsOneWidget);
    // Yo'q: izoh, "ko'proq", musiqa, aloqa, narx, ikkilamchi havola.
    expect(find.text('Yangi kolleksiya keldi'), findsNothing);
    expect(find.text('ko‘proq'), findsNothing);
    expect(_k('showcase-music'), findsNothing);
    expect(find.byKey(const ValueKey('music-chip')), findsNothing);
    // Biznes aloqasi (Qo'ng'iroq/Telegram) sahifada qoladi (egasi).
    expect(_k('showcase-contact'), findsOneWidget);
    expect(_k('showcase-price'), findsNothing);
    expect(_k('showcase-video'), findsNothing);
    expect(_k('showcase-instagram'), findsNothing);
    expect(_k('showcase-link'), findsNothing);

    // Sarlavha/«Batafsil» bosiladi -> varaq.
    await tester.tap(_k('showcase-info-button'));
    await _frames(tester, 12);
    expect(_k('showcase-info-sheet'), findsOneWidget);
    expect(find.text('Yangi kolleksiya keldi'), findsOneWidget);
    expect(_k('showcase-price'), findsOneWidget);
    expect(_k('showcase-info-music'), findsOneWidget);
    expect(_k('showcase-info-contact'), findsNothing,
        reason: 'aloqa sahifada — varaqda takrorlanmaydi');
    expect(_k('showcase-info-product'), findsOneWidget);
    expect(_k('showcase-info-video'), findsOneWidget,
        reason: 'hamma havolalar varaqda');
    await _end(tester);
  });

  testWidgets(
      'Reklama sahifasi: «Reklama» belgisi + sarlavha + bitta tugma; izoh '
      'varaqda. Bosish -> butun ekran, MUSIQA o‘ynaydi, × yopadi',
      (tester) async {
    final r = await _app(tester, [_lol]);
    expect(_k('showcase-sponsored'), findsOneWidget);
    expect(_k('showcase-title'), findsOneWidget);
    expect(_k('showcase-instagram'), findsOneWidget);
    expect(find.text('Reklama matni — varaqda'), findsNothing);
    expect(_k('showcase-contact'), findsNothing);
    expect(_playing(r.v), {'promo_lol707_720.mp4', 'music_29.mp3'});
    final pageVideo = _player(r.v, 'promo_lol707_720.mp4');

    // Reklamani bosish -> butun ekranli pleer.
    await tester.tap(_k('showcase-ad-video'));
    await _frames(tester, 40);
    expect(_k('ad-fullscreen'), findsOneWidget);
    expect(_k('ad-fullscreen-close'), findsOneWidget);
    expect(_k('ad-fullscreen-mute'), findsOneWidget);
    expect(_k('ad-fullscreen-cta'), findsOneWidget);
    // Sahifaning o'z pleeri pauzada; butun ekranda yangi video + musiqa.
    expect(r.v.playing.contains(pageVideo), isFalse);
    expect(_playing(r.v), {'promo_lol707_720.mp4', 'music_29.mp3'});
    final fsVideo = _player(r.v, 'promo_lol707_720.mp4');
    expect(fsVideo, isNot(pageVideo));
    final fsMusic = _player(r.v, 'music_29.mp3');
    expect(r.v.playing.contains(fsMusic), isTrue);
    expect(r.v.volumeOf[fsVideo], 0.0, reason: 'video audiosiz — musiqa');
    expect(r.v.volumeOf[fsMusic], 1.0, reason: 'ovozli');

    // Poster ilk kadr yurgunча turadi, pozitsiya > 0 bo'lgach yo'qoladi.
    expect(_posterOpacity(tester, 'ad-fullscreen-poster'), 0.0);

    // 🔇 — musiqa ovozi o'chadi, qayta bosilsa yoqiladi.
    await tester.tap(_k('ad-fullscreen-mute'));
    await _frames(tester, 6);
    expect(r.v.volumeOf[fsMusic], 0.0);
    await tester.tap(_k('ad-fullscreen-mute'));
    await _frames(tester, 6);
    expect(r.v.volumeOf[fsMusic], 1.0);

    // × — sahifaga qaytadi, avvalgidek davom etadi.
    await tester.tap(_k('ad-fullscreen-close'));
    await _frames(tester, 40);
    expect(_k('ad-fullscreen'), findsNothing);
    expect(r.v.alive.contains(fsVideo), isFalse, reason: 'pleer yopildi');
    expect(r.v.alive.contains(fsMusic), isFalse);
    expect(_playing(r.v), {'promo_lol707_720.mp4', 'music_29.mp3'},
        reason: 'sahifaning videosi va musiqasi qaytadan');
    await _end(tester);
  });

  testWidgets(
      'Rasm sahifasida bosish — toza rejim (butun ekran FAQAT reklama '
      'videosida)', (tester) async {
    await _app(tester, [_rich]);
    await tester.tapAt(const Offset(195, 300));
    await _frames(tester, 20);
    expect(_k('ad-fullscreen'), findsNothing);
    await _end(tester);
  });

  group('Lenta videosi (InlineVideo)', () {
    Future<({FakeVideoPlatform v, ProviderContainer c})> pumpInline(
      WidgetTester tester, {
      void Function(FakeVideoPlatform v)? setup,
      String url = 'https://nfcstore.uz/uploads/promo_lol707_720.mp4',
    }) async {
      final v = FakeVideoPlatform();
      setup?.call(v);
      VideoPlayerPlatform.instance = v;
      final base = await testOverrides();
      final c = ProviderContainer(overrides: base);
      addTearDown(c.dispose);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: MaterialApp(
          theme: buildTheme(NfcTokens.ivory),
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 300,
                height: 400,
                child: InlineVideo(
                  url: url,
                  poster: 'assets/none.png',
                  showMute: true,
                  music: MusicTrack.fromJson(_music(31)),
                ),
              ),
            ),
          ),
        ),
      ));
      await _frames(tester, 30);
      return (v: v, c: c);
    }

    testWidgets(
        'Ovozsiz video + kutubxona musiqasi: musiqa o‘ynaydi, 🔇 uni '
        'to‘xtatadi, 🔊 qaytaradi; video doim ovozsiz; aylana yo‘q',
        (tester) async {
      final r = await pumpInline(tester);
      expect(_playing(r.v), {'promo_lol707_720.mp4', 'music_31.mp3'});
      final video = _player(r.v, 'promo_lol707_720.mp4');
      final music = _player(r.v, 'music_31.mp3');
      expect(r.v.volumeOf[video], 0.0, reason: 'audio izi yo‘q — musiqa');
      expect(r.v.volumeOf[music], 1.0);
      expect(find.byType(CircularProgressIndicator), findsNothing,
          reason: 'video o‘ynayapti — aylana yo‘q');
      expect(_posterOpacity(tester, 'video-poster'), 0.0);

      await tester.tap(_k('video-mute'));
      await _frames(tester, 10);
      expect(_playing(r.v), {'promo_lol707_720.mp4'},
          reason: '🔇 — musiqa to‘xtaydi');
      expect(r.c.read(mediaMutedProvider), isTrue);

      await tester.tap(_k('video-mute'));
      await _frames(tester, 20);
      expect(_playing(r.v), {'promo_lol707_720.mp4', 'music_31.mp3'},
          reason: '🔊 — musiqa qaytadi');
      expect(r.v.volumeOf[video], 0.0);

      await tester.pumpWidget(const SizedBox());
      await _frames(tester, 6);
      expect(r.v.alive, isEmpty, reason: 'ikkala pleer yopildi');
    });

    testWidgets(
        'Poster pozitsiya 0 dan oshguncha ko‘rinadi; qotgan pleerda poster '
        'qoladi, aylana esa 8 s dan keyin o‘chadi', (tester) async {
      final r = await pumpInline(tester,
          setup: (v) => v.frozen.add('promo_lol707_720.mp4'));
      expect(_posterOpacity(tester, 'video-poster'), 1.0,
          reason: 'pozitsiya yurmadi — poster turadi');
      await tester.pumpWidget(const SizedBox());
      await _frames(tester, 6);
      expect(r.v.alive, isEmpty);
    });
  });

  group('AdVideoLoader / AdVideoSpinner', () {
    testWidgets(
        'Qotib qolgan pleer (pozitsiya ~8 s jilmadi) yo‘q qilinadi va '
        'yangisi ochiladi; normal pleer qayta ochilmaydi', (tester) async {
      final v = FakeVideoPlatform()..frozen.add('frozen.mp4');
      VideoPlayerPlatform.instance = v;
      final loaders = <AdVideoLoader>[];
      Future<AdVideoLoader> make(String file) async {
        final l = AdVideoLoader(
          url: () => 'https://nfcstore.uz/uploads/$file',
          onChanged: () {},
        );
        l.play();
        loaders.add(l);
        return l;
      }

      await make('frozen.mp4');
      await make('fine.mp4');
      await _frames(tester, 20);
      int opened(String f) => v.urls.values.where((u) => u.endsWith(f)).length;
      expect(opened('frozen.mp4'), 1);
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(seconds: 2));
        await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 5)));
      }
      await _frames(tester, 80);
      expect(opened('frozen.mp4'), greaterThanOrEqualTo(2),
          reason: 'qotgan pleer almashtirildi');
      expect(opened('fine.mp4'), 1, reason: 'yurayotgan pleerga tegilmaydi');
      for (final l in loaders) {
        l.dispose();
      }
      await _frames(tester, 10);
    });

    testWidgets('Tayyor, lekin yurmayotgan pleerda aylana CHEKSIZ emas',
        (tester) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      final c = VideoPlayerController.networkUrl(
          Uri.parse('https://nfcstore.uz/uploads/x.mp4'));
      await tester.runAsync(() => c.initialize());
      addTearDown(c.dispose);
      await tester.pumpWidget(MaterialApp(
        home: AdVideoSpinner(loading: false, controller: c),
      ));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.pump(kAdSpinnerGiveUp + const Duration(seconds: 1));
      expect(find.byType(CircularProgressIndicator), findsNothing);
      await tester.pumpWidget(const SizedBox());
    });
  });
}
