import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/features/discover/discover_cards.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// NAMUNA (DEMO) BIZNESLAR (2026-09-25).
///
/// Egasi: "demo profillar qilib qo'ysang — har sohadan, profil to'liq".
/// Server `demo: true` qaytaradi; ilova «Namuna» deb ko'rsatadi va
/// "tasdiqlangan" nishonini chizmaydi — tashrifchi aldanmasin.
class _Repo extends BusinessRepository {
  _Repo(this.demo) : super(ApiClient());
  final bool demo;

  Business get _b => Business(
        companyId: 'NAMUNAKAFE',
        displayName: 'Kofe Burchak',
        category: 'cafe',
        subcategory: 'Qahvaxona',
        status: 'active',
        createdAt: DateTime.now(),
        isDemo: demo,
      );

  @override
  Future<Result<Business>> byId(String id) async => Ok(_b);

  @override
  Future<Result<List<Business>>> mine() async => const Ok([]);

  @override
  Future<Result<List<CatalogItem>>> catalog(String companyId) async => const Ok([]);

  @override
  Future<Result<List<Post>>> posts(String companyId) async => const Ok([]);
}

void main() {
  test('model: `demo` o‘qiladi, bo‘lmasa — oddiy biznes', () {
    expect(Business.fromJson({'companyId': 'NAMUNAKAFE', 'demo': true}).isDemo, isTrue);
    expect(Business.fromJson({'companyId': 'ELITE'}).isDemo, isFalse);
  });

  Future<void> pump(WidgetTester tester, Widget child, {required bool demo}) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        businessRepositoryProvider.overrideWithValue(_Repo(demo)),
      ],
      child: wrapScreen(child),
    ));
    await settle(tester, frames: 16);
  }

  testWidgets('namuna profil: «Namuna» kapsulasi bor', (tester) async {
    await pump(tester, const ProfileScreen(companyId: 'NAMUNAKAFE'), demo: true);
    expect(find.byKey(const ValueKey('sample-business-notice')), findsOneWidget);
    expect(find.text(LUz().sampleBusinessNotice), findsOneWidget);
  });

  testWidgets('haqiqiy biznes: namuna kapsulasi yo‘q', (tester) async {
    await pump(tester, const ProfileScreen(companyId: 'NAMUNAKAFE'), demo: false);
    expect(find.byKey(const ValueKey('sample-business-notice')), findsNothing);
  });

  testWidgets('Kashfiyot kartasi: namunada «Namuna», «Yangi» emas', (tester) async {
    final b = Business(companyId: 'NAMUNAKAFE', displayName: 'Kofe Burchak', createdAt: DateTime.now(), isDemo: true);
    await pump(tester, Scaffold(body: DiscoverBusinessCard(business: b)), demo: true);
    // Belgi katta harflarda chiziladi.
    expect(find.text(LUz().sampleBadge.toUpperCase()), findsOneWidget);
    expect(find.text(LUz().storeNew.toUpperCase()), findsNothing);
  });
}
