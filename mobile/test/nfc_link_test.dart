import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/data/nfc.dart';

/// NFC / APP LINK HAVOLASINI TAHLIL QILISH.
///
/// NIMA UCHUN AYNAN SHU JOY ENG MUHIM: bu funksiya TASHQARIDAN
/// kelgan ma'lumot bilan ishlaydi — begona NFC karta ham, begona
/// havola ham shu yerdan o'tadi. Xato bo'lsa, ilova boshqa saytning
/// havolasi bo'yicha profil ochishga urinadi.
void main() {
  group('NfcLink.parse — qabul qilinadi', () {
    test('oddiy shaxsiy havola', () {
      final link = NfcLink.parse('https://nfcstore.uz/vip001');
      expect(link, isNotNull);
      expect(link!.code, 'VIP001');
      expect(link.company, isFalse);
    });

    test('/id/ prefiksi bilan', () {
      expect(NfcLink.parse('https://nfcstore.uz/id/aaa111')?.code, 'AAA111');
    });

    test('kompaniya havolasi alohida belgilanadi', () {
      final link = NfcLink.parse('https://nfcstore.uz/c/ddd333');
      expect(link?.code, 'DDD333');
      expect(link?.company, isTrue);
    });

    test('www va so‘rov parametrlari xalaqit bermaydi', () {
      expect(NfcLink.parse('https://www.nfcstore.uz/vip001?ref=nfc')?.code, 'VIP001');
    });

    test('bo‘sh joy va katta-kichik harf', () {
      expect(NfcLink.parse('  https://nfcstore.uz/ViP001  ')?.code, 'VIP001');
    });
  });

  group('NfcLink.parse — rad etiladi', () {
    test('begona domen', () {
      expect(NfcLink.parse('https://nfcstore.uz.evil.com/vip001'), isNull);
      expect(NfcLink.parse('https://example.com/vip001'), isNull);
    });

    test('domen ichida nfcstore.uz bo‘lsa ham', () {
      expect(NfcLink.parse('https://evil.com/nfcstore.uz/vip001'), isNull);
    });

    test('saytning o‘z bo‘limlari kod deb o‘qilmaydi', () {
      for (final p in ['api', 'admin', 'login', 'cabinet', 'pay', 'terms']) {
        expect(NfcLink.parse('https://nfcstore.uz/$p'), isNull, reason: p);
      }
    });

    test('bo‘sh yo‘l', () {
      expect(NfcLink.parse('https://nfcstore.uz/'), isNull);
      expect(NfcLink.parse('https://nfcstore.uz'), isNull);
    });

    test('noto‘g‘ri shakldagi kod', () {
      expect(NfcLink.parse('https://nfcstore.uz/ab'), isNull);
      expect(NfcLink.parse('https://nfcstore.uz/vip-001'), isNull);
      expect(NfcLink.parse('https://nfcstore.uz/vip001vip001vip001'), isNull);
    });

    test('umuman havola emas', () {
      expect(NfcLink.parse(''), isNull);
      expect(NfcLink.parse('salom'), isNull);
    });
  });

  test('teng havolalar teng deb hisoblanadi', () {
    expect(NfcLink.parse('https://nfcstore.uz/vip001'), const NfcLink('VIP001'));
    expect(
      NfcLink.parse('https://nfcstore.uz/c/ddd333'),
      const NfcLink('DDD333', company: true),
    );
    expect(const NfcLink('VIP001') == const NfcLink('VIP001', company: true), isFalse);
  });
}
