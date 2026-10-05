import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/settings/analytics_screen.dart';
import 'package:nfcstore_nova/features/social/media_sound.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';

import 'helpers.dart';

/// 1.1.1 (egasi, 2026-10-05): lentada ovoz tugmasi, analitikada top-5
/// va "Hammasini ko'rish", kunlik grafik butun davrga to'ldiriladi.
void main() {
  group('kunlik grafik', () {
    test('ko‘rishsiz kunlar 0 bilan to‘ldiriladi (ikki qalin ustun emas)', () {
      final out = fillDays(
        const [(day: '2026-10-04', views: 5), (day: '2026-10-05', views: 3)],
        30,
        today: DateTime.utc(2026, 10, 5),
      );
      expect(out.length, 30);
      expect(out.last, (day: '2026-10-05', views: 3));
      expect(out[out.length - 2], (day: '2026-10-04', views: 5));
      expect(out.first.day, '2026-09-06');
      expect(out.where((d) => d.views > 0).length, 2);
    });

    test('bo‘sh ma’lumot o‘zgarmaydi', () {
      expect(fillDays(const [], 30), isEmpty);
    });
  });

  testWidgets('analitika: faqat top-5, qolgani "Hammasini ko‘rish" ichida',
      (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 2600 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final top = [
      for (var i = 1; i <= 8; i++)
        TopContent(id: i, caption: 'Post $i', views: 100 - i),
    ];
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        myAnalyticsProvider.overrideWith(
            (ref) async => MyAnalytics(contentViews: 10, top: top)),
      ],
      child: wrapScreen(const AnalyticsScreen()),
    ));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    for (var i = 1; i <= 5; i++) {
      expect(find.byKey(ValueKey('an-top-post-$i')), findsOneWidget);
    }
    expect(find.byKey(const ValueKey('an-top-post-6')), findsNothing);
    expect(find.text('Hammasini ko‘rish (8)'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('an-top-all')));
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 60));
    }
    expect(find.byType(AnalyticsTopScreen), findsOneWidget);
    expect(find.byKey(const ValueKey('an-top-post-8')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('ovoz tugmasi lenta va Reels uchun bitta holat', (tester) async {
    final c = ProviderContainer();
    addTearDown(c.dispose);
    expect(identical(reelsMutedProvider, mediaMutedProvider), isTrue);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: const MaterialApp(home: Scaffold(body: Center(child: MuteButton()))),
    ));
    expect(find.byIcon(Icons.volume_up_rounded), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('video-mute')));
    await tester.pump();
    expect(c.read(reelsMutedProvider), isTrue);
    expect(find.byIcon(Icons.volume_off_rounded), findsOneWidget);
  });
}
