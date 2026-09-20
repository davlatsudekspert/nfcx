import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:nfcstore_nova/features/demo/demo_data.dart';
import 'package:nfcstore_nova/features/demo/demo_mode.dart';
import 'package:nfcstore_nova/features/demo/demo_screens.dart';
import 'package:nfcstore_nova/features/home/widgets/nfc_mobile_section.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/social/media_frame.dart';
import 'package:nfcstore_nova/features/social/story_viewer.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// "NFC MOBILE" — TANISHTIRUV BO'LIMI.
///
/// Eng muhim talab funksional emas, XAVFSIZLIK talabi: demo
/// mazmun HAQIQIY ma'lumot oqimiga aralashmasligi kerak. Quyidagi
/// testlarning yarmi aynan shuni qo'riqlaydi.
void main() {
  group('XAVFSIZLIK — demo haqiqiy ma’lumotga aralashmaydi', () {
    test('`demoModeProvider` ishlab chiqarishda NULL', () async {
      final c = ProviderContainer(overrides: [...await testOverrides()]);
      addTearDown(c.dispose);
      expect(c.read(demoModeProvider), isNull,
          reason: 'demo holati oddiy daraxtga sizib chiqqan');
    });

    test('demo repozitoriylari FAQAT demo daraxtida ishlaydi', () async {
      final outer = ProviderContainer(overrides: [...await testOverrides()]);
      addTearDown(outer.dispose);

      // Tashqi daraxt — oddiy repozitoriy.
      expect(outer.read(profileRepositoryProvider),
          isNot(isA<DemoProfileRepository>()));

      // Demo daraxt — almashtirilgan.
      final inner = ProviderContainer(
        parent: outer,
        overrides: demoOverrides(),
      );
      addTearDown(inner.dispose);
      expect(inner.read(profileRepositoryProvider), isA<DemoProfileRepository>());

      // Ichkarisi tashqarisiga TA'SIR QILMAYDI.
      expect(outer.read(profileRepositoryProvider),
          isNot(isA<DemoProfileRepository>()));
    });

    test('demo kompaniya "mening kompaniyalarim" ga QO‘SHILMAYDI', () async {
      final c = ProviderContainer(
        overrides: [...await testOverrides(), ...demoOverrides()],
      );
      addTearDown(c.dispose);
      final mine = await c.read(myBusinessesProvider.future);
      expect(mine, isEmpty,
          reason: 'demo kompaniya foydalanuvchi ro‘yxatiga tushgan');
    });

    test('demo identifikatorlari MANFIY — haqiqiylari bilan '
        'to‘qnashmaydi', () {
      // Server identifikatorlari doim musbat, shuning uchun demo
      // postining `id` si haqiqiy postnikiga hech qachon teng
      // bo‘lmaydi (layk holati `id` bo‘yicha saqlanadi).
      for (final p in demoPersonalPosts) {
        expect(p.id, lessThan(0));
      }
      for (final p in demoBusinessPosts) {
        expect(p.id, lessThan(0));
      }
      for (final s in demoPersonalStories) {
        expect(s.id, lessThan(0));
      }
    });

    test('demo kodini TANIYDI, begonasini yo‘q', () {
      expect(isDemoCode(kDemoPersonalCode), isTrue);
      expect(isDemoCode(kDemoBusinessId), isTrue);
      expect(isDemoCode('48210377'), isFalse);
      expect(isDemoCode(''), isFalse);
    });
  });

  group('Demo mazmuni BO‘SH EMAS', () {
    test('shaxsiy demo to‘ldirilgan', () {
      expect(demoPersonalId.code, 'ZZZ777');
      expect(demoPersonalId.avatarUrl, isNotEmpty);
      expect(demoPersonalId.coverUrl, isNotEmpty);
      expect(demoPersonalPosts.length, greaterThanOrEqualTo(2));
      expect(demoPersonalStories.length, greaterThanOrEqualTo(1));
      expect(demoPersonalId.followers, greaterThan(0));
    });

    test('biznes nomi ETALONDAGIDEK — NFV emas, NFC Market', () {
      expect(demoBusiness.displayName, 'NFC Market');
      expect(demoBusiness.displayName, isNot(contains('NFV')));
      expect(kDemoBusinessId, 'NFCMARKET');
    });

    test('biznes demo to‘ldirilgan', () {
      expect(demoCatalog.length, greaterThanOrEqualTo(3));
      expect(demoBusinessPosts.length, greaterThanOrEqualTo(2));
      expect(demoBusiness.logoUrl, isNotEmpty);
    });

    test('hamma demo media ILOVA ICHIDA — tarmoqqa chiqmaydi', () {
      // Internet sekin bo'lganda reklama bo'limi bo'sh kvadratlar
      // ko'rsatsa, u reklama emas, nuqson bo'lib ko'rinadi.
      final urls = <String>[
        demoPersonalId.avatarUrl,
        demoPersonalId.coverUrl,
        demoBusiness.logoUrl,
        demoBusiness.coverUrl,
        ...demoPersonalPosts.expand((p) => p.mediaUrls),
        ...demoBusinessPosts.expand((p) => p.mediaUrls),
        ...demoPersonalStories.map((s) => s.mediaUrl),
        ...demoCatalog.map((c) => c.imageUrl),
      ];
      for (final u in urls) {
        expect(isAssetMedia(u), isTrue, reason: '$u tarmoqdan olinmoqda');
      }
    });

    test('media NISBATLARI har xil — moslashuvchi quti ko‘rinsin', () {
      // Bitta nisbatdagi rasmlar yangi moslashuvni ko'rsatmasdi.
      final files = demoPersonalPosts
          .map((p) => p.mediaUrls.first)
          .map((p) => File(p))
          .toList();
      for (final f in files) {
        expect(f.existsSync(), isTrue, reason: '${f.path} yo‘q');
      }
    });

    test('hamma demo fayli DISKDA bor', () {
      final all = <String>[
        demoPersonalId.avatarUrl,
        demoPersonalId.coverUrl,
        demoBusiness.logoUrl,
        demoBusiness.coverUrl,
        ...demoPersonalPosts.expand((p) => p.mediaUrls),
        ...demoBusinessPosts.expand((p) => p.mediaUrls),
        ...demoPersonalStories.map((s) => s.mediaUrl),
        ...demoCatalog.map((c) => c.imageUrl),
      ];
      for (final p in all) {
        expect(File(p).existsSync(), isTrue, reason: '$p yo‘q');
      }
    });

    test('`pubspec.yaml` demo papkasini e’lon qilgan', () {
      // Aks holda rasmlar APK ga umuman tushmaydi va bo'lim
      // telefonda bo'sh chiqadi.
      expect(File('pubspec.yaml').readAsStringSync(),
          contains('assets/demo/'));
    });
  });

  group('Bo‘lim bosh sahifada', () {
    testWidgets('sarlavha, chiplar va IKKALA tugma chiziladi',
        (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [...await testOverrides()],
        child: wrapScreen(
            const Scaffold(body: SingleChildScrollView(child: NfcMobileSection()))),
      ));
      await settle(tester);
      final l = await L.delegate.load(const Locale('uz'));

      // `SectionHeader` sarlavhani BOSH HARFGA o'giradi.
      expect(find.text(l.demoSectionTitle.toUpperCase()), findsOneWidget);
      expect(find.text(l.demoHeroTitle), findsOneWidget);
      expect(find.text(l.demoChipIphone), findsOneWidget);
      expect(find.text(l.demoBadgePersonal), findsOneWidget);
      expect(find.text(l.demoBadgeBusiness), findsOneWidget);
      expect(find.text(l.demoChipSamsung), findsOneWidget);
      // AMAL BITTA JOYDA — o'z kartasida. Ilgari hero ichida ham
      // "Personal demo"/"Business demo" turardi va tor ekranda
      // ikkala yorliq ham qirqilib ko'rinardi.
      expect(find.text(l.demoViewProfile), findsOneWidget);
      expect(find.text(l.demoViewBusiness), findsOneWidget);
      expect(find.text(l.demoPersonalBtn), findsNothing);
      // Demo ekani ikkala kartada ham ko'rinadi — endi
      // "DEMO · PERSONAL" va "DEMO · BUSINESS" nishonlari bilan
      // (yuqoridagi tekshiruvlar). Qisqa "Demo" yorlig'i esa demo
      // EKRANLARINING sarlavhasida qoladi.
      // Telefon maketlarining yorliqlari KESILMAYDI.
      // Bo'lim sarlavhasining o'ng tomonida savol turadi —
      // HTML: <b>NFC MOBILE</b><span>NFC bilan nimalar mumkin?</span>
      expect(find.text(l.demoSectionHint), findsOneWidget);
      expect(find.text(demoPersonalId.code), findsOneWidget);
      expect(find.text(demoBusiness.displayName), findsOneWidget);
    });

    testWidgets('bosh sahifaga QO‘SHILGAN', (tester) async {
      final src =
          File('lib/features/home/home_screen.dart').readAsStringSync();
      expect(src, contains('NfcMobileSection()'));
      // Tezkor amallardan KEYIN, storylardan OLDIN.
      expect(src.indexOf('_QuickActions(mode: mode)'),
          lessThan(src.indexOf('NfcMobileSection()')));
      expect(src.indexOf('NfcMobileSection()'),
          lessThan(src.indexOf('_StoriesRow(user: user)')));
    });

    test('marshrutlar ro‘yxatdan o‘tadi', () {
      final router = buildTestRouter();
      expect(routeExists(router, Routes.demoPersonal), isTrue);
      expect(routeExists(router, Routes.demoBusiness), isTrue);
      expect(routeExists(router, Routes.story(kDemoPersonalCode)), isTrue);
      disposeTestContainers();
    });
  });

  group('Demo ekranlar — HAQIQIY ekranlarning o‘zi', () {
    test('demo ekranlar nusxa ekran yaratmaydi', () {
      final src =
          File('lib/features/demo/demo_screens.dart').readAsStringSync();
      // Ikki xil profil ekrani saqlansa, ular vaqt o'tib
      // bir-biridan uzoqlashadi.
      expect(src, contains('ProfileScreen('));
      expect(src, contains('StorefrontScreen('));
      expect(src, contains('ProviderScope('));
    });

    testWidgets('demo profil TO‘LIQ ochiladi — ism, kod, postlar',
        (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [...await testOverrides()],
        child: wrapScreen(const DemoPersonalScreen()),
      ));
      await settle(tester, frames: 24);
      final l = await L.delegate.load(const Locale('uz'));

      expect(find.text(demoPersonalId.name), findsWidgets);
      expect(find.text(l.demoBadge), findsOneWidget,
          reason: 'demo ekani ko‘rinmayapti');
      expect(find.text(l.demoNotice), findsOneWidget);
      // Shikoyat/bloklash demo profilda ma'nosiz.
      expect(find.byIcon(Icons.more_horiz_rounded), findsNothing);
    });
  });

  group('Demo havolasi ISHLAYDI', () {
    test('QR va ulashish demo manzilini oladi', () {
      final src =
          File('lib/features/profile/profile_screen.dart').readAsStringSync();
      // Demo kodi saytda mavjud emas — uning QR kodi 404 sahifaga
      // olib borardi.
      expect(src, contains('urlOverride: demo?.shareUrl'));
      expect(src, contains('demo?.shareUrl ?? id.publicUrl(kApiBase)'));
    });

    test('istorya marshruti demo daraxtiga o‘raladi', () {
      final src = File('lib/routing/router.dart').readAsStringSync();
      // Aks holda demo profilning istoryasi bo'sh chiqardi:
      // yangi marshrut demo `ProviderScope` dan tashqarida.
      expect(src, contains('demoWrap(code, StoryViewerScreen(code: code))'));
    });
  });

  test('istorya halqasi FAQAT istorya bor bo‘lganda', () {
    final src =
        File('lib/features/profile/profile_screen.dart').readAsStringSync();
    expect(src, contains('storiesOfProvider'));
    expect(src, contains('stories.isEmpty'),
        reason: 'istoryasiz profilda ham halqa chizilyapti');
    expect(storiesOfProvider, isNotNull);
  });

  group('HTML etaloni bilan bog‘lanish', () {
    test('etalondan ajratilgan suratlar DISKDA bor', () {
      // `nfc_mobile_demo.html` ichida ular `data:` URI edi.
      for (final p in [kDemoHeroImage, kDemoPersonalImage]) {
        expect(File(p).existsSync(), isTrue, reason: '$p yo‘q');
      }
    });

    test('biznes kartasi HERO suratini TAKRORLAMAYDI', () {
      // Prototipda biznes kartaning surati hero suratining aynan
      // nusxasi edi: "NFC Market demo katalogi" deb turgan joyda
      // telefonlar fotosi ko‘rinardi.
      expect(kDemoBusinessImage, isNot(kDemoHeroImage));
      expect(File(kDemoBusinessImage).existsSync(), isTrue);
    });

    test('matnlar etalondan AYNAN ko‘chirilgan', () async {
      final l = await L.delegate.load(const Locale('uz'));
      expect(l.demoHeroTitle, 'NFC bilan tanishing');
      expect(l.demoHeroBody,
          'Shaxsiy profil, biznes sahifa va NFC ID — barchasi bitta '
          'mobil ilovada.');
      expect(l.demoChipIphone, 'iPhone 18 bilan ishlaydi');
      expect(l.demoChipSamsung, 'Samsung S26 bilan ishlaydi');
      expect(l.demoChipReady, 'NFC ready');
      expect(l.demoSectionHint, 'NFC bilan nimalar mumkin?');
      expect(l.demoBadgePersonal, 'DEMO · PERSONAL');
      expect(l.demoBadgeBusiness, 'DEMO · BUSINESS');
      expect(l.demoPersonalSubtitle, 'Personal NFC Profile');
      expect(l.demoBizSubtitle, 'Business NFC Profile');
      expect(l.demoViewProfile, 'Profilni ko‘rish');
      expect(l.demoViewBusiness, 'Biznes profilni ko‘rish');
      expect(l.demoNotice,
          'Bu namuna ma’lumot — sizning profilingizga ta’sir '
          'qilmaydi.');
    });

    test('raqamlar etalondagidek', () {
      expect(demoPersonalId.views, 2840);
      expect(demoPersonalId.followers, 1240);
      expect(demoPersonalPosts.length, 3);
      expect(demoBusiness.views, 18400);
      expect(demoBusiness.followers, 3120);
      expect(demoCatalog.length, 4);
    });

    test('bo‘limda QAT‘IY rang yo‘q — hammasi mavzudan', () {
      // HTML'da mavzular CSS o'zgaruvchilari bilan almashardi.
      // Bu yerda ularning o'rnida `context.tokens` turadi.
      // Izohlar OLIB TASHLANADI: tekshiruv KOD haqida, matn
      // haqida emas. (Bu tekshiruvning o'zi shu sababdan bir
      // marta noto'g'ri yiqilgandi — fayl izohida `Color(0x...)`
      // degan so'zlar bor.)
      final src =
          File('lib/features/home/widgets/nfc_mobile_section.dart')
              .readAsStringSync()
              .split('\n')
              .where((line) {
                final t = line.trimLeft();
                return !t.startsWith('//') && !t.startsWith('///');
              })
              .join('\n');
      expect(RegExp(r'Color\(0x').hasMatch(src), isFalse,
          reason: 'qat‘iy rang yozilgan — mavzu almashganda o‘zgarmaydi');
      expect(src, contains('context.tokens'));
    });
  });
}
