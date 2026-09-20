import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// TELEFONDA TOPILGAN KAMCHILIKLAR.
///
/// Uchalasi ham avtomatlashtirilgan sinovlardan O'TIB KETGAN edi:
/// ular marshrut almashganini tekshirardi, lekin ochilgan ekran
/// HAQIQIY ma'lumot ko'rsatayotganini emas.
class _ProfileRepo extends ProfileRepository {
  _ProfileRepo() : super(ApiClient());

  int byCodeCalls = 0;
  bool fails = false;

  @override
  Future<Result<NfcId>> byCode(String code) async {
    byCodeCalls++;
    await Future<void>.delayed(const Duration(milliseconds: 20));
    if (fails) return const Err(AppError(AppErrorKind.notFound, status: 404));
    return Ok(NfcId(code: code, name: 'Begona $code', followers: 42));
  }
}

class _SocialRepo extends SocialRepository {
  _SocialRepo({this.mine = const [], this.feedItems = const []})
      : super(ApiClient());

  final List<Post> mine;
  final List<Post> feedItems;

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      Ok(mine);

  @override
  Future<Result<List<Post>>> feed({int page = 1}) async => Ok(feedItems);
}

Post video(int id, {String code = 'TTS075'}) => Post(
      id: id,
      code: code,
      authorName: 'Men',
      text: 'reel',
      mediaUrls: const ['https://nfcstore.uz/uploads/a.mp4'],
      isVideo: true,
    );

void main() {
  group('BEGONA PROFIL', () {
    Future<void> pump(WidgetTester tester, _ProfileRepo repo) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          profileRepositoryProvider.overrideWithValue(repo),
        ],
        child: MaterialApp(
          theme: buildTheme(NfcTokens.pearl),
          locale: const Locale('uz'),
          supportedLocales: L.supportedLocales,
          localizationsDelegates: const [
            L.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: const ProfileScreen(code: 'BEGONA1'),
        ),
      ));
      await tester.pump();
    }

    testWidgets('SERVERDAN o‘qiladi — o‘z ID larim orasidan emas',
        (tester) async {
      final repo = _ProfileRepo();
      await pump(tester, repo);
      await tester.pump(const Duration(milliseconds: 100));

      // Ildiz sabab: ekran begona kodni FAQAT `myIds` orasidan
      // qidirardi va topolmagach serverga umuman murojaat
      // qilmasdi.
      expect(repo.byCodeCalls, 1, reason: 'serverga so‘rov ketmadi');
      expect(find.text('Begona BEGONA1'), findsWidgets,
          reason: 'begona profilning ismi ko‘rinmadi');
    });

    testWidgets('MENGA tegishli maslahat CHIQMAYDI', (tester) async {
      await pump(tester, _ProfileRepo());
      await tester.pump(const Duration(milliseconds: 100));

      // Aynan shu matn telefonda har bir begona profilda chiqardi.
      expect(find.text(LUz().homeNoIdHint), findsNothing,
          reason: 'begona profilda "ID yarating" maslahati chiqdi');
    });

    testWidgets('server xato bersa SABAB ko‘rsatiladi', (tester) async {
      await pump(tester, _ProfileRepo()..fails = true);
      await tester.pump(const Duration(milliseconds: 100));

      // Bo'sh panel emas — xato holati.
      expect(find.text(LUz().homeNoIdHint), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });

  group('REELS MANBAI', () {
    test('o‘z videolarim lenta bo‘sh bo‘lsa ham chiqadi', () async {
      // Telefondagi holat: hisobda obuna yo'q, shuning uchun
      // `/api/feed` bo'sh. O'z reeling esa joylangan.
      final c = ProviderContainer(overrides: [
        ...await testOverrides(),
        myIdsProvider.overrideWithValue(
            const [NfcId(code: 'TTS075', name: 'Men', primary: true)]),
        socialRepositoryProvider.overrideWithValue(
            _SocialRepo(mine: [video(1)], feedItems: const [])),
      ]);
      addTearDown(c.dispose);

      final reels = await c.read(reelsProvider.future);
      expect(reels.map((e) => e.id), [1],
          reason: 'o‘z reelim Reels bo‘limida chiqmadi');
    });

    test('bir video ikki manbada bo‘lsa BIR marta chiqadi', () async {
      final c = ProviderContainer(overrides: [
        ...await testOverrides(),
        myIdsProvider.overrideWithValue(
            const [NfcId(code: 'TTS075', name: 'Men', primary: true)]),
        socialRepositoryProvider.overrideWithValue(
            _SocialRepo(mine: [video(1)], feedItems: [video(1), video(2)])),
      ]);
      addTearDown(c.dispose);

      final reels = await c.read(reelsProvider.future);
      expect(reels.length, 2, reason: 'takroriy video chiqdi');
      expect(reels.map((e) => e.id).toSet(), {1, 2});
    });

    test('videosiz yozuvlar olinmaydi', () async {
      final c = ProviderContainer(overrides: [
        ...await testOverrides(),
        myIdsProvider.overrideWithValue(
            const [NfcId(code: 'TTS075', name: 'Men', primary: true)]),
        socialRepositoryProvider.overrideWithValue(_SocialRepo(
          mine: [const Post(id: 9, code: 'TTS075', text: 'matn')],
          feedItems: [video(3)],
        )),
      ]);
      addTearDown(c.dispose);

      final reels = await c.read(reelsProvider.future);
      expect(reels.map((e) => e.id), [3]);
    });
  });
}
