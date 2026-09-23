import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';

/// Kompaniya katalogi kontrakti.
///
/// Topilgan ikki jim xato:
///   * server tovar id'sini UUID satr qilib beradi, ilova esa raqam
///     deb o'qirdi — `id` 0 bo'lib, tahrirlash/o'chirish
///     `/api/companies/X/catalog/0` ga ketardi;
///   * server chegirmani `promotionPrice` deb yuboradi va kutadi, ilova
///     `salePrice` o'qib/yozardi — chegirma saqlanmasdi va ko'rinmasdi.
void main() {
  test('UUID id asl holida saqlanadi va amal kaliti bo‘ladi', () {
    final i = CatalogItem.fromJson(const {
      'id': '3f2a9c1e-7b1d-4c55-9a0e-2b7f5d1c8e90',
      'name': 'Metall karta',
      'price': 390000,
      'promotionPrice': 299000,
      'category': 'card',
    });
    expect(i.key, '3f2a9c1e-7b1d-4c55-9a0e-2b7f5d1c8e90');
    expect(i.salePrice, 299000);
    expect(i.effectivePrice, 299000);
    expect(i.nfcType, NfcProductType.card);
  });

  test('raqamli id (NFC ID katalogi) ham ishlaydi', () {
    final i = CatalogItem.fromJson(const {'id': 7, 'name': 'Lavash'});
    expect(i.id, 7);
    expect(i.key, '7');
  });

  test('mahsulot formasi serverga promotionPrice va category yuboradi', () {
    final src =
        File('lib/features/business/business_forms.dart').readAsStringSync();
    expect(src, contains("'promotionPrice':"));
    expect(src, contains("'category':"));
    expect(src, contains('items[i].key'));
    final repo =
        File('lib/data/repositories/business_repository.dart').readAsStringSync();
    expect(repo, contains('String companyId, String itemId'));
  });

  test('NFC turi: kalit so‘zlar (lotin va kirill)', () {
    expect(NfcProductType.fromCategory('КАРТА'), NfcProductType.card);
    expect(NfcProductType.fromCategory('', 'NFC stiker 5 dona'),
        NfcProductType.sticker);
    expect(NfcProductType.fromCategory('', 'Брелок'), NfcProductType.keychain);
    expect(NfcProductType.fromCategory('aksessuar'), NfcProductType.accessory);
    expect(NfcProductType.fromCategory('sticker', 'karta'),
        NfcProductType.sticker,
        reason: 'slug kalit so‘zdan ustun');
    expect(NfcProductType.fromCategory('boshqa'), NfcProductType.other);
  });

  test('server bilan bir xil kalit so‘zlar (hosting/api/catalog-feed.js)', () {
    final js = File('../hosting/api/catalog-feed.js').readAsStringSync();
    final block = RegExp(r'const WORDS = \{([\s\S]*?)\};').firstMatch(js)!;
    for (final line in RegExp(r"(\w+): \[([^\]]*)\]")
        .allMatches(block.group(1)!)) {
      final type = NfcProductType.values.byName(line.group(1)!);
      for (final w in RegExp(r"'([^']+)'").allMatches(line.group(2)!)) {
        expect(NfcProductType.fromCategory(w.group(1)!), type,
            reason: 'server "${w.group(1)}" ni $type deydi, ilova boshqacha');
      }
    }
  });
}
