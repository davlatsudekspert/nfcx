import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
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
Future<ProviderContainer> _container(FakeSavesRepository repo,
    {List<String> localReels = const [], List<String> localFav = const []}) async {
  final base = await testOverrides();
  final c = ProviderContainer(overrides: [
    ...base,
    savesRepositoryProvider.overrideWithValue(repo),
  ]);
  addTearDown(c.dispose);
  final prefs = c.read(prefsProvider);
  await prefs.setSavedReels(localReels);
  await prefs.setCatalogFavorites(localFav);
  return c;
}

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
    expect(c.read(prefsProvider).savedReels.toSet(), {'p:12', 'c:7'},
        reason: 'kesh ham yangilandi');
  });

  test('eski versiyada telefonda saqlanganlar serverga ko‘chadi', () async {
    final repo = FakeSavesRepository(server: {SaveKind.reel: {'p:1'}});
    final c = await _container(repo, localReels: ['p:2']);
    c.read(savedReelsProvider);
    await _flush();
    expect(c.read(savedReelsProvider), {'p:1', 'p:2'});
    expect(repo.server[SaveKind.reel], {'p:1', 'p:2'});
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

  test('internet yo‘q / eski server: telefonda ishlayveradi', () async {
    final repo = FakeSavesRepository(offline: true);
    final c = await _container(repo, localFav: ['A/1']);
    final fav = c.read(catalogFavoritesProvider.notifier);
    await _flush();
    expect(c.read(catalogFavoritesProvider), {'A/1'}, reason: 'kesh o‘chmadi');
    await fav.toggle('B/2');
    expect(c.read(catalogFavoritesProvider), {'A/1', 'B/2'});
    expect(c.read(prefsProvider).catalogFavorites.toSet(), {'A/1', 'B/2'});
    // Internet qaytdi — keyingi sinxronda serverga ko'chadi.
    repo.offline = false;
    await fav.sync();
    expect(repo.server[SaveKind.listing], {'A/1', 'B/2'});
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
