import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/auth_repository.dart';
import 'package:nfcstore_nova/data/repositories/discover_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Testlarda ishlatiladigan namunaviy ma'lumot.
///
/// BU ISHLAB CHIQARISH KODIGA KIRMAYDI — faqat `test/` ichida.
const testUser = User(
  id: 1,
  email: 'test@nfcstore.uz',
  name: 'Test Foydalanuvchi',
  phone: '+998901234567',
);

const testIds = [
  NfcId(
    code: '48210377',
    name: 'Test Foydalanuvchi',
    primary: true,
    taps: 12,
    views: 40,
    followers: 5,
  ),
];

/// Tarmoqqa CHIQMAYDIGAN auth repository.
///
/// Testda haqiqiy so'rov yuborilsa natija tarmoqqa bog'liq bo'lardi —
/// ya'ni test beqaror bo'lardi.
class FakeAuthRepository extends AuthRepository {
  FakeAuthRepository({this.signedIn = true}) : super(ApiClient());

  final bool signedIn;

  @override
  Future<Result<({User user, List<NfcId> ids})>> restore() async => signedIn
      ? const Ok((user: testUser, ids: testIds))
      : const Err(AppError(AppErrorKind.unauthorized));

  @override
  Future<Result<({User user, List<NfcId> ids})>> me() async => restore();

  @override
  Future<void> logout() async {}
}

class FakeSocialRepository extends SocialRepository {
  FakeSocialRepository() : super(ApiClient());

  @override
  Future<Result<List<Post>>> feed({int page = 1}) async => const Ok([]);

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      const Ok([]);

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async => const Ok([]);
}

class FakeDiscoverRepository extends DiscoverRepository {
  FakeDiscoverRepository() : super(ApiClient());

  @override
  Future<Result<List<NfcId>>> suggested() async => const Ok(testIds);

  @override
  Future<Result<List<NfcId>>> searchPeople(String q) async => const Ok(testIds);

  @override
  Future<Result<List<Post>>> trending({int page = 1}) async => const Ok([]);
}

/// Test uchun tayyor `ProviderContainer` overridelari.
Future<List<Override>> testOverrides({bool signedIn = true}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await Prefs.open();
  return [
    prefsProvider.overrideWithValue(prefs),
    authRepositoryProvider.overrideWithValue(FakeAuthRepository(signedIn: signedIn)),
    socialRepositoryProvider.overrideWithValue(FakeSocialRepository()),
    discoverRepositoryProvider.overrideWithValue(FakeDiscoverRepository()),
  ];
}

/// Bitta ekranni mavzu va tarjimalar bilan o'raydi.
Widget wrapScreen(
  Widget child, {
  NfcTokens? tokens,
  Locale locale = const Locale('uz'),
}) {
  final t = tokens ?? NfcTokens.pearl;
  return MaterialApp(
    theme: buildTheme(t),
    locale: locale,
    supportedLocales: LocaleController.supported,
    localizationsDelegates: const [
      L.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    home: child,
  );
}

/// Routerni test uchun quradi.
GoRouter buildTestRouter() {
  final container = ProviderContainer(overrides: [
    // Router faqat sessiya holatini o'qiydi; bu yerda u muhim emas,
    // chunki test marshrut MAVJUDLIGINI tekshiradi.
    authRepositoryProvider.overrideWithValue(FakeAuthRepository()),
  ]);
  addTearDownContainer(container);
  return container.read(routerProvider);
}

final _containers = <ProviderContainer>[];
void addTearDownContainer(ProviderContainer c) => _containers.add(c);
void disposeTestContainers() {
  for (final c in _containers) {
    c.dispose();
  }
  _containers.clear();
}

/// Animatsiyalar tugashini kutadi.
///
/// `pumpAndSettle` ISHLAMAYDI: ambient fon va NFC orb ataylab CHEKSIZ
/// aylanadi, ya'ni daraxt hech qachon "tinch" holatga kelmaydi.
/// Shuning uchun belgilangan miqdorda kadr suriladi.
Future<void> settle(WidgetTester tester, {int frames = 12}) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 80));
  }
}

/// Manzil routerda mavjudmi.
///
/// `GoRouter.routeInformationParser` haqiqiy moslashtirish mantig'ini
/// ishlatadi, shuning uchun bu tekshiruv haqiqiy navigatsiya bilan
/// bir xil natija beradi.
bool routeExists(GoRouter router, String location) {
  final match = router.configuration.findMatch(Uri.parse(location));
  return match.routes.isNotEmpty && match.error == null;
}

/// Routerli ekranni mavzu va tarjimalar bilan o'raydi.
///
/// Tap testlari uchun kerak: bosilgandan keyin QAYERGA borilgani
/// tekshiriladi, ya'ni haqiqiy navigatsiya bo'lishi shart.
Widget wrapRouter(GoRouter router, {NfcTokens? tokens}) {
  final t = tokens ?? NfcTokens.ocean;
  return MaterialApp.router(
    routerConfig: router,
    theme: buildTheme(t),
    locale: const Locale('uz'),
    supportedLocales: LocaleController.supported,
    localizationsDelegates: const [
      L.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
  );
}
