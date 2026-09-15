// TO'RTINCHI TAB — DO'KON, REELS EMAS.
//
// Egasi Reels tabini olib tashlashni so'radi: ilova ijtimoiy lenta
// emas, u NFC ID va vizitka mahsuloti. O'rniga u qayta-qayta
// so'ragan narsa turadi: "ID sotib olishi, NFC kartaga buyurtma
// berishi, nom qidirishi, saytga o'xshab nom yozsa narxi chiqishi,
// to'lov Payme Click".
//
// Bu test o'sha kelishuvni qo'riqlaydi: xarid yo'llari BITTA tabda
// va bir bosishda bo'lishi kerak. Ular yana ekranlar ichiga
// yashirinib qolsa — test yiqiladi.
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/design/components/nav_bar.dart';
import 'package:nfcstore/l10n/strings.dart';
import 'package:nfcstore/screens/shop/shop.dart';

import 'audit/harness.dart';
import 'settle.dart';

void main() {
  setUpAll(loadAuditFonts);

  test('tab yorliqlarida REELS yo‘q, DO‘KON bor', () {
    final labels = NavBar.tabs.map((t) => t.label).toList();
    expect(labels, contains(tr('Do‘kon')));
    expect(labels, isNot(contains('Reels')));
    // Tab soni o'zgarmadi — markaziy NFC joyi ham o'z o'rnida.
    expect(labels.length, 5);
    expect(NavBar.nfcIndex, 2);
  });

  testWidgets('do‘konda xarid yo‘llari bir bosishda', (t) async {
    final s = auditState();
    await s.boot();
    await pumpScreen(t, const ShopScreen(), state: s);
    await settle(t);

    // Kod qidiruvi — saytdagidek, birinchi navbatda.
    expect(find.text(tr('Kod yozing — masalan AAA000')), findsOneWidget);

    // Xizmatlar va xaridlar.
    expect(find.text(tr('NFC ID karta')), findsOneWidget);
    expect(find.text(tr('Premium profil')), findsOneWidget);
    expect(find.text(tr('Buyurtmalarim')), findsOneWidget);
    expect(find.text(tr('To‘lovlar tarixi')), findsOneWidget);
  });

  testWidgets('tariflar narxi SERVERDAN — "…dan" ko‘rinadi', (t) async {
    // Mijozda narx jadvali yo'q. Katalog kelganda eng arzon narx
    // ko'rinadi; kelmasa yolg'on raqam emas, "Katalogda" yoziladi.
    final s = auditState();
    await s.boot();
    await pumpScreen(t, const ShopScreen(), state: s);
    await settle(t);

    expect(find.textContaining(tr('Tariflar')), findsOneWidget);
    expect(
      find.textContaining('dan'),
      findsWidgets,
      reason: 'katalogdagi eng arzon narx ko‘rinishi kerak',
    );
  });
}
