import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/icons/nova_icons.dart';
import 'package:nfcstore_nova/design/widgets/surfaces.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/social/comments.dart';
import 'package:nfcstore_nova/features/social/feed_card.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// BOSISH MAYDONI — IJTIMOIY EKRANLAR (UI-1, UI-5, UI-6, UI-7).
///
/// Lenta kartasidagi layk/izoh/ulashish 22x34 dp, izoh ostidagi yurakcha
/// 19x27 dp, post tafsilotidagi amallar 21 dp baland, Reels'dagi ovoz va
/// "yana" tugmalari 60x32 dp edi; Reels tugmalari orasidagi bo'shliq esa
/// bosilmas edi — barmoq sal chetga tushsa video pauzaga ketardi.
///
/// Tuzatish FAQAT shaffof hoshiya bilan (qo'shni bo'shliq hisobidan).
/// Shuning uchun har guruh IKKI narsani tekshiradi:
///   1. belgi va yozuvlar tuzatishdan OLDIN o'lchangan joyida turibdi
///      (ko'rinish o'zgarmagan);
///   2. bosish maydoni kattalashgan va eski "o'lik" nuqtaga bosish
///      endi amalni bajaradi.
///
/// Qiymatlar haqiqiy Manrope shrifti bilan, 390x844 dp ekranda
/// o'lchangan (tuzatishdan oldingi kodda).
class _Social extends FakeSocialRepository {
  int postLikes = 0;
  int commentLikes = 0;
  List<Comment> items = const [];
  Post? post;

  @override
  Future<Result<({bool liked, int count})>> like(
    int id, {
    bool company = false,
  }) async {
    postLikes++;
    return const Ok((liked: true, count: 1));
  }

  @override
  Future<Result<({bool liked, int count})>> toggleCommentLike(int id) async {
    commentLikes++;
    return const Ok((liked: true, count: 1));
  }

  @override
  Future<Result<Post>> postIn(
    String code,
    int id, {
    bool company = false,
  }) async => Ok(post!);

  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
    String kind,
    int id, {
    int page = 1,
  }) async => Ok((items: items, hasMore: false, total: items.length));
}

class _Profile extends ProfileRepository {
  _Profile() : super(ApiClient());

  @override
  Future<Result<FollowStats>> followStats(String code) async =>
      const Ok((followers: 0, following: 0, isFollowing: false));

  @override
  Future<Result<List<NfcId>>> followList(
    String code, {
    String dir = 'followers',
  }) async => const Ok([]);
}

class _Biz extends BusinessRepository {
  _Biz() : super(ApiClient());

  @override
  Future<Result<List<Business>>> mine() async => const Ok([]);
}

const _premium = User(
  id: 2,
  email: 'p@nfcstore.uz',
  name: 'Premium',
  phone: '',
  premium: true,
);

void _view(WidgetTester tester, {double width = 390}) {
  tester.view.physicalSize = Size(width * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

Future<List<Override>> _overrides(_Social social) async {
  final base = await testOverrides();
  return [
    // `testOverrides` dagi standart ijtimoiy repo o'rniga — shu testniki.
    ...base.where((o) => !identical(o, base[2])),
    socialRepositoryProvider.overrideWithValue(social),
    profileRepositoryProvider.overrideWithValue(_Profile()),
    businessRepositoryProvider.overrideWithValue(_Biz()),
    currentUserProvider.overrideWithValue(_premium),
    myIdsProvider.overrideWithValue(const [
      NfcId(code: '48210377', name: 'Men', primary: true),
    ]),
  ];
}

/// Joy tuzatishdan oldingi qiymatga teng (0.01 dp aniqlikda).
void _at(WidgetTester tester, Finder f, Offset want, {bool center = false}) {
  final got = center ? tester.getCenter(f) : tester.getTopLeft(f);
  expect(
    got.dx,
    moreOrLessEquals(want.dx, epsilon: .01),
    reason: '$f x siljidi',
  );
  expect(
    got.dy,
    moreOrLessEquals(want.dy, epsilon: .01),
    reason: '$f y siljidi',
  );
}

/// Belgini o'rab turgan eng yaqin `T` (yoki uning vorisi) o'lchami —
/// ya'ni bosish maydoni.
Finder _near<T>(Finder of) => find
    .ancestor(of: of, matching: find.byWidgetPredicate((w) => w is T))
    .first;

Size _hit<T>(WidgetTester tester, Finder of) => tester.getSize(_near<T>(of));

/// Bosilgandagi siyoh doirasining markazi (global). `InkResponse` uni
/// `getRectCallback` to'rtburchagi bo'yicha, u bo'lmasa butun quti
/// bo'yicha chizadi.
Offset _inkCenter(WidgetTester tester, Finder of) {
  final f = _near<InkResponse>(of);
  final box = tester.renderObject<RenderBox>(f);
  final rect =
      tester.widget<InkResponse>(f).getRectCallback(box)?.call() ??
      Offset.zero & box.size;
  return box.localToGlobal(rect.center);
}

void main() {
  // Haqiqiy shriftlar: yozuv o'lchami ilovadagidek bo'lsin.
  setUpAll(() async {
    const fams = {
      'Manrope': [
        'assets/fonts/Manrope-400.ttf',
        'assets/fonts/Manrope-500.ttf',
        'assets/fonts/Manrope-600.ttf',
        'assets/fonts/Manrope-700.ttf',
      ],
      'IBMPlexMono': [
        'assets/fonts/IBMPlexMono-400.ttf',
        'assets/fonts/IBMPlexMono-500.ttf',
        'assets/fonts/IBMPlexMono-600.ttf',
      ],
      'InstrumentSerif': ['assets/fonts/InstrumentSerif-400.ttf'],
    };
    for (final f in fams.entries) {
      final loader = FontLoader(f.key);
      for (final p in f.value) {
        loader.addFont(
          Future.value(ByteData.sublistView(File(p).readAsBytesSync())),
        );
      }
      await loader.load();
    }
  });

  // ─────────────────────────────────────────────── UI-1: lenta kartasi
  group('UI-1 lenta kartasi', () {
    Future<void> pumpCard(
      WidgetTester tester,
      _Social social, {
      int likes = 0,
      int comments = 0,
      double width = 390,
    }) async {
      _view(tester, width: width);
      await tester.pumpWidget(
        ProviderScope(
          overrides: await _overrides(social),
          child: wrapScreen(
            Scaffold(
              body: SingleChildScrollView(
                child: FeedCard(
                  post: Post(
                    id: 1,
                    code: 'TTS075',
                    authorName: 'Tohir',
                    text: 'Sinov posti',
                    likes: likes,
                    comments: comments,
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
    }

    for (final counts in [false, true]) {
      testWidgets(
        'belgilar o‘z joyida, maydon 48 dp baland (sonlar: $counts)',
        (tester) async {
          await pumpCard(
            tester,
            _Social(),
            likes: counts ? 8 : 0,
            comments: counts ? 2 : 0,
          );

          // Karta balandligi va belgilar — tuzatishdan oldingidek.
          expect(
            tester.getSize(find.byType(FeedCard)),
            Size(390, counts ? 140 : 139),
          );
          _at(tester, find.text('Sinov posti'), const Offset(13, 63));
          final y = counts ? 100.5 : 100.0;
          _at(tester, find.byIcon(NovaIcons.like), Offset(15, y));
          _at(
            tester,
            find.byIcon(NovaIcons.comment),
            Offset(counts ? 65.569 : 53, y),
          );
          _at(tester, find.byIcon(NovaIcons.share), Offset(357, y));
          if (counts) {
            _at(tester, find.text('8'), const Offset(38, 100));
            _at(tester, find.text('2'), const Offset(88.569, 100));
          }

          // Ilgari 22x34.
          final like = _hit<InkResponse>(tester, find.byIcon(NovaIcons.like));
          final comment = _hit<InkResponse>(
            tester,
            find.byIcon(NovaIcons.comment),
          );
          final share = _hit<InkResponse>(tester, find.byIcon(NovaIcons.share));
          for (final s in [like, comment, share]) {
            expect(s.height, greaterThanOrEqualTo(48));
          }
          // Laykning chap cheti karta hoshiyasiga tegib turadi — u
          // tomonga kengaytirib bo'lmaydi; o'ngga izohgacha oraliqning
          // yarmi qo'shildi.
          expect(like.width, greaterThanOrEqualTo(30));
          expect(comment.width, greaterThanOrEqualTo(44));
          expect(share.width, greaterThanOrEqualTo(44));

          // Bosilgandagi kulrang doira ham ESKI joyida (eski quti markazi).
          void ink(IconData i, Offset want) {
            final got = _inkCenter(tester, find.byIcon(i));
            expect(got.dx, moreOrLessEquals(want.dx, epsilon: .01));
            expect(got.dy, moreOrLessEquals(want.dy, epsilon: .01));
          }

          final iy = counts ? 109.5 : 109.0;
          ink(NovaIcons.like, Offset(counts ? 30.284 : 24, iy));
          ink(NovaIcons.comment, Offset(counts ? 80.762 : 62, iy));
          ink(NovaIcons.share, Offset(366, iy));
        },
      );
    }

    testWidgets('belgidan 20 dp pastga bosish laykni bosadi', (tester) async {
      final social = _Social();
      await pumpCard(tester, social);
      // Ilgari bu nuqta hech narsaga tegmasdi (maydon 17 dp da tugardi).
      await tester.tapAt(
        tester.getCenter(find.byIcon(NovaIcons.like)) + const Offset(0, 20),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(social.postLikes, 1);
    });

    testWidgets('320 dp va katta sonlar — qator toshmaydi', (tester) async {
      await pumpCard(
        tester,
        _Social(),
        likes: 1234567,
        comments: 7654321,
        width: 320,
      );
      expect(tester.takeException(), isNull);
    });
  });

  // ─────────────────────────────────────── UI-5: izoh ostidagi amallar
  group('UI-5 izoh: javob va yurakcha', () {
    Future<_Social> pumpComments(WidgetTester tester, String loc) async {
      _view(tester);
      final social = _Social()
        ..items = const [
          Comment(id: 5, code: 'AB12', authorName: 'Ali', text: 'Salom'),
          // Javob: "Javob berish" yo'q, yurakcha qatorda BIRINCHI.
          Comment(
            id: 6,
            code: 'CD34',
            authorName: 'Vali',
            text: 'Javob',
            parentId: 5,
            likes: 3,
          ),
          Comment(id: 7, code: 'EF56', authorName: 'Soli', text: 'Oxirgi'),
        ];
      await tester.pumpWidget(
        ProviderScope(
          overrides: await _overrides(social),
          child: wrapScreen(
            const Scaffold(
              body: SingleChildScrollView(
                child: CommentsSection(kind: 'post', id: 1),
              ),
            ),
            locale: Locale(loc),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      return social;
    }

    const reply = {'uz': 'Javob berish', 'en': 'Reply', 'ru': 'Ответить'};
    // Yurakcha "Javob berish" dan keyin turadi — x tilga bog'liq.
    const likeX = {'uz': 158.611, 'en': 119.334, 'ru': 142.047};

    for (final loc in ['uz', 'en', 'ru']) {
      testWidgets('[$loc] yozuv va yurakcha o‘z joyida, maydon >= 44x42', (
        tester,
      ) async {
        await pumpComments(tester, loc);
        // Sarlavha qatori uz'da bir, en/ru'da ikki qator.
        final dy = loc == 'uz' ? 0.0 : 17.0;

        expect(
          tester.getSize(find.byType(CommentsSection)).height,
          loc == 'uz' ? 421 : 438,
        );
        _at(tester, find.text('Salom'), Offset(66, 178 + dy));
        _at(tester, find.text('Javob'), Offset(100, 266 + dy));
        _at(tester, find.text('Oxirgi'), Offset(66, 354 + dy));
        _at(tester, find.text('3'), Offset(121, 297 + dy));
        final likes = find.byIcon(NovaIcons.like);
        _at(tester, likes.at(0), Offset(likeX[loc]!, 210.5 + dy));
        _at(tester, likes.at(1), Offset(102, 298.5 + dy));
        _at(tester, likes.at(2), Offset(likeX[loc]!, 386.5 + dy));
        final replies = find.text(reply[loc]!);
        _at(tester, replies.at(0), Offset(68, 209 + dy));
        _at(tester, replies.at(1), Offset(68, 385 + dy));

        // Ilgari yurakcha 19x27, "Javob berish" 30 dp baland edi.
        for (var i = 0; i < 3; i++) {
          final s = _hit<GestureDetector>(tester, likes.at(i));
          expect(s.width, greaterThanOrEqualTo(44), reason: 'like $i');
          expect(s.height, greaterThanOrEqualTo(42), reason: 'like $i');
        }
        for (var i = 0; i < 2; i++) {
          final s = _hit<GestureDetector>(tester, replies.at(i));
          expect(s.width, greaterThanOrEqualTo(44), reason: 'reply $i');
          expect(s.height, greaterThanOrEqualTo(42), reason: 'reply $i');
        }
      });
    }

    testWidgets('yurakchadan 16 dp pastga bosish — like', (tester) async {
      final social = await pumpComments(tester, 'uz');
      await tester.tapAt(
        tester.getCenter(find.byIcon(NovaIcons.like).first) +
            const Offset(0, 16),
      );
      await settle(tester, frames: 3);
      expect(social.commentLikes, 1);
    });

    testWidgets('"Javob berish" dan 18 dp pastga bosish — javob rejimi', (
      tester,
    ) async {
      await pumpComments(tester, 'uz');
      expect(find.byIcon(Icons.reply_rounded), findsNothing);
      await tester.tapAt(
        tester.getCenter(find.text('Javob berish').first) + const Offset(0, 18),
      );
      await tester.pump();
      expect(find.byIcon(Icons.reply_rounded), findsOneWidget);
    });

    testWidgets('320 dp, shrift 1.3 — 0 laykli izoh qatori toshmaydi', (
      tester,
    ) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      _view(tester, width: 320);
      final social = _Social()
        ..items = const [
          Comment(id: 5, code: 'AB12', authorName: 'Ali', text: 'Salom'),
        ];
      await tester.pumpWidget(
        ProviderScope(
          overrides: await _overrides(social),
          child: wrapScreen(
            const Scaffold(
              body: SingleChildScrollView(
                child: CommentsSection(kind: 'post', id: 1),
              ),
            ),
            locale: const Locale('uz'),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(tester.takeException(), isNull);
      expect(find.byIcon(NovaIcons.like), findsOneWidget);
    });
  });

  // ───────────────────────────────────────── UI-6: post tafsiloti
  group('UI-6 post tafsiloti amallari', () {
    Future<_Social> pumpPost(
      WidgetTester tester, {
      double width = 390,
      String loc = 'uz',
      int likes = 3,
      int comments = 2,
    }) async {
      _view(tester, width: width);
      final social = _Social()
        ..post = Post(
          id: 1,
          code: 'TTS075',
          authorName: 'Tohir',
          text: 'Sinov posti',
          likes: likes,
          comments: comments,
        );
      await tester.pumpWidget(
        ProviderScope(
          overrides: await _overrides(social),
          child: wrapScreen(
            const PostScreen(id: 1, code: 'TTS075'),
            locale: Locale(loc),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
      return social;
    }

    testWidgets('belgi va sonlar o‘z joyida, maydon >= 40 dp baland', (
      tester,
    ) async {
      await pumpPost(tester);
      // `.first`: izohlar bo'sh bo'lsa pastda yana bitta izoh belgisi bor.
      _at(tester, find.byIcon(NovaIcons.like).first, const Offset(20, 175));
      _at(
        tester,
        find.byIcon(NovaIcons.comment).first,
        const Offset(73.050, 175),
      );
      _at(
        tester,
        find.byIcon(NovaIcons.share).first,
        const Offset(293.138, 175),
      );
      _at(tester, find.text('3'), const Offset(46, 177.5));
      _at(tester, find.text('2'), const Offset(99.050, 177.5));
      _at(tester, find.text('Ulashish'), const Offset(319.138, 177.5));
      _at(tester, find.text('Sinov posti'), const Offset(20, 132));
      // Pastdagi izohlar bo'limi ham siljimagan.
      _at(tester, find.text('IZOHLAR'), const Offset(40, 222));

      // Ilgari 21 dp baland.
      for (final i in [NovaIcons.like, NovaIcons.comment, NovaIcons.share]) {
        final s = _hit<PressableScale>(tester, find.byIcon(i).first);
        expect(s.height, greaterThanOrEqualTo(40), reason: '$i');
        // Izoh tugmasi o'ngga kengaymaydi (320 dp da `Spacer` joy
        // bera olmaydi) — bir xonali son bilan ~41 keng.
        expect(
          s.width,
          greaterThanOrEqualTo(i == NovaIcons.comment ? 40 : 44),
          reason: '$i',
        );
      }
    });

    testWidgets('belgidan 16 dp tepaga bosish — layk', (tester) async {
      final social = await pumpPost(tester);
      // Ilgari bu — tugma ustidagi bosilmas `Gap.xl` bo'shliq edi.
      await tester.tapAt(
        tester.getCenter(find.byIcon(NovaIcons.like).first) -
            const Offset(0, 16),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(social.postLikes, 1);
    });

    testWidgets('320 dp, shrift 1.3, ru, katta sonlar — Ulashish surilmaydi', (
      tester,
    ) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await pumpPost(
        tester,
        width: 320,
        loc: 'ru',
        likes: 1234567,
        comments: 7654321,
      );
      expect(tester.takeException(), isNull);
      // Tuzatishdan oldingi joyi (hit maydoni `Spacer` hisobidan
      // kengayganda 183.12 ga surilib, qator 3.4 px toshardi).
      expect(
        tester.getTopLeft(find.byIcon(NovaIcons.share).first).dx,
        closeTo(179.77, .01),
      );
    });
  });

  // ───────────────────────────────────────────── UI-7: Reels tugmalari
  group('UI-7 Reels tugmalari', () {
    Future<({ProviderContainer c, FakeVideoPlatform v})> pumpReels(
      WidgetTester tester,
    ) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      _view(tester);
      final c = ProviderContainer(
        overrides: [
          ...await _overrides(_Social()),
          reelsProvider.overrideWith(
            (ref) async => [
              Post(
                id: 7,
                code: 'PPP777',
                authorName: 'Mashrabboy',
                text: 'Toshkent kechasi',
                mediaUrls: const ['https://nfcstore.uz/uploads/a.mp4'],
                isVideo: true,
                likes: 42,
                comments: 5,
              ),
            ],
          ),
          activeTabProvider.overrideWith((ref) => 3),
        ],
      );
      addTearDown(c.dispose);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: c,
          child: wrapScreen(const ReelsScreen()),
        ),
      );
      await settle(tester, frames: 10);
      expect(v.playing.length, 1, reason: 'reel o‘ynayapti');
      return (c: c, v: v);
    }

    Finder icon(String key) => find
        .descendant(
          of: find.byKey(ValueKey(key)).first,
          matching: find.byType(Icon),
        )
        .first;

    testWidgets('belgilar o‘z joyida, ovoz va "yana" >= 48 dp', (tester) async {
      await pumpReels(tester);
      _at(tester, icon('reel-like'), const Offset(356, 386), center: true);
      _at(tester, icon('reel-comments'), const Offset(356, 451), center: true);
      _at(tester, icon('reel-save'), const Offset(356, 516), center: true);
      _at(tester, icon('reel-share'), const Offset(356, 581), center: true);
      _at(
        tester,
        find.byIcon(NovaIcons.sound).first,
        const Offset(356, 646),
        center: true,
      );
      _at(tester, icon('reel-more'), const Offset(356, 694), center: true);
      _at(tester, find.text('42').first, const Offset(349.408, 404));
      _at(tester, find.text('5').first, const Offset(352.766, 469));
      _at(tester, find.text('Saqlash').first, const Offset(334.889, 534));
      _at(tester, find.text('Ulashish').first, const Offset(333.170, 599));

      // Ilgari 60x32.
      final more = tester.getSize(
        find.byKey(const ValueKey('reel-more')).first,
      );
      final sound = _hit<PressableScale>(
        tester,
        find.byIcon(NovaIcons.sound).first,
      );
      for (final s in [more, sound]) {
        expect(s.width, 60);
        expect(s.height, greaterThanOrEqualTo(48));
      }
    });

    testWidgets('ulashish va ovoz orasiga bosish videoni PAUZA QILMAYDI', (
      tester,
    ) async {
      final r = await pumpReels(tester);
      expect(r.c.read(reelsMutedProvider), isFalse);
      // Ovoz belgisidan 6 dp tepada — ilgari `Gap.lg` bo'shliq edi va
      // bosish sahifaga (play/pause) tushardi.
      await tester.tapAt(
        tester.getTopLeft(find.byIcon(NovaIcons.sound).first) +
            const Offset(14, -6),
      );
      // Sahifada `onDoubleTap` bor: bitta bosish 300 ms kutadi.
      await settle(tester, frames: 6);
      expect(r.v.playing.length, 1, reason: 'video to‘xtamasligi kerak');
      expect(
        r.c.read(reelsMutedProvider),
        isTrue,
        reason: 'bosish ovoz tugmasiga tegishi kerak',
      );
    });

    testWidgets('"yana" belgisining ostiga bosish menyuni ochadi', (
      tester,
    ) async {
      final r = await pumpReels(tester);
      // Belgi ostidan 8 dp — ilgari tugma 4 dp da tugardi.
      await tester.tapAt(
        tester.getBottomLeft(icon('reel-more')) + const Offset(14, 8),
      );
      await settle(tester, frames: 10);
      expect(find.byKey(const ValueKey('reel-report')), findsOneWidget);
      expect(r.v.playing.length, 1, reason: 'video to‘xtamasligi kerak');
    });
  });
}
