import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/business/business_forms.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// UMUMIY KATALOG — biznes listing formasi.
///
/// Egasining talabi: har qanday biznes istalgan mahsulot yoki xizmatni
/// joylaydi (rasm(lar), nom, tavsif, narx, aksiya narxi, kategoriya,
/// o'z bo'limi, mavjudlik); xizmatda "Narx kelishiladi"; NFC turlari
/// faqat NFCSTORE uchun; eski serverda saqlanmaydigan tanlov
/// KO'RSATILMAYDI (soxta tanlov yo'q).
class _Repo extends BusinessRepository {
  _Repo() : super(ApiClient());
  final added = <Map<String, dynamic>>[];

  @override
  Future<Result<CatalogItem>> addItem(
      String companyId, Map<String, dynamic> body) async {
    added.add(body);
    return Ok(CatalogItem.fromJson({'id': 'n1', ...body}));
  }

  @override
  Future<Result<List<CatalogItem>>> catalog(String companyId) async =>
      const Ok([]);
}

class _Profile extends ProfileRepository {
  _Profile() : super(ApiClient());
  final uploaded = <String>[];

  @override
  Future<Result<String>> uploadImage(String filePath,
      {String? kind, void Function(int, int)? onProgress}) async {
    uploaded.add(filePath);
    return Ok('assets/demo/m_cards.jpg');
  }
}

Business _biz({String id = 'GOZAL', String category = 'services', int schema = 2}) =>
    Business(companyId: id, displayName: id, category: category, catalogSchema: schema);

Future<(_Repo, _Profile)> _pump(WidgetTester tester, Business b) async {
  tester.view.physicalSize = const Size(390, 1600) * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final repo = _Repo();
  final profile = _Profile();
  final base = await testOverrides();
  final router = GoRouter(initialLocation: '/', routes: [
    GoRoute(path: '/', builder: (_, __) => const Scaffold(body: Text('HOME'))),
    GoRoute(path: '/form', builder: (_, __) => const BusinessProductFormScreen()),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...base,
      activeBusinessProvider.overrideWithValue(b),
      businessRepositoryProvider.overrideWithValue(repo),
      profileRepositoryProvider.overrideWithValue(profile),
      listingImagePickerProvider.overrideWithValue(() async => '/tmp/photo.jpg'),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      theme: buildTheme(NfcTokens.ivory),
      locale: const Locale('uz'),
      supportedLocales: LocaleController.supported,
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    ),
  ));
  router.push('/form');
  await settle(tester, frames: 10);
  return (repo, profile);
}

Future<void> _tap(WidgetTester tester, String key) async {
  final f = find.byKey(ValueKey(key));
  await tester.ensureVisible(f);
  await tester.tap(f);
  await settle(tester, frames: 4);
}

void main() {
  testWidgets('xizmat: narx kelishiladi, 2 rasm, kategoriya va o‘z bo‘limi',
      (tester) async {
    final (repo, profile) = await _pump(tester, _biz());
    expect(tester.takeException(), isNull);

    await _tap(tester, 'listing-kind-service');
    await tester.enterText(find.byKey(const ValueKey('listing-name')), 'Soch turmagi');
    await _tap(tester, 'listing-add-photo');
    await _tap(tester, 'listing-add-photo');
    expect(profile.uploaded.length, 2);
    expect(find.byKey(const ValueKey('listing-photo-1')), findsOneWidget);

    await _tap(tester, 'listing-price-on-request');
    expect(find.byKey(const ValueKey('listing-price')), findsNothing,
        reason: 'narx kelishiladi — narx maydoni yashirinadi');

    await _tap(tester, 'listing-cat-beauty');
    await tester.enterText(find.byKey(const ValueKey('listing-section')), 'Sartaroshlik');
    await _tap(tester, 'listing-save');

    expect(repo.added, hasLength(1));
    final body = repo.added.single;
    expect(body['kind'], 'service');
    expect(body['priceOnRequest'], true);
    expect(body['price'], 0);
    expect(body['promotionPrice'], isNull);
    expect(body['marketCategory'], 'beauty');
    expect(body['category'], 'Sartaroshlik');
    expect((body['images'] as List).length, 2);
    expect(body['imageUrl'], (body['images'] as List).first);
    expect(find.text('HOME'), findsOneWidget, reason: 'saqlangach ortga');
  });

  testWidgets('mahsulot: narx majburiy, aksiya narxi yuboriladi', (tester) async {
    final (repo, _) = await _pump(tester, _biz(id: 'MODAUZ', category: 'shop'));
    final l = await L.delegate.load(const Locale('uz'));

    expect(find.byKey(const ValueKey('listing-price-on-request')), findsNothing,
        reason: 'mahsulotda "narx kelishiladi" yo‘q');
    await tester.enterText(find.byKey(const ValueKey('listing-name')), 'Kuzgi palto');
    await _tap(tester, 'listing-save');
    expect(repo.added, isEmpty);
    expect(find.text(l.bizPriceRequired), findsOneWidget);

    await tester.enterText(find.byKey(const ValueKey('listing-price')), '890000');
    await tester.enterText(find.byKey(const ValueKey('listing-sale')), '790000');
    await _tap(tester, 'listing-cat-fashion');
    await _tap(tester, 'listing-available');
    await _tap(tester, 'listing-save');

    final body = repo.added.single;
    expect(body['kind'], 'product');
    expect(body['price'], 890000);
    expect(body['promotionPrice'], 790000);
    expect(body['marketCategory'], 'fashion');
    expect(body['available'], false);
    expect(body['priceOnRequest'], false);
  });

  testWidgets('NFC turlari FAQAT NFCSTORE biznesida', (tester) async {
    await _pump(tester, _biz(id: 'TECHSHOP', category: 'shop'));
    await _tap(tester, 'listing-cat-electronics');
    expect(find.byKey(const ValueKey('nfc-type-card')), findsNothing);
  });

  testWidgets('NFCSTORE: elektronika → NFC karta, bo‘limga odam o‘qiydigan matn',
      (tester) async {
    final (repo, _) = await _pump(tester, _biz(id: 'NFCSTORE', category: 'shop'));
    await tester.enterText(find.byKey(const ValueKey('listing-name')), 'Metall karta');
    await tester.enterText(find.byKey(const ValueKey('listing-price')), '293000');
    await _tap(tester, 'listing-cat-electronics');
    await _tap(tester, 'nfc-type-card');
    expect(find.byKey(const ValueKey('listing-section')), findsNothing);
    await _tap(tester, 'listing-save');
    final body = repo.added.single;
    expect(body['marketCategory'], 'electronics');
    expect(body['category'], 'NFC karta', reason: 'sayt slug emas, matn ko‘rsatadi');
    expect(NfcProductType.fromCategory(body['category'] as String),
        NfcProductType.card);
  });

  testWidgets('eski server: saqlanmaydigan tanlov ko‘rsatilmaydi, izoh bor',
      (tester) async {
    await _pump(tester, _biz(schema: 1));
    expect(find.byKey(const ValueKey('listing-schema-old')), findsOneWidget);
    expect(find.byKey(const ValueKey('listing-cat-beauty')), findsNothing);
    // Bitta rasm: qo'shgandan keyin "qo'shish" plitkasi yo'qoladi.
    await _tap(tester, 'listing-add-photo');
    expect(find.byKey(const ValueKey('listing-add-photo')), findsNothing);
  });
}
