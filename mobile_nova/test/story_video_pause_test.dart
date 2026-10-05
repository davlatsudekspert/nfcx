import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/social/media_sound.dart';
import 'package:nfcstore_nova/features/social/story_viewer.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// VIDEO ISTORYA: BOSIB TURISH, VARAQ VA OVOZ.
///
/// Ilgari barmoq bosib turilganda faqat progress taymeri to'xtardi —
/// video esa ovozi bilan o'ynab turaverardi. Izoh varag'i ochilganda
/// ham shunday edi. Ovoz tugmasi esa istoryada umuman yo'q edi.
class _Video extends FakeVideoPlatform {
  /// Har bir player uchun OXIRGI o'rnatilgan ovoz balandligi.
  final volumes = <int, double>{};

  @override
  Future<void> setVolume(int playerId, double volume) async =>
      volumes[playerId] = volume;
}

class _Repo extends SocialRepository {
  _Repo(this.items) : super(ApiClient());
  final List<StoryItem> items;

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async => Ok(items);

  @override
  Future<Result<void>> markStorySeen(int id) async => const Ok(null);

  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
    String kind,
    int id, {
    int page = 1,
  }) async =>
      const Ok((items: <Comment>[], hasMore: false, total: 0));
}

const _video = StoryItem(
  id: 1,
  code: 'VIP001',
  authorName: 'M',
  authorAvatar: 'https://x/m.jpg',
  mediaUrl: 'https://nfcstore.uz/uploads/s.mp4',
  isVideo: true,
);

const _image = StoryItem(
  id: 2,
  code: 'VIP001',
  authorName: 'M',
  authorAvatar: 'https://x/m.jpg',
);

void main() {
  late _Video v;
  late ProviderContainer c;

  Future<void> pump(WidgetTester tester, List<StoryItem> items,
      {bool muted = false}) async {
    v = _Video();
    VideoPlayerPlatform.instance = v;
    c = ProviderContainer(overrides: [
      ...await testOverrides(),
      socialRepositoryProvider.overrideWithValue(_Repo(items)),
    ]);
    addTearDown(c.dispose);
    if (muted) c.read(mediaMutedProvider.notifier).state = true;
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: wrapScreen(const StoryViewerScreen(code: 'VIP001')),
    ));
    // `pumpAndSettle` EMAS — taymer istoryani oxirigacha surib yuboradi.
    await settle(tester, frames: 6);
  }

  /// Taymerlar (qo'riqchi, rasm keshi) ochiq qolmasin.
  Future<void> tearDownTree(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 11));
  }

  double progress(WidgetTester tester) => tester
      .widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator))
      .value!;

  /// Sarlavha (X tugmasi) ustidagi shaffoflik.
  double chromeOpacity(WidgetTester tester) => tester
      .widget<AnimatedOpacity>(find
          .ancestor(
              of: find.byIcon(Icons.close_rounded),
              matching: find.byType(AnimatedOpacity))
          .first)
      .opacity;

  testWidgets('bosib turilganda VIDEO ham to‘xtaydi, belgilar yashirinadi, '
      'qo‘yib yuborilganda davom etadi', (tester) async {
    await pump(tester, const [_video]);
    expect(v.playing, hasLength(1), reason: 'video o‘ynamadi');
    expect(chromeOpacity(tester), 1);

    final center = tester.getCenter(find.byType(StoryViewerScreen));
    final g = await tester.startGesture(center);
    // Uzoq bosish 500 ms dan keyin taniladi.
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump();
    expect(v.playing, isEmpty,
        reason: 'bosib turilganda video o‘ynab turaverdi');
    expect(chromeOpacity(tester), 0,
        reason: 'bosib turilganda ustki belgilar yashirilmadi');

    // Bosib turilgan paytda progress ham joyida turadi.
    final before = progress(tester);
    await tester.pump(const Duration(seconds: 2));
    expect(progress(tester), before);

    await g.up();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(v.playing, hasLength(1),
        reason: 'qo‘yib yuborilganda video davom etmadi');
    expect(chromeOpacity(tester), 1);
    await tester.pump(const Duration(seconds: 1));
    expect(progress(tester), greaterThan(before));
    await tearDownTree(tester);
  });

  testWidgets('izoh varag‘i ochiq turganda video to‘xtaydi, yopilganda '
      'davom etadi', (tester) async {
    await pump(tester, const [_video]);
    expect(v.playing, hasLength(1));

    await tester.tap(find.text(LUz().storyCommentHint));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(v.playing, isEmpty,
        reason: 'varaq ochiq — video orqada ovozi bilan o‘ynab turibdi');

    // Varaqdan tashqariga (tepaga) tegib yopamiz.
    await tester.tapAt(const Offset(20, 20));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(v.playing, hasLength(1),
        reason: 'varaq yopilgach video davom etmadi');
    await tearDownTree(tester);
  });

  testWidgets('video istoryada OVOZ tugmasi bor va u umumiy holatni '
      'o‘zgartiradi', (tester) async {
    await pump(tester, const [_video]);
    final mute = find.byKey(const ValueKey('video-mute'));
    expect(mute, findsOneWidget);
    expect(find.byIcon(Icons.volume_up_rounded), findsOneWidget);
    final id = v.playing.single;

    await tester.tap(mute);
    await tester.pump();
    expect(c.read(mediaMutedProvider), isTrue);
    expect(find.byIcon(Icons.volume_off_rounded), findsOneWidget);
    expect(v.volumes[id], 0, reason: 'video ovozi o‘chmadi');

    await tester.tap(mute);
    await tester.pump();
    expect(c.read(mediaMutedProvider), isFalse);
    expect(v.volumes[id], 1);
    await tearDownTree(tester);
  });

  testWidgets('ovoz oldindan o‘chiq bo‘lsa video JIM boshlanadi',
      (tester) async {
    await pump(tester, const [_video], muted: true);
    expect(v.volumes[v.playing.single], 0,
        reason: 'lentada o‘chirilgan ovoz istoryada yoqilib ketdi');
    await tearDownTree(tester);
  });

  testWidgets('rasm istoryada ovoz tugmasi YO‘Q', (tester) async {
    await pump(tester, const [_image]);
    expect(find.byKey(const ValueKey('video-mute')), findsNothing);
    await tearDownTree(tester);
  });
}
