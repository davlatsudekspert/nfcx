
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/widgets/buttons.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/auth/social_auth.dart';
import 'package:nfcstore_nova/features/auth/social_buttons.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart'
    show SignInWithAppleButton;

import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'helpers.dart';

/// "APPLE BILAN" / "GOOGLE BILAN" KIRISH.
///
/// Bu yerda SDK chaqirilmaydi — u tizim oynasini ochadi va testda
/// ishlamaydi. Sinaladigan narsa SDK emas, ILOVANING O'ZI:
///
///   * sozlanmagan provayderning tugmasi UMUMAN chizilmaydi
///     (ishlamaydigan tugma — eng yomon variant: odam bosadi, hech
///     narsa bo'lmaydi va ilovani buzuq deb o'ylaydi);
///   * odam oynani yopsa, ekranda qizil yozuv CHIQMAYDI;
///   * server xatosi ko'rsatiladi;
///   * yangi hisob profil sozlashga, eskisi to'g'ri uyga boradi —
///     buni ilova o'zi HISOBLAMAYDI, serverning `isNew` i hal qiladi.

class _Auth extends FakeAuthRepository {
  _Auth() : super(signedIn: false);

  SocialCredential? got;
  Result<({User user, bool isNew})> reply =
      Ok((user: testUser, isNew: false));

  @override
  Future<Result<({User user, bool isNew})>> socialLogin(
    SocialCredential cred,
  ) async {
    got = cred;
    return reply;
  }
}

/// SDK o'rniga: tugma bosilganda nima qaytishini test belgilaydi.
SocialAuth _stub(Future<SocialCredential?> Function(SocialProvider) fn) =>
    SocialAuth()..override = fn;

const _bothOn = SocialAuthConfig(
  googleEnabled: true,
  googleServerClientId: 'web-id.apps.googleusercontent.com',
  appleEnabled: true,
  appleServiceId: 'uz.nfcstore.signin',
  appleRedirectUri: 'https://nfcstore.uz/api/auth/apple/callback',
);

void main() {
  // EKRAN ATAYLAB BALAND.
  //
  // `NovaScaffold` ichida `ListView` bor, ya'ni ekrandan tashqarida
  // qolgan vidjetlar UMUMAN QURILMAYDI. Oddiy 390x844 da ijtimoiy
  // tugmalar qatlam ostida qolib, `find` ularni topmasdi — testlar
  // "tugma yo'q" deb yiqilardi, holbuki ilovada ular bor va odam
  // pastga surib ko'radi.
  setUp(() {
    final v = TestWidgetsFlutterBinding.instance.platformDispatcher.views.first;
    v.physicalSize = const Size(390, 1600) * 3;
    v.devicePixelRatio = 3;
  });

  tearDown(() {
    TestWidgetsFlutterBinding.instance.platformDispatcher.views.first
      ..resetPhysicalSize()
      ..resetDevicePixelRatio();
    disposeTestContainers();
  });

  Future<_Auth> pumpLogin(
    WidgetTester tester, {
    required SocialAuthConfig config,
    SocialAuth? social,
  }) async {
    final auth = _Auth()..socialConfigValue = config;
    final base = await testOverrides(signedIn: false);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          // Standart `authRepositoryProvider` OLIB TASHLANADI.
          // Bitta provayder ikki marta override qilinsa, birinchisi
          // kuchda qoladi va bu yerdagi `_Auth` umuman ishlamasdi —
          // tugmalar chizilmay, testlar "tugma topilmadi" deb
          // yiqilardi. `prelogin_safe_area_test.dart` ham AYNAN shu
          // naqshni ishlatadi.
          ...base.where((o) => !identical(o, base[1])),
          authRepositoryProvider.overrideWithValue(auth),
          if (social != null) socialAuthProvider.overrideWithValue(social),
        ],
        child: wrapScreen(const LoginScreen()),
      ),
    );
    await settle(tester);
    return auth;
  }

  /// Router bilan: muvaffaqiyatli kirish `context.go()` ni chaqiradi,
  /// u esa `GoRouter` siz ishlamaydi. Maqsad ekranlarni sinash emas —
  /// shuning uchun manzillar oddiy yozuv bilan almashtirilgan.
  Future<_Auth> pumpRouted(
    WidgetTester tester, {
    required SocialAuth social,
  }) async {
    final auth = _Auth()..socialConfigValue = _bothOn;
    final base = await testOverrides(signedIn: false);
    final router = GoRouter(initialLocation: Routes.login, routes: [
      GoRoute(path: Routes.login, builder: (_, __) => const LoginScreen()),
      GoRoute(
          path: Routes.profileSetup,
          builder: (_, __) => const Text('SETUP')),
      GoRoute(
          path: Routes.home,
          builder: (_, __) => const Text('HOME')),
    ]);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...base.where((o) => !identical(o, base[1])),
          authRepositoryProvider.overrideWithValue(auth),
          socialAuthProvider.overrideWithValue(social),
        ],
        child: wrapRouter(router),
      ),
    );
    await settle(tester);
    return auth;
  }

  group('Ijtimoiy kirish tugmalari', () {
    testWidgets('sozlanmagan bo‘lsa tugmalar YO‘Q', (tester) async {
      await pumpLogin(tester, config: const SocialAuthConfig());
      expect(find.byType(SignInWithAppleButton), findsNothing);
      expect(find.text('Google bilan davom etish'), findsNothing);
      // Email bilan kirish ishlayveradi.
      expect(find.widgetWithText(NovaButton, 'Kirish'), findsOneWidget);
    });

    testWidgets('faqat Google sozlangan — faqat Google tugmasi',
        (tester) async {
      await pumpLogin(
        tester,
        config: const SocialAuthConfig(
          googleEnabled: true,
          googleServerClientId: 'web-id.apps.googleusercontent.com',
        ),
      );
      expect(find.text('Google bilan davom etish'), findsOneWidget);
      expect(find.byType(SignInWithAppleButton), findsNothing);
    });

    testWidgets('Apple yoqiq, lekin Services ID yo‘q — Android‘da tugma YO‘Q',
        (tester) async {
      // Android'da Apple veb oqimi bilan ishlaydi va unga Services ID
      // SHART. Usiz tugma ko'rsatilsa, u har safar xato bilan tugardi.
      await pumpLogin(
        tester,
        config: const SocialAuthConfig(appleEnabled: true),
      );
      expect(find.byType(SignInWithAppleButton), findsNothing);
    });
  });

  group('Kirish oqimi', () {
    testWidgets('odam oynani yopdi — ekranda xato YO‘Q', (tester) async {
      final auth = await pumpLogin(
        tester,
        config: _bothOn,
        social: _stub((_) async => throw const SocialCancelled()),
      );
      await tester.tap(find.text('Google bilan davom etish'));
      await settle(tester);

      expect(auth.got, isNull, reason: 'serverga so‘rov ketmasligi kerak');
      expect(find.text('Kirib bo‘lmadi. Qaytadan urinib ko‘ring.'), findsNothing);
    });

    testWidgets('SDK xatosi — jumla va texnik qator ko‘rsatiladi',
        (tester) async {
      await pumpLogin(
        tester,
        config: _bothOn,
        social: _stub((_) async => throw const SocialFailed('google_two_factor')),
      );
      await tester.tap(find.text('Google bilan davom etish'));
      await settle(tester);

      expect(find.text('Kirib bo‘lmadi. Qaytadan urinib ko‘ring.'), findsOneWidget);
      // Texnik qator EKRANDA turadi: usiz "ilova ishlamayapti" degan
      // xabardan boshqa hech narsa qolmasdi.
      expect(find.text('google_two_factor'), findsOneWidget);
    });

    testWidgets('server rad etdi — xato ko‘rsatiladi', (tester) async {
      final auth = await pumpLogin(
        tester,
        config: _bothOn,
        social: _stub((p) async => SocialCredential(
              provider: p,
              idToken: 'tok',
              nonce: 'xom',
            )),
      );
      auth.reply = const Err(AppError(
        AppErrorKind.unauthorized,
        code: 'token_invalid',
        detail: 'token_invalid',
      ));
      await tester.tap(find.text('Google bilan davom etish'));
      await settle(tester);

      expect(auth.got, isNotNull);
      expect(find.text('token_invalid'), findsOneWidget);
    });

    testWidgets('token va xom nonce AYNAN serverga uzatiladi', (tester) async {
      final auth = await pumpRouted(
        tester,
        social: _stub((p) async => SocialCredential(
              provider: p,
              idToken: 'id-token-123',
              nonce: 'xom-nonce',
              name: 'Olma Egasi',
            )),
      );
      await tester.tap(find.text('Google bilan davom etish'));
      await settle(tester);

      expect(auth.got!.provider, SocialProvider.google);
      expect(auth.got!.idToken, 'id-token-123');
      // Serverga XOM nonce boradi — u o‘zi SHA-256 ini hisoblab
      // token ichidagisi bilan solishtiradi.
      expect(auth.got!.nonce, 'xom-nonce');
      expect(auth.got!.name, 'Olma Egasi');
      expect(auth.got!.provider.wire, 'google');
    });

    testWidgets('YANGI hisob — profil sozlashga', (tester) async {
      // `isNew` ni ilova O'ZI hisoblamaydi: "sub" tanishmi yoki yo'qmi
      // — buni faqat server biladi. Shuning uchun yo'nalish ham
      // serverning javobiga qarab tanlanadi.
      final auth = await pumpRouted(
        tester,
        social: _stub((p) async =>
            SocialCredential(provider: p, idToken: 'tok', nonce: 'xom')),
      );
      auth.reply = Ok((user: testUser, isNew: true));
      await tester.tap(find.text('Google bilan davom etish'));
      await settle(tester);

      expect(find.text('SETUP'), findsOneWidget);
      expect(find.text('HOME'), findsNothing);
    });

    testWidgets('TANISH hisob — to‘g‘ri uyga', (tester) async {
      final auth = await pumpRouted(
        tester,
        social: _stub((p) async =>
            SocialCredential(provider: p, idToken: 'tok', nonce: 'xom')),
      );
      auth.reply = Ok((user: testUser, isNew: false));
      await tester.tap(find.text('Google bilan davom etish'));
      await settle(tester);

      expect(find.text('HOME'), findsOneWidget);
      expect(find.text('SETUP'), findsNothing);
    });
  });

  group('SocialAuthConfig', () {
    test('serverdan kelgan JSON o‘qiladi', () {
      final cfg = SocialAuthConfig.fromJson({
        'google': {
          'enabled': true,
          'serverClientId': 'web-id',
          'iosClientId': '',
        },
        'apple': {
          'enabled': true,
          'serviceId': 'uz.nfcstore.signin',
          'redirectUri': 'https://nfcstore.uz/api/auth/apple/callback',
        },
      });
      expect(cfg.googleEnabled, isTrue);
      expect(cfg.googleServerClientId, 'web-id');
      expect(cfg.appleServiceId, 'uz.nfcstore.signin');
    });

    test('bo‘sh yoki buzuq JSON — hammasi o‘chiq, istisno yo‘q', () {
      // Eski server yoki tarmoq xatosi odamni kirishdan to‘smasin.
      for (final json in <Map<String, dynamic>>[
        {},
        {'google': null, 'apple': null},
        {'google': 'buzuq', 'apple': 42},
      ]) {
        final cfg = SocialAuthConfig.fromJson(json);
        expect(cfg.googleEnabled, isFalse);
        expect(cfg.appleEnabled, isFalse);
        expect(cfg.showGoogle, isFalse);
        expect(cfg.showApple, isFalse);
      }
    });
  });
}
