import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/social/feed_card.dart';

import 'helpers.dart';

/// BOSH SAHIFADAGI LENTA VA "HOMIYLIK" BELGISI.
///
/// `homeFeedProvider` e'lon qilingan va yangilanganda invalidate
/// qilinardi, LEKIN hech qayerda chizilmasdi: ya'ni so'rov
/// yuborilmasdi ham, bosh sahifada post umuman ko'rinmasdi.
///
/// Pullik ko'tarilgan kontent esa BELGISIZ qolsa — bu yashirin
/// reklama bo'lardi. Shu ikkisi shu yerda tekshiriladi.
class _FeedRepo extends SocialRepository {
  _FeedRepo({this.posts = const [], this.fail = false}) : super(ApiClient());

  final List<Post> posts;
  final bool fail;

  /// Nechta marta so'ralgani — "lenta umuman so'ralmadi" holatini
  /// ushlash uchun.
  int calls = 0;

  @override
  Future<Result<List<Post>>> feed({int page = 1}) async {
    calls++;
    if (fail) return const Err(AppError(AppErrorKind.offline));
    return Ok(posts);
  }

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      const Ok([]);

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async => const Ok([]);

  @override
  Future<Result<List<StoryItem>>> followedStories() async => const Ok([]);
}

Post _post(int id, {String text = 'matn', bool featured = false}) => Post(
      id: id,
      code: 'VIP00$id',
      authorName: 'Muallif $id',
      text: text,
      featured: featured,
    );

void main() {
  Future<_FeedRepo> pumpHome(
    WidgetTester tester, {
    List<Post> posts = const [],
    bool fail = false,
  }) async {
    final repo = _FeedRepo(posts: posts, fail: fail);

    // BALAND VIEWPORT — ATAYLAB.
    //
    // Bosh sahifa `NovaScroll` (ListView) ichida va u DANGASA:
    // ekrandan pastdagi bo'lim UMUMAN qurilmaydi. Lenta esa eng
    // pastda. Oddiy 600px li test oynasida u hech qachon
    // qurilmas va test "lenta yo'q" deb yiqilardi — holbuki
    // telefonda odam pastga tushib uni ko'radi.
    tester.view.physicalSize = const Size(1080, 9000);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        socialRepositoryProvider.overrideWithValue(repo),
      ],
      child: wrapScreen(const HomeScreen()),
    ));
    await settle(tester, frames: 25);
    return repo;
  }

  group('Lenta bosh sahifada CHIZILADI', () {
    testWidgets('lenta HAQIQATDAN so‘raladi', (tester) async {
      final repo = await pumpHome(tester, posts: [_post(1)]);
      expect(repo.calls, greaterThan(0),
          reason: 'bosh sahifa lentani umuman so‘ramadi — '
              'provider e‘lon qilingan, lekin chizilmagan');
    });

    testWidgets('postlar ko‘rinadi', (tester) async {
      await pumpHome(tester, posts: [_post(1), _post(2)]);
      expect(find.byType(FeedCard), findsNWidgets(2));
      expect(find.text('Muallif 1'), findsOneWidget);
    });

    testWidgets('bo‘sh lentada TUSHUNARLI matn chiqadi', (tester) async {
      await pumpHome(tester);
      expect(find.byType(FeedCard), findsNothing);
      expect(find.textContaining('Hozircha post yo‘q'), findsOneWidget);
    });

    testWidgets('lenta yiqilsa BOSH SAHIFA yiqilmaydi', (tester) async {
      await pumpHome(tester, fail: true);
      // Eng muhimi: qolgan bo'limlar joyida.
      expect(find.text('LENTA'), findsOneWidget,
          reason: 'lenta xatosi butun ekranni yutib yubordi');
      expect(tester.takeException(), isNull);
    });

    testWidgets('bosh sahifa CHEKSIZ uzaymaydi', (tester) async {
      await pumpHome(tester,
          posts: List.generate(20, (i) => _post(i + 1)));
      // Bu lenta emas, uning boshi: to'liq oqim Kashfiyotda.
      expect(find.byType(FeedCard), findsNWidgets(5));
      expect(find.text('Hammasini ko‘rish'), findsOneWidget);
    });

    testWidgets('kam post bo‘lsa "hammasini ko‘rish" ko‘rinmaydi',
        (tester) async {
      await pumpHome(tester, posts: [_post(1)]);
      expect(find.text('Hammasini ko‘rish'), findsNothing);
    });
  });

  group('"Homiylik" belgisi', () {
    testWidgets('ko‘tarilgan postda belgi BOR', (tester) async {
      await pumpHome(tester, posts: [_post(1, featured: true)]);
      expect(find.text('Homiylik'), findsOneWidget,
          reason: 'to‘langan joylashuv belgisiz qoldi — yashirin reklama');
    });

    testWidgets('oddiy postda belgi YO‘Q', (tester) async {
      await pumpHome(tester, posts: [_post(1)]);
      expect(find.text('Homiylik'), findsNothing);
    });

    testWidgets('faqat ko‘tarilganida belgilanadi', (tester) async {
      await pumpHome(tester, posts: [
        _post(1, featured: true),
        _post(2),
        _post(3),
      ]);
      expect(find.text('Homiylik'), findsOneWidget);
    });

    testWidgets('tartib SERVERNIKI — ilova qayta saralamaydi',
        (tester) async {
      // Server ko'tarilganni birinchi qo'yadi. Ilova ro'yxatni
      // o'zgartirmasligi kerak: aks holda to'lovning ma'nosi
      // ilova versiyasiga bog'liq bo'lib qolardi.
      await pumpHome(tester, posts: [
        _post(1),
        _post(2, featured: true),
      ]);
      final cards = tester.widgetList<FeedCard>(find.byType(FeedCard)).toList();
      expect(cards.first.post.id, 1);
      expect(cards.last.post.id, 2);
    });
  });

  group('`featured` belgisi YO‘QOLMAYDI', () {
    test('copyWith like sonini yangilaganda ham saqlanadi', () {
      // Like bosilganda `copyWith` chaqiriladi. Belgi tushib qolsa,
      // odam like bosgan zahoti "Homiylik" yozuvi o‘chib ketardi.
      final p = _post(1, featured: true);
      expect(p.copyWith(likes: 5, liked: true).featured, isTrue);
      expect(p.copyWith(comments: 3).featured, isTrue);
    });

    test('copyWithKind ham saqlaydi', () {
      expect(_post(1, featured: true).copyWithKind(kind: 'story').featured,
          isTrue);
    });

    test('server bermasa — false', () {
      expect(Post.fromJson(const {'id': 1}).featured, isFalse);
    });

    test('server bersa — true', () {
      expect(Post.fromJson(const {'id': 1, 'featured': true}).featured, isTrue);
    });
  });
}
