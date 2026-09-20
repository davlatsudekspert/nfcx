@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/tokens/shapes.dart';
import 'package:nfcstore_nova/design/widgets/nova_scaffold.dart';
import 'package:nfcstore_nova/design/widgets/surfaces.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/features/business/business_forms.dart';
import 'package:nfcstore_nova/features/business/business_screens.dart';
import 'package:nfcstore_nova/features/discover/discover_screen.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_center_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/features/social/story_viewer.dart';

import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';

import '../helpers.dart';
import 'identity_widgets.dart';
import 'theme_mockup.dart';
import 'proposed_widgets.dart';

/// Suratlar uchun NAMUNAVIY ma'lumot.
///
/// Bo'sh ekranning surati dizayn haqida hech narsa aytmaydi.
/// Bu yerdagi qiymatlar faqat `test/` ichida va ilovaga
/// KIRMAYDI.
class _ShotsRepo extends SocialRepository {
  _ShotsRepo() : super(ApiClient());

  static final _stories = [
    StoryItem(
      id: 1,
      code: 'VIP001',
      authorName: 'Muhammad',
      caption: 'Yangi NFC kartalar keldi',
      likes: 12,
      createdAt: DateTime.now().subtract(const Duration(hours: 2)),
    ),
    StoryItem(id: 2, code: 'VIP001', authorName: 'Muhammad', likes: 3),
  ];

  static final _posts = [
    Post(
      id: 11,
      code: 'VIP001',
      authorName: 'Muhammad',
      text: 'NFCSTORE jamoasi bilan yangi loyiha ustida ishlayapmiz.',
      likes: 24,
      comments: 5,
      createdAt: DateTime.now().subtract(const Duration(hours: 5)),
    ),
    Post(
      id: 12,
      code: 'TTS075',
      authorName: 'Tohir',
      text: 'Bugungi uchrashuv.',
      likes: 8,
      comments: 1,
      createdAt: DateTime.now().subtract(const Duration(days: 1)),
    ),
  ];

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async => Ok(_stories);

  @override
  Future<Result<List<StoryItem>>> followedStories() async => const Ok([]);

  @override
  Future<Result<List<Post>>> feed({int page = 1}) async => Ok(_posts);

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      Ok(_posts);

  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
    String kind,
    int id, {
    int page = 1,
  }) async =>
      const Ok((items: <Comment>[], hasMore: false, total: 0));

  @override
  Future<Result<void>> markStorySeen(int id) async => const Ok(null);
}

/// Biznes ma'lumoti — suratlarda kompaniya bo'limlari BO'SH
/// ko'rinmasligi uchun.
class _ShotsBusinessRepo extends BusinessRepository {
  _ShotsBusinessRepo() : super(ApiClient());

  static const _company = Business(
    companyId: 'NFCSTOREUZ',
    displayName: 'NFCSTORE',
    category: 'texnologiya',
    city: 'Toshkent',
    description: 'NFC kartalar, stikerlar va raqamli profillar.',
    phone: '+998 90 123 45 67',
    status: 'active',
    followers: 312,
    views: 5680,
  );

  static const _items = [
    CatalogItem(id: 1, name: 'NFC karta — Classic', price: 149000),
    CatalogItem(id: 2, name: 'NFC stiker', price: 49000),
    CatalogItem(id: 3, name: 'Metall karta', price: 390000),
  ];

  @override
  Future<Result<List<Business>>> mine() async => const Ok([_company]);

  @override
  Future<Result<Business>> byId(String companyId) async => const Ok(_company);

  @override
  Future<Result<List<CatalogItem>>> catalog(String companyId) async =>
      const Ok(_items);

  @override
  Future<Result<List<Post>>> posts(String companyId) async =>
      Ok(_ShotsRepo._posts);

  @override
  Future<Result<List<StoryItem>>> stories(String companyId) async =>
      Ok(_ShotsRepo._stories);

  @override
  Future<Result<Map<String, dynamic>>> stats(
    String companyId, {
    int days = 30,
  }) async =>
      const Ok({
        'days': 30,
        'views': 5680,
        'taps': 412,
        'orders': 37,
        'series': <dynamic>[],
      });
}

/// HAQIQIY EKRANLARNI RASMGA OLISH.
///
/// Bu sinov emas — SURATGA OLUVCHI. Ilovaning O'Z vidjetlari
/// telefon o'lchamida chiziladi va PNG ga yoziladi. Chizilgan
/// narsa qo'lda tasvirlangan maket emas, aynan hozir ishlayotgan
/// kod.
///
/// Ishga tushirish:
///
///     flutter test test/shots --update-goldens --tags shots
///
/// `--tags shots` bo'lmasa oddiy `flutter test` bu faylni
/// O'TKAZIB YUBORADI: suratlar CI da qayta-qayta solishtirilishi
/// shart emas, ular faqat ko'rish uchun.
void main() {
  setUpAll(() async {
    // SHRIFTLAR YUKLANMASA matn qora to'rtburchak bo'lib chiqadi.
    // Flutter sinov muhitida `pubspec.yaml` dagi shriftlar o'zi
    // yuklanmaydi — ular qo'lda berilishi kerak.
    //
    // Ro'yxat `pubspec.yaml` DAN o'qiladi: qo'lda yozilsa, yangi
    // shrift qo'shilganda surat jimgina buzilib ketardi.
    final families = <String, List<String>>{};
    String? current;
    for (final raw in File('pubspec.yaml').readAsLinesSync()) {
      final fam = RegExp(r'^\s{4}- family:\s*(\S+)').firstMatch(raw);
      if (fam != null) {
        current = fam.group(1);
        families[current!] = <String>[];
        continue;
      }
      final asset = RegExp(r'^\s+- asset:\s*(\S+)').firstMatch(raw);
      if (asset != null && current != null) {
        families[current]!.add(asset.group(1)!);
      }
    }
    expect(families, isNotEmpty, reason: 'pubspec dan shrift topilmadi');

    for (final family in families.entries) {
      final loader = FontLoader(family.key);
      var any = false;
      for (final path in family.value) {
        if (File(path).existsSync()) {
          loader.addFont(rootBundle.load(path));
          any = true;
        }
      }
      if (any) await loader.load();
    }

    // IKONKA SHRIFTI. `MaterialIcons` Flutter SDK ichida turadi,
    // `pubspec.yaml` da emas — yuklanmasa har bir ikonka bo'sh
    // kvadrat bo'lib chiqadi va suratdan hech narsa tushunib
    // bo'lmaydi.
    final root = Platform.environment['FLUTTER_ROOT'] ??
        File(Platform.resolvedExecutable).parent.parent.parent.path;
    final icons =
        File('$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (icons.existsSync()) {
      final l = FontLoader('MaterialIcons')
        ..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData()));
      await l.load();
    } else {
      // ignore: avoid_print
      print('[shots] MaterialIcons topilmadi: ${icons.path}');
    }
  });

  /// Telefon o'lchami — iPhone 13 / o'rtacha Android sinfi.
  const phone = Size(390, 844);

  Future<void> shot(
    WidgetTester tester,
    Widget screen,
    String name, {
    NfcTokens? tokens,
    Size size = phone,
    bool business = false,
  }) async {
    tester.view.physicalSize = size * 3;
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final t = tokens ?? NfcTokens.pearl;
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        socialRepositoryProvider.overrideWithValue(_ShotsRepo()),
        businessRepositoryProvider.overrideWithValue(_ShotsBusinessRepo()),
        // BIZNES REJIMI. `ModeController` boshlang'ich holatni
        // sozlamalardan oladi, shuning uchun rejimni shu yerda
        // to'g'ridan-to'g'ri o'rnatamiz.
        if (business)
          modeProvider.overrideWith((ref) {
            final c = ModeController(ref.watch(prefsProvider));
            c.set(AppMode.business);
            return c;
          }),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildTheme(t),
        locale: const Locale('uz'),
        supportedLocales: L.supportedLocales,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: screen,
      ),
    ));
    // Ambient fon CHEKSIZ aylanadi — `pumpAndSettle` hech qachon
    // tugamaydi. Belgilangan miqdorda kadr suriladi.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 80));
    }

    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('png/$name.png'),
    );
  }

  testWidgets('01 — Home', (t) async {
    await shot(t, const HomeScreen(), '01-home');
  });

  testWidgets('02 — Story ko\u2018ruvchisi', (t) async {
    await shot(t, const StoryViewerScreen(code: 'VIP001'), '02-story');
  });

  testWidgets('03 — Reels', (t) async {
    await shot(t, const ReelsScreen(), '03-reels');
  });

  testWidgets('04 — NFC markazi', (t) async {
    await shot(t, const NfcCenterScreen(), '04-nfc-center');
  });

  testWidgets('05 — Shaxsiy profil', (t) async {
    await shot(t, const ProfileScreen(), '05-profile');
  });

  testWidgets('06 — Kashf etish', (t) async {
    await shot(t, const DiscoverScreen(), '06-discover');
  });

  // ── TAKLIFLAR ───────────────────────────────────────────────
  //
  // Bular `lib/` ga TEGMAYDI: `proposed_widgets.dart` faqat
  // `test/` ichida va ilovaga kirmaydi.

  testWidgets('P1 — lenta kartasi (taklif)', (t) async {
    await shot(t, const _ProposedFeed(), 'p1-feed-card');
  });

  // ── NFC O'ZIGA XOSLIGI (Instagram naqshidan uzoqlashtirish) ──
  testWidgets('N1 — lenta kartasi: NFC kodi bosh rolda', (t) async {
    await shot(t, const _IdentityFeed(), 'n1-feed-code');
  });

  testWidgets('N2 — profil yozuvlari: karta ko\'rinishida', (t) async {
    await shot(t, const IdentityProfilePosts(), 'n2-profile-cards');
  });

  testWidgets('N3 — «Reels» o\'rniga «Lavha»', (t) async {
    await shot(t, const LavhaEmpty(), 'n3-lavha');
  });

  // ── PROFIL RANG TIZIMI — to'rt mavzu ──────────────────────────
  testWidgets('T1 — Gold shaxsiy', (t) async {
    await shot(t, const _Theme(goldTheme), 't1-gold',
        size: const Size(390, 1480));
  });

  testWidgets('T2 — Silver shaxsiy', (t) async {
    await shot(t, const _Theme(silverTheme), 't2-silver',
        size: const Size(390, 1480));
  });

  testWidgets('T3 — Exclusive qora/oltin', (t) async {
    await shot(t, const _Theme(exclusiveTheme), 't3-exclusive',
        size: const Size(390, 1480));
  });

  testWidgets('T4 — Biznes brend rangi', (t) async {
    await shot(t, const _Theme(businessTheme), 't4-business',
        size: const Size(390, 1480));
  });

  testWidgets('P2 — Reels (taklif)', (t) async {
    await shot(t, const ProposedReels(), 'p2-reels');
  });

  testWidgets('P3 — NFC markazi (taklif)', (t) async {
    await shot(t, const _ProposedNfcCenter(), 'p3-nfc-center');
  });

  testWidgets('P4 — NFC yozish (taklif)', (t) async {
    await shot(t, const ProposedNfcWrite(), 'p4-nfc-write');
  });

  testWidgets('P5 — NFC yozish: tasdiq (taklif)', (t) async {
    await shot(t, const ProposedNfcWriteWaiting(done: true), 'p5-nfc-done');
  });

  // ── QOLGAN TO'RT JUFTLIK ────────────────────────────────────

  testWidgets('07 — Post tafsiloti', (t) async {
    await shot(t, const PostScreen(code: 'VIP001', id: 11), '07-post-detail');
  });

  testWidgets('08 — Biznes profil (Profil ekrani, biznes rejimi)', (t) async {
    await shot(t, const ProfileScreen(), '08-business', business: true);
  });

  testWidgets('08b — Biznes ro\u2018yxati / vitrina', (t) async {
    await shot(t, const BusinessScreen(), '08b-business-list', business: true);
  });

  testWidgets('09 — Biznes katalog', (t) async {
    await shot(t, const BusinessCatalogScreen(), '09-business-catalog',
        business: true);
  });

  testWidgets('10 — Biznes kabinet', (t) async {
    await shot(t, const BusinessDashboardScreen(), '10-business-dash',
        business: true);
  });

  testWidgets('11 — Biznes tahlil', (t) async {
    await shot(t, const BusinessAnalyticsScreen(), '11-business-stats',
        business: true);
  });

  testWidgets('P6 — Biznes post/istorya amallari (taklif)', (t) async {
    await shot(t, const _ProposedBusinessSocial(), 'p6-business-social',
        business: true);
  });
}

/// Biznes post va istorya — taklif qilingan amallar bilan.
///
/// Kompaniya kontenti SHAXSIYGA ARALASHMAYDI: karta tepasida
/// kompaniya nomi va `company` belgisi turadi, izohlar esa
/// `company_post` / `company_story` turi bilan ketadi.
class _ProposedBusinessSocial extends StatelessWidget {
  const _ProposedBusinessSocial();

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NovaScaffold(
      title: 'NFCSTORE',
      showBack: true,
      body: NovaScroll(
        children: [
          const SectionHeader(title: 'KOMPANIYA ISTORYASI'),
          const SizedBox(height: Gap.sm),
          FloatingSurface(
            solid: true,
            padding: const EdgeInsets.all(Gap.md),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: R.tile,
                  child: SizedBox(
                    width: 54,
                    height: 72,
                    child: DecoratedBox(
                      decoration: BoxDecoration(gradient: t.accentGradient),
                    ),
                  ),
                ),
                const SizedBox(width: Gap.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('NFCSTORE',
                          style: Theme.of(context).textTheme.bodyMedium),
                      const SizedBox(height: 6),
                      Row(
                        children: const [
                          ProposedAction(
                              icon: Icons.favorite_border_rounded,
                              label: 'Yoqtirish',
                              count: '18'),
                          SizedBox(width: Gap.lg),
                          ProposedAction(
                              icon: Icons.mode_comment_outlined,
                              label: 'Izohlar',
                              count: '4'),
                          Spacer(),
                          ProposedAction(
                              icon: Icons.ios_share_rounded,
                              label: 'Ulashish'),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: Gap.xl),
          const SectionHeader(title: 'KOMPANIYA POSTI'),
          const SizedBox(height: Gap.sm),
          const ProposedFeedCard(
            author: 'NFCSTORE',
            code: 'NFCSTOREUZ',
            text: 'Yangi metall kartalar sotuvda — cheklangan miqdorda.',
            likes: '42',
            comments: '9',
            following: true,
          ),
        ],
      ),
    );
  }
}

/// Lenta — taklif qilingan kartalar bilan.
class _Theme extends StatelessWidget {
  const _Theme(this.theme);
  final ProfileTheme theme;

  @override
  Widget build(BuildContext context) =>
      Scaffold(body: SingleChildScrollView(child: ThemeShowcase(theme)));
}

class _IdentityFeed extends StatelessWidget {
  const _IdentityFeed();

  @override
  Widget build(BuildContext context) {
    return NovaScaffold(
      title: 'Lenta',
      body: NovaScroll(
        children: const [
          IdentityFeedCard(
            author: 'Tohir',
            code: 'TTS075',
            text: 'Do\'konda yangi NFC kartalar keldi.',
            tapped: true,
            likes: '24',
            comments: '5',
          ),
          SizedBox(height: Gap.md),
          IdentityFeedCard(
            author: 'Nodira',
            code: 'NDR442',
            text: 'Bugungi uchrashuv uchun rahmat.',
            likes: '8',
            comments: '2',
          ),
        ],
      ),
    );
  }
}

class _ProposedFeed extends StatelessWidget {
  const _ProposedFeed();

  @override
  Widget build(BuildContext context) {
    return NovaScaffold(
      title: 'Lenta',
      body: NovaScroll(
        children: const [
          ProposedFeedCard(
            author: 'Muhammad',
            code: 'VIP001',
            text: 'NFCSTORE jamoasi bilan yangi loyiha ustida ishlayapmiz.',
            likes: '24',
            comments: '5',
            liked: true,
            following: null,
          ),
          SizedBox(height: Gap.md),
          ProposedFeedCard(
            author: 'Tohir',
            code: 'TTS075',
            text: 'Bugungi uchrashuv — yangi hamkorlar bilan.',
            likes: '8',
            comments: '1',
            following: false,
          ),
        ],
      ),
    );
  }
}

/// NFC markazi — MAVJUD tuzilma + yangi vositalar.
class _ProposedNfcCenter extends StatelessWidget {
  const _ProposedNfcCenter();

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NovaScaffold(
      title: 'NFC markazi',
      body: NovaScroll(
        children: [
          // MAVJUD ORB VA AMALLAR SHU YERDA QOLADI — bu maketda
          // ular joyini ko'rsatish uchun soddalashtirilgan.
          Container(
            height: 210,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: R.soft,
              border: Border.all(color: t.border2, style: BorderStyle.solid),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.nfc_rounded, size: 54, color: t.accent2),
                const SizedBox(height: Gap.sm),
                Text('MAVJUD: orb + NFC ID\u2019larim, Xavfsizlik,',
                    style: Theme.of(context).textTheme.bodySmall),
                Text('Kartalar, Sovg\u2018a — o\u2018zgarmaydi',
                    style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          const SizedBox(height: Gap.xl),
          const SectionHeader(title: 'NFC VOSITALARI'),
          const SizedBox(height: Gap.sm),
          const ProposedNfcTool(
            icon: Icons.wifi_tethering_rounded,
            title: 'O\u2018qish',
            subtitle: 'Tegdagi havola yoki matnni ko\u2018rish',
          ),
          const SizedBox(height: Gap.sm),
          const ProposedNfcTool(
            icon: Icons.edit_note_rounded,
            title: 'Yozish',
            subtitle: 'Havola, matn, kontakt yoki profil',
          ),
          const SizedBox(height: Gap.sm),
          const ProposedNfcTool(
            icon: Icons.info_outline_rounded,
            title: 'Teg ma\u2019lumoti',
            subtitle: 'Turi, sig\u2018imi, yozish mumkinmi',
          ),
          const SizedBox(height: Gap.sm),
          const ProposedNfcTool(
            icon: Icons.delete_sweep_outlined,
            title: 'Tozalash',
            subtitle: 'Qurilma qo\u2018llasa — bo\u2018sh NDEF yoziladi',
            disabled: true,
          ),
        ],
      ),
    );
  }
}
