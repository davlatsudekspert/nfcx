import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/core/media/audio_session.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// KO'RGAZMA VIDEO REKLAMASI O'ZI BOSHLANADI (egasi, TestFlight 332 /
/// Android 319: "BOY777 va LOL ni ko'rgazmada ochilsa musiqa bor,
/// rolikni o'zi ishlamayapti").
///
/// Haqiqiy yo'l bilan: butun ilova, Asosiydagi reklama kartasi bosiladi
/// -> Ko'rgazma shu reklama bilan ochiladi. Sabablar:
///
/// * video musiqa pleerining TO'LIQ yuklanishini (20 s gacha) kutardi;
/// * `initialize()` yiqilsa yoki 20 s da ulgurmasa — o'lik pleer qolar,
///   sahifada turganda video hech qachon boshlanmasdi;
/// * tashqaridan to'xtatilgan (iOS sessiyasi) video qayta qo'yilmasdi;
/// * Asosiydagi karta ham bir marta yiqilsa — reklama almashguncha faqat
///   poster.

Map<String, dynamic> _music(int id) => {
      'id': id,
      'title': 'Silk Road Fire',
      'artist': 'NeomSongs',
      'audioUrl': '/uploads/music_$id.mp3',
      'clipUrl': '',
      'start': 0,
    };

Post _ad(String name, int id, int music) => Post.fromJson({
      'id': id,
      'code': 'NFCSTOREUZ',
      'authorKind': 'company',
      'showcase': true,
      'ad': true,
      'featured': true,
      'title': name,
      'imageUrl': '/promo/nfcstore-${name.toLowerCase()}.jpg',
      'videoUrl': '/uploads/promo_${name.toLowerCase()}.mp4',
      'mediaUrls': ['/uploads/promo_${name.toLowerCase()}.mp4'],
      'mediaItems': [
        {'url': '/uploads/promo_${name.toLowerCase()}.mp4', 'type': 'video'},
      ],
      'linkUrl': 'https://www.instagram.com/reel/Ddy4e1cjVY9/',
      'music': _music(music),
    });

final _boy = _ad('BOY777', 54, 28);
final _lol = _ad('LOL707', 55, 29);

Post _image(int id, int music) => Post.fromJson({
      'id': id,
      'code': 'NFCSTOREUZ',
      'authorKind': 'company',
      'showcase': true,
      'title': 'P$id',
      'imageUrl': '/uploads/p$id.jpg',
      'mediaUrls': ['/uploads/p$id.jpg'],
      'music': _music(music),
    });

class _Repo extends FakeSocialRepository {
  @override
  Future<Result<ReelsPage>> showcasePage(
          {String? cursor, int limit = 10}) async =>
      Ok(ReelsPage(items: [_image(50, 60), _boy, _lol, _image(48, 63)]));

  @override
  Future<Result<ReelsPage>> showcaseAds({int limit = 4}) async =>
      Ok(ReelsPage(items: [_boy]));
}

class _Video extends FakeVideoPlatform {
  _Video(this.log);
  final List<String> log;

  @override
  Future<void> play(int playerId) {
    log.add('play:${urls[playerId]!.split('/').last}');
    return super.play(playerId);
  }
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

int _opened(FakeVideoPlatform v, String file) =>
    v.urls.values.where((u) => u.endsWith(file)).length;

Finder _ring(String key) => find.descendant(
    of: find.byKey(ValueKey(key)),
    matching: find.byType(CircularProgressIndicator));

Future<({ProviderContainer c, _Video v, List<String> log})> _app(
  WidgetTester tester, {
  void Function(_Video v)? setup,
  List<String>? log,
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  log ??= <String>[];
  final v = _Video(log);
  setup?.call(v);
  VideoPlayerPlatform.instance = v;
  final base = await testOverrides();
  final c = ProviderContainer(overrides: [
    ...base,
    socialRepositoryProvider.overrideWithValue(_Repo()),
  ]);
  addTearDown(c.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(container: c, child: const NovaApp()),
  );
  await _frames(tester, 60);
  return (c: c, v: v, log: log);
}

Future<void> _showHomeCard(WidgetTester tester) async {
  final card = find.byKey(const ValueKey('home-ad-card'));
  await tester.dragUntilVisible(
      card, find.byType(Scrollable).first, const Offset(0, -200));
  await _frames(tester, 20);
}

/// Asosiydagi karta bosiladi -> Ko'rgazma, BOY777 birinchi sahifada.
Future<void> _openFromHome(WidgetTester tester, ProviderContainer c) async {
  await tester.tap(find.byKey(const ValueKey('home-ad-card')));
  await tester.pump();
  expect(c.read(activeTabProvider), anyOf(0, kShowcaseTab));
}

Future<void> _end(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(minutes: 1));
}

/// iPhone: audio sessiya kanali (sinovda yo'q) — chaqiruvlar yoziladi.
/// Platforma belgisi sinov tanasi ICHIDA qaytariladi (aks holda
/// `flutter_test` invariant xatosi).
Future<void> _onIos(List<String> log, Future<void> Function() body) async {
  debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(audioSessionChannel, (call) async {
    log.add('session:${call.method}');
    return true;
  });
  try {
    await body();
  } finally {
    debugDefaultTargetPlatformOverride = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(audioSessionChannel, null);
  }
}

void main() {
  setUpAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/path_provider'),
            (_) async => Directory.systemTemp.createTempSync('nova').path);
  });

  testWidgets(
      'Asosiy karta -> Ko‘rgazma: video birinchi marta yuklanmasa, o‘lik '
      'pleer qolmaydi — bir necha soniyadan keyin O‘ZI qayta ochiladi va '
      'o‘ynaydi (sahifadan chiqmasdan)', (tester) async {
    final r = await _app(tester);
    await _showHomeCard(tester);
    expect(_playing(r.v), {'promo_boy777.mp4'}, reason: 'karta o‘ynaydi');
    r.v.failOnce.add('promo_boy777.mp4');

    await _openFromHome(tester, r.c);
    await _frames(tester, 30);
    expect(r.c.read(activeTabProvider), kShowcaseTab);
    expect(_playing(r.v), {'music_28.mp3'},
        reason: 'birinchi yuklash yiqildi, musiqa o‘ynaydi');
    final dead = _player(r.v, 'promo_boy777.mp4');
    expect(r.v.alive, isNot(contains(dead)), reason: 'yiqilgan pleer yopildi');
    expect(_ring('showcase-ad-loading'), findsOneWidget,
        reason: 'qayta urinish kutilmoqda — poster ustida aylana');

    await _frames(tester, 80);
    expect(_playing(r.v), {'promo_boy777.mp4', 'music_28.mp3'},
        reason: 'o‘zi qayta ochildi');
    final video = _player(r.v, 'promo_boy777.mp4');
    expect(video, isNot(dead));
    expect(r.v.volumeOf[video], 0.0, reason: 'musiqa bor — ovozsiz');
    expect(r.v.mixOf[video], isTrue, reason: 'Android: fokusni olmaydi');
    expect(_ring('showcase-ad-loading'), findsNothing,
        reason: 'video o‘ynayapti — aylana yo‘q');
    await _end(tester);
  });

  testWidgets(
      'Video 20 s da ochilmasa (osilib qoldi) — yo‘q qilinadi va yangisi '
      'o‘ynaydi', (tester) async {
    final r = await _app(tester);
    await _showHomeCard(tester);
    r.v.hangOnce.add('promo_boy777.mp4');
    await _openFromHome(tester, r.c);
    await _frames(tester, 30);
    expect(_playing(r.v), {'music_28.mp3'});
    final hung = _player(r.v, 'promo_boy777.mp4');
    expect(_ring('showcase-ad-loading'), findsOneWidget,
        reason: 'ochilmoqda — aylana');

    await tester.pump(const Duration(seconds: 20));
    await _frames(tester, 100);
    expect(r.v.alive, isNot(contains(hung)), reason: 'osilgan pleer yopildi');
    expect(_playing(r.v), {'promo_boy777.mp4', 'music_28.mp3'});
    await _end(tester);
  });

  testWidgets(
      'iPhone: musiqa sekin yuklansa ham video uni KUTMAYDI (darhol '
      'o‘ynaydi); musiqa kelgach — ikkalasi', (tester) async {
    final log = <String>[];
    await _onIos(log, () async {
      final r = await _app(tester,
          log: log,
          setup: (v) => v.slow['music_28.mp3'] = const Duration(seconds: 15));
      await _showHomeCard(tester);
      await _openFromHome(tester, r.c);
      await _frames(tester, 40);
      expect(_playing(r.v), {'promo_boy777.mp4'},
          reason: 'video musiqani 20 s kutmaydi');
      final video = _player(r.v, 'promo_boy777.mp4');
      expect(r.v.mixOf[video], isFalse, reason: 'iOS: sessiya aralashmaydi');
      expect(r.v.volumeOf[video], 0.0);

      await tester.pump(const Duration(seconds: 14));
      await _frames(tester, 20);
      expect(_playing(r.v), {'promo_boy777.mp4', 'music_28.mp3'});
      final all = [...r.log];
      final musicPlay = all.indexOf('play:music_28.mp3');
      expect(all.sublist(0, musicPlay), contains('session:playback'));
      expect(all.sublist(musicPlay), contains('play:promo_boy777.mp4'),
          reason: 'sessiya olingach ovozsiz video qayta play() qilinadi');
      await _end(tester);
    });
  });

  testWidgets(
      'Android: musiqa sekin yuklansa video ko‘pi bilan ~2 s kutadi, '
      'audio fokus tartibi saqlanadi', (tester) async {
    final r = await _app(tester,
        setup: (v) => v.slow['music_28.mp3'] = const Duration(seconds: 15));
    await _showHomeCard(tester);
    await _openFromHome(tester, r.c);
    await _frames(tester, 60);
    expect(_playing(r.v), {'promo_boy777.mp4'},
        reason: 'video musiqani 20 s kutmaydi');
    final video = _player(r.v, 'promo_boy777.mp4');
    final music = _player(r.v, 'music_28.mp3');
    expect(r.v.mixOf[video], isTrue);
    expect(r.v.mixOf[music], isFalse, reason: 'musiqa o‘z belgisi bilan');
    await tester.pump(const Duration(seconds: 14));
    await _frames(tester, 20);
    expect(_playing(r.v), {'promo_boy777.mp4', 'music_28.mp3'});
    await _end(tester);
  });

  testWidgets(
      'iPhone: o‘ynayotgan video tashqaridan to‘xtatilsa (audio sessiya '
      'uzilishi) — o‘zi davom etadi', (tester) async {
    final log = <String>[];
    await _onIos(log, () async {
      final r = await _app(tester, log: log);
      await _showHomeCard(tester);
      await _openFromHome(tester, r.c);
      await _frames(tester, 40);
      expect(_playing(r.v), {'promo_boy777.mp4', 'music_28.mp3'});
      final video = _player(r.v, 'promo_boy777.mp4');

      log.clear();
      r.v.externalPause(video);
      expect(_playing(r.v), {'music_28.mp3'});
      await _frames(tester, 60);
      expect(log, contains('play:promo_boy777.mp4'));
      expect(_playing(r.v), {'promo_boy777.mp4', 'music_28.mp3'},
          reason: 'o‘ynashi kerak edi — qayta play()');
      expect(r.v.alive, contains(video), reason: 'o‘sha pleer, yangisi emas');
      await _end(tester);
    });
  });

  testWidgets(
      'Video sekin ochilayotganda poster ustida aylana; o‘ynagach yo‘qoladi. '
      'Surib LOL707 ga — u ham o‘ynaydi', (tester) async {
    final r = await _app(tester);
    await _showHomeCard(tester);
    r.v.slow['promo_boy777.mp4'] = const Duration(seconds: 4);
    await _openFromHome(tester, r.c);
    await _frames(tester, 20);
    expect(_playing(r.v), {'music_28.mp3'});
    expect(_ring('showcase-ad-loading'), findsOneWidget);
    await _frames(tester, 80);
    expect(_playing(r.v), {'promo_boy777.mp4', 'music_28.mp3'});
    expect(_ring('showcase-ad-loading'), findsNothing);

    // Keyingi sahifalar: P50, keyin LOL707.
    for (var i = 0; i < 2; i++) {
      await tester.fling(find.byKey(const ValueKey('showcase-pager')),
          const Offset(0, -600), 2000);
      await _frames(tester, 30);
    }
    expect(_playing(r.v), {'promo_lol707.mp4', 'music_29.mp3'});
    await _end(tester);
  });

  testWidgets(
      'Asosiydagi karta: video yiqilsa poster qoladi, bir necha soniyadan '
      'keyin o‘zi qayta ochiladi', (tester) async {
    final r = await _app(tester,
        setup: (v) => v.failOnce.add('promo_boy777.mp4'));
    await _showHomeCard(tester);
    expect(_playing(r.v), isEmpty, reason: 'birinchi yuklash yiqildi');
    expect(_ring('home-ad-loading'), findsOneWidget);
    await _frames(tester, 80);
    expect(_playing(r.v), {'promo_boy777.mp4'});
    expect(_opened(r.v, 'promo_boy777.mp4'), 2);
    expect(r.v.volumeOf[_player(r.v, 'promo_boy777.mp4')], 0.0);
    expect(_ring('home-ad-loading'), findsNothing);
    await _end(tester);
  });
}
