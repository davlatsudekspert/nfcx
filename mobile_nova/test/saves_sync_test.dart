import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/data/repositories/saves_repository.dart';
import 'package:nfcstore_nova/design/widgets/states.dart';
import 'package:nfcstore_nova/features/discover/catalog_view.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:flutter/widgets.dart';

import 'helpers.dart';

/// SAQLANGANLAR HISOBGA BOG'LANGAN (egasining talabi, 2026-09).
///
/// Ilgari saqlangan Reels va katalog sevimlilari faqat telefonda
/// turardi — telefon almashsa yo'qolardi. Endi server asosiy manba,
/// telefon — kesh. Eski versiyada saqlanganlar serverga BIR MARTA
/// ko'chiriladi; internet bo'lmasa bosish baribir ishlaydi.
class _Auth extends FakeAuthRepository {
  _Auth();
  User user = testUser;

  @override
  Future<Result<({User user, List<NfcId> ids})>> restore() async =>
      Ok((user: user, ids: ids));
}

Future<({ProviderContainer c, _Auth auth})> _boot(FakeSavesRepository repo,
    {List<String> localReels = const [],
    List<String> localFav = const []}) async {
  final base = await testOverrides();
  // Eski versiya: hisobsiz umumiy kalit.
  final prefs = await Prefs.open();
  await prefs.setSavedReels(localReels);
  await prefs.setCatalogFavorites(localFav);
  final auth = _Auth();
  final c = ProviderContainer(overrides: [
    ...base,
    authRepositoryProvider.overrideWithValue(auth),
    savesRepositoryProvider.overrideWithValue(repo),
  ]);
  addTearDown(c.dispose);
  c.read(sessionProvider);
  await _flush();
  expect(c.read(sessionProvider), isA<SessionActive>());
  return (c: c, auth: auth);
}

Future<ProviderContainer> _container(FakeSavesRepository repo,
        {List<String> localReels = const [],
        List<String> localFav = const []}) async =>
    (await _boot(repo, localReels: localReels, localFav: localFav)).c;

Future<void> _flush() => Future<void>.delayed(const Duration(milliseconds: 10));

void main() {
  test('yangi telefon: serverdagi saqlanganlar keladi', () async {
    final repo = FakeSavesRepository(server: {
      SaveKind.reel: {'p:12', 'c:7'},
      SaveKind.listing: {'NFCSTORE/p1'},
    });
    final c = await _container(repo);
    c.read(savedReelsProvider);
    c.read(catalogFavoritesProvider);
    await _flush();
    expect(c.read(savedReelsProvider), {'p:12', 'c:7'});
    expect(c.read(catalogFavoritesProvider), {'NFCSTORE/p1'});
    expect(c.read(prefsProvider).savesOf('reel', testUser.id).toSet(),
        {'p:12', 'c:7'},
        reason: 'kesh ham yangilandi (hisob kalitida)');
  });

  test('eski versiyada telefonda saqlanganlar serverga BIR MARTA ko‘chadi',
      () async {
    final repo = FakeSavesRepository(server: {SaveKind.reel: {'p:1'}});
    final c = await _container(repo, localReels: ['p:2']);
    c.read(savedReelsProvider);
    await _flush();
    expect(c.read(savedReelsProvider), {'p:1', 'p:2'});
    expect(repo.server[SaveKind.reel], {'p:1', 'p:2'});
    expect(c.read(prefsProvider).savedReels, isEmpty,
        reason: 'eski umumiy kalit hisobga o‘tkazildi va o‘chirildi');

    // Boshqa qurilmada o'chirildi — bu yerda TIRILMAYDI.
    repo.server[SaveKind.reel]!.remove('p:2');
    repo.calls.clear();
    await c.read(savedReelsProvider.notifier).sync();
    expect(c.read(savedReelsProvider), {'p:1'});
    expect(repo.calls, isEmpty, reason: 'mahalliy yozuv qayta yuborilmadi');
    expect(repo.server[SaveKind.reel], {'p:1'});
  });

  test('bosish serverga yoziladi va o‘chirish ham', () async {
    final repo = FakeSavesRepository();
    final c = await _container(repo);
    final fav = c.read(catalogFavoritesProvider.notifier);
    await _flush();
    expect(await fav.toggle('KARTAUZ/u0'), isTrue);
    expect(repo.server[SaveKind.listing], {'KARTAUZ/u0'});
    expect(await fav.toggle('KARTAUZ/u0'), isFalse);
    expect(repo.server[SaveKind.listing], isEmpty);
  });

  test('internet yo‘q / eski server: telefonda ishlayveradi, keyin yuboriladi',
      () async {
    final repo = FakeSavesRepository(offline: true);
    final c = await _container(repo, localFav: ['A/1']);
    final fav = c.read(catalogFavoritesProvider.notifier);
    await _flush();
    expect(c.read(catalogFavoritesProvider), {'A/1'}, reason: 'kesh o‘chmadi');
    await fav.toggle('B/2');
    expect(c.read(catalogFavoritesProvider), {'A/1', 'B/2'});
    expect(c.read(prefsProvider).savesOf('listing', testUser.id).toSet(),
        {'A/1', 'B/2'});
    // Internet qaytdi — keyingi sinxronda serverga ko'chadi.
    repo.offline = false;
    await fav.sync();
    expect(repo.server[SaveKind.listing], {'A/1', 'B/2'});
    // Kutilayotgan bosish BIR MARTA — keyingi sinxron yana yubormaydi.
    repo.calls.clear();
    await fav.sync();
    expect(repo.calls, isEmpty);
  });

  test('offline o‘chirish ham keyin yuboriladi', () async {
    final repo = FakeSavesRepository(server: {SaveKind.reel: {'p:9'}});
    final c = await _container(repo);
    final n = c.read(savedReelsProvider.notifier);
    await _flush();
    expect(c.read(savedReelsProvider), {'p:9'});
    repo.offline = true;
    await n.toggle('p:9');
    expect(c.read(savedReelsProvider), isEmpty);
    repo.offline = false;
    await n.sync();
    expect(repo.server[SaveKind.reel], isEmpty);
    expect(c.read(savedReelsProvider), isEmpty);
  });

  test('HISOB ALMASHDI: oldingi odamning ro‘yxati ko‘rinmaydi va unga '
      'yozilmaydi', () async {
    final repo = FakeSavesRepository(server: {SaveKind.reel: {'p:1'}});
    final b = await _boot(repo);
    final c = b.c;
    c.listen(savedReelsProvider, (_, __) {});
    await _flush();
    expect(c.read(savedReelsProvider), {'p:1'});

    // Chiqish — ro'yxat bo'sh, sinxron yo'q.
    await c.read(sessionProvider.notifier).logout();
    await _flush();
    expect(c.read(savedReelsProvider), isEmpty);

    // Boshqa hisob — serverda uniki bo'sh.
    repo.server[SaveKind.reel] = <String>{};
    b.auth.user = const User(id: 2, email: 'b@nfcstore.uz');
    await c.read(sessionProvider.notifier).refresh();
    await _flush();
    expect(c.read(savedReelsProvider), isEmpty,
        reason: '1-hisobning `p:1` i 2-hisobga oqib o‘tmadi');
    expect(c.read(prefsProvider).savesOf('reel', 1), ['p:1'],
        reason: '1-hisob keshi joyida');
    expect(repo.calls, isEmpty);
  });

  test('rasm filtri rad etsa — sabab aniq aytiladi', () async {
    final l = await L.delegate.load(const Locale('uz'));
    String msg(String? cat) => describeError(
        l, AppError(AppErrorKind.validation, code: 'content_blocked', detail: cat));
    expect(msg('sexual'), l.errContentBlocked(l.blockSexual));
    expect(msg('extremism'), l.errContentBlocked(l.blockExtremism));
    expect(msg('political'), l.errContentBlocked(l.blockPolitical));
    expect(msg('violence'), contains(l.blockViolence));
    expect(msg('drugs'), contains(l.blockDrugs));
    expect(msg('hate'), contains(l.blockHate));
    expect(msg('extremism'), contains('qonun'));
  });
}
