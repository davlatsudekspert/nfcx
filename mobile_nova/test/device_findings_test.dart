import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/widgets/id_plate.dart';
import 'package:nfcstore_nova/routing/routes.dart';

/// QURILMADA TOPILGAN NUQSONLAR QAYTIB KELMASIN.
///
/// Bu fayldagi hamma narsani egasi TELEFONDA ko'rgan, birortasini
/// ham mavjud testlar tutmagan. Sabab bir xil: hammasi "xato
/// emas" ko'rinishida edi — 404 ekranda chiroyli chiqardi, ✓
/// belgisi chizilardi, bo'sh forma ochilardi.
void main() {
  group('lentadan ochilgan muallif', () {
    /// Kompaniya posti SHAXSIY profil sifatida ochilardi.
    ///
    /// `post.code` kompaniyada `companyId` bo'ladi, `/u/:code` esa
    /// shaxsiy kartani so'raydi:
    ///
    ///     GET /api/records/NFCSTOREUZ/posts  ->  404 not_found
    ///
    /// Ekranda "Topilmadi" chiqardi, "Kuzatish" esa bosilib
    /// o'z holiga qaytardi.
    test('kompaniya vitrinaga, odam shaxsiy profilga', () {
      expect(Routes.author('ABC123'), '/u/ABC123');
      expect(Routes.author('NFCSTOREUZ', company: true), '/c/NFCSTOREUZ');
    });

    test('lenta, Reels va post tafsiloti `author()` ni ishlatadi', () {
      for (final f in [
        'lib/features/social/feed_card.dart',
        'lib/features/social/reels_screen.dart',
        'lib/features/social/post_screens.dart',
      ]) {
        final src = File(f).readAsStringSync();
        expect(src, contains('Routes.author('), reason: f);
        expect(src.contains('Routes.user(p.code)'), isFalse, reason: f);
        expect(src.contains('Routes.user(post.code)'), isFalse, reason: f);
      }
    });
  });

  group('tasdiqlash belgisi', () {
    /// ✓ HAMMADA turardi, chunki shart `primary` edi.
    test('model serverdan `verified` o\'qiydi', () {
      expect(NfcId.fromJson(const {'code': 'A', 'verified': true}).verified,
          isTrue);
      expect(NfcId.fromJson(const {'code': 'A'}).verified, isFalse,
          reason: 'server yubormasa belgi CHIQMASLIGI kerak');
    });

    test('nishon `primary` ga emas, `verified` ga bog\'liq', () {
      final src =
          File('lib/features/profile/profile_screen.dart').readAsStringSync();
      expect(src, contains('profile!.verified'));
      expect(src.contains('profile!.id!.primary)'), isFalse,
          reason: '✓ yana har bir asosiy ID da chiziladi');
    });
  });

  group('kod kiritish', () {
    final src = File('lib/design/widgets/fields.dart').readAsStringSync();

    test('tizim autofill ishorasi qo\'yilgan', () {
      expect(src, contains('AutofillHints.oneTimeCode'));
    });

    test('buferdagi kod taklif qilinadi, lekin O\'ZI qo\'yilmaydi', () {
      expect(src, contains('_ClipboardHint'));
      // Avtomatik yozib qo'yish odamni hayratlantiradi va buferda
      // boshqa son bo'lsa noto'g'ri kod tushadi.
      expect(src, contains('_fromClipboard'));
      expect(src, contains('onTap: onTap'));
    });
  });

  _idPlateTests();

  group('biznesi yo\'q odam', () {
    final src =
        File('lib/features/business/business_screens.dart').readAsStringSync();

    test('bo\'sh forma emas — taklif ekrani', () {
      expect(src, contains('_BusinessPitch'));
    });

    test('NAMUNA ko\'rsatiladi', () {
      // Eng ishonarli dalil — haqiqiy sahifani ochib ko'rish.
      expect(src, contains('Routes.demoBusiness'));
    });

    test('yaratish tugmasi ham qoladi', () {
      expect(src, contains('Routes.businessOnboard'));
    });
  });
}

/// NFC ID — SOTILADIGAN MAHSULOT, TEXNIK YORLIQ EMAS.
///
/// Egasi: "ID larga urg'u bersang, Tanlovda ham. Odam ko'ziga
/// zo'r ko'rinsa sotib olish harakatiga tushadi."
///
/// Kod uchta ekranda uchta xil, hammasi kichkina kulrang yorliq
/// bo'lib chizilardi. Server esa har kod uchun `tier` ni
/// ALLAQACHON yuborardi — ilova uni o'qimasdi, ya'ni qimmat kod
/// bilan bepul kod ekranda bir xil ko'rinardi.
void _idPlateTests() {
  group('NFC ID plastinkasi', () {
    test('model serverdan `tier` o\'qiydi', () {
      expect(NfcId.fromJson(const {'code': 'A', 'tier': 'gold'}).tier, 'gold');
      expect(NfcId.fromJson(const {'code': 'A'}).tier, '');
    });

    test('faqat QIMMAT darajalar oltin bo\'ladi', () {
      // Hammasi oltin bo'lsa, oltin ma'nosini yo'qotadi.
      for (final t in ['gold', 'premium', 'exclusive']) {
        expect(IdPlate.isPrecious(t), isTrue, reason: t);
      }
      for (final t in ['free', 'silver', '', 'nomalum']) {
        expect(IdPlate.isPrecious(t), isFalse, reason: t);
      }
    });

    test('Tanlov, tasma va profil BIR XIL plastinkani ishlatadi', () {
      // Uch joyda uch xil bo'lsa, ular yana bir-biridan
      // uzoqlashadi.
      for (final f in [
        'lib/features/discover/discover_screen.dart',
        'lib/features/home/widgets/my_ids_strip.dart',
      ]) {
        expect(File(f).readAsStringSync(), contains('IdPlate('), reason: f);
      }
      // Profil kapsulasi o'z shakliga ega, lekin QOIDA bitta.
      expect(
        File('lib/features/profile/profile_screen.dart').readAsStringSync(),
        contains('IdPlate.isPrecious'),
      );
    });

    test('daraja Tanlovga UZATILADI', () {
      // Vidjet bor, lekin `tier` berilmasa hammasi neytral
      // bo'lib qolardi — ya'ni ish bekor.
      expect(
        File('lib/features/discover/discover_screen.dart').readAsStringSync(),
        contains('tier: e.tier'),
      );
    });
  });
}
