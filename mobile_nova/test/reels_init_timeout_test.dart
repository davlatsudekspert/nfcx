import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// REELS: OSILGAN VIDEO ABADIY QORA QOLMAYDI (egasi, 2026-10).
///
/// `initialize()` javob bermasa reel [reelsInitTimeout] dan keyin
/// "qayta urinish" holatiga o'tadi; bosilsa yangi pleyer bilan ochiladi.
final _reels = [
  for (var i = 1; i <= 3; i++)
    Post(
      id: i,
      code: 'VID00$i',
      authorName: 'Video $i',
      text: 'video-$i',
      mediaUrls: ['https://nfcstore.uz/uploads/v$i.mp4'],
      isVideo: true,
    ),
];

Future<FakeVideoPlatform> _pump(WidgetTester tester,
    {Duration initDelay = Duration.zero}) async {
  final fake = FakeVideoPlatform(initDelay: initDelay);
  VideoPlayerPlatform.instance = fake;
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final base = await testOverrides();
  final c = ProviderContainer(overrides: [
    ...base.where((o) => !identical(o, base[2])),
    socialRepositoryProvider.overrideWithValue(FakeSocialRepository()),
    reelsProvider.overrideWith((ref) async => _reels),
    activeTabProvider.overrideWith((ref) => 3),
  ]);
  addTearDown(c.dispose);
  await tester.pumpWidget(UncontrolledProviderScope(
    container: c,
    child: wrapScreen(const ReelsScreen()),
  ));
  await settle(tester, frames: 10);
  return fake;
}

void main() {
  testWidgets('ochilish osilib qolsa — qayta urinish, abadiy qora emas',
      (tester) async {
    final fake = await _pump(tester, initDelay: const Duration(hours: 1));
    expect(fake.created, isNotEmpty);
    expect(find.byIcon(Icons.videocam_off_rounded), findsNothing);
    await tester.pump(reelsInitTimeout + const Duration(seconds: 1));
    await settle(tester, frames: 6);
    expect(find.byIcon(Icons.videocam_off_rounded), findsWidgets,
        reason: 'osilgan video "qayta urinish" holatiga o‘tmadi');
    // Bosish — qaytadan ochishga urinadi (yangi pleyer).
    final before = fake.created.length;
    await tester.tap(find.byIcon(Icons.videocam_off_rounded).first);
    await settle(tester, frames: 6);
    expect(fake.created.length, greaterThan(before));

    // Soxta "osilgan" ochilish taymerlari tugasin.
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(hours: 2));
  });
}
