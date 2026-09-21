import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/demo/demo_screens.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';

import 'helpers.dart';

/// DEMO HAQIQIY MA'LUMOTGA TEGMASLIGI KERAK.
///
/// Ildiz doirasiga "tegilsa DARHOL yiqiladigan" repozitoriy
/// qo'yiladi. Demo ekran uni bir marta chaqirsa ham sinov yiqiladi.
///
/// Bu quruq nazariya emas: `myFollowingProvider` da `dependencies`
/// yo'q edi va demo profil ochilganda u AYNAN shu ildiz
/// repozitoriysiga chiqib, haqiqiy hisob uchun tarmoq so'rovi
/// yuborardi.
class _ForbiddenProfileRepository extends ProfileRepository {
  _ForbiddenProfileRepository() : super(ApiClient());

  final touched = <String>[];

  Never _boom(String m) {
    touched.add(m);
    throw StateError('DEMO ILDIZ REPOZITORIYSIGA TEGDI: $m');
  }

  @override
  Future<Result<NfcId>> byCode(String code) async => _boom('byCode($code)');

  @override
  Future<Result<List<NfcId>>> followList(String code,
          {String dir = 'followers'}) async =>
      _boom('followList($code, $dir)');

  @override
  Future<Result<void>> follow(String code) async => _boom('follow($code)');

  @override
  Future<Result<void>> unfollow(String code) async => _boom('unfollow($code)');

  @override
  Future<Result<FollowStats>> followStats(String code) async =>
      _boom('followStats($code)');
}

void main() {
  testWidgets('demo shaxsiy profil ildiz repozitoriysiga TEGMAYDI',
      (tester) async {
    final forbidden = _ForbiddenProfileRepository();

    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        profileRepositoryProvider.overrideWithValue(forbidden),
      ],
      child: wrapScreen(const DemoPersonalScreen()),
    ));
    await settle(tester, frames: 30);

    expect(forbidden.touched, isEmpty,
        reason: 'demo ekran haqiqiy hisob repozitoriysini chaqirdi: '
            '${forbidden.touched}');
    expect(tester.takeException(), isNull);
  });

  testWidgets('demo biznes profil ildiz repozitoriysiga TEGMAYDI',
      (tester) async {
    final forbidden = _ForbiddenProfileRepository();

    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        profileRepositoryProvider.overrideWithValue(forbidden),
      ],
      child: wrapScreen(const DemoBusinessScreen()),
    ));
    await settle(tester, frames: 30);

    expect(forbidden.touched, isEmpty,
        reason: 'demo biznes ekran haqiqiy repozitoriyni chaqirdi: '
            '${forbidden.touched}');
    expect(tester.takeException(), isNull);
  });

  testWidgets('demo ekranda HAQIQIY demo matni ko‘rinadi (bo‘sh emas)',
      (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [...await testOverrides()],
      child: wrapScreen(const DemoPersonalScreen()),
    ));
    await settle(tester, frames: 30);

    // Bo'sh ekran ham "tegmadi" sinovidan o'tib ketardi — shuning
    // uchun mazmun borligi alohida tekshiriladi.
    expect(find.text('Zafar'), findsWidgets,
        reason: 'demo profil bo‘sh chiqdi');
  });
}
