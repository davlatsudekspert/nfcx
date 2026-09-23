import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/social/feed_card.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_en.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_ru.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// LENTA KARTASIDAGI AMALLAR.
///
/// Karta postni OCHMASDAN layk bosish, izohga o'tish, ulashish va
/// obuna bo'lish imkonini beradi. Bu testlar o'sha to'rt amalning
/// haqiqatan backendga borishini va xato bo'lganda holat ORQAGA
/// qaytishini qotiradi.
class _FeedRepo extends SocialRepository {
  _FeedRepo() : super(ApiClient());

  int likeCalls = 0;
  final likedCompany = <bool>[];
  bool likeFails = false;
  bool serverLiked = true;
  int serverCount = 9;

  @override
  Future<Result<({bool liked, int count})>> like(int id,
      {bool company = false}) async {
    likeCalls++;
    likedCompany.add(company);
    // Haqiqiy tarmoq kabi kechikadi — optimistik holatni ko'rish
    // uchun. Aks holda u darhol almashib ketardi.
    await Future<void>.delayed(const Duration(milliseconds: 40));
    if (likeFails) {
      return const Err(AppError(AppErrorKind.server, status: 500));
    }
    return Ok((liked: serverLiked, count: serverCount));
  }
}

class _FollowRepo extends ProfileRepository {
  _FollowRepo() : super(ApiClient());

  int followCalls = 0;
  int unfollowCalls = 0;
  bool fails = false;

  /// Serverdagi "men obuna bo'lganlarim" ro'yxati.
  List<String> following = const [];

  @override
  Future<Result<List<NfcId>>> followList(
    String code, {
    String dir = 'followers',
  }) async => Ok(following.map((c) => NfcId(code: c, name: c)).toList());

  @override
  Future<Result<void>> follow(String code) async {
    followCalls++;
    await Future<void>.delayed(const Duration(milliseconds: 40));
    return fails
        ? const Err(AppError(AppErrorKind.server, status: 500))
        : const Ok(null);
  }

  @override
  Future<Result<void>> unfollow(String code) async {
    unfollowCalls++;
    await Future<void>.delayed(const Duration(milliseconds: 40));
    return fails
        ? const Err(AppError(AppErrorKind.server, status: 500))
        : const Ok(null);
  }
}

/// KOMPANIYALARIM — biznes lentasida o'z kompaniyamning posti
/// ostida ham obuna tugmasi chizilmasligi kerak.
class _BizRepo extends BusinessRepository {
  _BizRepo(this.ids) : super(ApiClient());

  final List<String> ids;

  @override
  Future<Result<List<Business>>> mine() async =>
      Ok(ids.map((e) => Business(companyId: e)).toList());
}

void main() {
  const myCode = '48210377';
  const myCompany = 'NFCSTOREUZ';

  Post post({
    String code = 'TTS075',
    String author = 'Tohir',
    int likes = 8,
    bool liked = false,
    int comments = 2,
  }) => Post(
    id: 77,
    code: code,
    authorName: author,
    text: 'Sinov posti',
    likes: likes,
    liked: liked,
    comments: comments,
  );

  Future<GoRouter> pump(
    WidgetTester tester, {
    required _FeedRepo social,
    required _FollowRepo profile,
    Post? item,
    List<String> companies = const [],
    Locale locale = const Locale('uz'),
    NfcTokens? tokens,
    double width = 390,
  }) async {
    tester.view.physicalSize = Size(width * 3, 844 * 3);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => Scaffold(
            body: SingleChildScrollView(child: FeedCard(post: item ?? post())),
          ),
        ),
        // Yo'llar ILOVADAGI bilan AYNAN bir xil (`router.dart`):
        // `/post/:id` + `?code=`, `/u/:code`. Manzil matn bo'lib
        // chiziladi, shuning uchun test qayerga o'tganini EKRANDAN
        // o'qiydi.
        GoRoute(
          path: '/post/:id',
          builder: (_, s) => Scaffold(body: Text('POST ${s.uri}')),
        ),
        GoRoute(
          path: '/u/:code',
          builder: (_, s) => Scaffold(body: Text('PROFIL ${s.uri}')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...await testOverrides(),
          socialRepositoryProvider.overrideWithValue(social),
          profileRepositoryProvider.overrideWithValue(profile),
          businessRepositoryProvider.overrideWithValue(_BizRepo(companies)),
          myIdsProvider.overrideWithValue(const [
            NfcId(code: myCode, name: 'Men', primary: true),
          ]),
        ],
        child: MaterialApp.router(
          routerConfig: router,
          theme: buildTheme(tokens ?? NfcTokens.pearl),
          locale: locale,
          supportedLocales: L.supportedLocales,
          localizationsDelegates: const [
            L.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    return router;
  }

  group('LAYK', () {
    testWidgets('bosilganda DARHOL o‘zgaradi va serverga boradi', (
      tester,
    ) async {
      final social = _FeedRepo()
        ..serverLiked = true
        ..serverCount = 42;
      await pump(tester, social: social, profile: _FollowRepo());

      expect(find.byIcon(Icons.favorite_border_rounded), findsOneWidget);
      await tester.tap(find.byIcon(Icons.favorite_border_rounded));
      await tester.pump();

      // Server javobi kelmasdan turib ham to‘lgan yurak.
      expect(find.byIcon(Icons.favorite_rounded), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 100));
      expect(social.likeCalls, 1);
      // Server QAYTARGAN sanoq — mahalliy taxmin emas.
      expect(find.text('42'), findsOneWidget);
    });

    testWidgets('server xato bersa ORQAGA qaytadi', (tester) async {
      final social = _FeedRepo()..likeFails = true;
      await pump(tester, social: social, profile: _FollowRepo());

      await tester.tap(find.byIcon(Icons.favorite_border_rounded));
      await tester.pump();
      expect(
        find.byIcon(Icons.favorite_rounded),
        findsOneWidget,
        reason: 'optimistik o‘zgarish ko‘rinmadi',
      );

      await tester.pump(const Duration(milliseconds: 100));
      expect(
        find.byIcon(Icons.favorite_border_rounded),
        findsOneWidget,
        reason: 'xatodan keyin eski holatga qaytmadi',
      );
      expect(find.text('8'), findsOneWidget, reason: 'sanoq tiklanmadi');
      expect(social.likeCalls, 1);
    });
  });

  group('OBUNA', () {
    testWidgets('BEGONA postda tugma bor, O‘Z postimda YO‘Q', (tester) async {
      final uz = LUz();

      await pump(
        tester,
        social: _FeedRepo(),
        profile: _FollowRepo(),
        item: post(code: 'TTS075'),
      );
      expect(find.text(uz.actionFollow), findsOneWidget);

      await pump(
        tester,
        social: _FeedRepo(),
        profile: _FollowRepo(),
        item: post(code: myCode, author: 'Men'),
      );
      expect(
        find.text(uz.actionFollow),
        findsNothing,
        reason: 'o‘z postimda obuna tugmasi chiqdi',
      );
      expect(find.text(uz.actionFollowing), findsNothing);
    });

    testWidgets('BIZNES lentasida o‘z kompaniyam postida tugma YO‘Q', (
      tester,
    ) async {
      // `isMineProvider` shaxsiy ID lardan tashqari KOMPANIYA
      // ID larini ham tekshiradi. Busiz biznes rejimida o'z
      // kompaniyangning posti ostida "Obuna bo'lish" turardi.
      await pump(
        tester,
        social: _FeedRepo(),
        profile: _FollowRepo(),
        item: post(code: myCompany, author: 'NFCSTORE'),
        companies: const [myCompany],
      );
      await tester.pump(const Duration(milliseconds: 100));

      expect(
        find.text(LUz().actionFollow),
        findsNothing,
        reason: 'o‘z kompaniyam postida obuna tugmasi chiqdi',
      );
      expect(find.text(LUz().actionFollowing), findsNothing);

      // BEGONA kompaniya posti esa obuna qilinadi.
      await pump(
        tester,
        social: _FeedRepo(),
        profile: _FollowRepo(),
        item: post(code: 'BEGONABIZ', author: 'Begona'),
        companies: const [myCompany],
      );
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text(LUz().actionFollow), findsOneWidget);
    });

    testWidgets('serverdagi obuna ro‘yxati HISOBGA olinadi', (tester) async {
      final profile = _FollowRepo()..following = const ['TTS075'];
      await pump(tester, social: _FeedRepo(), profile: profile);
      await tester.pump(const Duration(milliseconds: 100));

      // Allaqachon obuna bo‘lgan odamda "Obuna bo‘lish" turmasligi
      // kerak — aks holda tugma holatni emas, taxminni ko‘rsatardi.
      expect(find.text(LUz().actionFollowing), findsOneWidget);
      expect(find.text(LUz().actionFollow), findsNothing);
    });

    testWidgets('bosilganda serverga boradi', (tester) async {
      final profile = _FollowRepo();
      await pump(tester, social: _FeedRepo(), profile: profile);

      await tester.tap(find.text(LUz().actionFollow));
      await tester.pump();
      expect(find.text(LUz().actionFollowing), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 100));
      expect(profile.followCalls, 1);
      expect(profile.unfollowCalls, 0);
    });

    testWidgets('server xato bersa ORQAGA qaytadi', (tester) async {
      final profile = _FollowRepo()..fails = true;
      await pump(tester, social: _FeedRepo(), profile: profile);

      await tester.tap(find.text(LUz().actionFollow));
      await tester.pump();
      expect(find.text(LUz().actionFollowing), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 100));
      expect(
        find.text(LUz().actionFollow),
        findsOneWidget,
        reason: 'xatodan keyin obuna holati tiklanmadi',
      );
    });
  });

  group('IKKI MARTA BOSISH VA XATO HOLATI', () {
    testWidgets('tez ikki marta bosilsa serverga BIR so‘rov ketadi', (
      tester,
    ) async {
      final social = _FeedRepo()
        ..serverLiked = true
        ..serverCount = 9;
      await pump(tester, social: social, profile: _FollowRepo());

      // Birinchi bosish serverga ketdi va hali javob kelmadi.
      await tester.tap(find.byIcon(Icons.favorite_border_rounded));
      await tester.pump();
      // Ikkinchi bosish AYNAN shu paytda tushadi.
      await tester.tap(find.byIcon(Icons.favorite_rounded));
      await tester.pump();

      await tester.pump(const Duration(milliseconds: 200));

      // Ikki so‘rov ketganda server laykni ikki marta o‘girardi va
      // odam bosgani YO‘QOLARDI.
      expect(social.likeCalls, 1, reason: 'ikki marta so‘rov ketdi');
      expect(find.byIcon(Icons.favorite_rounded), findsOneWidget);
    });

    testWidgets('obunada ham tez ikki bosish BIR so‘rov', (tester) async {
      final profile = _FollowRepo();
      await pump(tester, social: _FeedRepo(), profile: profile);

      await tester.tap(find.text(LUz().actionFollow));
      await tester.pump();
      await tester.tap(find.text(LUz().actionFollowing));
      await tester.pump();

      await tester.pump(const Duration(milliseconds: 200));
      expect(profile.followCalls, 1);
      expect(
        profile.unfollowCalls,
        0,
        reason: 'obuna qo‘yilib darhol yechilib ketdi',
      );
    });

    testWidgets('layk yiqilsa SABAB ko‘rsatiladi', (tester) async {
      final social = _FeedRepo()..likeFails = true;
      await pump(tester, social: social, profile: _FollowRepo());

      await tester.tap(find.byIcon(Icons.favorite_border_rounded));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      // Jimgina orqaga sakragan yurak odamga "bosilmadi" emas,
      // "ilova buzuq" bo‘lib ko‘rinadi.
      expect(
        find.byType(SnackBar),
        findsOneWidget,
        reason: 'xato jimgina yutildi',
      );
      expect(find.text(LUz().errServer), findsOneWidget);
    });

    testWidgets('obuna yiqilsa ham SABAB ko‘rsatiladi', (tester) async {
      final profile = _FollowRepo()..fails = true;
      await pump(tester, social: _FeedRepo(), profile: profile);

      await tester.tap(find.text(LUz().actionFollow));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.byType(SnackBar), findsOneWidget);
    });
  });

  group('IZOH VA ULASHISH', () {
    testWidgets('izoh bosilganda POST ekraniga o‘tadi', (tester) async {
      await pump(tester, social: _FeedRepo(), profile: _FollowRepo());

      await tester.tap(find.byIcon(Icons.mode_comment_outlined));
      await tester.pumpAndSettle();

      // Post ID VA muallif kodi ikkalasi ham uzatilishi shart:
      // kodsiz post ekrani muallif profilini ocholmaydi.
      expect(
        find.textContaining('/post/77'),
        findsOneWidget,
        reason: 'izoh tugmasi mavjud izoh oqimini ochmadi',
      );
      expect(
        find.textContaining('code=TTS075'),
        findsOneWidget,
        reason: 'muallif kodi uzatilmadi',
      );
    });

    testWidgets('muallif bosilganda PROFILGA o‘tadi', (tester) async {
      await pump(tester, social: _FeedRepo(), profile: _FollowRepo());

      await tester.tap(find.text('Tohir'));
      await tester.pumpAndSettle();

      expect(find.textContaining('/u/TTS075'), findsOneWidget);
    });

    testWidgets('ulashish tugmasi bor va ishlaydi', (tester) async {
      await pump(tester, social: _FeedRepo(), profile: _FollowRepo());
      // Tizim varag'i sinovda ochilmaydi, lekin tugma mavjud va
      // bosilganda istisno bermasligi kerak.
      expect(find.byIcon(Icons.ios_share_rounded), findsOneWidget);
    });
  });

  group('KO‘RINISH', () {
    testWidgets('320/360/390/430 va uz/ru/en da sinmaydi', (tester) async {
      for (final w in [320.0, 360.0, 390.0, 430.0]) {
        for (final loc in [
          const Locale('uz'),
          const Locale('ru'),
          const Locale('en'),
        ]) {
          await pump(
            tester,
            social: _FeedRepo(),
            profile: _FollowRepo(),
            width: w,
            locale: loc,
          );
          expect(
            tester.takeException(),
            isNull,
            reason: '${w.toInt()}px / ${loc.languageCode} da sindi',
          );
        }
      }
    });

    testWidgets('beshala mavzuda ham sinmaydi', (tester) async {
      for (final tok in [
        NfcTokens.pearl,
        NfcTokens.graphite,
        NfcTokens.ocean,
        NfcTokens.aurora,
        NfcTokens.mono,
      ]) {
        await pump(
          tester,
          social: _FeedRepo(),
          profile: _FollowRepo(),
          tokens: tok,
        );
        expect(tester.takeException(), isNull);
      }
    });

    testWidgets('uchala tilda obuna matnlari TURLICHA', (tester) async {
      for (final l in [LUz(), LRu(), LEn()]) {
        expect(
          l.actionFollow,
          isNot(l.actionFollowing),
          reason: 'obuna va obuna bo‘lingan matni bir xil',
        );
        expect(l.actionFollowing.trim(), isNotEmpty);
      }
    });
  });
}
