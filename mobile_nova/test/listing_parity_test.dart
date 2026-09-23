import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';

/// UMUMIY KATALOG QOIDALARI IKKI JOYDA — VA ULAR AJRALMASLIGI KERAK.
///
/// Server (`hosting/api/catalog-feed.js`) listing turini va global
/// kategoriyasini aniqlaydi; ilova ham (`ListingKind.infer`,
/// `MarketCategory.infer`) — eski server maydonni yubormasa yoki
/// kompaniya sahifasidan chuqur havola ochilganda. Ikkalasi boshqa
/// natija bersa, bitta tovar katalogda "Ovqat", sahifasida "Boshqa"
/// bo'lib ko'rinardi. Shuning uchun so'z ro'yxatlari AYNAN solishtiriladi
/// va bir xil namunalar ikkala tomonda bir xil javob beradi
/// (server tomoni: scripts/test-catalog-feed.mjs).
void main() {
  final js = File('../hosting/api/catalog-feed.js').readAsStringSync();

  List<String> strings(String src) => [
        for (final m in RegExp(r'''(['"])(.*?)\1''').allMatches(src)) m.group(2)!,
      ];

  Map<String, List<String>> jsMap(String name) {
    final block =
        RegExp('const $name = \\{([\\s\\S]*?)\\n\\};').firstMatch(js)!.group(1)!;
    return {
      for (final line in RegExp(r'(\w+): \[([^\]]*)\]').allMatches(block))
        line.group(1)!: strings(line.group(2)!),
    };
  }

  test('NFC so‘zlari bir xil', () {
    final server = jsMap('NFC_WORDS');
    expect(server.keys.toSet(),
        {for (final t in NfcProductType.words.keys) t.name});
    for (final e in NfcProductType.words.entries) {
      expect(e.value, server[e.key.name], reason: e.key.name);
    }
  });

  test('global kategoriya so‘zlari bir xil', () {
    final server = jsMap('MARKET_WORDS');
    expect(server.keys.toSet(),
        {for (final m in MarketCategory.words.keys) m.name});
    for (final e in MarketCategory.words.entries) {
      expect(e.value, server[e.key.name], reason: e.key.name);
    }
    final order = strings(RegExp(r'export const MARKET_CATEGORIES = \[([^\]]*)\]')
        .firstMatch(js)!
        .group(1)!);
    expect(order, [for (final m in MarketCategory.values) m.name],
        reason: 'chiplar tartibi ham bir xil');
  });

  test('xizmat so‘zlari va xizmat sohalari bir xil', () {
    final words = strings(
        RegExp(r'const SERVICE_WORDS = \[([^\]]*)\]').firstMatch(js)!.group(1)!);
    expect(ListingKind.serviceWords, words);
    final companies = strings(RegExp(r"const SERVICE_COMPANIES = new Set\(\[([^\]]*)\]\)")
        .firstMatch(js)!
        .group(1)!);
    expect(ListingKind.serviceCompanies, companies.toSet());
  });

  test('kompaniya sohasi → kategoriya bir xil', () {
    final block = RegExp(r'const COMPANY_MARKET = \{([\s\S]*?)\};')
        .firstMatch(js)!
        .group(1)!;
    final server = {
      for (final m in RegExp(r"(\w+): '(\w+)'").allMatches(block))
        m.group(1)!: m.group(2)!,
    };
    expect({for (final e in MarketCategory.byCompany.entries) e.key: e.value.name},
        server);
  });

  test('server testidagi namunalar ilovada ham xuddi shunday', () {
    // scripts/test-catalog-feed.mjs bilan bir xil holatlar.
    expect(MarketCategory.infer(null, 'restaurant', 'Salatlar', 'Uy salati'),
        MarketCategory.food);
    expect(ListingKind.infer(null, 'services', 'Sartaroshlik', 'Soch olish'),
        ListingKind.service);
    expect(MarketCategory.infer(null, 'services', 'Sartaroshlik', 'Soch olish'),
        MarketCategory.beauty);
    expect(MarketCategory.infer(null, 'shop', 'Kiyimlar', 'Ayollar ko‘ylagi'),
        MarketCategory.fashion);
    expect(MarketCategory.infer(null, 'shop', 'КАРТА', 'Oq PVC'),
        MarketCategory.electronics);
    expect(NfcProductType.subOf(MarketCategory.electronics, 'КАРТА', 'Oq PVC'),
        NfcProductType.card);
    expect(MarketCategory.infer('auto', 'restaurant', '', 'Palov'),
        MarketCategory.auto);
    expect(MarketCategory.infer(null, 'shop', '', 'Shina 17'),
        MarketCategory.auto);
    expect(ListingKind.infer(null, 'clinic', '', 'Ko‘rik'), ListingKind.service);
    expect(NfcProductType.subOf(MarketCategory.food, 'karta', 'Karta orqali to‘lov'),
        isNull);
  });
}
