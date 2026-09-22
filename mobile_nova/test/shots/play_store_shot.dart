@Tags(['shots'])
library;

// PLAY MARKET SKRINSHOTLARI.
//
// Play Console telefon uchun kamida 2 ta surat so'raydi (biz 6 ta
// beramiz). Talab: eng qisqa tomoni >= 320px, eng uzuni <= 3840px,
// nisbat 16:9 va 9:16 oralig'ida.
//
// 1080x1920 chiqadi (540x960 mantiqiy piksel, 2x) — 16:9.
//
// NIMA UCHUN 16:9. Avval 1080x2340 (zamonaviy telefon nisbati)
// olingan edi, lekin Play skrinshot uchun MAKSIMUM 2:1 ga ruxsat
// beradi — 2.17 rad etilardi. 16:9 chegaradan uzoq va xavfsiz.
//
// Suratlar HAQIQIY VIDJETLARDAN chiziladi, maket emas: do'konda
// ko'rgan narsa ilovada ham aynan shunday. Ma'lumot esa
// `testOverrides()` dan — tarmoqqa chiqilmaydi va hech kimning
// haqiqiy profili do'konga tushmaydi.
//
//   flutter test --run-skipped -t shots --update-goldens \
//     test/shots/play_store_shot.dart

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart'
    show rootBundle, FontLoader, MethodChannel;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/auth_repository.dart';
import 'package:nfcstore_nova/data/repositories/discover_repository.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/demo/demo_data.dart';
import 'package:nfcstore_nova/features/discover/discover_screen.dart';
import 'package:nfcstore_nova/features/entry/welcome_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_center_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';

import '../helpers.dart';

/// UI/UX AUDIT — ekranlarni STANDART mavzuda suratga oladi.
///
/// `shots_test.dart` ochiq (`pearl`) mavzuda ishlaydi. Egasining
/// shikoyati esa telefonda ko'rinadigan STANDART mavzu haqida
/// ("ko'k va og'ir"), ya'ni auditni aynan o'sha mavzuda qilish
/// kerak.
///
///   flutter test test/shots/ui_audit_shot.dart \
///     --run-skipped -t shots --update-goldens
void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();

    // DISK KESHIGA VAQTINCHALIK PAPKA.
    //
    // `runAsync` tufayli endi HAQIQIY asenkron kod ishlaydi va
    // `CachedNetworkImage` o'z keshini ochmoqchi bo'ladi. Testda
    // `path_provider` plagini yo'q, shuning uchun u test
    // tugagandan KEYIN `MissingPluginException` tashlaydi va
    // suratni tayyor deb hisoblab bo'lmaydi.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (_) async => Directory.systemTemp
          .createTempSync('nova_play_shots')
          .path,
    );
    final fams = {
      'InstrumentSerif': ['assets/fonts/InstrumentSerif-400.ttf'],
      'Manrope': [
        'assets/fonts/Manrope-400.ttf',
        'assets/fonts/Manrope-500.ttf',
        'assets/fonts/Manrope-600.ttf',
        'assets/fonts/Manrope-700.ttf',
      ],
      'IBMPlexMono': ['assets/fonts/IBMPlexMono-500.ttf'],
      'PlayfairDisplay': ['assets/fonts/PlayfairDisplay-500.ttf'],
    };
    for (final f in fams.entries) {
      final loader = FontLoader(f.key);
      var any = false;
      for (final p in f.value) {
        if (File(p).existsSync()) {
          loader.addFont(rootBundle.load(p));
          any = true;
        }
      }
      if (any) await loader.load();
    }
    final root = Platform.environment['FLUTTER_ROOT'] ?? '';
    final icons = File(
        '$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (icons.existsSync()) {
      final l = FontLoader('MaterialIcons')
        ..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData()));
      await l.load();
    }
  });

  /// KIRGAN FOYDALANUVCHI HAM DEMO BO'LSIN.
  ///
  /// `demoOverrides()` profil, lenta va biznesni almashtiradi,
  /// lekin SESSIYAGA tegmaydi — u ilovaning boshqa qatlami.
  /// Natijada Bosh sahifa "Test Foydalanuvchi" va 48210377 deb
  /// turardi: do'kon sahifasida bu eng ko'zga tashlanadigan xato
  /// bo'lardi.
  ///
  /// Shuning uchun sessiya ham demo odamni qaytaradi. Bu faqat
  /// `test/` ichida — ishlab chiqarish kodiga kirmaydi.
  Future<void> shot(
    WidgetTester tester,
    Widget screen,
    String name, {
    NfcTokens? tokens,
    // MANTIQIY O'LCHAM TELEFONNIKI BO'LSIN.
    //
    // Birinchi urinishda bu yerda 540x960 turgan edi va suratlar
    // "sifatsiz" chiqdi. Sabab piksel soni emas — u o'sha-o'sha
    // 1080x1920 edi. Sabab MANTIQIY kenglik: 540 dp planshet
    // kengligi, telefonniki ~360-400 dp. Flutter matnni dp da
    // chizadi, shuning uchun 14 dp sarlavha 540 dp kenglikda
    // rasmning 1/38 qismi bo'lib qolgan — ingichka va mayda.
    //
    // 360 dp @3x ham aynan 1080x1920 beradi, lekin har bir element
    // 1.5 barobar yirik va to'q chiqadi.
    Size size = const Size(360, 640),
    double dpr = 3.0,
  }) async {
    tester.view.physicalSize = size * dpr;
    tester.view.devicePixelRatio = dpr;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(ProviderScope(
      // DO'KON SURATIDA "Test Foydalanuvchi" TURMASIN.
      //
      // `testOverrides()` sinov uchun: ismi "Test Foydalanuvchi",
      // postlari nol, obunachilari esa umuman yuklanmaydi va
      // o'rniga "—" chiziladi. Bunday surat do'konda ilovani
      // BO'SH ko'rsatadi.
      //
      // `demoOverrides()` esa ilovaning O'ZIDA bor: "NFC Mobile"
      // bo'limi aynan shu ma'lumot bilan ochiladi va rasmlar APK
      // ichida keladi. Ya'ni bu to'qib chiqarilgan maket emas —
      // foydalanuvchi ilovani o'rnatib o'sha ekranni ko'radi.
      overrides: [
        ...await testOverrides(),
        ...demoOverrides(),
        authRepositoryProvider.overrideWithValue(_DemoAuthRepository()),
        // TANLOV UCHUN ALOHIDA MANBA.
        //
        // `demoOverrides()` profil va lentani almashtiradi, lekin
        // Tanlov boshqa repozitoriydan o'qiydi. Usiz ro'yxatda
        // bitta "Test Foydalanuvchi" turardi.
        discoverRepositoryProvider
            .overrideWithValue(_ShowcaseDiscoverRepository()),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildTheme(tokens ?? NfcTokens.fallback),
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
    // RASMLAR HAQIQATAN CHIZILSIN.
    //
    // `Image.asset` dekodi ASENKRON. Oddiy `pump` soatni suradi,
    // lekin dekod uchun HAQIQIY event loop kerak — usiz golden
    // faylga fotolar o'rniga bo'sh joy tushadi.
    //
    // Bir marta kutish YETMAYDI va buni avatar ko'rsatdi: birinchi
    // kadrda profil hali KELMAGAN, demak `Image.asset` hali
    // boshlanmagan ham. Ma'lumot kelgach rasm yuklana boshlaydi —
    // lekin asenkron oyna allaqachon yopilgan bo'lardi va
    // avatar o'rnida bo'sh doira qolardi.
    //
    // Shuning uchun uch bosqich: kut -> chiz -> kut. Birinchisi
    // ma'lumotni, keyingilari undan kelib chiqqan rasmlarni
    // ulguradi.
    for (var round = 0; round < 3; round++) {
      await tester.runAsync(() async {
        await Future<void>.delayed(const Duration(milliseconds: 300));
      });
      await tester.pump();
    }
    // Ambient fon cheksiz aylanadi — belgilangan kadr suriladi.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 80));
    }
    await expectLater(
        find.byType(MaterialApp), matchesGoldenFile('png/$name.png'));
  }


  // ── PLAY UCHUN TO'PLAM ─────────────────────────────────────────
  //
  // Tartibni EGASI tanladi: telefonidan uchta ekranni yuborib
  // "shu rasmlarni qo'yish kerak" dedi — Xush kelibsiz, NFC
  // markazi va Kirish. Ular shu yerda qayta chizildi, chunki
  // telefondan olingan nusxa ~570px kenglikda edi; bu yerda
  // aynan o'sha ekranlar 1080x1920 bo'lib chiqadi.
  //
  // Birinchi surat eng muhimi: odam do'konda uni ko'radi va
  // "bu nima?" degan savolga javob olishi kerak. Shuning uchun
  // birinchi o'rinda hero rasmli Xush kelibsiz ekrani turadi.

  testWidgets('play 1 — Xush kelibsiz', (t) async {
    await shot(t, const WelcomeScreen(), 'play-1-xush-kelibsiz');
  });
  testWidgets('play 2 — NFC markazi', (t) async {
    await shot(t, const NfcCenterScreen(), 'play-2-nfc-markazi');
  });
  testWidgets('play 3 — Profil', (t) async {
    // Demo kodi bilan: Zafarning to'rtta posti, muqovasi va
    // haqiqiy sonlari ko'rinadi.
    await shot(t, const ProfileScreen(code: kDemoPersonalCode),
        'play-3-profil');
  });
  // SLOT 4 ATAYLAB YO'Q.
  //
  // Bu yerda avval Bosh sahifa, keyin Biznes sahifasi sinaldi.
  // Ikkalasi ham `CachedNetworkImage` ishlatadi; suratlar uchun
  // `runAsync` yoqilgandan keyin u disk keshini ochib DAVRIY
  // taymer qo'yadi, taymer esa vidjet daraxti yopilgandan keyin
  // ham qolib testni yiqitadi. Telefonda kesh aynan shunday
  // ishlashi KERAK, ya'ni ilovada nuqson yo'q — kamchilik
  // faqat surat vositasida.
  //
  // Play telefon uchun kamida 2 ta surat so'raydi; bizda 5 ta,
  // shuning uchun bu slot uchun ilovani o'zgartirish noto'g'ri
  // bo'lardi.

  // REELS SURATI ATAYLAB YO'Q.
  //
  // Ijtimoiy tomonni ko'rsatish kerak edi va Reels birinchi
  // nomzod bo'ldi. Lekin chizib ko'rilganda ekran BO'SH chiqdi:
  // "Hozircha reels yo'q".
  //
  // Sabab — demo ma'lumotida VIDEO yo'q, faqat foto
  // (`assets/demo/*.jpg`), `reelsProvider` esa `p.isVideo`
  // bo'yicha filtrlaydi. Ya'ni ekran to'g'ri ishlayapti,
  // ko'rsatadigan narsa yo'q.
  //
  // Bo'sh ekran do'kon sahifasida suratsizdan ham YOMON: odam
  // ilovani tashlandiq deb o'ylaydi. Shuning uchun Reels o'rniga
  // Tanlov qo'yildi — u ham ijtimoiy tomonni ko'rsatadi va
  // ayni paytda NFC ID plastinkalarini sotadi.
  //
  // Reels surati demo videosi qo'shilgandan keyin qaytariladi.

  testWidgets('play 5 — Tanlov', (t) async {
    // Tanlov ayni paytda NFC ID plastinkalarini ham ko'rsatadi —
    // ya'ni bitta surat ikkita narsani sotadi.
    await shot(t, const DiscoverScreen(), 'play-5-tanlov');
  });

  testWidgets('play 7 — Kirish', (t) async {
    await shot(t, const LoginScreen(), 'play-7-kirish');
  });
  testWidgets('play 8 — Oq-qora mavzu', (t) async {
    // Bitta surat MUQOBIL mavzuda: ilovada tanlov borligi
    // do'konda ham ko'rinsin.
    await shot(t, const ProfileScreen(code: kDemoPersonalCode),
        'play-8-oq-qora', tokens: NfcTokens.mono);
  });
}

/// Demo sessiyasi — ismi va NFC ID'si `demo_data.dart` dan.
class _DemoAuthRepository extends AuthRepository {
  _DemoAuthRepository() : super(ApiClient());

  static const _user = User(
    id: 1,
    email: 'zafar@nfcstore.uz',
    name: 'Zafar',
    phone: '+998901234567',
  );

  @override
  Future<Result<({User user, List<NfcId> ids})>> restore() async =>
      Ok((user: _user, ids: [demoPersonalId]));

  @override
  Future<Result<({User user, List<NfcId> ids})>> me() async => restore();

  @override
  Future<void> logout() async {}
}

/// TANLOV UCHUN NAMUNA RO'YXATI.
///
/// Turli DARAJADAGI kodlar ataylab tanlangan: ekslyuziv, gold,
/// silver va bepul. Do'kon sahifasida odam plastinkalar
/// farqini bir qarashda ko'rishi kerak — aynan shu farq xarid
/// istagini tug'diradi.
///
/// Fotolar ilova ichidagi demo aktivlaridan, ya'ni tarmoqqa
/// chiqilmaydi va hech kimning haqiqiy profili do'konga
/// tushmaydi.
class _ShowcaseDiscoverRepository extends DiscoverRepository {
  _ShowcaseDiscoverRepository() : super(ApiClient());

  // FOTO FAQAT BITTASIDA.
  //
  // Ilk urinishda to'rttasiga ham demo foto berilgan edi va
  // natijada "Malika" degan ayol ismi yonida ERKAK surati
  // turdi — demo aktivlarida bitta portret bor.
  //
  // Qolganlari bosh harf bilan chiziladi: bu halol (yolg'on
  // yuz yo'q), toza ko'rinadi va ayni paytda ilovaning bosh
  // harf avatarini ham ko'rsatadi.
  static final _people = <NfcId>[
    NfcId(
      code: 'VIP001',
      name: 'Zafar',
      role: 'Digital creator',
      avatarUrl: kDemoPortrait,
      tier: 'exclusive',
      views: 2840,
      followers: 1240,
      posts: 4,
      primary: true,
    ),
    const NfcId(
      code: 'AZK007',
      name: 'Malika Yusupova',
      role: 'Arxitektor',
      tier: 'gold',
      views: 918,
      followers: 342,
      posts: 12,
    ),
    const NfcId(
      code: 'UZD772',
      name: 'Bekzod Rahimov',
      role: 'Restoran egasi',
      tier: 'silver',
      views: 465,
      followers: 128,
      posts: 7,
    ),
    const NfcId(
      code: '48210377',
      name: 'Dilnoza Karimova',
      role: 'Marketolog',
      tier: 'free',
      views: 102,
      followers: 24,
      posts: 3,
    ),
  ];

  @override
  Future<Result<List<NfcId>>> suggested() async => Ok(_people);

  @override
  Future<Result<List<NfcId>>> searchPeople(String q) async => Ok(_people);
}
