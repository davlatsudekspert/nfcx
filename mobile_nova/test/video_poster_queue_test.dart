import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/social/video_poster.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// YASHIRIN MUQOVA NAVBATNI TO'XTATMAYDI (audit P-M1).
///
/// Muqovalar bitta umumiy navbatda (bir vaqtda bitta pleer). Ilgari
/// yashirin tabdagi (yoki ustiga ekran ochilgan) katakcha navbat
/// boshida 500 ms aylanib KUTARDI — undan keyingi hamma muqova, boshqa
/// ekrandagilari ham, hech qachon chizilmasdi.
void main() {
  testWidgets('yashirin katakcha joyni bo‘shatadi, ko‘rinadigani chiziladi',
      (tester) async {
    VideoPoster.clearCache();
    final v = FakeVideoPlatform();
    VideoPlayerPlatform.instance = v;
    await tester.pumpWidget(wrapScreen(const Scaffold(
      body: Column(children: [
        TickerMode(
          enabled: false,
          child: SizedBox(
              width: 100,
              height: 100,
              child: VideoPoster(url: 'https://nfcstore.uz/uploads/yashirin.mp4')),
        ),
        SizedBox(
            width: 100,
            height: 100,
            child: VideoPoster(url: 'https://nfcstore.uz/uploads/korinadi.mp4')),
      ]),
    )));
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 100));
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 10)));
    }
    expect(v.urls.values.any((u) => u.contains('korinadi')), isTrue,
        reason: 'ko‘rinadigan muqova yashirin katakcha ortida qotib qoldi');
    expect(v.urls.values.any((u) => u.contains('yashirin')), isFalse,
        reason: 'yashirin katakcha pleer ochmaydi');
    // Navbatdagi taymerlar tugasin.
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));
  });
}
