import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:nfcstore_nova/features/business/business_screens.dart';
import 'package:nfcstore_nova/features/entry/splash_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/features/settings/app_lock.dart';
import 'package:nfcstore_nova/features/social/feed_card.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/features/social/moderation.dart';
import 'package:nfcstore_nova/core/utils/sharing.dart';
import 'package:nfcstore_nova/design/widgets/states.dart';
import 'package:nfcstore_nova/design/widgets/nova_scaffold.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class _FakeSecure extends SecureStore {
  _FakeSecure() : super(const FlutterSecureStorage());
  String? _pin;

  @override
  Future<String?> readPin() async => _pin;
  @override
  Future<void> writePin(String pin) async => _pin = pin;
  @override
  Future<void> deletePin() async => _pin = null;
  @override
  Future<void> clear() async {}
}

class _LogoutSpy extends FakeAuthRepository {
  int logouts = 0;
  @override
  Future<void> logout() async => logouts++;
}

/// Internet yo'q: birinchi [fails] urinish `offline`, keyin sessiya bor.
class _FlakyAuth extends FakeAuthRepository {
  _FlakyAuth(this.fails, {this.kind = AppErrorKind.offline});
  int fails;
  final AppErrorKind kind;
  int calls = 0;

  @override
  Future<Result<({User user, List<NfcId> ids})>> restore() async {
    calls++;
    if (fails > 0) {
      fails--;
      return Err(AppError(kind));
    }
    return super.restore();
  }
}

/// Haqiqiy `me()` kabi: har chaqiruvda JSON'dan YANGI obyektlar.
class _FreshAuth extends FakeAuthRepository {
  @override
  Future<Result<({User user, List<NfcId> ids})>> restore() async => Ok((
        user: testUser,
        ids: [
          for (final i in testIds)
            NfcId(code: i.code, name: i.name, primary: i.primary),
        ],
      ));
}

/// `followStats` so'rovlarini sanaydi.
class _StatsSpy extends ProfileRepository {
  _StatsSpy() : super(ApiClient());
  final asked = <String>[];

  @override
  Future<Result<FollowStats>> followStats(String code) async {
    asked.add(code);
    return const Ok((followers: 0, following: 0, isFollowing: false));
  }

  @override
  Future<Result<List<NfcId>>> followList(String code,
          {String dir = 'followers'}) async =>
      const Ok([]);
}

/// `feed()` / `postsOf()` necha marta chaqirilganini sanaydi.
class _CountingSocial extends FakeSocialRepository {
  int feeds = 0;
  int own = 0;

  @override
  Future<Result<List<Post>>> feed({int page = 1}) async {
    feeds++;
    return const Ok([]);
  }

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async {
    own++;
    return const Ok([]);
  }
}

/// Qaysi yo'l so'ralganini yozib boradi; har yo'lga bitta post.
class _PathApi extends ApiClient {
  final paths = <String>[];

  @override
  Future<Result<T>> get<T>(String path,
      {Map<String, dynamic>? query, bool auth = true}) async {
    paths.add(path);
    return Ok({
      'posts': [
        {'id': 7, 'code': 'ACME', 'caption': path},
      ],
    } as T);
  }
}

/// Tasdiqlangan audit topilmalari (F-H3, F-H5, F-H6, F-H7, F-M4, F-M5,
/// F-M11, F-M12).
void main() {
  group('Kompaniya postini ulashish /c/ havolasi (F-M5)', () {
    for (final company in [true, false]) {
      testWidgets(company ? 'kompaniya -> /c/<ID>' : 'shaxsiy -> /<KOD>',
          (tester) async {
        String? shared;
        shareInvokerOverride = (t, _) async => shared = t;
        addTearDown(() => shareInvokerOverride = null);
        await tester.pumpWidget(ProviderScope(
          overrides: await testOverrides(),
          child: wrapScreen(Scaffold(
            body: ListView(children: [
              FeedCard(
                post: Post(
                  id: 5,
                  code: 'NFCSTOREUZ',
                  authorName: 'NFCSTORE',
                  authorKind: company ? 'company' : 'card',
                  text: 'salom',
                ),
              ),
            ]),
          )),
        ));
        await tester.pump();
        await tester.tap(find.byTooltip(LUz().actionShare));
        await tester.pump();
        expect(shared, isNotNull);
        expect(shared!.contains('/c/NFCSTOREUZ'), company);
        // Ulashish oynasi va Tooltip taymerlari tugasin.
        await tester.pump(const Duration(seconds: 10));
      });
    }
  });

  testWidgets('"Saqlash" paneli klaviatura USTIDA (F-L10)', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    // Klaviatura ochiq: 300 dp.
    tester.view.viewInsets = const FakeViewPadding(bottom: 300 * 3);
    addTearDown(tester.view.reset);
    await tester.pumpWidget(wrapScreen(NovaScaffold(
      title: 'Tahrirlash',
      body: ListView(children: const [TextField()]),
      bottomNav: const SizedBox(
          key: ValueKey('save-bar'), height: 60, width: double.infinity),
    )));
    await tester.pump();
    final bottom =
        tester.getBottomLeft(find.byKey(const ValueKey('save-bar'))).dy;
    expect(bottom, lessThanOrEqualTo(844 - 300 + .5),
        reason: 'panel klaviatura ortida qolmasin');
  });

  testWidgets('qora fonda holat paneli o‘qiladi (F-M4)', (tester) async {
    await tester.pumpWidget(wrapScreen(const Scaffold(
      backgroundColor: Colors.black,
      body: StatePanel(
          icon: Icons.videocam_off_rounded, title: 'SARLAVHA', onDark: true),
    )));
    final style = tester.widget<Text>(find.text('SARLAVHA')).style;
    expect(style?.color, Colors.white,
        reason: 'Ivory text1 qora fonda ~1.2:1 — ko‘rinmasdi');
  });

  group('Biznes yuklanayotganda "biznes yo‘q" deyilmaydi (F-M12)', () {
    Future<void> pump(WidgetTester tester, Override o) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [...await testOverrides(), o],
        child: wrapScreen(const BusinessDashboardScreen()),
      ));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
    }

    testWidgets('yuklanmoqda — skelet, "yarating" tugmasi yo‘q',
        (tester) async {
      final never = Completer<List<Business>>();
      await pump(tester,
          myBusinessesProvider.overrideWith((ref) => never.future));
      expect(find.text(LUz().bizNone), findsNothing);
      expect(find.text(LUz().bizCreate), findsNothing);
    });

    testWidgets('xato — sabab va qayta urinish', (tester) async {
      await pump(
          tester,
          myBusinessesProvider.overrideWith(
              (ref) async => throw const AppError(AppErrorKind.offline)));
      expect(find.text(LUz().bizNone), findsNothing);
      expect(find.text(LUz().actionRetry), findsOneWidget);
    });

    testWidgets('haqiqatan yo‘q — "Biznes yaratish"', (tester) async {
      await pump(tester,
          myBusinessesProvider.overrideWith((ref) async => const []));
      expect(find.text(LUz().bizNone), findsOneWidget);
      expect(find.text(LUz().bizCreate), findsOneWidget);
    });
  });

  test('sessiya yangilanishi Reels’ni QAYTA YUKLAMAYDI (P-H3)', () async {
    final social = _CountingSocial();
    final c = ProviderContainer(overrides: [
      ...await testOverrides(),
      socialRepositoryProvider.overrideWithValue(social),
      authRepositoryProvider.overrideWithValue(_FreshAuth()),
    ]);
    addTearDown(c.dispose);
    await c.read(sessionProvider.notifier).restore();
    final sub = c.listen(reelsProvider, (_, __) {});
    addTearDown(sub.close);
    await c.read(reelsProvider.future);
    expect(social.feeds, 1);
    expect(social.own, 1, reason: 'o‘z videolari ham so‘raladi');

    // Profil tahriri / NFC ID o'zgarishi -> refresh(): o'sha odam.
    await c.read(sessionProvider.notifier).refresh();
    await Future<void>.delayed(Duration.zero);
    await c.read(reelsProvider.future);
    expect(social.feeds, 1,
        reason: 'har refresh Reels’ni boshidan yuklab, videoni uzardi');
  });

  testWidgets('o‘z postim uchun obuna holati SO‘RALMAYDI (P-M3)',
      (tester) async {
    final spy = _StatsSpy();
    final c = ProviderContainer(overrides: [
      ...await testOverrides(),
      profileRepositoryProvider.overrideWithValue(spy),
    ]);
    addTearDown(c.dispose);
    // Ilovadagidek: lenta ko'ringanda sessiya allaqachon faol.
    await c.read(sessionProvider.notifier).restore();
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: wrapScreen(Scaffold(
        body: ListView(children: [
          FeedCard(
              post: Post(
                  id: 1, code: testIds.first.code, authorName: 'Men', text: 'a')),
          const FeedCard(
              post: Post(id: 2, code: 'TTS075', authorName: 'Boshqa', text: 'b')),
        ]),
      )),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(spy.asked.contains(testIds.first.code), isFalse,
        reason: 'o‘z postida "Kuzatish" yo‘q — so‘rov ham kerak emas');
    expect(spy.asked, contains('TTS075'));
  });

  group('Kompaniya posti ochiladi (F-H5)', () {
    test('havola kompaniya belgisini olib yuradi', () {
      expect(Routes.post(7, code: 'ACME', company: true),
          '/post/7?code=ACME&company=1');
      expect(Routes.post(7, code: 'ABC123'), '/post/7?code=ABC123');
    });

    test('kompaniya posti kompaniya ro‘yxatidan olinadi', () async {
      final api = _PathApi();
      final repo = SocialRepository(api);
      final r = await repo.postIn('ACME', 7, company: true);
      expect(api.paths.single, '/api/companies/ACME/posts');
      final p = (r as Ok<Post>).value;
      expect(p.isCompany, isTrue,
          reason: 'layk/izoh/shikoyat kompaniya yo‘lidan ketsin');

      final personal = await repo.postIn('ABC123', 7);
      expect(api.paths.last, '/api/records/ABC123/posts');
      expect((personal as Ok<Post>).value.isCompany, isFalse);
    });
  });

  group('Sessiya internet yo‘qligida CHIQARIB YUBORMAYDI (F-H3)', () {
    for (final kind in [
      AppErrorKind.offline,
      AppErrorKind.timeout,
      AppErrorKind.server,
    ]) {
      testWidgets('${kind.name} — Splash + sabab, keyin o‘zi tiklanadi',
          (tester) async {
        final auth = _FlakyAuth(1, kind: kind);
        final c = ProviderContainer(overrides: [
          ...await testOverrides(),
          authRepositoryProvider.overrideWithValue(auth),
        ]);
        addTearDown(c.dispose);
        await tester.pumpWidget(UncontrolledProviderScope(
          container: c,
          child: wrapScreen(const SplashScreen()),
        ));
        await tester.pump();
        await tester.pump();
        final s = c.read(sessionProvider);
        expect(s, isA<SessionRestoring>(),
            reason: 'tarmoq xatosi odamni Welcome ga chiqarmasin');
        expect((s as SessionRestoring).error?.kind, kind);
        expect(find.byKey(const ValueKey('splash-error')), findsOneWidget);
        expect(find.text(LUz().actionRetry), findsOneWidget);

        // Avtomatik qayta urinish (2 s).
        await tester.pump(const Duration(seconds: 2));
        await tester.pump();
        expect(c.read(sessionProvider), isA<SessionActive>());
        expect(auth.calls, 2);
      });
    }

    test('haqiqiy "sessiya yo‘q" (unauthorized) — anonim', () async {
      final c = ProviderContainer(overrides: [
        ...await testOverrides(),
        authRepositoryProvider.overrideWithValue(
            _FlakyAuth(99, kind: AppErrorKind.unauthorized)),
      ]);
      addTearDown(c.dispose);
      await c.read(sessionProvider.notifier).restore();
      expect(c.read(sessionProvider), isA<SessionAnonymous>());
    });

    testWidgets('"Qayta urinish" darhol tiklaydi', (tester) async {
      final auth = _FlakyAuth(1);
      final c = ProviderContainer(overrides: [
        ...await testOverrides(),
        authRepositoryProvider.overrideWithValue(auth),
      ]);
      addTearDown(c.dispose);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: wrapScreen(const SplashScreen()),
      ));
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text(LUz().actionRetry));
      await tester.pump();
      await tester.pump();
      expect(c.read(sessionProvider), isA<SessionActive>());
    });
  });

  group('Bloklanganlar ro‘yxati (F-H6)', () {
    for (final w in [320.0, 360.0, 430.0]) {
      testWidgets('${w.toInt()} dp — xatosiz chiziladi, tugmalar bor',
          (tester) async {
        tester.view.physicalSize = Size(w * 3, 2400);
        tester.view.devicePixelRatio = 3;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(ProviderScope(
          overrides: [
            ...await testOverrides(),
            blocksProvider.overrideWith((ref) async => const [
                  BlockedItem(kind: 'user', id: 'VERYLONGUSERCODE12345'),
                  BlockedItem(kind: 'company', id: 'ACME'),
                ]),
          ],
          child: wrapScreen(const BlockedScreen()),
        ));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
        expect(tester.takeException(), isNull);
        final btn = find.text(LUz().unblockUser);
        expect(btn, findsNWidgets(2));
        for (final e in btn.evaluate()) {
          final size = (e.renderObject! as RenderBox).size;
          expect(size.width.isFinite && size.width > 0, isTrue);
        }
      });
    }
  });

  group('Ilova qulfi — PIN unutilsa (F-H7, F-M11)', () {
    testWidgets('“unutdingizmi” — avval CHIQADI, keyin qulf tiklanadi',
        (tester) async {
      SharedPreferences.setMockInitialValues({'nova.appLock': true});
      final prefs = await Prefs.open();
      final spy = _LogoutSpy();
      final secure = _FakeSecure().._pin = '1234';
      final c = ProviderContainer(overrides: [
        prefsProvider.overrideWithValue(prefs),
        secureStoreProvider.overrideWithValue(secure),
        authRepositoryProvider.overrideWithValue(spy),
      ]);
      addTearDown(c.dispose);
      expect(c.read(appLockProvider).locked, isTrue);

      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        // Ishlab chiqarishdagidek: qulf `MaterialApp.builder` da.
        child: MaterialApp(
          theme: buildTheme(NfcTokens.ivory),
          locale: const Locale('uz'),
          supportedLocales: L.supportedLocales,
          localizationsDelegates: const [
            L.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          builder: (context, child) =>
              AppLockGate(child: child ?? const SizedBox.shrink()),
          home: const Text('kontent'),
        ),
      ));
      await tester.pump();

      // F-M11: qulf matnlari Material ichida — debug uslubi yo'q.
      final title = tester.widget<Text>(find.text(LUz().lockTitle));
      final style = DefaultTextStyle.of(
              tester.element(find.text(LUz().lockTitle)))
          .style
          .merge(title.style);
      expect(style.decoration, isNot(TextDecoration.underline));

      // Kichik ekranda ham tugmaga yetib boriladi (qulf ekrani suriladi).
      await tester.ensureVisible(find.byKey(const ValueKey('lock-forgot')));
      await tester.tap(find.byKey(const ValueKey('lock-forgot')));
      await tester.pump();
      await tester
          .ensureVisible(find.byKey(const ValueKey('lock-forgot-confirm')));
      await tester.tap(find.byKey(const ValueKey('lock-forgot-confirm')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(spy.logouts, 1, reason: 'qulf olib tashlanishidan oldin chiqish');
      expect(c.read(sessionProvider), isA<SessionAnonymous>());
      expect(c.read(appLockProvider).enabled, isFalse);
      expect(c.read(appLockProvider).locked, isFalse);
      expect(await secure.readPin(), isNull);
      expect(tester.takeException(), isNull);
    });
  });
}
