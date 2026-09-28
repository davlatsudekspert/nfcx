import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// IZOH YOZAYOTGANDA REEL O'TIB KETMASIN (egasi, 2026-09-28, BlueStacks
/// suratlari): rasmli reel vaqti tugab keyingisiga o'tardi, izohlar varag'i
/// esa oldingi reelniki bo'lib qolardi. Varaq ochiq turganda reel shu
/// joyida boshidan aylanadi; yopilgach — odatdagidek keyingisiga o'tadi.
class _Social extends FakeSocialRepository {
  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
          String kind, int id, {int page = 1}) async =>
      const Ok((items: <Comment>[], hasMore: false, total: 0));
}

final _reels = [
  Post(
    id: 1,
    code: 'AAA111',
    authorName: 'Birinchi',
    text: 'birinchi-reel',
    mediaUrls: const ['assets/demo/z_post_nfc.jpg'],
    imageSeconds: 3,
  ),
  Post(
    id: 2,
    code: 'BBB222',
    authorName: 'Ikkinchi',
    text: 'ikkinchi-reel',
    mediaUrls: const ['assets/demo/z_post_cafe.jpg'],
    imageSeconds: 3,
  ),
];

void main() {
  testWidgets('izohlar ochiq — rasmli reel keyingisiga o‘tmaydi', (tester) async {
    VideoPlayerPlatform.instance = FakeVideoPlatform();
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final base = await testOverrides();
    final c = ProviderContainer(overrides: [
      ...base.where((o) => !identical(o, base[2])),
      socialRepositoryProvider.overrideWithValue(_Social()),
      reelsProvider.overrideWith((ref) async => _reels),
      activeTabProvider.overrideWith((ref) => 3),
    ]);
    addTearDown(c.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: wrapScreen(const ReelsScreen()),
    ));
    await settle(tester, frames: 10);

    double page() => tester
        .widget<PageView>(find.byKey(const ValueKey('reels-pager')))
        .controller!
        .page!;
    expect(page(), 0);

    await tester.tap(find.byKey(const ValueKey('reel-comments')).first);
    await settle(tester, frames: 10);
    // Rasm vaqti (3 s) ikki marta o'tadi — varaq ochiq.
    for (var i = 0; i < 16; i++) {
      await tester.pump(const Duration(milliseconds: 500));
    }
    expect(page(), 0, reason: 'varaq ochiq — reel o‘z joyida qoladi');

    // Varaq yopildi — endi vaqt tugagach keyingisiga o'tadi.
    Navigator.of(tester.element(find.byType(ReelsScreen))).pop();
    await settle(tester, frames: 10);
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 500));
    }
    expect(page(), greaterThan(0.5), reason: 'varaqsiz — odatdagidek o‘tadi');
  });
}
