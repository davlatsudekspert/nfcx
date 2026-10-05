import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// TEZLIK YO'LLARI (egasi, 2026-10-05: "boshqalarni profilini
/// ko'rishda sekin", "Reels ochilishi sekin").
///
/// Har biri tarmoq aylanishini KETMA-KET kutishni olib tashlaydi;
/// testlar shu kutish qaytib kelmasligini qo'riqlaydi.

/// Profil yozuvi testdan [release] bo'lguncha KELMAYDI.
class _SlowProfileRepo extends ProfileRepository {
  _SlowProfileRepo() : super(ApiClient());

  final release = Completer<void>();
  bool fails = false;

  @override
  Future<Result<NfcId>> byCode(String code) async {
    await release.future;
    if (fails) return const Err(AppError(AppErrorKind.notFound, status: 404));
    return Ok(NfcId(code: code, name: 'Begona $code'));
  }
}

class _SpySocial extends FakeSocialRepository {
  final postsCalls = <String>[];
  Completer<Result<List<Post>>>? ownGate;
  List<Post> mine = const [];
  List<Post> feedItems = const [];

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async {
    postsCalls.add(code);
    final g = ownGate;
    if (g != null) return g.future;
    return Ok(mine);
  }

  @override
  Future<Result<List<Post>>> feed({int page = 1}) async => Ok(feedItems);
}

Post _reel(int id, String code) => Post(
      id: id,
      code: code,
      authorName: code,
      text: 'reel',
      mediaUrls: const ['https://nfcstore.uz/uploads/a.mp4'],
      isVideo: true,
    );

void main() {
  testWidgets('begona profil: postlar so‘rovi profil yozuvini KUTMAYDI',
      (tester) async {
    final profiles = _SlowProfileRepo();
    final social = _SpySocial();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        profileRepositoryProvider.overrideWithValue(profiles),
        socialRepositoryProvider.overrideWithValue(social),
      ],
      child: wrapScreen(const ProfileScreen(code: 'BEGONA1')),
    ));
    await tester.pump(const Duration(milliseconds: 50));

    // Yozuv hali kelmagan — lekin postlar allaqachon so'ralgan.
    expect(profiles.release.isCompleted, isFalse);
    expect(social.postsCalls, ['BEGONA1'],
        reason: 'to‘r profil javobini kutib turibdi (ketma-ket so‘rov)');

    profiles.release.complete();
    await tester.pump(const Duration(milliseconds: 50));
    // Profil kelgach to'r QAYTA so'ramaydi — kalit o'zgarmaydi.
    expect(social.postsCalls, ['BEGONA1']);
    expect(find.text('Begona BEGONA1'), findsWidgets);
    expect(find.textContaining('${LUz().profilePosts} ·'), findsOneWidget);
  });

  testWidgets('profil topilmasa postlar to‘ri ko‘rinmaydi', (tester) async {
    final profiles = _SlowProfileRepo()..fails = true;
    final social = _SpySocial()..mine = [_reel(7, 'BEGONA1')];
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        profileRepositoryProvider.overrideWithValue(profiles),
        socialRepositoryProvider.overrideWithValue(social),
      ],
      child: wrapScreen(const ProfileScreen(code: 'BEGONA1')),
    ));
    await tester.pump(const Duration(milliseconds: 50));
    profiles.release.complete();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.textContaining('${LUz().profilePosts} ·'), findsNothing,
        reason: 'topilmagan profilda postlar to‘ri chiqdi');
    expect(tester.takeException(), isNull);
  });

  test('postlar ro‘yxati chiqilgach saqlanadi; eskirsa fonda yangilanadi',
      () async {
    var now = DateTime(2026, 10, 5, 12);
    postsClock = () => now;
    addTearDown(() => postsClock = DateTime.now);
    final social = _SpySocial();
    final c = ProviderContainer(overrides: [
      ...await testOverrides(),
      socialRepositoryProvider.overrideWithValue(social),
    ]);
    addTearDown(c.dispose);
    final posts = profilePostsProvider('ABC123');

    var sub = c.listen(posts, (_, __) {});
    await c.read(posts.future);
    sub.close();
    await Future<void>.delayed(Duration.zero);

    // Qaytib kirildi (1 daqiqa) — so'rov yo'q, ro'yxat tayyor.
    now = now.add(const Duration(minutes: 1));
    sub = c.listen(posts, (_, __) {});
    expect(c.read(posts).hasValue, isTrue);
    await Future<void>.delayed(Duration.zero);
    expect(social.postsCalls, ['ABC123']);
    sub.close();

    // Uzoq vaqtdan keyin — eski ro'yxat KO'RINADI va fonda yangilanadi.
    now = now.add(kPostsFresh);
    sub = c.listen(posts, (_, __) {});
    expect(c.read(posts).hasValue, isTrue, reason: 'skelet chiqdi');
    await c.read(posts.future);
    expect(social.postsCalls, ['ABC123', 'ABC123']);

    // Yangilash (invalidate) har doim yangisini oladi.
    c.invalidate(posts);
    await c.read(posts.future);
    expect(social.postsCalls.length, 3);
    sub.close();
  });

  test('xotirada eng ko‘pi bilan $kPostsKeepMax ta profil saqlanadi',
      () async {
    final social = _SpySocial();
    final c = ProviderContainer(overrides: [
      ...await testOverrides(),
      socialRepositoryProvider.overrideWithValue(social),
    ]);
    addTearDown(c.dispose);
    for (var i = 0; i <= kPostsKeepMax; i++) {
      final sub = c.listen(profilePostsProvider('P$i'), (_, __) {});
      await c.read(profilePostsProvider('P$i').future);
      sub.close();
    }
    await Future<void>.delayed(Duration.zero);
    expect(c.exists(profilePostsProvider('P0')), isFalse,
        reason: 'eng eski ro‘yxat bo‘shatilmadi');
    expect(c.exists(profilePostsProvider('P$kPostsKeepMax')), isTrue);
    expect(c.exists(profilePostsProvider('P1')), isTrue);
  });

  test('Reels: lenta o‘z postlarimni KUTMAYDI, ular keyin oxiriga qo‘shiladi',
      () async {
    final social = _SpySocial()
      ..ownGate = Completer()
      ..feedItems = [_reel(1, 'BOSHQA1'), _reel(2, 'BOSHQA1')];
    final c = ProviderContainer(overrides: [
      ...await testOverrides(),
      myIdsProvider.overrideWithValue(
          const [NfcId(code: 'TTS075', name: 'Men', primary: true)]),
      socialRepositoryProvider.overrideWithValue(social),
    ]);
    addTearDown(c.dispose);
    final sub = c.listen(reelsProvider, (_, __) {});
    addTearDown(sub.close);

    final first = await c.read(reelsProvider.future);
    expect(first.map((p) => p.id), [1, 2],
        reason: 'lenta o‘z postlarim javobini kutdi');

    social.ownGate!.complete(Ok([_reel(9, 'TTS075'), _reel(2, 'TTS075')]));
    await Future<void>.delayed(Duration.zero);
    expect(c.read(reelsProvider).valueOrNull?.map((p) => p.id), [1, 2, 9],
        reason: 'o‘z reelim kelgach ro‘yxat oxiriga qo‘shilmadi');
  });

  test('Reels: lenta xato bersa o‘z postlarim kutiladi va ko‘rsatiladi',
      () async {
    final social = _FailingFeed()..ownGate = Completer();
    final c = ProviderContainer(overrides: [
      ...await testOverrides(),
      myIdsProvider.overrideWithValue(
          const [NfcId(code: 'TTS075', name: 'Men', primary: true)]),
      socialRepositoryProvider.overrideWithValue(social),
    ]);
    addTearDown(c.dispose);
    final sub = c.listen(reelsProvider, (_, __) {});
    addTearDown(sub.close);

    final f = c.read(reelsProvider.future);
    await Future<void>.delayed(Duration.zero);
    social.ownGate!.complete(Ok([_reel(9, 'TTS075')]));
    expect((await f).map((p) => p.id), [9]);
  });
}

class _FailingFeed extends _SpySocial {
  @override
  Future<Result<List<Post>>> feed({int page = 1}) async =>
      const Err(AppError(AppErrorKind.offline));
}
