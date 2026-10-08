import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// BU BUILD'DA VIDEO YUKLASH UI YO'Q (2026-10): reel (video) yaratish
/// ekraniga yo'l yo'q, post va istoriya — faqat rasm, Ko'rgazma — faqat
/// rasm.
void main() {
  test('router reel composer qurmaydi', () {
    final router = File('lib/routing/router.dart').readAsStringSync();
    expect(router, isNot(contains('ComposerKind.reel')));
    final showcase =
        File('lib/features/showcase/showcase_composer.dart').readAsStringSync();
    expect(showcase, isNot(contains('pickVideo')));
    expect(showcase, isNot(contains('pickMultipleMedia')));
    expect(showcase, isNot(contains('uploadVideo')));
  });

  for (final kind in [ComposerKind.post, ComposerKind.story]) {
    testWidgets('${kind.name}: manba varag‘ida video yo‘q', (tester) async {
      tester.view.physicalSize = const Size(1170, 3600);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(ProviderScope(
        overrides: await testOverrides(),
        child: wrapScreen(ComposerScreen(kind: kind)),
      ));
      await settle(tester);
      final l = LUz();
      await tester.tap(find.text(l.mediaPickPhoto));
      await settle(tester, frames: 6);
      expect(find.byKey(const ValueKey('pick-gallery-photo')), findsOneWidget);
      expect(find.byKey(const ValueKey('pick-gallery-video')), findsNothing);
      expect(find.text(l.mediaPickVideo), findsNothing);
    });
  }
}
