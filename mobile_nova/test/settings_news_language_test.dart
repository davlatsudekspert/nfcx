import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/profile_context.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/states.dart';
import 'package:nfcstore_nova/design/widgets/surfaces.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/entry/welcome_screen.dart';
import 'package:nfcstore_nova/features/settings/language_picker.dart';
import 'package:nfcstore_nova/features/settings/news_screen.dart';
import 'package:nfcstore_nova/features/settings/settings_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// SOZLAMALAR, YANGILIKLAR VA TIL (egasi, 2026-10, iPhone suratlari).
const _user = User(id: 7, email: 'ali77099@gmail.com');
const _id = NfcId(code: 'VIP001', name: 'Muhammad', avatarUrl: '');

double _lum(Color c) {
  double ch(double v) =>
      v <= .03928 ? v / 12.92 : math.pow((v + .055) / 1.055, 2.4).toDouble();
  return .2126 * ch(c.r) + .7152 * ch(c.g) + .0722 * ch(c.b);
}

double contrast(Color a, Color b) {
  final x = _lum(a), y = _lum(b);
  return (math.max(x, y) + .05) / (math.min(x, y) + .05);
}

Future<void> _settings(WidgetTester tester, NfcTokens tokens,
    {NfcId? personal = _id}) async {
  tester.view.physicalSize = const Size(393 * 3, 1700 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final base = await testOverrides();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...base,
      currentUserProvider.overrideWithValue(_user),
      activePersonalProvider.overrideWithValue(personal),
    ],
    child: wrapScreen(const SettingsScreen(), tokens: tokens),
  ));
  await settle(tester, frames: 8);
}

Widget _news(Override o, {NfcTokens? tokens}) =>
    FutureBuilder(
      future: testOverrides(),
      builder: (_, s) => !s.hasData
          ? const SizedBox()
          : ProviderScope(
              overrides: [...s.data!, o],
              child: wrapScreen(const NewsScreen(), tokens: tokens),
            ),
    );

void main() {
  group('Sozlamalar — akkaunt kartasi', () {
    testWidgets('xom login (ali77099) yo‘q, real ism va email bor',
        (tester) async {
      await _settings(tester, NfcTokens.ivory);
      final card = find.byKey(const ValueKey('settings-account'));
      expect(card, findsOneWidget);
      expect(find.descendant(of: card, matching: find.text('Muhammad')),
          findsOneWidget);
      expect(find.descendant(of: card, matching: find.text('ali77099@gmail.com')),
          findsOneWidget);
      expect(find.text('ali77099'), findsNothing,
          reason: 'email’dan olingan xom login ko‘rinmasligi kerak');
    });

    testWidgets('ism yo‘q bo‘lsa — faqat email, login emas', (tester) async {
      await _settings(tester, NfcTokens.ivory, personal: null);
      expect(find.text('ali77099'), findsNothing);
      expect(find.text('ali77099@gmail.com'), findsOneWidget);
    });

    testWidgets('profilni tahrirlash — bitta kirish (karta bosilmaydi)',
        (tester) async {
      await _settings(tester, NfcTokens.ivory);
      final card = tester.widget<FloatingSurface>(
          find.byKey(const ValueKey('settings-account')));
      expect(card.onTap, isNull, reason: 'karta tahrirlashni takrorlaydi');
      expect(find.text(L.of(tester.element(find.byType(SettingsScreen))).profileEdit),
          findsOneWidget);
      final src = File('lib/features/settings/settings_screen.dart')
          .readAsStringSync();
      expect(RegExp(r'Routes\.profileEdit').allMatches(src).length, 1,
          reason: 'profileEdit ga faqat bitta qator olib borishi kerak');
    });

    for (final theme in [('Ivory', NfcTokens.ivory), ('Noir', NfcTokens.noir)]) {
      testWidgets('${theme.$1}: bo‘lim, qiymat, chevron — o‘qiladi (≥4.5:1)',
          (tester) async {
        await _settings(tester, theme.$2);
        final t = theme.$2;
        final header = tester.widget<SectionHeader>(find.byType(SectionHeader).first);
        expect(header.color, t.text2);
        for (final bg in [t.surfaceSolid, t.bg1]) {
          expect(contrast(t.text2, bg), greaterThanOrEqualTo(4.5));
        }
        final chevrons = tester
            .widgetList<Icon>(find.byIcon(Icons.chevron_right_rounded))
            .map((i) => i.color)
            .toSet();
        expect(chevrons, {t.text2});
        final value = tester.widget<Text>(find.text(
            L.of(tester.element(find.byType(SettingsScreen))).langUz));
        expect(value.style?.color, t.text2);
      });
    }
  });

  group('Yangiliklar — hech qachon qora ekran emas', () {
    test('Ilova haqida -> Yangiliklar o‘z sahifasiga (Tanlov tabiga emas)', () {
      final src = File('lib/features/settings/settings_subscreens.dart')
          .readAsStringSync();
      final about = src.substring(src.indexOf('class AboutScreen'));
      expect(about, contains('Routes.settingsNews'));
      expect(about, isNot(contains('Routes.discover')),
          reason: 'shell branch’ni push qilish qora sahifa beradi');
      expect(Routes.settingsNews, '/settings/news');
    });

    for (final theme in [NfcTokens.ivory, NfcTokens.noir]) {
      testWidgets('yangiliklar ro‘yxati (${theme.id})', (tester) async {
        await tester.pumpWidget(_news(newsProvider.overrideWith((_) async => [
              {
                'id': 1,
                'title': 'Sarlavha',
                'titleEn': 'Headline',
                'body': 'Matn',
                'imageUrl': '',
                'createdAt': '2026-09-26 07:51:22.176+00',
                'published': true,
              }
            ]), tokens: theme));
        await settle(tester, frames: 8);
        expect(find.byKey(const ValueKey('news-list')), findsOneWidget);
        expect(find.text('Sarlavha'), findsOneWidget);
        expect(find.text('26.09.2026'), findsOneWidget);
      });
    }

    testWidgets('bo‘sh — "Hozircha yangiliklar yo‘q"', (tester) async {
      await tester
          .pumpWidget(_news(newsProvider.overrideWith((_) async => [])));
      await settle(tester, frames: 8);
      expect(find.byKey(const ValueKey('news-empty')), findsOneWidget);
      expect(find.text('Hozircha yangiliklar yo‘q'), findsOneWidget);
    });

    testWidgets('xato — qayta urinish tugmasi', (tester) async {
      await tester.pumpWidget(_news(newsProvider.overrideWith(
          (_) async => throw const AppError(AppErrorKind.offline))));
      await settle(tester, frames: 8);
      expect(find.byType(StatePanel), findsOneWidget);
      expect(find.text('Qayta urinish'), findsOneWidget);
    });

    test('tarjima: til bo‘yicha sarlavha, bo‘sh bo‘lsa o‘zbekcha', () {
      final j = {'id': 1, 'title': 'Uz', 'titleRu': '', 'titleEn': 'En'};
      expect(NewsItem.fromJson(j, 'en').title, 'En');
      expect(NewsItem.fromJson(j, 'ru').title, 'Uz');
      expect(NewsItem.fromJson(j, 'uz').title, 'Uz');
    });
  });

  group('Til — birinchi ochilish', () {
    Future<ProviderContainer> app(WidgetTester tester) async {
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final c = ProviderContainer(
          overrides: [...await testOverrides(signedIn: false)]);
      addTearDown(c.dispose);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: Consumer(
          builder: (_, ref, __) => wrapScreen(const WelcomeScreen(),
              locale: ref.watch(localeProvider)),
        ),
      ));
      await settle(tester, frames: 10);
      return c;
    }

    testWidgets('yangi o‘rnatish -> tanlagich; English darhol va saqlanadi',
        (tester) async {
      final c = await app(tester);
      expect(find.byKey(const ValueKey('language-sheet')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('lang-en')));
      await settle(tester, frames: 6);
      expect(find.text('Choose your language'), findsOneWidget,
          reason: 'UI darhol English bo‘lishi kerak');
      await tester.tap(find.byKey(const ValueKey('lang-continue')));
      await settle(tester, frames: 10);
      expect(find.byKey(const ValueKey('language-sheet')), findsNothing);
      expect(c.read(prefsProvider).localeCode, 'en');
      expect(c.read(localeProvider).languageCode, 'en');

      // Qayta ochilish: tanlov saqlangan — tanlagich chiqmaydi.
      final again = LocaleController(c.read(prefsProvider));
      expect(again.chosen, isTrue);
      expect(again.state.languageCode, 'en');
    });

    testWidgets('sukutdagi o‘zbekcha tanlansa ham eslab qolinadi',
        (tester) async {
      final c = await app(tester);
      await tester.tap(find.byKey(const ValueKey('lang-uz')));
      await settle(tester, frames: 4);
      await tester.tap(find.byKey(const ValueKey('lang-continue')));
      await settle(tester, frames: 8);
      expect(c.read(prefsProvider).localeCode, 'uz');
    });

    testWidgets('ixcham tugma (UZ) -> 3 til; Русский tanlanadi',
        (tester) async {
      final c = await app(tester);
      await tester.tap(find.byKey(const ValueKey('lang-continue')));
      await settle(tester, frames: 8);
      await tester.tap(find.byKey(const ValueKey('lang-pill')));
      await settle(tester, frames: 8);
      for (final code in ['uz', 'ru', 'en']) {
        expect(find.byKey(ValueKey('lang-$code')), findsOneWidget);
      }
      await tester.tap(find.byKey(const ValueKey('lang-ru')));
      await settle(tester, frames: 8);
      expect(c.read(localeProvider).languageCode, 'ru');
      expect(find.text('RU'), findsOneWidget);
    });

    test('telefon tiliga tavsiya', () {
      expect(suggestedLanguage(const Locale('uz')), 'uz');
      expect(suggestedLanguage(const Locale('kk')), 'ru');
      expect(suggestedLanguage(const Locale('de')), 'en');
    });

    test('chiqish (logout) tanlangan tilni o‘chirmaydi', () {
      final src = File('lib/features/auth/session.dart').readAsStringSync();
      expect(src, isNot(contains('setLocaleCode')));
      expect(src, isNot(contains('nova.locale')));
    });

    test('kirish ekranlarida til almashtirgich bor', () {
      for (final f in [
        'lib/features/entry/welcome_screen.dart',
        'lib/features/auth/login_screen.dart',
        'lib/features/auth/register_screen.dart',
        'lib/features/auth/forgot_password_screen.dart',
      ]) {
        expect(File(f).readAsStringSync(), contains('LanguagePill()'),
            reason: f);
      }
    });
  });
}
