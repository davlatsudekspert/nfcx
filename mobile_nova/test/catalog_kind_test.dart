import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';

/// KATALOG TURI — SERVER QOIDASINING NUSXASI.
///
/// Server turni biznes yo'nalishiga qarab hal qiladi va mos
/// kelmagan so'rovni RAD ETADI (403). Ilova o'sha qoidani bilishi
/// kerak, aks holda u noto'g'ri turni so'rab, odam "qo'shib
/// bo'lmadi" degan xatoni ko'radi.
///
/// Manba: `hosting/api/catalog.js` -> `businessModule()`.
/// Qoida u yerda o'zgarsa, bu sinov ogohlantirmaydi — shuning
/// uchun `scripts/test-catalog-kind-parity.mjs` ikkala nusxani
/// solishtiradi.
void main() {
  group('Yo‘nalishdan katalog turi', () {
    test('ovqat — menyu', () {
      expect(CatalogKind.forCategory('food'), CatalogKind.menu);
      expect(CatalogKind.forCategory('food-cafe'), CatalogKind.menu);
      expect(CatalogKind.forCategory('food-restaurant'), CatalogKind.menu);
    });

    test('savdo — mahsulotlar', () {
      expect(CatalogKind.forCategory('retail'), CatalogKind.products);
      expect(CatalogKind.forCategory('retail-clothes'), CatalogKind.products);
    });

    test('qolgan hammasi — xizmatlar', () {
      for (final s in ['beauty', 'auto', 'medical', 'other', '']) {
        expect(CatalogKind.forCategory(s), CatalogKind.services,
            reason: '"$s" uchun noto‘g‘ri tur');
      }
    });

    test('katta harf ahamiyatsiz', () {
      expect(CatalogKind.forCategory('FOOD'), CatalogKind.menu);
      expect(CatalogKind.forCategory('Retail-Books'), CatalogKind.products);
    });

    test('"foodie" — ovqat EMAS', () {
      // Server sharti `s === 'food' || s.startsWith('food-')`.
      // `startsWith('food')` bo'lganda "foodie" ham menyuga
      // tushib ketardi va server uni rad etardi.
      expect(CatalogKind.forCategory('foodie'), CatalogKind.services);
      expect(CatalogKind.forCategory('retailer'), CatalogKind.services);
    });
  });

  group('Yo‘nalish serverdan O‘QILADI', () {
    test('NfcId `categorySlug` ni oladi', () {
      // Server uni `/api/records/:code` javobida qaytaradi
      // (`rowToRecord`), lekin ilova uni o‘qimasdi — shuning
      // uchun turni aniqlashning iloji yo‘q edi.
      expect(
        NfcId.fromJson(const {'code': 'BIZ777', 'categorySlug': 'food-cafe'})
            .categorySlug,
        'food-cafe',
      );
    });

    test('snake_case ham qabul qilinadi', () {
      expect(
        NfcId.fromJson(const {'code': 'BIZ777', 'category_slug': 'retail'})
            .categorySlug,
        'retail',
      );
    });

    test('yo‘q bo‘lsa — bo‘sh satr, xato emas', () {
      expect(NfcId.fromJson(const {'code': 'VIP001'}).categorySlug, '');
    });
  });
}
