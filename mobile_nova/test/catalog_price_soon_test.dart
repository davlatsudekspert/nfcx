import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

/// "NARXI TEZ KUNDA" (egasi, 2026-09-27: yangi stiker va kartalar
/// do'konda "narxi tez kunda" bilan tursin).
///
/// Server bunday tovarda `priceOnRequest: true` ham yuboradi (eski ilova
/// "0 so'm" emas, "Narx kelishiladi" ko'rsatsin). Yangi ilova esa
/// `priceSoon` ni BIRINCHI tekshiradi.
void main() {
  test('model: priceSoon o‘qiladi, eski javobda false', () {
    final soon = CatalogItem.fromJson(const {
      'id': 'a', 'name': 'Avto NFC stiker Ø80', 'price': 0,
      'priceOnRequest': true, 'priceSoon': true,
    });
    expect([soon.priceSoon, soon.priceOnRequest], [true, true]);

    final old = CatalogItem.fromJson(const {'id': 'b', 'name': 'Karta', 'price': 220000});
    expect([old.priceSoon, old.priceOnRequest], [false, false]);

    final p = CatalogProduct.fromJson(const {
      'id': 'c', 'name': 'Metall karta', 'price': 0,
      'priceOnRequest': true, 'priceSoon': true, 'companyId': 'NFCSTOREUZ',
    });
    expect([p.priceSoon, p.priceOnRequest], [true, true]);
  });

  test('uch tilda yozuv bor va "Narx kelishiladi"dan farqli', () async {
    for (final loc in const [Locale('uz'), Locale('ru'), Locale('en')]) {
      final l = await L.delegate.load(loc);
      expect(l.catalogPriceSoon.trim(), isNotEmpty);
      expect(l.catalogPriceSoon, isNot(l.catalogPriceOnRequest));
    }
    expect((await L.delegate.load(const Locale('uz'))).catalogPriceSoon,
        'Narxi tez kunda');
  });

  /// Narx yozuvi chiqadigan HAR joy bayroqni hisobga oladi. Yangi joy
  /// qo'shilib, bayroq unutilsa — u yerda "Narx kelishiladi" chiqib
  /// qoladi. Widget testi har ekranni qamramaydi, shuning uchun manba.
  test('manba: har narx yozuvi priceSoon ni tekshiradi', () {
    const files = [
      'lib/features/business/business_screens.dart',
      'lib/features/business/store_catalog.dart',
      'lib/features/discover/catalog_view.dart',
    ];
    for (final f in files) {
      final src = File(f).readAsStringSync();
      final onRequest = 'l.catalogPriceOnRequest'.allMatches(src).length;
      final soon = 'l.catalogPriceSoon'.allMatches(src).length;
      expect(onRequest, greaterThan(0), reason: f);
      expect(soon, onRequest, reason: '$f: "tez kunda" tekshirilmagan joy bor');
    }
  });
}
