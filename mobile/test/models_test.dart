import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/models.dart';
import 'package:nfcstore/design/tokens.dart';
import 'package:nfcstore/design/type.dart';

void main() {
  group('Narx va son ko‘rinishi', () {
    test('so‘m tor bo‘shliq bilan ajratiladi', () {
      // Oddiy probel EMAS: qator oxirida raqam ikkiga bo‘linib ketmasin.
      expect(som(1200000), '1 200 000');
      expect(som(149000), '149 000');
      expect(som(0), '0');
      expect(som(999), '999');
    });

    test('katta son qisqartiriladi', () {
      expect(compact(842), '842');
      expect(compact(12400), '12.4k');
      expect(compact(48200), '48.2k');
      expect(compact(1284), '1.3k');
      expect(compact(31400000), '31.4M');
      // Ortiqcha ".0" chiqmaydi va 100 dan kattasida kasr tashlanadi.
      expect(compact(12000), '12k');
      expect(compact(124600), '125k');
    });
  });

  group('Email niqobi', () {
    test('faqat birinchi harf qoladi', () {
      expect(AppUser.mask('aziz@gmail.com'), 'a***@gmail.com');
    });

    test('noto‘g‘ri manzil o‘zgarmaydi', () {
      // Niqoblash hech qachon yiqilmasligi kerak — u xavfsizlik
      // ko‘rinishi, majburiy tekshiruv emas.
      expect(AppUser.mask('@x.com'), '@x.com');
      expect(AppUser.mask('yoq'), 'yoq');
    });
  });

  group('Rasm manzili', () {
    test('nisbiy yo‘l to‘liq manzilga aylanadi', () {
      // Brauzerda /uploads/x.png ishlaydi, ilovada esa YO‘Q — shuning
      // uchun har bir rasm shu funksiyadan o‘tishi shart.
      expect(absUrl('/uploads/a.png'), 'https://nfcstore.uz/uploads/a.png');
      expect(absUrl('uploads/a.png'), 'https://nfcstore.uz/uploads/a.png');
    });

    test('to‘liq manzil va data URI tegilmaydi', () {
      expect(absUrl('https://cdn.example/x.png'), 'https://cdn.example/x.png');
      expect(absUrl('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
    });

    test('bo‘sh qiymat null qaytaradi', () {
      expect(absUrl(''), isNull);
      expect(absUrl('   '), isNull);
      expect(absUrl(null), isNull);
    });
  });

  group('Record', () {
    test('yetishmayotgan maydonlar yiqitmaydi', () {
      // Backend JSON‘i vaqt o‘tishi bilan o‘zgaradi; bitta null butun
      // ekranni yiqitmasligi kerak.
      final r = Record.fromJson({'code': 'vip001'});
      expect(r.code, 'VIP001');
      expect(r.name, '');
      expect(r.price, 0);
      expect(r.verified, isFalse);
      expect(r.avatarUrl, isNull);
    });

    test('tarif narxdan aniqlanadi', () {
      Tier t(int price) => Record.fromJson({'code': 'GLD100', 'price': price}).tier;
      expect(t(49000), Tier.bronze);
      expect(t(99000), Tier.silver);
      expect(t(149000), Tier.gold);
      expect(t(199000), Tier.premium);
      expect(t(490000), Tier.exclusive);
      expect(t(0), Tier.free);
    });

    test('tierOverride hamma narsadan ustun', () {
      final r = Record.fromJson({'code': 'AAA111', 'price': 49000, 'tierOverride': 'premium'});
      expect(r.tier, Tier.premium);
    });

    test('faqat harfli kod — exclusive', () {
      expect(Record.fromJson({'code': 'NFCSTORE'}).tier, Tier.exclusive);
    });
  });

  group('Product', () {
    test('chegirma foizi hisoblanadi', () {
      final p = Product.fromJson({'id': '1', 'name': 'X', 'price': 1750000, 'promotionPrice': 1487000});
      expect(p.discountPct, 15);
      expect(p.effectivePrice, 1487000);
    });

    test('chegirma yo‘q bo‘lsa null', () {
      expect(Product.fromJson({'id': '1', 'name': 'X', 'price': 100}).discountPct, isNull);
    });

    test('soxta chegirma ko‘rsatilmaydi', () {
      // Sotuv narxi asl narxdan katta bo‘lsa — bu chegirma emas.
      final p = Product.fromJson({'id': '1', 'name': 'X', 'price': 100, 'salePrice': 120});
      expect(p.discountPct, isNull);
    });
  });

  group('ApiError', () {
    test('401 — sessiya xatosi', () {
      expect(ApiError('unauthorized', status: 401).isAuth, isTrue);
      expect(ApiError('not_found', status: 404).isAuth, isFalse);
    });

    test('offline alohida belgilanadi', () {
      expect(ApiError('offline').isOffline, isTrue);
    });
  });
}
