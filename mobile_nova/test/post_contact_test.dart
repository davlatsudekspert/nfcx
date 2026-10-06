import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderParagraph;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/external_link.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/social/feed_card.dart';
import 'package:nfcstore_nova/features/social/post_contact_bar.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// BIZNES POSTIDAGI "BOG'LANISH" — Qo'ng'iroq / Telegram / Xarita
/// (server `contact`, 2026-10).
///
///   * model: null-xavfsiz, hammasi bo'sh — `null`; havolalar profildagi
///     aloqa tugmalari qoidasida; faqat tel/http/https;
///   * lenta va Reels: faqat kompaniya postida, maydon bo'lmasa — yo'q;
///   * 360 / 390 / 430 kenglik, ruscha yozuv, Ivory va Noir — toshmaydi.

class _Profile extends ProfileRepository {
  _Profile() : super(ApiClient());

  @override
  Future<Result<List<NfcId>>> followList(String code, {String dir = 'followers'}) async =>
      const Ok([]);

  @override
  Future<Result<FollowStats>> followStats(String code) async =>
      const Ok((followers: 0, following: 0, isFollowing: false));
}

class _Biz extends BusinessRepository {
  _Biz() : super(ApiClient());
  @override
  Future<Result<List<Business>>> mine() async => const Ok([]);
}

const _full = PostContact(
  phone: '+998 (90) 123-45-67',
  telegram: '@kartauz',
  mapUrl: 'https://www.google.com/maps/dir/?api=1&destination=41.3%2C69.2',
);

Post _company({PostContact? contact = _full, String text = 'Yangi metall kartalar'}) =>
    Post(
      id: 5,
      code: 'KARTAUZ',
      authorName: 'Karta Uz',
      authorKind: 'company',
      text: text,
      contact: contact,
    );

Future<void> _pumpCard(
  WidgetTester tester,
  Post post, {
  double width = 390,
  Locale locale = const Locale('uz'),
  NfcTokens? tokens,
}) async {
  tester.view.physicalSize = Size(width * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...await testOverrides(),
      profileRepositoryProvider.overrideWithValue(_Profile()),
      businessRepositoryProvider.overrideWithValue(_Biz()),
      myIdsProvider.overrideWithValue(const [NfcId(code: '48210377', primary: true)]),
    ],
    child: MaterialApp(
      theme: buildTheme(tokens ?? NfcTokens.ivory),
      locale: locale,
      supportedLocales: L.supportedLocales,
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Scaffold(
        body: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: FeedCard(post: post),
        ),
      ),
    ),
  ));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));
}

void main() {
  group('model', () {
    test('fromJson: null, Map emas, hammasi bo‘sh — null', () {
      expect(PostContact.fromJson(null), isNull);
      expect(PostContact.fromJson('x'), isNull);
      expect(PostContact.fromJson(const {}), isNull);
      expect(
          PostContact.fromJson(const {'phone': null, 'telegram': ' ', 'mapUrl': null}),
          isNull);
      final c = PostContact.fromJson(const {'phone': '+998901234567', 'telegram': null})!;
      expect([c.phone, c.telegram, c.mapUrl], ['+998901234567', '', '']);
      // Raqam kelsa ham yiqilmaydi (faqat satr olinadi).
      expect(PostContact.fromJson(const {'phone': 998, 'mapUrl': ''}), isNull);
    });

    test('Post.fromJson — server shakli; copyWith / copyWithKind saqlaydi', () {
      final p = Post.fromJson(const {
        'kind': 'post',
        'id': 5,
        'code': 'KARTAUZ',
        'authorKind': 'company',
        'caption': 'Salom',
        'contact': {
          'phone': '+998 90 123 45 67',
          'telegram': 'https://t.me/kartauz',
          'mapUrl': 'https://www.google.com/maps/dir/?api=1&destination=Toshkent',
        },
      });
      expect(p.contact, isNotNull);
      expect(p.contact!.telegram, 'https://t.me/kartauz');
      expect(p.copyWith(likes: 3).contact, same(p.contact));
      expect(p.copyWithKind(authorKind: 'company').contact, same(p.contact));
      // Kontaktsiz va shaxsiy post.
      expect(Post.fromJson(const {'id': 1}).contact, isNull);
    });

    test('havolalar: tartib, tel, Telegram (@, havola, raqam), xarita', () {
      final a = _full.actions();
      expect(a.map((e) => e.kind),
          [ContactKind.phone, ContactKind.telegram, ContactKind.map]);
      expect(a[0].url, 'tel:+998901234567');
      expect(a[1].url, 'https://t.me/kartauz');
      expect(a[2].url, _full.mapUrl);

      String tg(String v) => PostContact(telegram: v).actions().single.url;
      expect(tg('kartauz'), 'https://t.me/kartauz');
      expect(tg('t.me/kartauz'), 'https://t.me/kartauz');
      expect(tg('https://t.me/kartauz?start=1'), 'https://t.me/kartauz');
      expect(tg('https://t.me/joinchat/AbC'), 'https://t.me/joinchat/AbC');
      expect(tg('+998 90 123-45-67'), 'https://t.me/+998901234567');
      expect(tg('998901234567'), 'https://t.me/+998901234567');
    });

    test('faqat tel / http / https — boshqasi tugmaga aylanmaydi', () {
      expect(const PostContact(mapUrl: 'javascript:alert(1)').actions(), isEmpty);
      expect(const PostContact(mapUrl: 'intent://maps#Intent;end').actions(), isEmpty);
      expect(const PostContact(mapUrl: 'https://').actions(), isEmpty);
      expect(const PostContact(phone: '—').actions(), isEmpty);
      expect(isSafeContactUrl('tel:+998901234567'), isTrue);
      expect(isSafeContactUrl('https://t.me/a b'), isFalse);
      expect(isSafeContactUrl('http://maps.google.com/?q=1'), isTrue);
    });

    test('faqat kompaniya posti (istoriya va shaxsiy — yo‘q)', () {
      expect(postContactActions(_company()), hasLength(3));
      expect(postContactActions(_company(contact: null)), isEmpty);
      const personal = Post(id: 1, code: 'ALI000', contact: _full);
      expect(postContactActions(personal), isEmpty);
      const story = Post(id: 2, code: 'KARTAUZ', kind: 'story', authorKind: 'company', contact: _full);
      expect(postContactActions(story), isEmpty);
    });
  });

  group('lenta kartasi', () {
    testWidgets('biznes posti: uch tugma izohdan keyin, amallar qatoridan oldin',
        (tester) async {
      await _pumpCard(tester, _company(), width: 600);
      final l = await L.delegate.load(const Locale('uz'));
      expect(find.byKey(const ValueKey('post-contact')), findsOneWidget);
      expect(find.text(l.contactCall), findsOneWidget);
      expect(find.text('Telegram'), findsOneWidget);
      expect(find.text(l.contactMap), findsOneWidget);
      final bar = tester.getRect(find.byKey(const ValueKey('post-contact')));
      expect(bar.top, greaterThan(tester.getRect(find.text('Yangi metall kartalar')).bottom));
      expect(bar.bottom, lessThan(tester.getRect(find.byType(Divider)).top));
    });

    testWidgets('bosilsa — tashqi havola (Telegram)', (tester) async {
      final opened = <Uri>[];
      openLinkOverride = (u) async {
        opened.add(u);
        return true;
      };
      addTearDown(() => openLinkOverride = null);
      await _pumpCard(tester, _company());
      await tester.tap(find.byKey(const ValueKey('post-contact-telegram')));
      await tester.pump();
      expect(opened.single.toString(), 'https://t.me/kartauz');
      await tester.tap(find.byKey(const ValueKey('post-contact-phone')));
      await tester.pump();
      expect(opened.last.toString(), 'tel:+998901234567');
    });

    testWidgets('faqat bitta maydon — bitta tugma', (tester) async {
      await _pumpCard(tester, _company(contact: const PostContact(telegram: 'kartauz')));
      expect(find.byKey(const ValueKey('post-contact-telegram')), findsOneWidget);
      expect(find.byKey(const ValueKey('post-contact-phone')), findsNothing);
      expect(find.byKey(const ValueKey('post-contact-map')), findsNothing);
    });

    testWidgets('kontaktsiz biznes posti va shaxsiy post — qator yo‘q',
        (tester) async {
      await _pumpCard(tester, _company(contact: null));
      expect(find.byKey(const ValueKey('post-contact')), findsNothing);
      await _pumpCard(
          tester, const Post(id: 9, code: 'ALI000', authorName: 'Ali', text: 'x', contact: _full));
      expect(find.byKey(const ValueKey('post-contact')), findsNothing);
    });

    for (final width in [360.0, 390.0, 430.0]) {
      for (final (name, tokens) in [('Ivory', NfcTokens.ivory), ('Noir', NfcTokens.noir)]) {
        testWidgets('${width.toInt()} px, ruscha, $name — toshmaydi', (tester) async {
          await _pumpCard(tester, _company(),
              width: width, locale: const Locale('ru'), tokens: tokens);
          expect(tester.takeException(), isNull);
          final bar = tester.getRect(find.byKey(const ValueKey('post-contact')));
          expect(bar.right, lessThanOrEqualTo(width));
          for (final k in ['phone', 'telegram', 'map']) {
            final r = tester.getRect(find.byKey(ValueKey('post-contact-$k')));
            expect(r.right, lessThanOrEqualTo(bar.right + .01), reason: k);
            expect(r.height, lessThan(40), reason: 'ixcham kapsula');
          }
          // Yozuv YO ko'rinadi va kesilmagan, YO uchalasi ham faqat belgi
          // (sinov shrifti keng — qaysi biri bo'lishi shriftga bog'liq).
          final labels = find.descendant(
              of: find.byKey(const ValueKey('post-contact')),
              matching: find.byType(RichText));
          for (final e in labels.evaluate()) {
            final rp = e.renderObject! as RenderParagraph;
            final txt = rp.text.toPlainText();
            if (txt.isEmpty) continue;
            expect(rp.didExceedMaxLines, isFalse, reason: 'kesilgan: $txt');
          }
        });
      }
    }

    testWidgets('keng joy — yozuvli; tor joy — faqat belgi, kesilmaydi',
        (tester) async {
      Future<void> bar(double w) async {
        await tester.pumpWidget(MaterialApp(
          theme: buildTheme(NfcTokens.ivory),
          locale: const Locale('ru'),
          supportedLocales: L.supportedLocales,
          localizationsDelegates: const [
            L.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: Scaffold(
            body: Align(
              alignment: Alignment.topLeft,
              child: SizedBox(width: w, child: PostContactBar(post: _company())),
            ),
          ),
        ));
        await tester.pump();
      }

      await bar(900);
      expect(find.text('Позвонить'), findsOneWidget);
      expect(find.text('Telegram'), findsOneWidget);
      expect(find.text('Карта'), findsOneWidget);
      await bar(150);
      expect(tester.takeException(), isNull);
      expect(find.text('Позвонить'), findsNothing);
      expect(find.text('Telegram'), findsNothing);
      expect(find.byKey(const ValueKey('post-contact-phone')), findsOneWidget);
      expect(find.byTooltip('Позвонить'), findsOneWidget,
          reason: 'nomi bosib turganda ko‘rinadi');
    });

    testWidgets('360 px, juda katta shrift — baribir toshmaydi', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await _pumpCard(tester, _company(), width: 360, locale: const Locale('ru'));
      expect(tester.takeException(), isNull);
    });
  });

  group('Reels', () {
    Future<void> pumpReels(WidgetTester tester, List<Post> reels, {double width = 360}) async {
      VideoPlayerPlatform.instance = FakeVideoPlatform();
      tester.view.physicalSize = Size(width * 3, 780 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final base = await testOverrides();
      final c = ProviderContainer(overrides: [
        ...base.where((o) => !identical(o, base[2])),
        socialRepositoryProvider.overrideWithValue(FakeSocialRepository()),
        profileRepositoryProvider.overrideWithValue(_Profile()),
        businessRepositoryProvider.overrideWithValue(_Biz()),
        reelsProvider.overrideWith((ref) async => reels),
        activeTabProvider.overrideWith((ref) => 3),
      ]);
      addTearDown(c.dispose);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: wrapScreen(const ReelsScreen(), locale: const Locale('ru')),
      ));
      await settle(tester, frames: 10);
    }

    Post reel({String kind = 'company', PostContact? contact = _full}) => Post(
          id: 31,
          code: 'KARTAUZ',
          authorName: 'Очень длинное название компании Карта Уз',
          authorKind: kind,
          text: 'Новые металлические карты',
          mediaUrls: const ['https://nfcstore.uz/uploads/b.mp4'],
          isVideo: true,
          contact: contact,
        );

    testWidgets('biznes reeli (360 px, ruscha): qora shisha kapsulalar, toshmaydi',
        (tester) async {
      await pumpReels(tester, [reel()]);
      expect(tester.takeException(), isNull);
      expect(find.byKey(const ValueKey('reel-contact')), findsOneWidget);
      for (final k in ['phone', 'telegram', 'map']) {
        final r = tester.getRect(find.byKey(ValueKey('post-contact-$k')));
        // O'ng ustun (layk, izoh...) bilan ustma-ust tushmaydi.
        expect(r.right, lessThanOrEqualTo(360 - 72 + .01), reason: k);
      }
    });

    testWidgets('shaxsiy reel va kontaktsiz biznes reeli — tugma yo‘q',
        (tester) async {
      await pumpReels(tester, [reel(kind: 'card'), reel(contact: null)]);
      expect(find.byKey(const ValueKey('reel-contact')), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });
}
