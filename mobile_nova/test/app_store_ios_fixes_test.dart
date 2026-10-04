import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/core/utils/validators.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/buttons.dart';
import 'package:nfcstore_nova/design/widgets/fields.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/demo/demo_data.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_edit_screen.dart';
import 'package:nfcstore_nova/features/settings/settings_screen.dart';
import 'package:nfcstore_nova/features/settings/settings_subscreens.dart';
import 'package:nfcstore_nova/features/shop/store_policy.dart';
import 'package:nfcstore_nova/features/social/content_rules.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

/// APP STORE (iPhone) TAYYORGARLIGI — 2026-10-04 auditining topilmalari.
///
/// Har tekshiruv imkon qadar IKKI TOMONLAMA (`app_store_policy_test.dart`
/// kabi): iPhone'da tuzatilgan, Android'da avvalgidek. Bittasi yolg'iz
/// sinalsa "hamma joyda yashirildi" yoki "hech narsa o'zgarmadi" xatosi
/// ko'rinmay qolardi.
final _ios = TargetPlatformVariant.only(TargetPlatform.iOS);

String _read(String p) => File(p).readAsStringSync();

/// Izohsiz kod — tekshiruv KOD haqida, izohdagi so'zlar haqida emas.
String _codeOnly(String s) => s
    .split('\n')
    .where((l) => !l.trimLeft().startsWith('//'))
    .join('\n');

Future<L> _uz() => L.delegate.load(const Locale('uz'));

void _tall(WidgetTester tester) {
  tester.view.physicalSize = const Size(393 * 3, 1600 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

/// Ekranni haqiqiy `GoRouter` ichida ochadi; [extra] yo'llarga o'tish
/// [went] ga yoziladi.
Widget _routed(
  Widget screen,
  List<Override> overrides, {
  List<String> extra = const [],
  List<String>? went,
}) {
  final router = GoRouter(routes: [
    GoRoute(path: '/', builder: (_, __) => screen),
    for (final p in extra)
      GoRoute(
        path: p,
        builder: (_, __) {
          went?.add(p);
          return Scaffold(body: Text('ROUTE $p'));
        },
      ),
  ]);
  return ProviderScope(
    overrides: overrides,
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
  );
}

void main() {
  // ───────────────────────────────── 1. ruxsat matnlari va musiqa
  group('1. Info.plist ruxsat matnlari', () {
    final plist = _read('ios/Runner/Info.plist');
    Map<String, String> purposeStrings() {
      final re = RegExp(
          r'<key>((?:NS\w+|NFCReader)UsageDescription)</key>\s*<string>([^<]*)</string>');
      return {
        for (final m in re.allMatches(plist)) m.group(1)!: m.group(2)!,
      };
    }

    test('musiqa kutubxonasi kaliti bor (aks holda iOS ilovani yopadi)', () {
      expect(purposeStrings().keys, contains('NSAppleMusicUsageDescription'));
    });

    test('kerakli kalitlarning hammasi joyida', () {
      expect(
        purposeStrings().keys,
        containsAll(const [
          'NFCReaderUsageDescription',
          'NSFaceIDUsageDescription',
          'NSCameraUsageDescription',
          'NSPhotoLibraryUsageDescription',
          'NSMicrophoneUsageDescription',
          'NSPhotoLibraryAddUsageDescription',
          'NSAppleMusicUsageDescription',
        ]),
      );
    });

    test('HAR BIR matn ikki tilda: "O‘zbekcha … / English …"', () {
      final all = purposeStrings();
      expect(all, isNotEmpty);
      for (final e in all.entries) {
        final parts = e.value.split(' / ');
        expect(parts.length, 2, reason: '${e.key}: " / " bilan ikki qism emas');
        final uz = parts[0].trim();
        final en = parts[1].trim();
        expect(uz, contains('kerak'), reason: '${e.key}: o‘zbekcha qism');
        expect(uz.length, greaterThan(25), reason: '${e.key}: juda qisqa');
        expect(en, startsWith('NFCSTORE '),
            reason: '${e.key}: inglizcha qism ilova nomi bilan boshlansin');
        expect(en.length, greaterThan(40),
            reason: '${e.key}: maqsad aniq aytilmagan');
      }
    });

    test('kamera matni videoni ham aytadi (Reels ham kameradan)', () {
      final camera = purposeStrings()['NSCameraUsageDescription']!;
      expect(camera, contains('video'));
      expect(camera, contains('Reels'));
    });

    test('CI qo‘riqchisi musiqa kalitini ham tekshiradi', () {
      final ci = _read('../.github/workflows/nova-ios.yml');
      expect(ci, contains('NSAppleMusicUsageDescription'));
      expect(ci, contains('NSFaceIDUsageDescription'));
    });
  });

  group('1. "Musiqa qo‘shish" oynasi', () {
    testWidgets('Android: avvalgidek audio oynasi', (tester) async {
      final spec = musicPickerSpec();
      expect(spec.type, FileType.audio);
      expect(spec.extensions, isNull);
    });

    testWidgets('iPhone: Fayllar oynasi — ruxsat kerak emas', (tester) async {
      final spec = musicPickerSpec();
      expect(spec.type, FileType.custom,
          reason: 'FileType.audio iOS’da Music kutubxonasini ochadi');
      expect(spec.extensions, containsAll(['mp3', 'm4a']));
      // AVPlayer o'ynamaydigan va server sniffer'i qabul qilmaydigan
      // turlar ro'yxatda yo'q.
      expect(spec.extensions, isNot(contains('ogg')));
      expect(spec.extensions, isNot(contains('flac')));
    }, variant: _ios);

    test('tanlash oynasi aynan shu sozlamadan o‘qiladi', () {
      final src = _codeOnly(
          _read('lib/features/profile/profile_edit_screen.dart'));
      final pick = src.substring(src.indexOf('Future<void> _pickMusic()'));
      final body = pick.substring(0, pick.indexOf('withData'));
      expect(body, contains('type: spec.type'));
      expect(body, contains('allowedExtensions: spec.extensions'));
      expect(body, isNot(contains('FileType.audio')));
    });
  });

  // ───────────────────────────────────────────── 2. Yangiliklar
  group('2. Yangiliklar iPhone’da yo‘q', () {
    Future<L> pumpAbout(WidgetTester tester) async {
      _tall(tester);
      await tester.pumpWidget(ProviderScope(
        overrides: [...await testOverrides()],
        child: wrapScreen(const AboutScreen(), tokens: NfcTokens.ivory),
      ));
      await settle(tester);
      return _uz();
    }

    testWidgets('Android: "Ilova haqida"da Yangiliklar bor', (tester) async {
      final l = await pumpAbout(tester);
      expect(find.text(l.settingsNews), findsWidgets);
      expect(showNewsEntry, isTrue);
    });

    testWidgets('iPhone: "Ilova haqida"da Yangiliklar YO‘Q', (tester) async {
      final l = await pumpAbout(tester);
      expect(tester.takeException(), isNull);
      expect(find.text(l.settingsNews), findsNothing);
      expect(showNewsEntry, isFalse);
      // Qolgan huquqiy havolalar joyida.
      expect(find.text(l.legalPrivacy), findsOneWidget);
      expect(find.text(l.legalTerms), findsOneWidget);
    }, variant: _ios);

    test('lib/ ichida NewsScreen’ga boshqa kirish yo‘li yo‘q', () {
      // Yangi tugma qo'shilsa va kalit unutilsa — iPhone'da yana
      // saytdagi xarid e'lonlari chiqadi.
      final hits = <String>[];
      for (final f in Directory('lib').listSync(recursive: true)) {
        if (f is! File || !f.path.endsWith('.dart')) continue;
        if (f.path.contains('l10n/gen')) continue;
        final code = _codeOnly(f.readAsStringSync());
        if (code.contains('Routes.settingsNews')) hits.add(f.path);
      }
      expect(hits, ['lib/features/settings/settings_subscreens.dart'],
          reason: 'yangi kirish yo‘li: $hits');
      final about = _codeOnly(
          _read('lib/features/settings/settings_subscreens.dart'));
      final at = about.indexOf('Routes.settingsNews');
      final guard = about.lastIndexOf('if (showNewsEntry)', at);
      expect(guard, greaterThan(0), reason: 'kalit yo‘q');
      expect(at - guard, lessThan(600),
          reason: 'kalit aynan shu qatorni o‘rashi kerak');
    });
  });

  // ─────────────────────────────── 2 va 4. iPhone'da yo'naltirish
  group('2/4. Havola bilan ochilsa ham', () {
    Future<GoRouter> boot(WidgetTester tester) async {
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final c = ProviderContainer(overrides: [...await testOverrides()]);
      addTearDown(c.dispose);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: const NovaApp(),
      ));
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      return c.read(routerProvider);
    }

    Future<String> go(WidgetTester tester, GoRouter r, String to) async {
      r.go(to);
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      return r.routerDelegate.currentConfiguration.uri.path;
    }

    testWidgets('iPhone: /settings/news → "Ilova haqida"', (tester) async {
      final r = await boot(tester);
      expect(await go(tester, r, Routes.settingsNews), Routes.settingsAbout);
    }, variant: _ios);

    testWidgets('iPhone: /settings/notifications → Sozlamalar',
        (tester) async {
      final r = await boot(tester);
      expect(await go(tester, r, Routes.settingsNotifications),
          Routes.settings);
    }, variant: _ios);

    testWidgets('Android: ikkalasi ham ochiladi', (tester) async {
      final r = await boot(tester);
      expect(await go(tester, r, Routes.settingsNews), Routes.settingsNews);
      expect(await go(tester, r, Routes.settingsNotifications),
          Routes.settingsNotifications);
    });
  });

  // ───────────────────────────────────────── 3. ID yo'q kartasi
  group('3. Bosh sahifa: NFC ID yo‘q kartasi', () {
    Future<(L, List<String>)> pumpHome(WidgetTester tester) async {
      _tall(tester);
      final went = <String>[];
      final base = await testOverrides();
      await tester.pumpWidget(_routed(
        const HomeScreen(),
        [
          // `base[1]` — standart auth; bitta provayder ikki marta
          // almashtirilmaydi.
          ...base.where((o) => !identical(o, base[1])),
          authRepositoryProvider
              .overrideWithValue(FakeAuthRepository(ids: const [])),
        ],
        extra: [Routes.nfcActivate, Routes.shop, Routes.nfcMarket],
        went: went,
      ));
      await settle(tester, frames: 16);
      return (await _uz(), went);
    }

    testWidgets('iPhone: bepul ID va qidiruv yo‘q — stiker faollashtirish',
        (tester) async {
      final (l, went) = await pumpHome(tester);
      expect(tester.takeException(), isNull);
      expect(find.text(l.homeNoId), findsOneWidget);
      expect(find.text(l.homeNoIdHintIos), findsOneWidget);
      expect(find.text(l.homeNoIdHint), findsNothing);
      expect(find.text(l.homeShop), findsNothing);

      await tester.tap(find.text(l.stickerActivate));
      await settle(tester);
      expect(went, [Routes.nfcActivate],
          reason: 'ID qidiruvi (do‘kon) emas, faollashtirish ochilishi kerak');
    }, variant: _ios);

    testWidgets('Android: avvalgidek Do‘kon', (tester) async {
      final (l, went) = await pumpHome(tester);
      expect(find.text(l.homeNoIdHint), findsOneWidget);
      await tester.tap(find.text(l.homeShop));
      await settle(tester);
      expect(went, [Routes.shop]);
    });

    test('iPhone matnida "bepul" va "qidiruv" va’dasi yo‘q', () {
      final banned = {
        'uz': ['bepul', 'qidiruv', 'bo‘sh id'],
        'ru': ['бесплат', 'поиск', 'свободн'],
        'en': ['free', 'search', 'make it yours'],
      };
      for (final e in banned.entries) {
        final arb = jsonDecode(_read('lib/l10n/arb/app_${e.key}.arb'))
            as Map<String, dynamic>;
        final v = '${arb['homeNoIdHintIos']}'.toLowerCase();
        for (final w in e.value) {
          expect(v.contains(w), isFalse, reason: '${e.key}: "$w"');
        }
      }
    });
  });

  // ───────────────────────────────────── 4. Bildirishnomalar
  group('4. Bildirishnoma sozlamasi iPhone’da yo‘q', () {
    Future<L> pumpSettings(WidgetTester tester) async {
      _tall(tester);
      await tester.pumpWidget(_routed(
        const SettingsScreen(),
        [...await testOverrides()],
      ));
      await settle(tester, frames: 10);
      return _uz();
    }

    testWidgets('iPhone: Sozlamalarda "Bildirishnomalar" qatori yo‘q',
        (tester) async {
      final l = await pumpSettings(tester);
      expect(tester.takeException(), isNull);
      expect(find.text(l.settingsNotifications), findsNothing);
      expect(showNotificationSettings, isFalse);
      // Qo'shni qatorlar joyida.
      expect(find.text(l.settingsPrivacy), findsOneWidget);
      expect(find.text(l.settingsLanguage), findsOneWidget);
    }, variant: _ios);

    testWidgets('Android: qator bor', (tester) async {
      final l = await pumpSettings(tester);
      expect(find.text(l.settingsNotifications), findsOneWidget);
      expect(showNotificationSettings, isTrue);
    });
  });

  // ─────────────────────── 5. AI oshkorligi va nol toqat (5.1.2(i), 1.2)
  group('5. Kontent qoidalari: Google Gemini va nol toqat', () {
    test('AI yozuvi uchala tilda: Google, Gemini, rasm VA video', () {
      final checks = {
        'uz': ['google', 'gemini', 'rasm', 'video', 'sun’iy intellekt'],
        'ru': ['google', 'gemini', 'фото', 'видео', 'искусственн'],
        'en': ['google', 'gemini', 'photos', 'videos', 'ai'],
      };
      for (final e in checks.entries) {
        final arb = jsonDecode(_read('lib/l10n/arb/app_${e.key}.arb'))
            as Map<String, dynamic>;
        for (final k in ['rulesAiNotice', 'rulesAiConsent']) {
          final v = '${arb[k] ?? ''}'.toLowerCase();
          expect(v, isNotEmpty, reason: '${e.key}.$k yo‘q');
          expect(v, contains('gemini'), reason: '${e.key}.$k');
        }
        final notice = '${arb['rulesAiNotice']}'.toLowerCase();
        for (final w in e.value) {
          expect(notice, contains(w), reason: '${e.key}: "$w"');
        }
        final zero = '${arb['rulesZeroTolerance'] ?? ''}';
        expect(zero, isNotEmpty, reason: '${e.key}.rulesZeroTolerance');
      }
    });

    test('nol toqat: kontent VA haqorat qiluvchi foydalanuvchilar', () {
      final en = jsonDecode(_read('lib/l10n/arb/app_en.arb'))
          as Map<String, dynamic>;
      final v = '${en['rulesZeroTolerance']}'.toLowerCase();
      expect(v, contains('zero tolerance'));
      expect(v, contains('objectionable content'));
      expect(v, contains('harass'));
      expect(v, contains('blocked'));
    });

    test('rulesCardProcess "faqat rasm" deb noto‘g‘ri aytmaydi', () {
      // Ilgari: "Yuklangan rasmlar avtomatik tekshiriladi" — video ham
      // tekshiriladi, kim tekshirishi esa aytilmasdi. Endi bu
      // `rulesAiNotice` da.
      final en = jsonDecode(_read('lib/l10n/arb/app_en.arb'))
          as Map<String, dynamic>;
      expect('${en['rulesCardProcess']}',
          isNot(contains('Uploaded photos are checked automatically')));
    });

    /// Darvozani chaqiruvchi tugma.
    Widget gateButton(List<bool> results) => Consumer(
          builder: (context, ref, _) => Center(
            child: TextButton(
              onPressed: () async =>
                  results.add(await ensureContentRules(context, ref)),
              child: const Text('GATE'),
            ),
          ),
        );

    testWidgets('varaqda AI yozuvi va nol toqat; IKKI rozilik shart',
        (tester) async {
      _tall(tester);
      final results = <bool>[];
      final c = ProviderContainer(overrides: [...await testOverrides()]);
      addTearDown(c.dispose);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: wrapScreen(Scaffold(body: gateButton(results)),
            tokens: NfcTokens.ivory),
      ));
      await settle(tester);
      final l = await _uz();

      await tester.tap(find.text('GATE'));
      await settle(tester);
      expect(find.text(l.rulesAiNotice), findsOneWidget);
      expect(find.text(l.rulesZeroTolerance), findsOneWidget);
      expect(find.text(l.rulesAiConsent), findsOneWidget);

      NovaButton cont() =>
          tester.widget<NovaButton>(find.widgetWithText(NovaButton, l.rulesContinue));

      // Faqat qoidalarga rozilik — AI'siz davom etib bo'lmaydi.
      await tester.tap(find.byKey(const ValueKey('rules-accept')));
      await settle(tester, frames: 4);
      expect(cont().onPressed, isNull,
          reason: 'AI tekshiruviga ALOHIDA rozilik shart');

      await tester.tap(find.byKey(const ValueKey('rules-ai-consent')));
      await settle(tester, frames: 4);
      expect(cont().onPressed, isNotNull);

      await tester.tap(find.widgetWithText(NovaButton, l.rulesContinue));
      await settle(tester);
      expect(results, [true]);
      expect(c.read(contentRulesProvider), isTrue);
      expect(c.read(prefsProvider).contentRulesAccepted, isTrue);
    });

    testWidgets('faqat AI roziligi bilan ham davom etib bo‘lmaydi',
        (tester) async {
      _tall(tester);
      final results = <bool>[];
      await tester.pumpWidget(ProviderScope(
        overrides: [...await testOverrides()],
        child: wrapScreen(Scaffold(body: gateButton(results)),
            tokens: NfcTokens.ivory),
      ));
      await settle(tester);
      final l = await _uz();
      await tester.tap(find.text('GATE'));
      await settle(tester);
      await tester.tap(find.byKey(const ValueKey('rules-ai-consent')));
      await settle(tester, frames: 4);
      expect(
        tester
            .widget<NovaButton>(
                find.widgetWithText(NovaButton, l.rulesContinue))
            .onPressed,
        isNull,
      );
      await tester.tap(find.widgetWithText(NovaButton, l.actionCancel));
      await settle(tester);
      expect(results, [false]);
    });

    test('ESKI rozilik (AI’siz) hisobga olinmaydi — darvoza qayta',
        () async {
      // Eski kalit: `nova.contentRulesAccepted` — Gemini haqida
      // hech narsa aytilmagan paytdagi rozilik.
      SharedPreferences.setMockInitialValues(
          {'nova.contentRulesAccepted': true});
      final prefs = await Prefs.open();
      expect(prefs.contentRulesAccepted, isFalse);
      await prefs.setContentRulesAccepted(true);
      expect(prefs.contentRulesAccepted, isTrue);
    });

    testWidgets('joylash ekranidagi kartada ham AI yozuvi bor',
        (tester) async {
      _tall(tester);
      await tester.pumpWidget(wrapScreen(
        const Scaffold(body: SingleChildScrollView(child: ContentRulesCard())),
        tokens: NfcTokens.ivory,
      ));
      await settle(tester, frames: 4);
      final l = await _uz();
      expect(find.byKey(const ValueKey('rules-ai-notice')), findsOneWidget);
      expect(find.text(l.rulesAiNotice), findsOneWidget);
    });

    test('rasm yuklash boshlanadigan HAMMA joyda darvoza bor', () {
      // Darvoza faqat postda bo'lsa, avatar yoki biznes rasmi
      // Gemini'ga ogohlantirishsiz ketardi.
      final sites = {
        'lib/features/profile/profile_edit_screen.dart':
            'Future<void> _pickImage(',
        'lib/features/auth/profile_setup_screen.dart':
            'Future<void> _pickAvatar(',
        'lib/features/business/business_forms.dart#logo':
            'Future<void> _pick({required bool cover})',
        'lib/features/business/business_forms.dart#catalog':
            'Future<void> _addImage(',
      };
      for (final e in sites.entries) {
        final src = _codeOnly(_read(e.key.split('#').first));
        final at = src.indexOf(e.value);
        expect(at, greaterThan(0), reason: '${e.key}: ${e.value} topilmadi');
        // Imzoning o'zi (`_pickImage(`) qidiruvga tushmasin.
        final body = src.substring(at + e.value.length);
        final gate = body.indexOf('ensureContentRules(context, ref)');
        final picker = body
            .indexOf(RegExp(r'pickImage\(|listingImagePickerProvider'));
        expect(gate, greaterThan(0), reason: '${e.key}: darvoza yo‘q');
        expect(gate, lessThan(picker),
            reason: '${e.key}: darvoza rasm tanlashdan OLDIN bo‘lishi kerak');
      }
      // Post/istoriya/reel — avvalgidek joylashdan oldin.
      final composer = _read('lib/features/social/post_screens.dart');
      final publish = composer.substring(composer.indexOf('Future<void> _publish'));
      expect(publish.indexOf('ensureContentRules'),
          lessThan(publish.indexOf('uploadVideo')));
    });
  });

  // ──────────────────────────────────────────────── 6. Demo do'kon
  group('6. Demo do‘kon — begona brend va begona aloqa yo‘q', () {
    test('katalogda telefon brendlari yo‘q', () {
      const brands = [
        'iphone', 'apple', 'samsung', 'galaxy', 'xiaomi', 'redmi', 'pixel',
        'huawei', 'honor', 'oppo', 'vivo',
      ];
      for (final c in demoCatalog) {
        final text = '${c.name} ${c.description}'.toLowerCase();
        for (final b in brands) {
          expect(text.contains(b), isFalse, reason: '${c.name}: "$b"');
        }
        expect(c.imageUrl, isNot(contains('m_iphone')));
        expect(c.imageUrl, isNot(contains('m_samsung')));
      }
    });

    test('katalog — faqat NFC mahsulotlari (tegizib ishlaydigan)', () {
      for (final c in demoCatalog) {
        final text = '${c.name} ${c.description}';
        expect(text.contains('NFC') || text.contains('tegiz'), isTrue,
            reason: '${c.name}: NFC mahsuloti emas');
      }
    });

    test('demo biznes hech kimning Telegram yoki telefoniga yubormaydi', () {
      // `t.me/nfcmarket` — begona odamning haqiqiy akkaunti edi.
      expect(demoBusiness.telegram, isEmpty);
      expect(demoBusiness.whatsapp, isEmpty);
      expect(demoBusiness.phone, isEmpty);
      expect(demoBusiness.address, isNot(contains('ko\'chasi')));
      expect(demoBusiness.description.toLowerCase(),
          isNot(contains('smartfon')));
    });

    test('ishlatilmaydigan iPhone/Samsung matnlari olib tashlangan', () {
      for (final lang in ['uz', 'ru', 'en']) {
        final arb = jsonDecode(_read('lib/l10n/arb/app_$lang.arb'))
            as Map<String, dynamic>;
        expect(arb.containsKey('demoChipIphone'), isFalse, reason: lang);
        expect(arb.containsKey('demoChipSamsung'), isFalse, reason: lang);
      }
    });
  });

  // ─────────────────────────────────── 7. Hisobni o'chirish matni
  group('7. Hisobni o‘chirish oynasi', () {
    Future<L> openDialog(WidgetTester tester) async {
      tester.view.physicalSize = const Size(390, 2400) * 3;
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(ProviderScope(
        overrides: [...await testOverrides()],
        child: wrapScreen(const SecuritySettingsScreen(),
            tokens: NfcTokens.ivory),
      ));
      await settle(tester, frames: 10);
      final l = await _uz();
      await tester.scrollUntilVisible(
          find.text(l.settingsDeleteAccount).last, 300,
          scrollable: find.byType(Scrollable).first);
      await tester.tap(find.text(l.settingsDeleteAccount).last);
      await settle(tester, frames: 8);
      return l;
    }

    testWidgets('iPhone: pullik ID, pul qaytarish va sayt yo‘q',
        (tester) async {
      final l = await openDialog(tester);
      expect(find.text(l.deleteAccountWhatIos), findsOneWidget);
      expect(find.text(l.deleteAccountWhat), findsNothing);
    }, variant: _ios);

    testWidgets('Android: avvalgi to‘liq matn', (tester) async {
      final l = await openDialog(tester);
      expect(find.text(l.deleteAccountWhat), findsOneWidget);
      expect(find.text(l.deleteAccountWhatIos), findsNothing);
    });

    test('iPhone matni: 30 va 90 kun qoladi, xarid izi yo‘q', () async {
      const banned = [
        'nfcstore.uz', 'to‘lov', 'to‘langan', 'qaytarilmaydi', 'balans',
        'payment', 'refund', 'balance', 'оплат', 'платеж', 'возвра',
        'средств', 'Business ID',
      ];
      for (final code in ['uz', 'ru', 'en']) {
        final l = await L.delegate.load(Locale(code));
        final v = l.deleteAccountWhatIos;
        expect(v, contains('30'), reason: code);
        expect(v, contains('90'), reason: code);
        for (final w in banned) {
          expect(v.toLowerCase().contains(w.toLowerCase()), isFalse,
              reason: '$code: "$w"');
        }
      }
    });
  });

  // ───────────────────────────────────────── 8. Kod maydoni va bufer
  group('8. Kod maydoni: iPhone’da bufer o‘zidan o‘qilmaydi', () {
    Future<List<String>> pumpCode(WidgetTester tester) async {
      final calls = <String>[];
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          calls.add(call.method);
          return call.method == 'Clipboard.getData'
              ? <String, dynamic>{'text': '482913'}
              : null;
        },
      );
      addTearDown(() => tester.binding.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null));
      await tester.pumpWidget(wrapScreen(
        Material(child: Center(child: CodeField(onCompleted: (_) {}))),
      ));
      await tester.pumpAndSettle();
      return calls;
    }

    Future<void> leaveAndReturn(WidgetTester tester) async {
      for (final s in const [
        AppLifecycleState.inactive,
        AppLifecycleState.hidden,
        AppLifecycleState.paused,
        AppLifecycleState.hidden,
        AppLifecycleState.inactive,
        AppLifecycleState.resumed,
      ]) {
        tester.binding.handleAppLifecycleStateChanged(s);
        await tester.pump();
      }
      await tester.pumpAndSettle();
    }

    testWidgets('iPhone: ochilganda ham, qaytganda ham getData YO‘Q',
        (tester) async {
      final calls = await pumpCode(tester);
      expect(calls, isNot(contains('Clipboard.getData')));
      await leaveAndReturn(tester);
      expect(calls, isNot(contains('Clipboard.getData')),
          reason: 'iOS 16+ "joylash" so‘rovini chiqaradi');
      expect(find.byKey(const ValueKey('clipboard-hint')), findsNothing);
      // Kod tizim taklifi orqali keladi.
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.autofillHints, contains(AutofillHints.oneTimeCode));
    }, variant: _ios);

    testWidgets('Android: avvalgidek — taklif chiqadi, ishora yo‘q',
        (tester) async {
      final calls = await pumpCode(tester);
      expect(calls, contains('Clipboard.getData'));
      expect(find.byKey(const ValueKey('clipboard-hint')), findsOneWidget);
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.autofillHints, isNull,
          reason: 'Android autofill nosozligi (resume_focus_test)');
    });
  });

  // ──────────────────────────────────────────────── 9. Kirish formasi
  group('9. Kirish: server qabul qiladigan hamma narsa', () {
    test('kirish paroli — 6 belgidan; yangi parol qoidasi o‘zgarmagan', () {
      expect(Validate.loginPassword('123456'), isNull);
      expect(Validate.loginPassword('abc1234'), isNull);
      expect(Validate.loginPassword('12345'), 'errPasswordShortLogin');
      expect(Validate.loginPassword(''), 'errRequired');
      // Ro'yxatdan o'tish / tiklash — avvalgidek 8.
      expect(Validate.password('1234567'), 'errPasswordShort');
      expect(Validate.password('12345678'), isNull);
    });

    test('kirish maydoni — email YOKI telefon', () {
      expect(Validate.login('aziza@example.com'), isNull);
      expect(Validate.login('+998 90 123 45 67'), isNull);
      expect(Validate.login('901234567'), isNull);
      expect(Validate.login('(90) 123-45-67'), isNull);
      expect(Validate.login('+44 7700 900123'), isNull);
      expect(Validate.login(''), 'errRequired');
      expect(Validate.login('aziza@'), 'errBadEmail');
      expect(Validate.login('aziza'), 'errBadLogin');
      expect(Validate.login('12345'), 'errBadLogin');
    });

    for (final (login, password) in [
      ('aziza@example.com', 'qwe123'),
      ('+998 90 123 45 67', 'parol1'),
    ]) {
      testWidgets('"$login" + 6 belgili parol serverga yuboriladi',
          (tester) async {
        _tall(tester);
        final auth = _LoginAuth();
        final base = await testOverrides(signedIn: false);
        await tester.pumpWidget(_routed(
          const LoginScreen(),
          [
            ...base.where((o) => !identical(o, base[1])),
            authRepositoryProvider.overrideWithValue(auth),
          ],
          extra: [Routes.home],
        ));
        await settle(tester);
        final l = await _uz();
        expect(find.text(l.fieldLogin), findsOneWidget);

        final fields = find.byType(TextField);
        await tester.enterText(fields.at(0), login);
        await tester.enterText(fields.at(1), password);
        await tester.tap(find.widgetWithText(NovaButton, l.welcomeLogin));
        await settle(tester);

        expect(find.text(l.errPasswordShort), findsNothing);
        expect(find.text(l.errBadEmail), findsNothing);
        expect(auth.calls, [(login, password)],
            reason: 'forma so‘rovni serverga yubormadi');
      });
    }

    testWidgets('5 belgili parol — so‘rov ketmaydi, aniq sabab',
        (tester) async {
      _tall(tester);
      final auth = _LoginAuth();
      final base = await testOverrides(signedIn: false);
      await tester.pumpWidget(_routed(
        const LoginScreen(),
        [
          ...base.where((o) => !identical(o, base[1])),
          authRepositoryProvider.overrideWithValue(auth),
        ],
      ));
      await settle(tester);
      final l = await _uz();
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), 'aziza@example.com');
      await tester.enterText(fields.at(1), '12345');
      await tester.tap(find.widgetWithText(NovaButton, l.welcomeLogin));
      await settle(tester);
      expect(auth.calls, isEmpty);
      expect(find.text(l.errPasswordShortLogin), findsOneWidget);
    });
  });
}

/// Kirish so'rovlarini yozib oladi.
class _LoginAuth extends FakeAuthRepository {
  _LoginAuth() : super(signedIn: false);
  final calls = <(String, String)>[];

  @override
  Future<Result<User>> loginWithPassword({
    required String email,
    required String password,
  }) async {
    calls.add((email, password));
    return const Ok(testUser);
  }
}
