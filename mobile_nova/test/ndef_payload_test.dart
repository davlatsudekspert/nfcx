import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/nfc/ndef_payload.dart';

/// NFC MANTIG'I TELEFONSIZ SINALADI.
///
/// Tegga yozish va o'qishning O'ZI qurilma talab qiladi, lekin
/// BAYTLARNI qurish mantig'i sof Dart. Shuning uchun u shu yerda
/// to'liq tekshiriladi: noto'g'ri qurilgan yuklama telefonda
/// "yozildi, lekin hech narsa o'qilmadi" holatini berardi va
/// sababini topish juda qiyin bo'lardi.
void main() {
  group('URI yozuvi', () {
    test('eng uzun mos prefiks tanlanadi — yuklama qisqaradi', () {
      // `https://www.` uchun 0x02; `https://` (0x04) ishlatilsa
      // yuklama 4 bayt uzun bo'lardi.
      final p = encodeUriPayload('https://www.nfcstore.uz/VIP001');
      expect(p.first, 0x02);
      expect(utf8.decode(p.sublist(1)), 'nfcstore.uz/VIP001');
    });

    test('https:// uchun 0x04', () {
      final p = encodeUriPayload('https://nfcstore.uz/VIP001');
      expect(p.first, 0x04);
      expect(utf8.decode(p.sublist(1)), 'nfcstore.uz/VIP001');
    });

    test('notanish sxema prefikssiz yoziladi', () {
      final p = encodeUriPayload('ftp://example.com');
      expect(p.first, 0x00);
      expect(utf8.decode(p.sublist(1)), 'ftp://example.com');
    });

    test('yozib — qayta o‘qiganda AYNAN o‘zi chiqadi', () {
      for (final url in [
        'https://nfcstore.uz/VIP001',
        'https://www.nfcstore.uz/c/NFCSTOREUZ',
        'http://example.com/a?b=1&c=2',
        'tel:+998901234567',
        'mailto:a@b.uz',
      ]) {
        expect(decodeUriPayload(encodeUriPayload(url)), url,
            reason: '$url aylanib qaytmadi');
      }
    });

    test('bo‘sh yuklama qulatmaydi', () {
      expect(decodeUriPayload(const []), '');
    });
  });

  group('Matn yozuvi', () {
    test('til kodi va matn to‘g‘ri joylashadi', () {
      final p = encodeTextPayload('Salom', language: 'uz');
      expect(p.first & 0x3F, 2); // "uz" — 2 bayt
      expect(decodeTextLanguage(p), 'uz');
      expect(decodeTextPayload(p), 'Salom');
    });

    test('o‘zbek va rus harflari buzilmaydi', () {
      for (final s in ['Assalomu alaykum', 'Привет мир', "O‘zbekiston"]) {
        expect(decodeTextPayload(encodeTextPayload(s)), s);
      }
    });

    test('UTF-16 biti HECH QACHON qo‘yilmaydi', () {
      final p = encodeTextPayload('test');
      expect(p.first & 0x80, 0);
    });

    test('juda uzun til kodi rad etiladi', () {
      expect(() => encodeTextPayload('x', language: 'a' * 64),
          throwsArgumentError);
    });
  });

  group('vCard', () {
    test('majburiy maydonlar bor va CRLF ishlatiladi', () {
      final v = buildVCard(name: 'Muhammad', phone: '+998901234567');
      expect(v, startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n'));
      expect(v, contains('FN:Muhammad\r\n'));
      expect(v, contains('TEL;TYPE=CELL:+998901234567\r\n'));
      expect(v, endsWith('END:VCARD\r\n'));
      expect(v.contains('\n\n'), isFalse);
    });

    test('bo‘sh maydonlar umuman yozilmaydi', () {
      final v = buildVCard(name: 'A');
      expect(v, isNot(contains('TEL')));
      expect(v, isNot(contains('EMAIL')));
      expect(v, isNot(contains('URL')));
    });

    test('nuqtali vergul va vergul qochiriladi', () {
      final v = buildVCard(name: 'Ali; Vali, Sami');
      expect(v, contains(r'FN:Ali\; Vali\, Sami'));
    });
  });

  group('Yozishdan oldingi tekshiruv', () {
    test('NDEF bo‘lmagan teg', () {
      expect(
          checkWritable(
              isNdef: false, writable: true, maxSize: 100, payloadSize: 10),
          WriteBlock.notNdef);
    });

    test('qulflangan teg', () {
      expect(
          checkWritable(
              isNdef: true, writable: false, maxSize: 100, payloadSize: 10),
          WriteBlock.readOnly);
    });

    test('sig‘imi yetmaydi', () {
      expect(
          checkWritable(
              isNdef: true, writable: true, maxSize: 48, payloadSize: 120),
          WriteBlock.tooLarge);
    });

    test('sig‘im aniq — chegarada o‘tadi', () {
      expect(
          checkWritable(
              isNdef: true, writable: true, maxSize: 48, payloadSize: 48),
          WriteBlock.ok);
    });

    test('platforma sig‘imni bermasa — taxmin qilinmaydi', () {
      // `maxSize` 0 bo'lsa tekshiruv o'tkazib yuboriladi: yozib
      // ko'rib, natijani QAYTA O'QIB tasdiqlash afzal.
      expect(
          checkWritable(
              isNdef: true, writable: true, maxSize: 0, payloadSize: 9999),
          WriteBlock.ok);
    });
  });

  group('Manzil xavfsizligi', () {
    test('faqat http/https ga ruxsat', () {
      expect(isSafeWriteUrl('https://nfcstore.uz/VIP001'), isTrue);
      expect(isSafeWriteUrl('http://example.com'), isTrue);
    });

    test('xavfli sxemalar rad etiladi', () {
      for (final bad in [
        'javascript:alert(1)',
        'file:///etc/passwd',
        'intent://scan/#Intent;scheme=zxing;end',
        'data:text/html,<script>',
        'not a url',
        '',
      ]) {
        expect(isSafeWriteUrl(bad), isFalse, reason: '"$bad" o‘tkazib yuborildi');
      }
    });
  });

  group('NFCSTORE profil manzili', () {
    test('ochiq profil manzili quriladi', () {
      expect(profileTagUrl('https://nfcstore.uz', 'VIP001'),
          'https://nfcstore.uz/VIP001');
      // Oxiridagi qiya chiziq ikkilanmaydi.
      expect(profileTagUrl('https://nfcstore.uz/', 'VIP001'),
          'https://nfcstore.uz/VIP001');
    });

    test('maxsus belgili kod kodlanadi', () {
      expect(profileTagUrl('https://nfcstore.uz', 'A B'),
          'https://nfcstore.uz/A%20B');
    });

    test('natija HAR DOIM xavfsiz manzil', () {
      expect(isSafeWriteUrl(profileTagUrl('https://nfcstore.uz', 'VIP001')),
          isTrue);
    });
  });
}
