import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/profile/music_player.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// Egasining talabi: avatar yonida musiqa/ekvalayzer belgisi; bosilganda
/// premium varaq — play/pause, progress, vaqt, oldingi/keyingi.
Future<void> _flush(WidgetTester tester) async {
  await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 40)));
  await settle(tester, frames: 4);
}

void main() {
  const urls = [
    'https://nfcstore.uz/uploads/Yulduzlar_ostida.mp3',
    'https://nfcstore.uz/uploads/Toshkent-kechasi.mp3',
  ];

  Future<ProviderContainer> pump(WidgetTester tester, FakeVideoPlatform v) async {
    VideoPlayerPlatform.instance = v;
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final c = ProviderContainer(overrides: await testOverrides());
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: wrapScreen(
        const Scaffold(
          body: Center(
            child: MusicControl(urls: urls, size: 34, ownerName: 'Muhammad Aliyev'),
          ),
        ),
        tokens: NfcTokens.ivory,
      ),
    ));
    await settle(tester);
    return c;
  }

  testWidgets('belgi → varaq → play/pause → keyingi/oldingi', (tester) async {
    final v = FakeVideoPlatform();
    final c = await pump(tester, v);

    expect(find.byKey(const ValueKey('music-eq')), findsOneWidget,
        reason: 'avatar yonida ekvalayzer belgisi');
    await tester.tap(find.byType(MusicControl));
    await settle(tester, frames: 10);

    expect(find.text('Yulduzlar ostida'), findsWidgets);
    expect(find.text('MUHAMMAD ALIYEV'), findsOneWidget);
    expect(find.byKey(const ValueKey('music-progress')), findsOneWidget);
    expect(find.text('0:00'), findsWidgets);

    // Ijro.
    await tester.tap(find.byKey(const ValueKey('music-play')));
    await _flush(tester);
    expect(c.read(musicPlayerProvider).playing, isTrue);
    expect(v.urls[v.playing.single], urls.first);
    expect(find.text('0:15'), findsOneWidget, reason: 'davomiylik ko‘rinadi');

    // Pauza.
    await tester.tap(find.byKey(const ValueKey('music-play')));
    await _flush(tester);
    expect(c.read(musicPlayerProvider).playing, isFalse);

    // Keyingi.
    await tester.tap(find.byKey(const ValueKey('music-next')));
    await _flush(tester);
    expect(c.read(musicPlayerProvider).url, urls[1]);
    expect(find.byKey(const ValueKey('music-title')), findsOneWidget);
    expect(find.text('Toshkent kechasi'), findsWidgets);

    // Oldingi (boshida — oldingi qo'shiqqa).
    await tester.tap(find.byKey(const ValueKey('music-prev')));
    await _flush(tester);
    expect(c.read(musicPlayerProvider).url, urls.first);

    // Pleyer butun ilovaga tegishli — test oxirida yopiladi (uning
    // pozitsiya taymeri qolmasin).
    await tester.pumpWidget(const SizedBox());
    c.dispose();
    await _flush(tester);
  });

  testWidgets('bitta qo‘shiq: keyingi tugmasi o‘chiq', (tester) async {
    VideoPlayerPlatform.instance = FakeVideoPlatform();
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: await testOverrides(),
      child: wrapScreen(Scaffold(
          body: Center(child: MusicControl(urls: [urls[0]], size: 34)))),
    ));
    await settle(tester);
    await tester.tap(find.byType(MusicControl));
    await settle(tester, frames: 10);
    final next = tester.widget<IconButton>(find.byKey(const ValueKey('music-next')));
    expect(next.onPressed, isNull);
  });
}
