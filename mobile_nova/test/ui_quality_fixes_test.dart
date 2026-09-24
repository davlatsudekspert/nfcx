import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/brand_logo.dart';
import 'package:nfcstore_nova/design/widgets/buttons.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/business/business_forms.dart';
import 'package:nfcstore_nova/features/business/business_screens.dart';
import 'package:nfcstore_nova/features/nfc/qr_sheet.dart';
import 'package:nfcstore_nova/features/profile/profile_edit_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'helpers.dart';

/// UI SIFATI — tasdiqlangan uchta topilma (UIQ-2, UIQ-4, UIQ-5).
///
/// UIQ-2: do'kon/analitika xato panelidagi "Qayta urinish" katalogni
///        ham qayta so'rasin (ilgari katalog xatoda qotib qolardi).
/// UIQ-4: saqlash/kirish tugmasi sessiya yangilanishi TUGAGUNCHA band
///        tursin — aks holda ikkinchi bosish ikkinchi so'rov yuborardi.
/// UIQ-5: QR varaq kichik ekranda + katta matnda toshib ketmasin.

const _offline = Err<Never>(AppError(AppErrorKind.offline));

/// Tarmoqqa chiqmaydigan biznes repozitoriysi. `companyOffline` va
/// `catalogOffline` — server javob bermayotgan holat.
class _Biz extends BusinessRepository {
  _Biz({this.companyOffline = false, this.catalogOffline = false})
      : super(ApiClient());

  bool companyOffline;
  bool catalogOffline;

  static const item = CatalogItem(id: 1, ref: 'k1', name: 'Qora kofe');

  @override
  Future<Result<List<Business>>> mine() async => Ok([
        Business.fromJson(const {'companyId': 'ACME', 'displayName': 'Acme'}),
      ]);

  @override
  Future<Result<Business>> byId(String companyId) async => companyOffline
      ? _offline
      : Ok(Business.fromJson(
          {'companyId': companyId, 'displayName': 'Acme Do‘kon'}));

  @override
  Future<Result<List<CatalogItem>>> catalog(String companyId) async =>
      catalogOffline ? _offline : const Ok([item]);

  @override
  Future<Result<Map<String, dynamic>>> stats(String companyId,
          {int days = 30}) async =>
      const Ok({});
}

/// `me()` — [gate] ochilguncha KUTADI (sekin tarmoq).
class _SlowAuth extends FakeAuthRepository {
  _SlowAuth({super.signedIn});

  Completer<void>? gate;
  int logins = 0;

  @override
  Future<Result<({User user, List<NfcId> ids})>> me() async {
    final g = gate;
    if (g != null) await g.future;
    return super.me();
  }

  @override
  Future<Result<User>> loginWithPassword({
    required String email,
    required String password,
  }) async {
    logins++;
    return const Ok(testUser);
  }
}

/// Saqlash so'rovlarini sanaydi.
class _CountingProfile extends ProfileRepository {
  _CountingProfile({this.fail = false}) : super(ApiClient());
  final bool fail;
  int updates = 0;

  @override
  Future<Result<void>> updateProfile({
    required String code,
    String? name,
    String? bio,
    String? role,
    String? avatarUrl,
    String? coverUrl,
    List<String>? musicUrls,
    bool? hiddenFromDirectory,
    Map<String, dynamic>? links,
  }) async {
    updates++;
    return fail ? const Err(AppError(AppErrorKind.server)) : const Ok(null);
  }
}

Widget _routed(Widget screen, List<Override> overrides) =>
    ProviderScope(
      overrides: overrides,
      child: MaterialApp.router(
        theme: buildTheme(NfcTokens.fallback),
        routerConfig: GoRouter(initialLocation: '/screen', routes: [
          GoRoute(
            path: '/',
            builder: (_, __) => const Scaffold(body: Text('ROOT')),
            routes: [
              GoRoute(path: 'screen', builder: (_, __) => screen),
            ],
          ),
          GoRoute(
            path: Routes.home,
            builder: (_, __) => const Scaffold(body: Text('HOME')),
          ),
        ]),
        locale: const Locale('uz'),
        supportedLocales: L.supportedLocales,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      ),
    );

void _tall(WidgetTester tester) {
  tester.view.physicalSize = const Size(390 * 3, 2400 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

NovaButton _button(WidgetTester tester, String label) =>
    tester.widget<NovaButton>(find.widgetWithText(NovaButton, label));

void main() {
  late L l;
  setUpAll(() async => l = await L.delegate.load(const Locale('uz')));

  group('UIQ-2 — "Qayta urinish" katalogni ham qayta so‘raydi', () {
    testWidgets('do‘kon: butun sahifa xatosidan keyin katalog ham keladi',
        (tester) async {
      _tall(tester);
      final biz = _Biz(companyOffline: true, catalogOffline: true);
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          businessRepositoryProvider.overrideWithValue(biz),
        ],
        child: wrapScreen(const StorefrontScreen(companyId: 'ACME')),
      ));
      await settle(tester);
      expect(find.text(l.actionRetry), findsOneWidget);

      // Internet qaytdi.
      biz
        ..companyOffline = false
        ..catalogOffline = false;
      await tester.tap(find.text(l.actionRetry));
      await settle(tester);

      expect(find.text('Acme Do‘kon'), findsOneWidget);
      expect(find.text(_Biz.item.name), findsOneWidget,
          reason: 'katalog eski xatoda qotib qoldi');
      expect(find.text(l.actionRetry), findsNothing);
    });

    testWidgets('do‘kon: katalog bo‘limidagi xatoda ham "Qayta urinish" bor',
        (tester) async {
      _tall(tester);
      final biz = _Biz(catalogOffline: true);
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          businessRepositoryProvider.overrideWithValue(biz),
        ],
        child: wrapScreen(const StorefrontScreen(companyId: 'ACME')),
      ));
      await settle(tester);
      expect(find.text('Acme Do‘kon'), findsOneWidget);
      expect(find.text(l.actionRetry), findsOneWidget,
          reason: 'katalog xatosida qayta urinish yo‘q');

      biz.catalogOffline = false;
      await tester.tap(find.text(l.actionRetry));
      await settle(tester);
      expect(find.text(_Biz.item.name), findsOneWidget);
    });

    testWidgets('analitika: katalog xatosida "Qayta urinish" ishlaydi',
        (tester) async {
      _tall(tester);
      final biz = _Biz(catalogOffline: true);
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          businessRepositoryProvider.overrideWithValue(biz),
        ],
        child: wrapScreen(const BusinessAnalyticsScreen()),
      ));
      await settle(tester);
      expect(find.text(l.actionRetry), findsOneWidget,
          reason: 'analitika katalog xatosida qayta urinish yo‘q');

      biz.catalogOffline = false;
      await tester.tap(find.text(l.actionRetry));
      await settle(tester);
      expect(find.text(_Biz.item.name), findsOneWidget);
    });
  });

  group('UIQ-4 — sessiya yangilanguncha tugma band', () {
    testWidgets('profil tahriri: ikkinchi bosish ikkinchi so‘rov yubormaydi',
        (tester) async {
      _tall(tester);
      final auth = _SlowAuth();
      final profile = _CountingProfile();
      await tester.pumpWidget(_routed(const ProfileEditScreen(), [
        ...await testOverrides(),
        authRepositoryProvider.overrideWithValue(auth),
        profileRepositoryProvider.overrideWithValue(profile),
      ]));
      await settle(tester);

      auth.gate = Completer<void>();
      await tester.tap(find.widgetWithText(NovaButton, l.actionSave));
      await tester.pump(const Duration(milliseconds: 50));
      expect(_button(tester, l.actionSave).busy, isTrue,
          reason: '`me()` hali tugamagan — tugma band turishi kerak');

      await tester.tap(find.widgetWithText(NovaButton, l.actionSave));
      await tester.pump(const Duration(milliseconds: 50));
      expect(profile.updates, 1, reason: 'ikki marta saqlandi');

      auth.gate!.complete();
      await settle(tester);
      expect(find.byType(ProfileEditScreen), findsNothing,
          reason: 'muvaffaqiyatdan keyin ekran yopiladi');
      expect(find.text('ROOT'), findsOneWidget);
    });

    testWidgets('profil tahriri: xato bo‘lsa aylanma qotib qolmaydi',
        (tester) async {
      _tall(tester);
      final profile = _CountingProfile(fail: true);
      await tester.pumpWidget(_routed(const ProfileEditScreen(), [
        ...await testOverrides(),
        authRepositoryProvider.overrideWithValue(_SlowAuth()),
        profileRepositoryProvider.overrideWithValue(profile),
      ]));
      await settle(tester);

      await tester.tap(find.widgetWithText(NovaButton, l.actionSave));
      await settle(tester, frames: 4);
      expect(profile.updates, 1);
      expect(_button(tester, l.actionSave).busy, isFalse);
      expect(find.byType(ProfileEditScreen), findsOneWidget);
    });

    testWidgets('kirish: `adopt` tugaguncha ikkinchi kirish so‘rovi yo‘q',
        (tester) async {
      _tall(tester);
      final auth = _SlowAuth(signedIn: false);
      final base = await testOverrides(signedIn: false);
      await tester.pumpWidget(_routed(const LoginScreen(), [
        ...base.where((o) => !identical(o, base[1])),
        authRepositoryProvider.overrideWithValue(auth),
      ]));
      await settle(tester);

      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), 'aziza@example.com');
      await tester.enterText(fields.at(1), 'parol12345');
      await tester.pump();

      auth.gate = Completer<void>();
      await tester.tap(find.widgetWithText(NovaButton, l.welcomeLogin));
      await tester.pump(const Duration(milliseconds: 50));
      expect(_button(tester, l.welcomeLogin).busy, isTrue,
          reason: '`adopt()` hali tugamagan — tugma band turishi kerak');

      await tester.tap(find.widgetWithText(NovaButton, l.welcomeLogin));
      await tester.pump(const Duration(milliseconds: 50));
      expect(auth.logins, 1, reason: 'ikki marta kirish so‘rovi ketdi');

      auth.gate!.complete();
      await settle(tester);
      expect(find.text('HOME'), findsOneWidget);
    });
  });

  group('UIQ-5 — QR varaq kichik ekranda toshmaydi', () {
    testWidgets('360x640, pastki panel 48 dp, matn 1.3x', (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 3;
      tester.view.padding = const FakeViewPadding(bottom: 144);
      tester.view.viewPadding = const FakeViewPadding(bottom: 144);
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.view.reset);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await tester.pumpWidget(wrapScreen(Scaffold(
        body: Builder(
          builder: (context) => Center(
            child: TextButton(
              onPressed: () => showQrSheet(context, testIds.first),
              child: const Text('QR'),
            ),
          ),
        ),
      )));
      // QR ichidagi logo YUKLANGUNCHA `QrImageView` bo'sh (0 px)
      // chiziladi — telefonda bu bir kadr, testda esa haqiqiy I/O.
      // Oldindan keshlanmasa varaq haqiqiydan 216 px past bo'lib,
      // toshish umuman ko'rinmasdi.
      await tester.runAsync(() => precacheImage(
          const AssetImage(BrandLogo.assetLogo),
          tester.element(find.text('QR'))));
      await tester.tap(find.text('QR'));
      await settle(tester);

      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.byType(QrImageView)).height, 216,
          reason: 'QR to‘liq chizilmagan — sinov ma’nosiz bo‘lardi');
      expect(find.text(testIds.first.code), findsOneWidget);
      // Eng pastki tugmalarga aylantirib yetib boriladi.
      await tester.scrollUntilVisible(
          find.widgetWithText(NovaButton, l.actionShare), 80,
          // Varaqning O'Z aylantirgichi (SelectableText ichidagisi emas).
          scrollable: find
              .ancestor(
                  of: find.byType(QrImageView),
                  matching: find.byType(Scrollable))
              .first);
      expect(find.widgetWithText(NovaButton, l.actionShare), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
