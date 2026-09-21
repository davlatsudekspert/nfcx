import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/shop/nfc_id_market.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

/// NFC ID QIDIRISH / SOTIB OLISH — ILOVA TOMONI.
///
/// Server tomoni alohida qo'riqlanadi
/// (`scripts/test-nova-id-purchase.mjs`, 27 tekshiruv). Bu yerda
/// ilovaning O'ZI tekshiriladi: javobni to'g'ri o'qiydimi, narxni
/// o'zi to'qib chiqarmaydimi va saytnikidan boshqa yo'lga
/// bormaydimi.
void main() {
  group('kodni tozalash', () {
    test('kichik harf, bo\'shliq va tire tashlanadi', () {
      expect(normalizeIdCode('vip 001'), 'VIP001');
      expect(normalizeIdCode('  aaa-000 '), 'AAA000');
      expect(normalizeIdCode('ddd_333'), 'DDD333');
    });

    // Server ham kodni AYNAN shunday normallashtiradi
    // (`String(code).toUpperCase().replace(/[^A-Z0-9]/g,'')`).
    // Ikki tomon ikki xil tozalasa, ilovada "bo'sh" ko'ringan kod
    // serverda "band" bo'lib chiqardi.
    test('boshqa belgilar butunlay olib tashlanadi', () {
      expect(normalizeIdCode('v!i@p#0\$0%1'), 'VIP001');
      expect(normalizeIdCode('—'), '');
    });
  });

  group('holat', () {
    late L l;
    setUpAll(() async {
      l = await L.delegate.load(const Locale('uz'));
    });
    final t = NfcTokens.fallback;

    test('egasi bor kod — sotilgan', () {
      final s = quoteState(l, t,
          const IdQuote(code: 'VIP001', taken: true, reason: 'already_taken'));
      expect(s.text, l.idStateTaken);
    });

    test('boshqa odam band qilgan — sotilgan EMAS, band', () {
      // Bu ikkovi bir xil emas: band qilingan kod to'lov
      // tugamasa yana sotuvga chiqadi, sotilgani esa yo'q.
      final s = quoteState(
          l,
          t,
          const IdQuote(
              code: 'QWE321', reason: 'reserved_pending_payment'));
      expect(s.text, l.idStateReserved);
      expect(s.text, isNot(l.idStateTaken));
    });

    test('bo\'sh kod — sotuvda', () {
      final s = quoteState(l, t,
          const IdQuote(code: 'QWE321', purchasable: true, amount: 49000));
      expect(s.text, l.idStateAvailable);
      expect(s.color, t.accent2);
    });

    test('sotib olinmaydigan kod — tugma uchun sabab bor', () {
      final s = quoteState(l, t,
          const IdQuote(code: '12345678', reason: 'not_purchasable'));
      expect(s.text, l.idStateNotForSale);
    });
  });

  group('server javobini o\'qish', () {
    test('quote — barcha maydonlar', () {
      final q = IdQuote.fromJson({
        'code': 'qwe321',
        'taken': false,
        'purchasable': true,
        'tier': 'free',
        'amount': 49000,
      });
      expect([q.code, q.purchasable, q.tier, q.amount],
          ['QWE321', true, 'free', 49000]);
    });

    test('buyurtma qoralamasi — narx va to\'lov havolalari', () {
      final d = IdOrderDraft.fromJson({
        'pending': true,
        'orderId': 12,
        'code': 'QWE321',
        'price': 49000,
        'payLink': 'https://checkout.paycom.uz/abc',
        'payLinks': {
          'payme': 'https://checkout.paycom.uz/abc',
          'click': 'https://my.click.uz/services/pay?x=1',
        },
      });
      expect([d.orderId, d.code, d.price], [12, 'QWE321', 49000]);
      expect(d.paymeLink, contains('paycom.uz'));
      expect(d.clickLink, contains('click.uz'));
    });

    /// SUMMA `price` MAYDONIDAN.
    ///
    /// Server `GET /api/orders` da summani `price` deb yuboradi,
    /// model esa faqat `total`/`amount` ni o'qirdi — ya'ni
    /// "To'lovlar" ekrani har bir buyurtmani 0 so'm deb ko'rsatardi
    /// va kod ham, tur ham tashlab yuborilardi.
    test('buyurtma tarixi — summa, kod va tur yo\'qolmaydi', () {
      final o = Order.fromJson({
        'id': 12,
        'code': 'QWE321',
        'kind': 'card_purchase',
        'price': 49000,
        'status': 'pending',
        'payLinks': {'payme': 'https://checkout.paycom.uz/abc'},
      });
      expect(o.total, 49000, reason: 'summa `price` dan o‘qilishi kerak');
      expect([o.code, o.kind, o.pending], ['QWE321', 'card_purchase', true]);
      expect(o.paymeLink, isNotEmpty);
    });

    test('to\'langan buyurtmada to\'lov havolasi yo\'q', () {
      final o = Order.fromJson(
          {'id': 12, 'code': 'QWE321', 'price': 49000, 'status': 'paid'});
      expect(o.pending, isFalse);
      expect(o.paymeLink, isEmpty);
    });
  });

  group('shartnoma qo\'riqchisi', () {
    final repo =
        File('lib/data/repositories/shop_repository.dart').readAsStringSync();
    final screens =
        File('lib/features/shop/nfc_id_market.dart').readAsStringSync();

    /// ILOVA UCHUN ALOHIDA BACKEND YO'Q.
    ///
    /// Sotib olish oqimi saytning O'SHA endpointlaridan ishlashi
    /// shart. Kimdir kelajakda "ilova uchun qulayroq" parallel yo'l
    /// ochsa, shu yerda ko'rinadi.
    test('faqat mavjud sayt endpointlari chaqiriladi', () {
      for (final path in [
        '/api/settings/id-pricing',
        '/api/records/',
        '/api/orders',
      ]) {
        expect(repo, contains(path), reason: '$path chaqirilmayapti');
      }
      // "app", "mobile", "nova" prefiksli parallel yo'l bo'lmasin.
      expect(RegExp(r"'/api/(app|mobile|nova)/").hasMatch(repo), isFalse,
          reason: 'ilova uchun alohida API yo‘li ochilgan');
    });

    /// NARXNI SERVER QO'YADI.
    ///
    /// `buyId` so'rov tanasiga summa yozmasligi kerak. Yozilsa,
    /// ertaga kimdir uni ekrandagi qiymatdan olib, ikki tomonda ikki
    /// xil summa paydo bo'lardi. Server baribir qabul qilmaydi
    /// (`scripts/test-nova-id-purchase.mjs` 4-bo'lim), lekin
    /// yuborishning o'zi ham noto'g'ri.
    test('xarid so\'roviga summa yozilmaydi', () {
      final start = repo.indexOf('Future<Result<IdOrderDraft>> buyId(');
      expect(start, greaterThan(-1), reason: 'buyId topilmadi');
      final body = repo.substring(start, repo.indexOf('\n  }', start));
      for (final key in ["'price'", "'amount'", "'total'", "'sum'"]) {
        expect(body, isNot(contains(key)),
            reason: 'so‘rov tanasida $key yuborilyapti');
      }
    });

    /// NARX ILOVADA YOZILMAYDI.
    test('ekranlarda qotirilgan narx yo\'q', () {
      // 49000 / 99000 / 149000 / 199000 / 490000 — server
      // konstantalari. Ilovada uchrasa, jadval ikki joyda bo'lib
      // qolgan va biri eskiradi.
      expect(RegExp(r'\b(49000|99000|149000|199000|490000)\b').hasMatch(screens),
          isFalse,
          reason: 'narx ekranga qotirilgan');
    });

    /// HOLATNI SERVER AYTADI.
    test('ilova o\'zi "to\'landi" deb hisoblamaydi', () {
      // Faqat serverdan kelgan `status` o'qiladi; ilova uni
      // o'zi 'paid' qilib qo'ymaydi.
      expect(RegExp(r"status\s*=\s*'paid'").hasMatch(screens), isFalse);
      expect(screens, contains("o.status"),
          reason: 'holat server javobidan o‘qilishi kerak');
    });

    /// HAR BOSILGAN HARFDA SO'ROV YO'Q.
    test('qidiruvda kechikish bor', () {
      expect(screens, contains('Timer('),
          reason: 'debounce yo‘q — server har harfda uriladi');
      expect(screens, contains('milliseconds: 350'));
    });

    /// IKKINCHI KATALOG YO'Q.
    test('ikkala kirish joyi bitta ekranga olib boradi', () {
      final center =
          File('lib/features/nfc/nfc_center_screen.dart').readAsStringSync();
      final home = File('lib/features/home/home_screen.dart').readAsStringSync();
      expect(center, contains('Routes.nfcMarket'));
      expect(home, contains('Routes.nfcMarket'));
    });
  });
}
