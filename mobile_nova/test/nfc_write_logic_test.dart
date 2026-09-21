import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/nfc/ndef_payload.dart';

/// BEGONA NFC TEGIGA YOZISH — MANTIQ QISMI.
///
/// Yozishning O'ZI qurilma talab qiladi (DEVICE REQUIRED), lekin
/// undagi HAR BIR QAROR sof Dart: qaysi teg rozilik berilgan teg,
/// tegda nima turibdi, va yozilgandan keyin tegdan qaytgan manzil
/// kutilganiga tengmi. Aynan shu qarorlar noto'g'ri bo'lsa odam
/// boshqa kartasidagi ma'lumotni yo'qotadi yoki "yozildi" degan
/// yolg'on yozuvni ko'radi — shuning uchun ular shu yerda
/// telefonsiz tekshiriladi.
void main() {
  group('Teg identifikatori', () {
    test('nfca xaritasidan o‘n oltilik satr chiqadi', () {
      final id = tagIdentity({
        'nfca': {
          'identifier': [0x04, 0xA2, 0x0B, 0xFF],
          'atqa': [0x44, 0x00],
        },
      });
      expect(id, '04a20bff');
    });

    test('bitta baytli qiymat nol bilan to‘ldiriladi', () {
      // `0x0b` -> "0b", "b" EMAS. Aks holda [0x0B, 0xFF] va
      // [0xBF, 0xF0] bir xil satr berardi va ikki xil teg bir xil
      // deb qabul qilinardi.
      expect(tagIdentity({'nfcv': {'identifier': [0x0B, 0xFF]}}), '0bff');
    });

    test('boshqa texnologiyalar ham qaraladi', () {
      for (final key in [
        'nfcb', 'nfcf', 'nfcv', 'mifareclassic',
        'mifareultralight', 'ndefformatable', 'iso7816', 'iso15693',
      ]) {
        expect(tagIdentity({key: {'identifier': [0x01, 0x02]}}), '0102',
            reason: '$key o‘qilmadi');
      }
    });

    test('identifikator yo‘q bo‘lsa bo‘sh satr', () {
      // iOS ba'zi teglarda id bermaydi. Bo'sh satr "boshqa teg"
      // degani EMAS — chaqiruvchi solishtiruvni o'tkazib yuboradi.
      expect(tagIdentity({}), '');
      expect(tagIdentity({'ndef': {'isWritable': true}}), '');
      expect(tagIdentity({'nfca': {'identifier': []}}), '');
    });
  });

  group('Mavjud yozuvni tanib olish', () {
    test('URI yozuvi to‘liq manzil bilan chiqadi', () {
      final r = classifyRecord(
        typeNameFormat: kTnfWellKnown,
        type: [0x55],
        payload: encodeUriPayload('https://example.com/abc'),
      );
      expect(r.kind, NdefKind.uri);
      expect(r.value, 'https://example.com/abc');
    });

    test('jadvalning uzoq indekslari ham to‘g‘ri ochiladi', () {
      // 0x1D = `file://`. Qisqa jadval bilan bu "..." bo‘lib
      // ko‘rinardi va odam tegida nima turganini bilmasdi.
      final r = classifyRecord(
        typeNameFormat: kTnfWellKnown,
        type: [0x55],
        payload: [0x1D, ...'srv/x'.codeUnits],
      );
      expect(r.value, 'file://srv/x');
    });

    test('matn yozuvi tili bilan chiqadi', () {
      final r = classifyRecord(
        typeNameFormat: kTnfWellKnown,
        type: [0x54],
        payload: encodeTextPayload('Salom', language: 'uz'),
      );
      expect(r.kind, NdefKind.text);
      expect(r.value, 'Salom');
      expect(r.language, 'uz');
    });

    test('vCard MIME yozuvi tanib olinadi', () {
      final r = classifyRecord(
        typeNameFormat: kTnfMime,
        type: 'text/vcard'.codeUnits,
        payload: buildVCard(name: 'Ali').codeUnits,
      );
      expect(r.kind, NdefKind.vcard);
      expect(r.value, contains('FN:Ali'));
    });

    test('notanish MIME turi ham ko‘rsatiladi', () {
      final r = classifyRecord(
        typeNameFormat: kTnfMime,
        type: 'application/json'.codeUnits,
        payload: '{"a":1}'.codeUnits,
      );
      expect(r.kind, NdefKind.unknown);
      expect(r.mimeType, 'application/json');
      expect(r.value, '{"a":1}');
    });

    test('bo‘sh va buzuq yozuv qulatmaydi', () {
      expect(
        classifyRecord(typeNameFormat: 0, type: const [], payload: const [])
            .kind,
        NdefKind.unknown,
      );
      expect(
        classifyRecord(
                typeNameFormat: kTnfWellKnown, type: [0x55], payload: const [])
            .value,
        '',
      );
    });
  });

  group('Yozilganni qayta o‘qib tasdiqlash', () {
    test('aynan o‘sha manzil — o‘tadi', () {
      expect(
        sameWrittenUrl(
            'https://nfcstore.uz/VIP001', 'https://nfcstore.uz/VIP001'),
        isTrue,
      );
    });

    test('www va oxirgi qiya chiziq farq qilmaydi', () {
      // Teg URI ni prefiks jadvali orqali saqlaydi, shuning uchun
      // `https://www.` bilan qaytishi mumkin — manzil o‘sha-o‘sha.
      expect(
        sameWrittenUrl(
            'https://nfcstore.uz/VIP001', 'https://www.nfcstore.uz/VIP001/'),
        isTrue,
      );
    });

    test('BOSHQA kod — o‘tmaydi', () {
      // Eng muhim holat: yozish yarim ketib, tegda eski kod qolgan.
      expect(
        sameWrittenUrl(
            'https://nfcstore.uz/VIP001', 'https://nfcstore.uz/ZZZ999'),
        isFalse,
      );
    });

    test('boshqa host — o‘tmaydi', () {
      expect(
        sameWrittenUrl(
            'https://nfcstore.uz/VIP001', 'https://evil.example/VIP001'),
        isFalse,
      );
    });

    test('sxema farq qilsa — o‘tmaydi', () {
      expect(
        sameWrittenUrl(
            'https://nfcstore.uz/VIP001', 'http://nfcstore.uz/VIP001'),
        isFalse,
      );
    });

    test('bo‘sh yoki buzuq javob — o‘tmaydi', () {
      expect(sameWrittenUrl('https://nfcstore.uz/VIP001', ''), isFalse);
      expect(sameWrittenUrl('https://nfcstore.uz/VIP001', '   '), isFalse);
    });

    test('so‘rov qismi ham solishtiriladi', () {
      expect(
        sameWrittenUrl('https://nfcstore.uz/a?x=1', 'https://nfcstore.uz/a?x=2'),
        isFalse,
      );
    });
  });

  group('Tegga yoziladigan narsa — XAVFSIZLIK', () {
    test('yoziladigan manzil DOIM ochiq profil manzili', () {
      final url = profileTagUrl('https://nfcstore.uz', 'VIP001');
      expect(url, 'https://nfcstore.uz/VIP001');
      expect(isSafeWriteUrl(url), isTrue);
    });

    test('chip tokeniga o‘xshash yo‘l profil manzilidan chiqmaydi', () {
      // Jismoniy kartaning maxfiy tokeni `/tap/<token>` yo‘lida
      // yashaydi. `profileTagUrl` uni YASAY OLMAYDI: u faqat
      // `/<KOD>` beradi. Bu yerda shu kafolat qayd etiladi —
      // funksiya kelajakda o‘zgartirilsa test yiqiladi.
      final url = profileTagUrl('https://nfcstore.uz', 'VIP001');
      expect(url, isNot(contains('/tap/')));
      expect(Uri.parse(url).pathSegments, ['VIP001']);
    });

    test('xavfli sxema hech qachon yozilmaydi', () {
      for (final bad in [
        'javascript:alert(1)',
        'data:text/html,<script>',
        'intent://x#Intent;end',
        'file:///etc/passwd',
      ]) {
        expect(isSafeWriteUrl(bad), isFalse, reason: bad);
      }
    });
  });

  group('Yozish mumkinmi — sabab bilan', () {
    test('qulflangan teg aniq sabab beradi', () {
      expect(
        checkWritable(
            isNdef: true, writable: false, maxSize: 144, payloadSize: 30),
        WriteBlock.readOnly,
      );
    });

    test('kichik stikerga uzun kod sig‘masligi oldindan bilinadi', () {
      // NTAG213 ning foydali sig‘imi ~144 bayt; bu yerda ataylab
      // kichik teg olingan.
      final url = profileTagUrl('https://nfcstore.uz', 'A' * 60);
      final size = 4 + encodeUriPayload(url).length;
      expect(
        checkWritable(
            isNdef: true, writable: true, maxSize: 48, payloadSize: size),
        WriteBlock.tooLarge,
      );
    });

    test('oddiy NFC ID oddiy stikerga sig‘adi', () {
      final url = profileTagUrl('https://nfcstore.uz', 'VIP001');
      final size = 4 + encodeUriPayload(url).length;
      expect(size, lessThan(48));
      expect(
        checkWritable(
            isNdef: true, writable: true, maxSize: 144, payloadSize: size),
        WriteBlock.ok,
      );
    });
  });

  group('Platforma sozlamalari — yozish uchun', () {
    test('Android: NFC ruxsati bor va apparat SHART emas', () {
      final m =
          File('android/app/src/main/AndroidManifest.xml').readAsStringSync();
      expect(m, contains('android.permission.NFC'),
          reason: 'ruxsatsiz Android\'da na o\'qish, na yozish ishlaydi');
      // `required="false"` — NFC'siz telefonlarda ham ilova
      // Play Store'da ko'rinadi (ular QR yo'lidan foydalanadi).
      expect(
        RegExp(r'android\.hardware\.nfc"\s+android:required="false"')
            .hasMatch(m),
        isTrue,
        reason: 'NFC majburiy qilib qo\'yilgan — NFC\'siz telefonlar '
            'ilovani Play Store\'da umuman ko\'rmaydi',
      );
    });

    test('iOS: kartani tegizish oynasi uchun matn bor', () {
      // `NFCReaderUsageDescription` bo'lmasa CoreNFC sessiyasi
      // ochilmaydi va ilova yiqiladi.
      final plist = File('ios/Runner/Info.plist').readAsStringSync();
      expect(plist, contains('NFCReaderUsageDescription'));
    });

    test('iOS: NDEF entitlement fayli bor va FAQAT NDEF so‘raydi', () {
      final e = File('ios/Runner/Runner.entitlements').readAsStringSync();
      expect(e, contains('com.apple.developer.nfc.readersession.formats'));
      expect(e, contains('NDEF'));
      // Xom `TAG` formati kerak emas; Apple uni alohida
      // asoslashni talab qiladi va rad etilishi mumkin.
      expect(e.contains('<string>TAG</string>'), isFalse);
    });
  });
}
