import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/external_link.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/buttons.dart';
import 'package:nfcstore_nova/design/widgets/contact_buttons.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/business/business_forms.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:nfcstore_nova/features/profile/profile_edit_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// ALOQA VA HAVOLALAR — sayt bilan teng tahrir va logoli dumaloq
/// tugmalar (egasi, 2026-09).
class _SpyProfile extends ProfileRepository {
  _SpyProfile() : super(ApiClient());
  Map<String, dynamic>? links;
  String? bio;

  @override
  Future<Result<void>> updateProfile({
    required String code,
    String? name,
    String? bio,
    String? role,
    String? avatarUrl,
    String? coverUrl,
    List<String>? musicUrls,
    bool? hiddenFromDirectory,
    Map<String, dynamic>? links,
  }) async {
    this.links = links;
    this.bio = bio;
    return const Ok(null);
  }
}

class _SpyBiz extends BusinessRepository {
  _SpyBiz() : super(ApiClient());
  Map<String, dynamic>? sent;

  @override
  Future<Result<void>> update(String companyId, Map<String, dynamic> body) async {
    sent = body;
    return const Ok(null);
  }
}

Widget _app(Widget screen, List<Override> overrides) => ProviderScope(
      overrides: overrides,
      child: MaterialApp.router(
        theme: buildTheme(NfcTokens.fallback),
        routerConfig: GoRouter(initialLocation: '/edit', routes: [
          GoRoute(
            path: '/',
            builder: (_, __) => const SizedBox.shrink(),
            routes: [GoRoute(path: 'edit', builder: (_, __) => screen)],
          ),
        ]),
        locale: const Locale('uz'),
        supportedLocales: L.supportedLocales,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      ),
    );

void main() {
  group('havolalar sayt bilan bir xil yasaladi (socialLinks.js)', () {
    test('Instagram: username, @, to‘liq manzil va kuzatuv parametrlari', () {
      for (final v in [
        'neomsongs',
        '@neomsongs',
        'instagram.com/neomsongs',
        'https://www.instagram.com/neomsongs/',
        'https://www.instagram.com/neomsongs?stkn=1&utm_source=qr',
      ]) {
        expect(socialUrl('ig', v), 'https://instagram.com/neomsongs', reason: v);
      }
    });
    test('Telegram taklif havolasi buzilmaydi', () {
      expect(socialUrl('tg', 'https://t.me/+AbCdE'), 'https://t.me/+AbCdE');
      expect(socialUrl('tg', '@nfcstore'), 'https://t.me/nfcstore');
    });
    test('Facebook/LinkedIn to‘liq manziliga tegilmaydi', () {
      const fb = 'https://facebook.com/profile.php?id=123';
      expect(socialUrl('fb', fb), fb);
      expect(socialUrl('li', 'linkedin.com/in/ali'), 'https://linkedin.com/in/ali');
    });
  });

  group('ContactInfo — server kalitlari', () {
    test('profil: o‘qish va qaytarish (`tg`, toza username)', () {
      final c = ContactInfo.fromRecord({
        'tg': 'eski',
        'phone': '+998901234567',
        'instagram': 'ig',
        'extraLinks': [
          {'label': 'Portfolio', 'url': 'https://a.uz'},
        ],
      }).copyWith(instagram: 'https://www.instagram.com/yangi?utm_source=qr');
      final j = c.toRecordJson();
      expect(j['tg'], 'eski');
      expect(j['instagram'], 'yangi');
      expect(j['phone'], '+998901234567');
      expect(j['extraLinks'], [
        {'label': 'Portfolio', 'url': 'https://a.uz'}
      ]);
      expect(j.containsKey('telegram'), isFalse);
    });
    test('biznes: `telegram`, WhatsApp, 8 ta havola, nomsiz havolaga domen', () {
      final c = ContactInfo.fromCompany({
        'telegram': 'shop',
        'whatsapp': '+998 90 111 22 33',
        'extraLinks': [
          for (var i = 0; i < 10; i++) {'label': '', 'url': 'https://www.site$i.uz/x'},
        ],
      });
      final j = c.toCompanyJson();
      expect(j['telegram'], 'shop');
      expect(j.containsKey('tg'), isFalse);
      expect((j['extraLinks'] as List).length, 8);
      expect((j['extraLinks'] as List).first, {'label': 'site0.uz', 'url': 'https://www.site0.uz/x'});
    });
    test('tugmalar tartibi saytdagidek; yashirilgan telefon chiqmaydi', () {
      const c = ContactInfo(
        phone: '+998901234567',
        telegram: 'nfc',
        instagram: 'nfc',
        website: 'nfcstore.uz',
        address: 'Toshkent',
        extraLinks: [ExtraLink(label: 'Menyu', url: 'menu.uz')],
      );
      expect(c.actions().map((a) => a.kind), [
        ContactKind.phone,
        ContactKind.telegram,
        ContactKind.instagram,
        ContactKind.map,
        ContactKind.website,
        ContactKind.link,
      ]);
      expect(c.actions().first.url, 'tel:+998901234567');
      expect(c.actions().last.url, 'https://menu.uz');
      expect(c.copyWith(hidePhone: true).actions().first.kind, ContactKind.telegram);
      expect(const ContactInfo().actions(), isEmpty);
    });
  });

  testWidgets('dumaloq tugma bosilganda toza havola ochiladi', (tester) async {
    final opened = <Uri>[];
    openLinkOverride = (u) async {
      opened.add(u);
      return true;
    };
    addTearDown(() => openLinkOverride = null);
    await tester.pumpWidget(wrapScreen(Scaffold(
      body: ContactButtons(
        actions: const ContactInfo(
          telegram: '@nfcstore',
          instagram: 'https://www.instagram.com/neomsongs?utm_source=qr',
        ).actions(),
      ),
    )));
    await tester.pump();
    expect(find.text('Telegram'), findsOneWidget);
    expect(find.text('Instagram'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('contact-instagram')));
    await tester.pump(const Duration(milliseconds: 300));
    expect(opened.single.toString(), 'https://instagram.com/neomsongs');
  });

  testWidgets('profil tahriri: aloqa maydonlari saqlanadi va serverga ketadi',
      (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 2400 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final spy = _SpyProfile();
    await tester.pumpWidget(_app(const ProfileEditScreen(), [
      ...await testOverrides(),
      authRepositoryProvider.overrideWithValue(FakeAuthRepository(ids: [
        NfcId(
          code: '48210377',
          name: 'Test',
          primary: true,
          bio: 'eski bio',
          contact: const ContactInfo(telegram: 'eski', phone: '+998901234567'),
        ),
      ])),
      profileRepositoryProvider.overrideWithValue(spy),
    ]));
    await settle(tester, frames: 20);
    final l = await L.delegate.load(const Locale('uz'));

    expect(find.text(l.editContactSection.toUpperCase()), findsOneWidget);
    // Serverdagi qiymatlar maydonlarda ko'rinadi.
    expect(find.text('eski'), findsOneWidget);

    Finder field(String key) => find.descendant(
        of: find.byKey(ValueKey(key)), matching: find.byType(TextField));
    await tester.enterText(field('edit-telegram'), 'https://t.me/yangi');
    await tester.enterText(field('edit-instagram'), '@nfc.uz');
    await tester.tap(find.byKey(const ValueKey('extra-link-add')));
    await tester.pump();
    final extra = find.descendant(
        of: find.byKey(const ValueKey('contact-editor')),
        matching: find.byType(TextField));
    // Oxirgi ikki maydon — yangi havolaning nomi va manzili.
    final n = extra.evaluate().length;
    await tester.enterText(extra.at(n - 2), 'Portfolio');
    await tester.enterText(extra.at(n - 1), 'behance.net/ali');
    await tester.pump();

    await tester.tap(find.widgetWithText(NovaButton, l.actionSave));
    await settle(tester, frames: 6);

    final links = spy.links!;
    expect(links['tg'], 'yangi');
    expect(links['instagram'], 'nfc.uz');
    expect(links['phone'], '+998901234567', reason: 'tegilmagan maydon saqlanadi');
    expect(links['extraLinks'], [
      {'label': 'Portfolio', 'url': 'behance.net/ali'}
    ]);
    expect(spy.bio, 'eski bio');
  });

  testWidgets('biznes tahriri: logo/muqova joyi va WhatsApp/Instagram ketadi',
      (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 2400 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final spy = _SpyBiz();
    await tester.pumpWidget(_app(const BusinessEditScreen(), [
      ...await testOverrides(),
      businessRepositoryProvider.overrideWithValue(spy),
      activeBusinessProvider.overrideWithValue(const Business(
        companyId: 'KARTAUZ',
        displayName: 'Karta Uz',
        logoUrl: 'https://nfcstore.uz/uploads/logo.png',
        contact: ContactInfo(phone: '+998711234567', telegram: 'kartauz'),
      )),
    ]));
    await settle(tester, frames: 20);
    final l = await L.delegate.load(const Locale('uz'));

    expect(find.byKey(const ValueKey('biz-logo')), findsOneWidget);
    expect(find.byKey(const ValueKey('biz-cover')), findsOneWidget);
    expect(find.byKey(const ValueKey('edit-whatsapp')), findsOneWidget);
    expect(find.byKey(const ValueKey('edit-email')), findsNothing,
        reason: 'biznesda email maydoni serverda yo‘q');

    Finder field(String key) => find.descendant(
        of: find.byKey(ValueKey(key)), matching: find.byType(TextField));
    await tester.enterText(field('edit-whatsapp'), '+998901112233');
    await tester.enterText(field('edit-instagram'), 'kartauz');
    await tester.pump();
    await tester.tap(find.widgetWithText(NovaButton, l.actionSave));
    await settle(tester, frames: 6);

    final b = spy.sent!;
    expect(b['whatsapp'], '+998901112233');
    expect(b['instagram'], 'kartauz');
    expect(b['telegram'], 'kartauz');
    expect(b['phone'], '+998711234567');
    expect(b['logoUrl'], '/uploads/logo.png', reason: 'serverga nisbiy yo‘l');
    expect(b['displayName'], 'Karta Uz');
  });

  testWidgets('javob bermaydigan havola: qotmaydi, “nusxalandi” chiqadi',
      (tester) async {
    // Telefon hech narsa qaytarmaydi (osilgan platforma kanali).
    openLinkOverride = (u) => Completer<bool>().future;
    final old = openLinkTimeout;
    openLinkTimeout = const Duration(milliseconds: 200);
    addTearDown(() {
      openLinkOverride = null;
      openLinkTimeout = old;
    });
    await tester.pumpWidget(wrapScreen(Scaffold(
      body: ContactButtons(
          actions: const ContactInfo(website: 'nfcstore.uz').actions()),
    )));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('contact-website')));
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(seconds: 3));
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.text(l.shareCopied), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('har bir tugma haqiqiy ochiladigan manzil beradi', () {
    const c = ContactInfo(
      phone: '+998 (90) 123-45-67',
      telegram: 't.me/nfc',
      whatsapp: '+998 90 123 45 67',
      instagram: 'nfc',
      facebook: 'nfc',
      twitter: '@nfc',
      linkedin: 'https://linkedin.com/in/nfc',
      email: 'a@b.uz',
      website: 'nfcstore.uz',
      address: 'Toshkent, Amir Temur 1',
      extraLinks: [ExtraLink(label: 'x', url: 'http://a.uz')],
    );
    for (final a in c.actions()) {
      final u = Uri.parse(a.url);
      expect(['tel', 'mailto', 'https', 'http'], contains(u.scheme), reason: a.url);
      if (u.scheme.startsWith('http')) expect(u.host, isNotEmpty, reason: a.url);
    }
    expect(c.actions().first.url, 'tel:+998901234567');
    expect(c.actions()[2].url, 'https://wa.me/998901234567');
  });
}
