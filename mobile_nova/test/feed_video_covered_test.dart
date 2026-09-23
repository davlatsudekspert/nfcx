import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/social/inline_video.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// LENTA VIDEOSI USTIGA EKRAN OCHILSA TO'XTAYDI (audit P-H1).
///
/// Home ustiga post/profil (ildiz navigator) ochilsa yoki Home tabi
/// yashirilsa, Home o'lmaydi — ilgari dominant video ORQADA ovoz
/// bilan o'ynayverardi. Ikkala holatda ham Flutter `TickerMode` ni
/// o'chiradi; video shu signalga qaraydi.
void main() {
  Future<void> flush(WidgetTester tester) async {
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 50));
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 20)));
    }
    await tester.pump();
  }

  Widget video(bool shown) => TickerMode(
        enabled: shown,
        child: const SizedBox(
          width: 300,
          height: 300,
          child: InlineVideo(
              url: 'https://nfcstore.uz/uploads/a.mp4', active: true),
        ),
      );

  testWidgets('yashirin/yopilgan — boshlanmaydi; ko‘ringach o‘ynaydi; '
      'yana yopilsa to‘xtaydi', (tester) async {
    final v = FakeVideoPlatform();
    VideoPlayerPlatform.instance = v;
    final overrides = await testOverrides();

    Future<void> pump(bool shown) async {
      await tester.pumpWidget(ProviderScope(
        overrides: overrides,
        child: wrapScreen(Scaffold(body: video(shown))),
      ));
      await tester.pump();
      await flush(tester);
    }

    await pump(false);
    expect(v.playing, isEmpty, reason: 'ekran yopiq — ovoz yo‘q');

    await pump(true);
    expect(v.playing.length, 1, reason: 'ko‘rindi — dominant video o‘ynaydi');

    await pump(false);
    expect(v.playing, isEmpty,
        reason: 'ustiga ekran ochildi — video orqada o‘ynamasin');
  });
}
