import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/media/audio_session.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/icons/nova_icons.dart';
import 'package:nfcstore_nova/features/profile/music_player.dart'
    show audioOwnerProvider;
import 'package:nfcstore_nova/features/showcase/showcase_sound.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// KO'RGAZMA MUSIQASI O'ZI BOSHLANADI (egasi, TestFlight 331: "musiqa
/// avto qo'yilmayapti", "hamma joyda avto aytmayapti").
///
/// Butun ilova (`NovaApp`, haqiqiy shell va tablar) bilan: Asosiyda
/// ovozsiz reklama kartasi ko'rindi -> Ko'rgazma. Server javobi
/// haqiqiysiga o'xshash: BOY777 — video reklama + kutubxona musiqasi
/// (`clipUrl` bo'sh, `audioUrl` nisbiy).

Map<String, dynamic> _music(int id) => {
      'id': id,
      'title': 'Silk Road Fire',
      'artist': 'NeomSongs',
      'audioUrl': '/uploads/music_$id.mp3',
      'clipUrl': '',
      'start': 0,
    };

final _boy = Post.fromJson({
  'id': 54,
  'code': 'NFCSTOREUZ',
  'authorKind': 'company',
  'showcase': true,
  'ad': true,
  'featured': true,
  'title': 'BOY777 — premium NFC ID',
  'imageUrl': '/promo/nfcstore-boy777.jpg',
  'videoUrl': '/uploads/promo_boy777.mp4',
  'mediaUrls': ['/uploads/promo_boy777.mp4'],
  'mediaItems': [
    {'url': '/uploads/promo_boy777.mp4', 'type': 'video'},
  ],
  'linkUrl': 'https://www.instagram.com/reel/Ddy4e1cjVY9/',
  'music': _music(28),
});

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
      Ok(ReelsPage(items: [_image(50, 60), _boy, _image(48, 63)]));

  @override
  Future<Result<ReelsPage>> showcaseAds({int limit = 4}) async =>
      Ok(ReelsPage(items: [_boy]));
}

/// Soxta platforma + `play` tartibi (iOS sessiyasi undan OLDIN).
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
    // `VideoPlayerController.dispose` haqiqiy asinxron ishni kutadi.
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

Future<({ProviderContainer c, _Video v, List<String> log})> _app(
  WidgetTester tester, {
  Future<void> Function(SharedPreferences p)? prefs,
  List<String>? log,
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  log ??= <String>[];
  final v = _Video(log);
  VideoPlayerPlatform.instance = v;
  final base = await testOverrides();
  await prefs?.call(await SharedPreferences.getInstance());
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

/// Asosiydagi reklama kartasigacha suriladi (video ovozsiz o'ynaydi).
Future<void> _showHomeCard(WidgetTester tester) async {
  final card = find.byKey(const ValueKey('home-ad-card'));
  await tester.dragUntilVisible(
      card, find.byType(Scrollable).first, const Offset(0, -200));
  await _frames(tester, 20);
}

IconData _muteIcon(WidgetTester tester) => tester
    .widget<Icon>(find.descendant(
        of: find.byKey(const ValueKey('showcase-mute')),
        matching: find.byType(Icon)))
    .icon!;

void main() {
  setUpAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/path_provider'),
            (_) async => Directory.systemTemp.createTempSync('nova').path);
  });

  test('iOS: AppDelegate audio sessiya kanalini ro‘yxatdan o‘tkazadi', () {
    final src = File('ios/Runner/AppDelegate.swift').readAsStringSync();
    expect(src, contains('NovaAudioSession.register'));
    expect(src, contains('"uz.nfcstore.nova/audio"'));
    expect(src, contains('case "playback"'));
    expect(src, contains('setCategory(.playback'));
    expect(src, contains('setActive(true)'));
    expect(audioSessionChannel.name, 'uz.nfcstore.nova/audio');
  });

  testWidgets(
      '330–331 da saqlangan 🔇 tashlanadi: standart — ovoz bor, tabga '
      'kirilsa birinchi sahifa musiqasi o‘zi boshlanadi; ikonka holatni '
      'ko‘rsatadi', (tester) async {
    final r = await _app(tester,
        prefs: (p) => p.setBool('nova.showcaseMuted', true));
    expect(r.c.read(prefsProvider).showcaseMuted, isFalse);
    expect(r.c.read(showcaseMutedProvider), isFalse);

    r.c.read(routerProvider).go(Routes.showcase);
    await _frames(tester, 40);
    expect(_playing(r.v), {'music_60.mp3'},
        reason: 'birinchi sahifa — musiqa o‘zi');
    // Ovoz yoqiq — oddiy karnay; o'chiq — chizilgan.
    expect(_muteIcon(tester), NovaIcons.sound);

    await tester.tap(find.byKey(const ValueKey('showcase-mute')));
    await _frames(tester, 10);
    expect(_playing(r.v), isEmpty);
    expect(_muteIcon(tester), NovaIcons.muted);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getBool('nova.showcaseMuted.v2'), isTrue,
        reason: 'yangi 🔇 saqlanadi');
    expect(prefs.containsKey('nova.showcaseMuted'), isFalse,
        reason: 'eski kalit tozalandi');

    await tester.tap(find.byKey(const ValueKey('showcase-mute')));
    await _frames(tester, 10);
    expect(_playing(r.v), {'music_60.mp3'});
    expect(_muteIcon(tester), NovaIcons.sound);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(minutes: 1));
  });

  testWidgets(
      'Asosiy karta ko‘rindi -> bosildi -> BOY777: video ovozsiz va '
      'fokussiz, musiqa o‘ynaydi; surilsa keyingi musiqa', (tester) async {
    final r = await _app(tester);
    await _showHomeCard(tester);
    final card = _player(r.v, 'promo_boy777.mp4');
    expect(_playing(r.v), {'promo_boy777.mp4'});
    expect(r.v.mixOf[card], isTrue, reason: 'Asosiydagi karta aralashadi');

    await tester.tap(find.byKey(const ValueKey('home-ad-card')));
    await _frames(tester, 40);
    expect(r.c.read(activeTabProvider), kShowcaseTab);
    expect(r.v.alive, isNot(contains(card)), reason: 'karta pleeri yopildi');
    final video = _player(r.v, 'promo_boy777.mp4');
    final music = _player(r.v, 'music_28.mp3');
    expect(_playing(r.v), {'promo_boy777.mp4', 'music_28.mp3'});
    expect(r.v.volumeOf[video], 0.0, reason: 'musiqa bor — video ovozsiz');
    expect(r.v.volumeOf[music], 1.0);
    // Ovozsiz video audio fokusni olmaydi (Android'da musiqani
    // to'xtatardi); musiqa — oladi (boshqa ilova ovozi to'xtaydi).
    expect(r.v.mixOf[video], isTrue);
    expect(r.v.mixOf[music], isFalse);
    expect(r.c.read(audioOwnerProvider).current, isNotNull,
        reason: 'audio egasi — musiqa (ovozsiz video olmaydi)');

    await tester.fling(find.byKey(const ValueKey('showcase-pager')),
        const Offset(0, -600), 2000);
    await _frames(tester, 30);
    // Reklama birinchi sahifaga qo'yilgan: keyingisi — ro'yxat boshi.
    expect(_playing(r.v), {'music_60.mp3'}, reason: 'keyingi sahifa');
    expect(r.v.alive, isNot(contains(music)));
    expect(r.v.alive, isNot(contains(video)));

    // Asosiyga va qaytib — karta yana ovozsiz o'ynadi, Ko'rgazmada
    // shu sahifa musiqasi yana o'zi boshlanadi.
    r.c.read(routerProvider).go(Routes.home);
    await _frames(tester, 20);
    r.c.read(routerProvider).go(Routes.showcase);
    await _frames(tester, 30);
    expect(_playing(r.v), {'music_60.mp3'});
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(minutes: 1));
  });

  testWidgets(
      'iPhone: musiqa play() dan OLDIN audio sessiya olinadi (Asosiydagi '
      'aralashuvchi kartadan keyin ham)', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    final log = <String>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(audioSessionChannel, (call) async {
      log.add('session:${call.method}');
      return true;
    });
    addTearDown(() => TestDefaultBinaryMessengerBinding
        .instance.defaultBinaryMessenger
        .setMockMethodCallHandler(audioSessionChannel, null));
    try {
      final r = await _app(tester, log: log);
      await _showHomeCard(tester);
      expect(_playing(r.v), {'promo_boy777.mp4'});
      expect(log.where((e) => e.startsWith('session')), isEmpty,
          reason: 'ovozsiz karta sessiyani olmaydi');
      log.clear();

      await tester.tap(find.byKey(const ValueKey('home-ad-card')));
      await _frames(tester, 40);
      final all = [...log];
      expect(_playing(r.v), {'promo_boy777.mp4', 'music_28.mp3'});
      final musicPlay = all.indexOf('play:music_28.mp3');
      expect(musicPlay, greaterThan(0));
      expect(all.sublist(0, musicPlay), contains('session:playback'),
          reason: 'sessiya musiqadan oldin');
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(minutes: 1));
    } finally {
      debugDefaultTargetPlatformOverride = null;
    }
  });
}
