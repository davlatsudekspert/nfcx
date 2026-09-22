import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/social/story_viewer.dart';

/// KOMPANIYA ISTORYASI ILOVADA KO'RINSIN.
///
/// ## NUQSON QANDAY TOPILDI
///
/// Egasi biznes profiliga istorya qo'ydi: saytda ko'rindi,
/// ilovada esa halqa umuman chizilmadi.
///
/// Sabab: shaxsiy va kompaniya istoryalari serverda boshqa
/// manzilda yashaydi —
///
///     shaxsiy    -> /api/records/:code/stories
///     kompaniya  -> /api/companies/:id/stories
///
/// `storiesOfProvider` esa HAR DOIM shaxsiy yo'lni chaqirardi.
/// Server kompaniya identifikatorini shaxsiy kartalar orasidan
/// qidirib, BO'SH ro'yxat qaytarardi.
///
/// Xato bilinmasdi, chunki bo'sh ro'yxat xato emas: halqa
/// shunchaki chizilmasdi va hech qanday ogohlantirish
/// chiqmasdi. Shuning uchun bu sinov bor.
void main() {
  group('StoryOwner', () {
    test('kod bir xil, egasi boshqa — BOShQA kalit', () {
      // Eng muhim xossa. Agar ikkalasi bitta kalitga tushsa,
      // biri ikkinchisining keshini o'qib, yana bo'sh ro'yxat
      // qaytarardi.
      const personal = StoryOwner('VIP001');
      const company = StoryOwner('VIP001', isBusiness: true);
      expect(personal == company, isFalse);
      expect(personal.hashCode == company.hashCode, isFalse);
    });

    test('bir xil egalar teng', () {
      expect(const StoryOwner('ABC') == const StoryOwner('ABC'), isTrue);
      expect(
        const StoryOwner('ABC', isBusiness: true) ==
            const StoryOwner('ABC', isBusiness: true),
        isTrue,
      );
    });

    test('standart holat — shaxsiy', () {
      expect(const StoryOwner('ABC').isBusiness, isFalse);
    });
  });

  test('provayder kompaniya repozitoriysini HAQIQATAN chaqiradi', () {
    // Kalit bor, lekin u hech narsaga ta'sir qilmasa — bezak.
    final src =
        File('lib/features/social/story_viewer.dart').readAsStringSync();
    expect(src, contains('businessRepositoryProvider'),
        reason: 'kompaniya manbai ulanmagan');
    expect(src, contains('owner.isBusiness'),
        reason: 'egasi tekshirilmayapti');
  });

  test('profil halqasi biznesligini UZATADI', () {
    final src =
        File('lib/features/profile/profile_screen.dart').readAsStringSync();
    expect(src, contains('isBusiness: business'),
        reason: 'halqa har doim shaxsiy yo\'lni chaqiradi');
  });

  test('marshrut biznesligini saqlaydi', () {
    // Halqa bosilganda ochiladigan ekran ham bilishi kerak,
    // aks holda ro'yxat yana bo'sh chiqadi.
    final routes = File('lib/routing/routes.dart').readAsStringSync();
    expect(routes, contains('business=1'));

    final router = File('lib/routing/router.dart').readAsStringSync();
    expect(router, contains("queryParameters['business']"));
    expect(router, contains('isBusiness:'));
  });
}
