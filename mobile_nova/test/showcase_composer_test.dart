import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/profile_context.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/showcase/showcase_common.dart';
import 'package:nfcstore_nova/features/showcase/showcase_composer.dart';
import 'package:nfcstore_nova/features/social/music_picker.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

class _Source implements ShowcaseImageSource {
  _Source(this.paths);
  final List<String> paths;
  final limits = <int>[];

  @override
  Future<List<String>> gallery(int limit) async {
    limits.add(limit);
    return paths.take(limit).toList();
  }

  @override
  Future<String?> camera() async => '/tmp/camera.jpg';
}

class _Profile extends ProfileRepository {
  _Profile() : super(ApiClient());
  final uploaded = <String>[];

  @override
  Future<Result<String>> uploadImage(String filePath,
      {String? kind, void Function(int, int)? onProgress}) async {
    uploaded.add(filePath);
    onProgress?.call(1, 1);
    return Ok('/uploads/u${uploaded.length}.jpg');
  }
}

class _Social extends FakeSocialRepository {
  final created = <({String code, bool company, ShowcaseDraft draft})>[];

  @override
  Future<Result<Post?>> createShowcase({
    required String code,
    required bool company,
    required ShowcaseDraft draft,
  }) async {
    created.add((code: code, company: company, draft: draft));
    return const Ok(null);
  }
}

Future<({_Social social, _Profile profile, _Source source})> _pump(
  WidgetTester tester, {
  List<String> paths = const ['/tmp/a.jpg', '/tmp/b.jpg'],
  ActiveProfile? as,
  List<CatalogItem> catalog = const [],
  MusicTrack? music,
}) async {
  tester.view.physicalSize = const Size(390 * 3, 2600 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final social = _Social();
  final profile = _Profile();
  final source = _Source(paths);
  final base = await testOverrides();
  await acceptContentRules();
  final c = ProviderContainer(overrides: [
    ...base.where((o) => !identical(o, base[2])),
    socialRepositoryProvider.overrideWithValue(social),
    profileRepositoryProvider.overrideWithValue(profile),
    showcaseImageSourceProvider.overrideWithValue(source),
    if (as != null) activeProfileProvider.overrideWithValue(as),
    businessCatalogProvider.overrideWith((ref, id) async => catalog),
  ]);
  addTearDown(c.dispose);
  if (music != null) c.read(pendingComposerMusicProvider.notifier).state = music;
  final router = GoRouter(initialLocation: '/', routes: [
    GoRoute(
      path: '/',
      builder: (_, __) => const Scaffold(body: Text('HOME')),
      routes: [
        GoRoute(
            path: 'create',
            builder: (_, __) => const ShowcaseComposerScreen()),
      ],
    ),
  ]);
  await tester.pumpWidget(UncontrolledProviderScope(
    container: c,
    child: MaterialApp.router(
      routerConfig: router,
      theme: buildTheme(NfcTokens.ivory),
      locale: const Locale('uz'),
      supportedLocales: LocaleController.supported,
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    ),
  ));
  await settle(tester, frames: 6);
  router.push('/create');
  await settle(tester, frames: 10);
  return (social: social, profile: profile, source: source);
}

Future<void> _addFromGallery(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey('showcase-add-image')));
  await settle(tester, frames: 6);
  await tester.tap(find.byKey(const ValueKey('showcase-pick-gallery')));
  await settle(tester, frames: 6);
}

Future<void> _enter(WidgetTester tester, String key, String text) async {
  await tester.enterText(
      find.descendant(
          of: find.byKey(ValueKey(key)), matching: find.byType(TextField)),
      text);
  await tester.pump();
}

Future<void> _publish(WidgetTester tester) async {
  final btn = find.byKey(const ValueKey('showcase-publish'));
  await tester.ensureVisible(btn);
  await tester.tap(btn);
  await settle(tester, frames: 10);
}

void main() {
  group('validateShowcase', () {
    test('rasm soni 1..5', () {
      expect(validateShowcase(images: 0), [ShowcaseIssue.noImages]);
      expect(validateShowcase(images: 1), isEmpty);
      expect(validateShowcase(images: 5), isEmpty);
      expect(validateShowcase(images: 6), [ShowcaseIssue.tooManyImages]);
    });

    test('sarlavha ≤ 80', () {
      expect(validateShowcase(images: 1, title: 'a' * 80), isEmpty);
      expect(validateShowcase(images: 1, title: 'a' * 81),
          [ShowcaseIssue.titleTooLong]);
    });

    test('narx — faqat raqam, bo‘sh — narxsiz', () {
      expect(validateShowcase(images: 1, price: ''), isEmpty);
      expect(validateShowcase(images: 1, price: '125 000'), isEmpty);
      expect(validateShowcase(images: 1, price: '12a'),
          [ShowcaseIssue.badPrice]);
      expect(validateShowcase(images: 1, price: '-5'),
          [ShowcaseIssue.badPrice]);
      expect(validateShowcase(images: 1, price: '1.5'),
          [ShowcaseIssue.badPrice]);
      expect(validateShowcase(images: 1, price: '10000000001'),
          [ShowcaseIssue.priceTooHigh]);
      expect(parsePriceInput('125 000'), 125000);
      expect(parsePriceInput('  '), isNull);
    });

    test('havola — faqat https YouTube/Instagram', () {
      expect(validateShowcase(images: 1, link: 'https://youtu.be/x'), isEmpty);
      expect(validateShowcase(images: 1, link: 'https://instagram.com/p/x'),
          isEmpty);
      expect(validateShowcase(images: 1, link: 'http://youtu.be/x'),
          [ShowcaseIssue.badLink]);
      expect(validateShowcase(images: 1, link: 'https://tiktok.com/x'),
          [ShowcaseIssue.badLink]);
    });

    test('xato matnlari uz tilida aniq', () {
      final l = LUz();
      expect(showcaseIssueText(l, ShowcaseIssue.badLink), contains('https://'));
      expect(showcaseIssueText(l, ShowcaseIssue.noImages), l.errShowcaseNoImages);
    });
  });

  test('narx maydoni: faqat raqam, ming ajratgich', () {
    const f = ThousandsInputFormatter();
    String fmt(String s) =>
        f.formatEditUpdate(TextEditingValue.empty, TextEditingValue(text: s)).text;
    expect(fmt('125000'), '125 000');
    expect(fmt('12a3,4'), '1 234');
    expect(fmt('007'), '7');
    expect(fmt('abc'), '');
  });

  group('ShowcaseDraft.toJson — shartnoma §3', () {
    const d = ShowcaseDraft(
      mediaUrls: ['/uploads/a.jpg', '/uploads/b.jpg'],
      title: 'Ko‘ylak',
      text: 'Tavsif',
      priceUzs: 125000,
      catalogItemId: 'b9fa1d77-794a-4b7a-b972-aecb1dce7c02',
      linkUrl: 'https://youtu.be/x',
      musicId: 5,
      musicStart: 0,
      imageSeconds: 8,
    );

    test('kompaniya posti — hamma maydonlar', () {
      final j = d.toJson(company: true);
      expect(j['showcase'], true);
      expect(j['mediaUrls'], ['/uploads/a.jpg', '/uploads/b.jpg']);
      expect(j['title'], 'Ko‘ylak');
      expect(j['text'], 'Tavsif');
      expect(j['priceUzs'], 125000);
      expect(j['catalogItemId'], 'b9fa1d77-794a-4b7a-b972-aecb1dce7c02');
      expect(j['catalogItemId'], isA<String>());
      expect(j['linkUrl'], 'https://youtu.be/x');
      expect(j['musicId'], 5);
      expect(j['musicStart'], 0);
      expect(j['imageSeconds'], 8);
      expect(j['agreed'], true);
      expect(j['rulesVersion'], '2026-10');
      expect(j.containsKey('videoUrl'), isFalse);
    });

    test('shaxsiy postda catalogItemId yo‘q; narxsiz — null', () {
      final j = const ShowcaseDraft(mediaUrls: ['/uploads/a.jpg'])
          .toJson(company: false);
      expect(j.containsKey('catalogItemId'), isFalse);
      expect(j['priceUzs'], isNull);
      expect(j.containsKey('musicId'), isFalse);
      expect(j.containsKey('linkUrl'), isFalse);
      expect(d.toJson(company: false).containsKey('catalogItemId'), isFalse);
    });
  });

  testWidgets('rasm manbai: faqat galereya va kamera (video yo‘q)',
      (tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const ValueKey('showcase-add-image')));
    await settle(tester, frames: 6);
    expect(find.byKey(const ValueKey('showcase-pick-gallery')), findsOneWidget);
    expect(find.byKey(const ValueKey('showcase-pick-camera')), findsOneWidget);
    expect(find.byKey(const ValueKey('pick-gallery-video')), findsNothing);
    expect(find.byIcon(Icons.video_library_rounded), findsNothing);
    expect(find.byIcon(Icons.videocam_rounded), findsNothing);
  });

  testWidgets('rasmsiz — xato, so‘rov yo‘q', (tester) async {
    final r = await _pump(tester);
    await _publish(tester);
    expect(find.text(LUz().errShowcaseNoImages), findsOneWidget);
    expect(r.social.created, isEmpty);
  });

  testWidgets('yaroqsiz havola — aniq xabar, so‘rov yo‘q', (tester) async {
    final r = await _pump(tester);
    await _addFromGallery(tester);
    await _enter(tester, 'showcase-link', 'https://evil.com/x');
    await _publish(tester);
    expect(find.text(LUz().errShowcaseBadLink), findsOneWidget);
    expect(r.social.created, isEmpty);
    expect(r.profile.uploaded, isEmpty, reason: 'yuklash ham boshlanmaydi');
  });

  testWidgets('5 tadan ko‘p tanlanmaydi; olib tashlash mumkin',
      (tester) async {
    final r = await _pump(tester,
        paths: [for (var i = 0; i < 7; i++) '/tmp/$i.jpg']);
    await _addFromGallery(tester);
    expect(r.source.limits, [5]);
    expect(find.byKey(const ValueKey('showcase-thumb-4')), findsOneWidget);
    expect(find.byKey(const ValueKey('showcase-add-image')), findsNothing);
    await tester.tap(find.descendant(
        of: find.byKey(const ValueKey('showcase-thumb-0')),
        matching: find.byIcon(Icons.close_rounded)));
    await settle(tester, frames: 3);
    expect(find.byKey(const ValueKey('showcase-thumb-4')), findsNothing);
    expect(find.byKey(const ValueKey('showcase-add-image')), findsOneWidget);
  });

  testWidgets('chop etish: har rasm yuklanadi, keyin createPost maydonlari',
      (tester) async {
    final r = await _pump(tester,
        music: const MusicTrack(id: 5, title: 'Kuy', start: 12));
    await _addFromGallery(tester);
    await _enter(tester, 'showcase-title', 'Qizil ko‘ylak');
    await _enter(tester, 'showcase-desc', 'Yangi kolleksiya');
    await _enter(tester, 'showcase-price', '125000');
    expect(find.text('125 000'), findsOneWidget);
    await _enter(tester, 'showcase-link', 'https://www.instagram.com/p/x');
    await tester.ensureVisible(find.byKey(const ValueKey('showcase-seconds-8')));
    await tester.tap(find.byKey(const ValueKey('showcase-seconds-8')));
    await tester.pump();
    await _publish(tester);

    expect(r.profile.uploaded, ['/tmp/a.jpg', '/tmp/b.jpg']);
    final c = r.social.created.single;
    expect(c.company, isFalse);
    expect(c.code, testIds.first.code);
    expect(c.draft.mediaUrls, ['/uploads/u1.jpg', '/uploads/u2.jpg']);
    expect(c.draft.title, 'Qizil ko‘ylak');
    expect(c.draft.text, 'Yangi kolleksiya');
    expect(c.draft.priceUzs, 125000);
    expect(c.draft.linkUrl, 'https://www.instagram.com/p/x');
    expect(c.draft.musicId, 5);
    expect(c.draft.musicStart, 12);
    expect(c.draft.imageSeconds, 8);
    expect(c.draft.catalogItemId, isNull);
    expect(find.text('HOME'), findsOneWidget, reason: 'muvaffaqiyat — yopiladi');
  });

  testWidgets('biznes: katalogdan tanlash sarlavha/narx/rasmni to‘ldiradi',
      (tester) async {
    final item = CatalogItem.fromJson({
      'id': 'b9fa1d77-794a-4b7a-b972-aecb1dce7c02',
      'name': 'Ko‘ylak',
      'price': 99000,
      'imageUrl': '/uploads/k1.jpg',
      'images': ['/uploads/k2.jpg'],
    });
    final r = await _pump(
      tester,
      paths: const [],
      as: const ActiveProfile.company(
          Business(companyId: 'C7', displayName: 'Ali Market')),
      catalog: [item],
    );
    await tester.tap(find.byKey(const ValueKey('showcase-from-catalog')));
    await settle(tester, frames: 8);
    await tester.tap(find.byKey(ValueKey('showcase-catalog-${item.key}')));
    await settle(tester, frames: 8);
    expect(find.byKey(const ValueKey('showcase-catalog-picked')), findsOneWidget);
    expect(find.text('99 000'), findsOneWidget);
    expect(find.byKey(const ValueKey('showcase-thumb-1')), findsOneWidget);
    await _publish(tester);

    expect(r.profile.uploaded, isEmpty, reason: 'katalog rasmlari serverda');
    final c = r.social.created.single;
    expect(c.company, isTrue);
    expect(c.code, 'C7');
    expect(c.draft.title, 'Ko‘ylak');
    expect(c.draft.priceUzs, 99000);
    expect(c.draft.catalogItemId, 'b9fa1d77-794a-4b7a-b972-aecb1dce7c02');
    expect(c.draft.mediaUrls, ['/uploads/k1.jpg', '/uploads/k2.jpg']);
    expect(c.draft.mediaUrls.every((u) => !u.startsWith(kApiBase)), isTrue);
  });
}
