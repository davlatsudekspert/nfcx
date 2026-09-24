import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/social/fullscreen_video.dart';
import 'package:nfcstore_nova/features/social/media_frame.dart';

import 'helpers.dart';

/// MEDIA O'Z SHAKLIGA MOSLASHSIN.
///
/// Telefonda aytildi: "istorya, reels, post qo'yganda o'zi moslab
/// olsin, katta bo'p ketyapti".
///
/// Sabab: har ekran media uchun O'Z qutisini yozib qo'ygandi va
/// ichiga `BoxFit.cover` bergandi. `cover` quti bilan rasm nisbati
/// mos kelmasa rasmni KATTALASHTIRADI va ortig'ini KESADI.
void main() {
  group('Nisbat chegarasi', () {
    test('oddiy nisbatlar O‘ZGARMAYDI', () {
      expect(clampMediaAspect(1.0), 1.0);
      expect(clampMediaAspect(4 / 3), closeTo(1.333, 0.001));
      expect(clampMediaAspect(3 / 4), closeTo(0.8, 0.001),
          reason: '3:4 chegara ichida — tegilmasligi kerak');
    });

    test('juda TIK media chegaraga keltiriladi', () {
      // 9:16 skrinshot lentada butun ekranni egallab olardi va
      // keyingi post umuman ko'rinmasdi.
      expect(clampMediaAspect(9 / 16), kMediaAspectMin);
    });

    test('juda YOTIQ media chegaraga keltiriladi', () {
      expect(clampMediaAspect(21 / 9), kMediaAspectMax);
    });

    test('buzuq qiymat ilovani yiqitmaydi', () {
      expect(clampMediaAspect(0), kMediaAspectFallback);
      expect(clampMediaAspect(-3), kMediaAspectFallback);
      expect(clampMediaAspect(double.nan), kMediaAspectFallback);
      expect(clampMediaAspect(double.infinity), kMediaAspectFallback);
    });

    test('chegaralar mantiqan to‘g‘ri', () {
      expect(kMediaAspectMin, lessThan(kMediaAspectFallback));
      expect(kMediaAspectFallback, lessThan(kMediaAspectMax));
    });
  });

  testWidgets('AdaptiveMedia QOTIB QOLGAN nisbat bermaydi', (tester) async {
    await tester.pumpWidget(wrapScreen(
      const Center(
        child: SizedBox(
          width: 300,
          child: AdaptiveMedia(url: 'https://x/y.jpg', isVideo: false),
        ),
      ),
    ));
    await tester.pump();

    final ar = tester.widget<AspectRatio>(find.byType(AspectRatio));
    // Boshlanish qiymati — kvadrat. Rasm kelgach O'ZGARADI.
    expect(ar.aspectRatio, kMediaAspectFallback);
    expect(ar.aspectRatio, isNot(4 / 3),
        reason: 'lentadagi eski 4:3 qutisi qaytib kelgan');
  });

  group('Ekranlar bitta tizimdan foydalanadi', () {
    String read(String p) => File(p).readAsStringSync();

    final feed = read('lib/features/social/feed_card.dart');
    final post = read('lib/features/social/post_screens.dart');
    final story = read('lib/features/social/story_viewer.dart');
    final reels = read('lib/features/social/reels_screen.dart');

    test('lenta va post tafsiloti BIR XIL qutidan foydalanadi', () {
      // Ilgari lentada 4:3, tafsilotda 1:1 edi — BITTA post ikki
      // ekranda ikki xil ko'rinardi.
      expect(feed, contains('AdaptiveMedia'));
      expect(post, contains('AdaptiveMedia'));
      expect(feed, isNot(contains('aspectRatio: 4 / 3')));
      expect(post, isNot(contains('aspectRatio: 1,')));
    });

    test('BUTUN EKRANDA media kesilmaydi', () {
      // Istoryadagi rasm endi `contain` — hoshiyasi qirqilmaydi.
      expect(story, contains('FullBleedMedia'));
      expect(story, contains('BoxFit.contain'));
      expect(story, isNot(contains('fit: BoxFit.cover')),
          reason: 'istoryada hali ham kesuvchi `cover` bor');
      // Reels — Instagram kabi (egasi, 2026-09-24): tik video ekranni
      // to'ldiradi, yotiq/kvadrat video butun ko'rinadi. Qoida bitta
      // joyda — `immersiveVideoFit`.
      expect(reels, contains('immersiveVideoFit('));
      expect(reels, isNot(contains('fit: BoxFit.cover')),
          reason: 'Reels videoni shartsiz qirqyapti');
    });

    test('Reels: tik video to‘ldiradi, yotiq va kvadrat — kesilmaydi', () {
      const phone = Size(390, 844);
      // 9:16 tik video — chetdan ~18% kesiladi, qora chiziq qolmaydi.
      expect(immersiveVideoFit(const Size(1080, 1920), phone), BoxFit.cover);
      // Yotiq (16:9), kvadrat va 4:5 — butun ko'rinadi.
      expect(immersiveVideoFit(const Size(1920, 1080), phone), BoxFit.contain);
      expect(immersiveVideoFit(const Size(1080, 1080), phone), BoxFit.contain);
      expect(immersiveVideoFit(const Size(1080, 1350), phone), BoxFit.contain);
      // O'lcham noma'lum — xavfsiz tomonga.
      expect(immersiveVideoFit(Size.zero, phone), BoxFit.contain);
    });
  });
}
