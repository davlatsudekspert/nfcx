import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart' show MusicTrack;
import 'package:nfcstore_nova/features/social/inline_video.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// TO'LIQ EKRANDA BITTA OVOZ (egasi, build 335: "ichiga kirsang ham
/// musiqa, tashqaridagi ham — ikki xil ovoz").
///
/// Reklama roliklarida (v4) videoning o'zida musiqa izi bor, postda
/// esa alohida musiqa ham bor. Lentada video jim, musiqa chalinadi.
/// To'liq ekran ilgari videoni `setVolume(1)` qilardi — ikkalasi birga
/// eshitilardi, lentaga qaytganda ham video ovozli qolardi.
void main() {
  Future<void> flush(WidgetTester tester) async {
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 50));
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 20)));
    }
    await tester.pump();
  }

  Future<FakeVideoPlatform> pumpCard(WidgetTester tester,
      {MusicTrack? music}) async {
    final v = FakeVideoPlatform();
    VideoPlayerPlatform.instance = v;
    final overrides = await testOverrides();
    await tester.pumpWidget(ProviderScope(
      overrides: overrides,
      child: wrapScreen(Scaffold(
        body: SizedBox(
          width: 300,
          height: 300,
          child: InlineVideo(
            url: 'https://nfcstore.uz/uploads/promo_boy777_v4.mp4',
            active: true,
            looping: true,
            fullscreenOnTap: true,
            music: music,
          ),
        ),
      )),
    ));
    await tester.pump();
    await flush(tester);
    // Sahifa o'tish animatsiyasi tugasin (u paytda bosish o'tmaydi).
    await tester.pump(const Duration(seconds: 1));
    await flush(tester);
    return v;
  }

  /// Soxta platformaning kadri bosishni qabul qilmaydi (haqiqiy
  /// `Texture` qabul qiladi) — kartaning o'z `onTap` i chaqiriladi.
  Future<void> openFullscreen(WidgetTester tester) async {
    tester
        .widget<GestureDetector>(
            find.byKey(const ValueKey('video-open-fullscreen')))
        .onTap!();
    await flush(tester);
  }

  int idOf(FakeVideoPlatform v, String part) =>
      v.urls.entries.firstWhere((e) => e.value.contains(part)).key;

  /// Hozir eshitilayotgan manbalar: o'ynayapti va ovozi > 0.
  Set<String> audible(FakeVideoPlatform v) => {
        for (final id in v.playing)
          if ((v.volumeOf[id] ?? 1) > 0) v.urls[id]!,
      };

  const track = MusicTrack(
      id: 28, title: 'Silk Road Fire', clipUrl: 'https://nfcstore.uz/m/28.mp3');

  testWidgets('musiqali post: lentada, to‘liq ekranda va qaytganda — '
      'faqat musiqa eshitiladi', (tester) async {
    final v = await pumpCard(tester, music: track);
    final video = idOf(v, 'promo_boy777');
    expect(audible(v), {'https://nfcstore.uz/m/28.mp3'},
        reason: 'lentada video jim, musiqa chalinadi');

    await openFullscreen(tester);
    expect(find.byKey(const ValueKey('video-fullscreen')), findsOneWidget);
    expect(v.playing, contains(video));
    expect(v.volumeOf[video], 0, reason: 'video o‘z izini chalmaydi');
    expect(audible(v), {'https://nfcstore.uz/m/28.mp3'},
        reason: 'to‘liq ekranda ham BITTA ovoz');

    await tester.binding.handlePopRoute();
    await flush(tester);
    expect(find.byKey(const ValueKey('video-fullscreen')), findsNothing);
    expect(v.volumeOf[video], 0, reason: 'lentaga qaytgach ham video jim');
    expect(audible(v).length, lessThanOrEqualTo(1));
    expect(tester.takeException(), isNull);
  });

  testWidgets('musiqasiz video: to‘liq ekranda o‘z ovozi bilan', (tester) async {
    final v = await pumpCard(tester);
    final video = idOf(v, 'promo_boy777');
    await openFullscreen(tester);
    expect(find.byKey(const ValueKey('video-fullscreen')), findsOneWidget);
    expect(v.volumeOf[video], 1);
    expect(v.created.length, 1, reason: 'alohida musiqa pleeri yo‘q');
    await tester.binding.handlePopRoute();
    await flush(tester);
    expect(tester.takeException(), isNull);
  });
}
