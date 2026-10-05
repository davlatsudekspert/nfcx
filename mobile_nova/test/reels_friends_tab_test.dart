import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// REELS "Reels | Do'stlar" (egasi, 2026-10-05).
///
/// "Do'stlar" — faqat obuna bo'linganlar (`/api/feed?scope=following`):
/// tab bosilganda shu ro'yxat ochiladi, yonida ularning yuzlari turadi,
/// bo'sh bo'lsa tushunarli holat va "Reels"ga qaytish tugmasi.
class _Social extends FakeSocialRepository {
  _Social(this.friends);
  final List<Post> friends;
  int followingCalls = 0;

  @override
  Future<Result<List<Post>>> followingFeed({int page = 1}) async {
    followingCalls++;
    return Ok(friends);
  }
}

class _Biz extends BusinessRepository {
  _Biz() : super(ApiClient());
  @override
  Future<Result<List<Business>>> mine() async => const Ok([]);
}

Post _reel(int id, String code, String name, {String kind = 'card'}) => Post(
      id: id,
      code: code,
      authorName: name,
      authorKind: kind,
      mediaUrls: ['https://nfcstore.uz/uploads/$code$id.mp4'],
      isVideo: true,
    );

final _all = [_reel(1, 'ALL001', 'Hamma')];

Future<({ProviderContainer c, _Social social})> _pump(
    WidgetTester tester, List<Post> friends) async {
  VideoPlayerPlatform.instance = FakeVideoPlatform();
  tester.view.physicalSize = const Size(360 * 3, 780 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final social = _Social(friends);
  final base = await testOverrides();
  final c = ProviderContainer(overrides: [
    ...base.where((o) => !identical(o, base[2])),
    socialRepositoryProvider.overrideWithValue(social),
    businessRepositoryProvider.overrideWithValue(_Biz()),
    reelsProvider.overrideWith((ref) async => _all),
    activeTabProvider.overrideWith((ref) => 3),
  ]);
  addTearDown(c.dispose);
  await tester.pumpWidget(UncontrolledProviderScope(
    container: c,
    child: wrapScreen(const ReelsScreen()),
  ));
  await settle(tester, frames: 10);
  return (c: c, social: social);
}

void main() {
  testWidgets('tepada "Reels" va "Do‘stlar", standart — Reels', (tester) async {
    final r = await _pump(tester, const []);
    expect(find.byKey(const ValueKey('reels-tab-all')), findsOneWidget);
    expect(find.byKey(const ValueKey('reels-tab-friends')), findsOneWidget);
    expect(find.text('Do‘stlar'), findsOneWidget);
    expect(r.c.read(reelsTabProvider), ReelsTab.all);
    expect(find.byKey(const ValueKey('reels-pager')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('"Do‘stlar" bosilsa — faqat obunalar reels’i, qaytsa — hammasi',
      (tester) async {
    final friends = [
      _reel(5, 'FRN001', 'Do‘st Bir'),
      // Shaxsiy 5-post va kompaniyaning 5-posti — ikki xil reel.
      _reel(5, 'SHOP01', 'Do‘kon', kind: 'company'),
    ];
    final r = await _pump(tester, friends);

    await tester.tap(find.byKey(const ValueKey('reels-tab-friends')));
    await settle(tester, frames: 10);
    expect(r.c.read(reelsTabProvider), ReelsTab.following);
    expect(find.byKey(const ValueKey('reels-pager-friends')), findsOneWidget);
    expect(find.byKey(const ValueKey('reels-pager')), findsNothing);
    expect(find.text('Do‘st Bir'), findsWidgets);
    final list = await r.c.read(followingReelsProvider.future);
    expect(list.length, 2, reason: 'bir xil id, turli muallif — ikkalasi ham');

    await tester.tap(find.byKey(const ValueKey('reels-tab-all')));
    await settle(tester, frames: 10);
    expect(r.c.read(reelsTabProvider), ReelsTab.all);
    expect(find.byKey(const ValueKey('reels-pager')), findsOneWidget);
    expect(find.text('Hamma'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('"Do‘stlar" yonida yuzlar — bir odam bir marta, 3 tagacha',
      (tester) async {
    await _pump(tester, [
      _reel(1, 'AAA001', 'Ali'),
      _reel(2, 'AAA001', 'Ali'),
      _reel(3, 'BBB002', 'Vali'),
      _reel(4, 'CCC003', 'Gani'),
      _reel(5, 'DDD004', 'Soli'),
    ]);
    final faces = find.byKey(const ValueKey('reels-friends-faces'));
    expect(faces, findsOneWidget);
    expect(
        find.descendant(of: faces, matching: find.byType(Positioned)),
        findsNWidgets(3));
  });

  testWidgets('obunalarda reels yo‘q — tushunarli holat, Reels’ga qaytish',
      (tester) async {
    final r = await _pump(tester, const []);
    expect(find.byKey(const ValueKey('reels-friends-faces')), findsNothing);
    await tester.tap(find.byKey(const ValueKey('reels-tab-friends')));
    await settle(tester, frames: 10);
    expect(find.byKey(const ValueKey('reels-following-empty')), findsOneWidget);
    expect(find.text('Do‘stlaringizda hali reels yo‘q'), findsOneWidget);
    // "Do'stlar"da ham tab paneli turadi — chiqib ketish mumkin.
    expect(find.byKey(const ValueKey('reels-tab-all')), findsOneWidget);

    await tester.tap(find.text('Reels').last);
    await settle(tester, frames: 10);
    expect(r.c.read(reelsTabProvider), ReelsTab.all);
    expect(find.byKey(const ValueKey('reels-pager')), findsOneWidget);
  });

  testWidgets('tab tanlovi boshqa bo‘limga o‘tib qaytganda saqlanadi',
      (tester) async {
    final r = await _pump(tester, [_reel(9, 'FRN009', 'Do‘st')]);
    await tester.tap(find.byKey(const ValueKey('reels-tab-friends')));
    await settle(tester, frames: 6);
    r.c.read(activeTabProvider.notifier).state = 0;
    await settle(tester, frames: 4);
    r.c.read(activeTabProvider.notifier).state = 3;
    await settle(tester, frames: 6);
    expect(r.c.read(reelsTabProvider), ReelsTab.following);
    expect(find.byKey(const ValueKey('reels-pager-friends')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
