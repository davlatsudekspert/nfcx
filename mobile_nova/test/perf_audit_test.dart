import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/home/widgets/nfc_mobile_section.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/features/social/comments.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';
import 'package:nfcstore_nova/design/icons/nova_icons.dart';

import 'helpers.dart';

/// PERFORMANCE AUDITI (2026-09-23) — tasdiqlangan topilmalar.
///
/// SM-2: (release auditida qayta ko'rildi) post har doim serverdan.
/// SM-3: do'kon sahifasi bir vaqtda ikki xil `GET /api/companies/:id`
///       yubormaydi.
/// SM-4: izoh yozilayotganda har harfda izohlar ro'yxati qayta
///       qurilmaydi.
/// TS-1: Home'dagi demo rasmlar quti o'lchamida dekodlanadi (~23 MB emas).
/// UIQ-3: izoh like'ini ikki marta bosish ikkita toggle yubormaydi.

/// `GET /api/companies/X` sonini sanaydi; javobni [gate] ochilguncha
/// ushlab turadi — ikkala so'rov haqiqatan PARALLEL bo'lsin.
class _Companies implements HttpClientAdapter {
  int calls = 0;
  Completer<void> gate = Completer<void>();

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? body,
      Future<void>? cancel) async {
    if (o.path.contains('/api/companies/X')) calls++;
    await gate.future;
    return ResponseBody.fromString(
      jsonEncode({
        'company': {
          'id': 'X',
          'name': 'Dokon',
          'category': 'shop',
          'catalog': [
            {'id': 1, 'name': 'Choy', 'price': 1000},
          ],
        },
      }),
      200,
      headers: {
        'content-type': ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _Posts extends SocialRepository {
  _Posts() : super(ApiClient());

  int postsOfCalls = 0;
  int postInCalls = 0;

  static const _list = [
    Post(id: 5, code: 'A', text: 'birinchi'),
    Post(id: 6, code: 'A', text: 'ikkinchi'),
  ];

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async {
    postsOfCalls++;
    return const Ok(_list);
  }

  @override
  Future<Result<Post>> postIn(String code, int id, {bool company = false}) async {
    postInCalls++;
    return Ok(_list.firstWhere((p) => p.id == id));
  }
}

class _Comments extends SocialRepository {
  _Comments() : super(ApiClient());

  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
    String kind,
    int id, {
    int page = 1,
  }) async =>
      Ok((
        items: [
          for (var i = 1; i <= 20; i++)
            Comment(id: i, code: 'C$i', authorName: 'Odam $i', text: 'izoh $i'),
        ],
        hasMore: false,
        total: 20,
      ));
}


class _LikeRepo extends SocialRepository {
  _LikeRepo() : super(ApiClient());

  int likes = 0;
  final gate = Completer<void>();

  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
    String kind,
    int id, {
    int page = 1,
  }) async =>
      const Ok((
        items: [Comment(id: 7, code: 'C7', authorName: 'Odam', text: 'izoh')],
        hasMore: false,
        total: 1,
      ));

  @override
  Future<Result<({bool liked, int count})>> toggleCommentLike(int id) async {
    likes++;
    await gate.future;
    return const Ok((liked: true, count: 1));
  }
}

void main() {
  test('SM-3: byId + catalog bir vaqtda — BITTA so‘rov, keyingisi yangidan',
      () async {
    final adapter = _Companies();
    final repo = BusinessRepository(
        ApiClient(dio: Dio()..httpClientAdapter = adapter));

    final both = Future.wait([repo.byId('X'), repo.catalog('X')]);
    await Future<void>.delayed(Duration.zero);
    adapter.gate.complete();
    final r = await both;
    expect(adapter.calls, 1, reason: 'ilgari ikkita parallel GET edi');
    expect(r[0], isA<Ok<Business>>());
    final cat = r[1] as Result<List<CatalogItem>>;
    expect(cat.valueOrNull, hasLength(1));

    // Javob kelgach birlashtirish tugaydi: katalog tahriridan keyingi
    // invalidate eski javobni emas, serverdagi yangisini oladi.
    adapter.gate = Completer<void>()..complete();
    await repo.catalog('X');
    expect(adapter.calls, 2);
  });

  // Release auditi: ro'yxatdagi nusxani QAYTARISH layk/izoh sonini
  // sessiya bo'yi eskirtirardi. Nusxa endi faqat birinchi kadr uchun
  // (`PostScreen`), provayder har doim serverdan oladi —
  // test/release_audit_fixes_test.dart.
  test('SM-2: profil ro‘yxati bor — post baribir serverdan yangilanadi',
      () async {
    final repo = _Posts();
    final c = ProviderContainer(overrides: [
      socialRepositoryProvider.overrideWithValue(repo),
    ]);
    addTearDown(c.dispose);

    final sub = c.listen(profilePostsProvider('A'), (_, __) {});
    addTearDown(sub.close);
    await c.read(profilePostsProvider('A').future);
    expect(repo.postsOfCalls, 1);

    final p = await c
        .read(postProvider((code: 'A', id: 6, company: false)).future);
    expect(p.text, 'ikkinchi');
    expect(repo.postInCalls, 1, reason: 'eski nusxa emas — yangi sonlar');
  });

  test('SM-2: ro‘yxat yo‘q (lenta/deep link) — serverdan, ro‘yxat YARATILMAYDI',
      () async {
    final repo = _Posts();
    final c = ProviderContainer(overrides: [
      socialRepositoryProvider.overrideWithValue(repo),
    ]);
    addTearDown(c.dispose);

    final p = await c
        .read(postProvider((code: 'A', id: 5, company: false)).future);
    expect(p.id, 5);
    expect(repo.postInCalls, 1);
    expect(c.exists(profilePostsProvider('A')), isFalse);
  });

  testWidgets('SM-4: izoh yozilganda izohlar ro‘yxati qayta qurilmaydi',
      (tester) async {
    const premium = User(
      id: 2,
      email: 'p@nfcstore.uz',
      name: 'Premium',
      phone: '',
      premium: true,
    );
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        socialRepositoryProvider.overrideWithValue(_Comments()),
        currentUserProvider.overrideWithValue(premium),
      ],
      child: wrapScreen(const Scaffold(
        body: SingleChildScrollView(
          child: CommentsSection(kind: 'post', id: 1),
        ),
      )),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    final tile = find.byWidgetPredicate(
        (w) => w.runtimeType.toString() == '_CommentTile');
    expect(tile, findsWidgets);
    final before = tester.widget(tile.first);

    await tester.enterText(find.byType(TextField), 'a');
    await tester.pump();

    expect(identical(tester.widget(tile.first), before), isTrue,
        reason: 'har harfda ~20 izoh kartasi qayta qurilmasin');
    // Yuborish tugmasi baribir matnga qarab yoqiladi.
    final send = find.byKey(const ValueKey('comment-send'));
    expect(send, findsOneWidget);
  });

  testWidgets('TS-1: NFC Mobile demo rasmlari QUTI o‘lchamida ochiladi',
      (tester) async {
    tester.view.physicalSize = const Size(392 * 2.75, 800 * 2.75);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [...await testOverrides()],
      child: wrapScreen(const Scaffold(
          body: SingleChildScrollView(child: NfcMobileSection()))),
    ));
    await tester.pump();

    final images = tester
        .widgetList<Image>(find.descendant(
            of: find.byType(NfcMobileSection), matching: find.byType(Image)))
        .toList();
    final raw = images.where((i) =>
        i.image is AssetImage &&
        (i.image as AssetImage).assetName.startsWith('assets/demo/'));
    expect(raw, isEmpty,
        reason: 'demo JPEG to‘liq o‘lchamda (720-1240 px) ochilmasin');
    final resized = images.whereType<Image>().where((i) => i.image is ResizeImage);
    expect(resized, isNotEmpty);
    for (final i in resized) {
      final w = (i.image as ResizeImage).width;
      expect(w, isNotNull);
      expect(w!, lessThanOrEqualTo(1440));
    }
  });

  testWidgets('UIQ-3: izoh like ikki marta bosilsa — BITTA so‘rov', (tester) async {
    const premium = User(
      id: 2,
      email: 'p@nfcstore.uz',
      name: 'Premium',
      phone: '',
      premium: true,
    );
    final repo = _LikeRepo();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        socialRepositoryProvider.overrideWithValue(repo),
        currentUserProvider.overrideWithValue(premium),
      ],
      child: wrapScreen(const Scaffold(
        body: SingleChildScrollView(
          child: CommentsSection(kind: 'post', id: 1),
        ),
      )),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    final heart = find.byIcon(NovaIcons.like);
    expect(heart, findsOneWidget);
    await tester.tap(heart);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(heart);
    await tester.pump(const Duration(milliseconds: 300));
    expect(repo.likes, 1, reason: 'ikkinchi toggle like’ni bekor qilardi');

    repo.gate.complete();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
  });
}

