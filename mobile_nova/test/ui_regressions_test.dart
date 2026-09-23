import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// EKRAN XATOLARI UCHUN ARZON QO'RIQCHILAR.
///
/// Bu yerdagi tekshiruvlar emulyatorsiz, bir soniyada bajariladi.
/// Ularning vazifasi — HAQIQIY telefonda topilgan to'rtta xato
/// qaytib kelmasligi. To'liq oqim `integration_test/e2e_flows_test.dart`
/// da, haqiqiy hisob bilan sinaladi; bu esa o'sha sinov ishga
/// tushishidan ancha oldin ogohlantiradi.
///
/// Nima uchun matn bo'yicha: bu xatolarning hammasi BITTA QATORDA
/// edi — noto'g'ri marshrut, qattiq kodlangan bo'sh ro'yxat,
/// noto'g'ri endpoint. Ularni statik tutish mumkin va arzon.
void main() {
  String read(String path) => File(path).readAsStringSync();

  /// Izohlarni tashlaydi — tushuntirishda eski nom eslatilgan
  /// bo'lishi mumkin va u chaqiruv emas.
  String code(String src) => src
      .split('\n')
      .where((l) {
        final t = l.trimLeft();
        return !t.startsWith('//') && !t.startsWith('///');
      })
      .join('\n');

  test('Home orbi NFC skanerini OCHMAYDI', () {
    final src = code(read('lib/features/home/home_screen.dart'));
    // Orb `_IdentityHero` ga beriladigan `onTap` — u skanerga
    // bormasligi kerak. Tezkor amallardagi ATAYLAB NFC tugmasi
    // bundan mustasno, shuning uchun aynan hero bloki tekshiriladi.
    final hero = src.substring(
      src.indexOf('_IdentityHero('),
      src.indexOf('NfcIdHeroCard('),
    );
    expect(hero, isNot(contains('Routes.nfcScan')),
        reason: 'Orbni bosish NFC skanerini ochmasligi kerak: apparati '
            'yo\'q qurilmada story o\'rniga "NFC yo\'q" chiqardi');
  });

  test('Kashfiyot bizneslari QATTIQ KODLANGAN bo\'sh emas', () {
    final src = code(read('lib/features/discover/discover_screen.dart'));
    expect(src, isNot(contains('DiscoverTab.businesses => <Object>[]')),
        reason: '"Bizneslar" bo\'limi so\'rovsiz holatda ham serverdan '
            'o\'qishi kerak');
    expect(src, contains('repo.companies()'),
        reason: 'bo\'sh so\'rovda `GET /api/companies` chaqirilishi kerak');
  });

  test('Lenta ADMIN YANGILIKLARIDAN emas, haqiqiy postlardan', () {
    for (final p in [
      'lib/data/repositories/social_repository.dart',
      'lib/data/repositories/discover_repository.dart',
    ]) {
      final src = code(read(p));
      // `/api/news` faqat `likeNews` uchun qolishi mumkin.
      final feedUsesNews = RegExp(
        r"(feed|trending)[\s\S]{0,400}?'/api/news'",
      ).hasMatch(src);
      expect(feedUsesNews, isFalse,
          reason: '$p: lenta `/api/news` (admin e\'lonlari) dan o\'qiyapti. '
              'Haqiqiy postlar `/api/feed` da va faqat u yerda media bor');
    }

    // LENTANING MIJOZI BITTA BO'LSIN.
    //
    // Ilgari ikkita edi: bosh sahifa `SocialRepository.feed()`,
    // Tanlovdagi "Postlar" yorlig'i esa
    // `DiscoverRepository.trending()`. Ikkalasi ham `/api/feed`
    // ga qarardi, lekin `limit` i va filtri boshqacha edi — ya'ni
    // bitta joyda ko'ringan post boshqasida yo'qolishi mumkin edi.
    //
    // Yorliq olib tashlanganda nusxa ham ketdi. Bu tekshiruv
    // uning jim qaytib kelishini ushlaydi.
    final owners = Directory('lib/data/repositories')
        .listSync()
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'))
        .where((f) => code(f.readAsStringSync()).contains("'/api/feed'"))
        .map((f) => f.uri.pathSegments.last)
        .toList()
      ..sort();
    expect(owners, ['social_repository.dart'],
        reason: 'lentaning mijozi BITTA bo\'lishi kerak, topildi: $owners');
  });

  test('Biznes konteksti NFC yozuvidan EMAS, kompaniyadan olinadi', () {
    final src = code(read('lib/app/profile_context.dart'));
    expect(src, contains('activeBusinessProvider'),
        reason: 'biznes kontekst `/api/my/companies` dan kelishi kerak');
    // Biznes rejimida shaxsiyga QAYTMASLIK — asosiy xato shu edi.
    expect(src, isNot(contains('NfcIdKind.business')),
        reason: 'biznes profil NFC yozuvi turi bilan aniqlanmaydi — '
            'u kompaniya (companies jadvali)');
  });

  test('Profil ekrani faol KONTEKSTdan foydalanadi', () {
    final src = code(read('lib/features/profile/profile_screen.dart'));
    expect(src, contains('activeProfileProvider'),
        reason: 'o\'z profili faol kontekstdan chizilishi kerak');
    expect(src, contains('companyPostsProvider'),
        reason: 'biznes postlari `/api/companies/:id/posts` dan olinadi');
  });

  test('Biometrika FAIL emas, KNOWN MISSING deb belgilanadi', () {
    final src = read('integration_test/e2e_ui_test.dart');
    final i = src.indexOf("name: 'Biometric App Lock'");
    expect(i, greaterThan(-1));
    expect(src.substring(i, i + 400), contains('Verdict.deferred'),
        reason: 'ataylab olib qo\'yilgan narsa ishni har safar '
            'qizartirmasligi kerak — aks holda HAQIQIY yangi xato '
            'shovqinda ko\'rinmay qoladi');
  });

  test('Oqimlar to\'plami KRITIK FAIL da ishni yiqitadi', () {
    final src = read('integration_test/e2e_flows_test.dart');
    expect(src, contains('criticalFailures'),
        reason: 'UI FAIL faqat hisobotga yozilib, workflow yashil '
            'qolmasligi kerak — aynan shu sababdan ekran xatolari '
            'CI dan o\'tib ketgan edi');
    expect(src, contains('expect('),
        reason: 'to\'plam o\'zini baholashi shart');
  });
}
