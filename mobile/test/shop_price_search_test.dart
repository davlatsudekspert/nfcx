// EGASINING TELEFONDAN YUBORGAN TO'RT XATOSI (2026-09-15).
//
//   1. ID katalogida bo'sh kodi yo'q tarif narxsiz turardi ("Yo'q /
//      hozircha") — "bronzalar ham ishlamayaptiku, hammasini o'zini
//      narxi yozilsin". Narx endi `/api/pricing` dan, kodlarga bog'liq
//      emas.
//   2. Do'kondagi kod qidiruvi bazada YO'Q kodni (III777) "Bunday kod
//      topilmadi" derdi — holbuki aynan shunday kod sotib olinadi.
//      Endi to'liq kod uchun `/api/records/:code/quote` so'raladi.
//   3. Qidiruv ekranida so'rov yozilganda tur/toifa chiplari umuman
//      ishlamasdi va biznes turidagi karta "Odamlar" ostida chiqardi.
//   4. Jismoniy karta buyurtmasida "Manzil" va "Aloqa raqami" ga
//      bosib bo'lmasdi: `TextField` faqat matn qatorini egallaydi,
//      qutining qolgan qismi bosilganda hech narsa bo'lmasdi; ustiga
//      klaviatura ochilganda pastki maydonlar uning ostida qolardi.
//
// Har biri uchun bittadan tekshiruv — xato qaytib kelsa shu yerda
// yiqiladi.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/data/models.dart';
import 'package:nfcstore/design/components/input.dart';
import 'package:nfcstore/design/tokens.dart';
import 'package:nfcstore/design/type.dart';
import 'package:nfcstore/l10n/strings.dart';
import 'package:nfcstore/screens/discover/discover.dart';
import 'package:nfcstore/screens/nfc/code_search.dart';
import 'package:nfcstore/screens/nfc/id_catalog.dart';
import 'package:nfcstore/screens/nfc/order_card.dart';
import 'package:nfcstore/screens/shop/shop.dart';

import 'audit/harness.dart';
import 'settle.dart';

void main() {
  setUpAll(loadAuditFonts);

  // ── 1) NARX HAR TARIFDA ─────────────────────────────────────
  //
  // Soxta katalogda faqat Gold (GLD100) va Bronza (KTB482) bo'sh
  // kodlari bor. Silver, Premium va Ekslyuziv uchun bo'sh kod YO'Q —
  // ilgari ular "Yo'q" bo'lib turardi.
  testWidgets('ID katalogi: bo‘sh kodi yo‘q tarifning ham narxi bor',
      (t) async {
    final s = auditState();
    await s.boot();
    await pumpScreen(t, const IdCatalogScreen(), state: s);
    await settle(t);

    expect(find.text(tr('Yo‘q')), findsNothing,
        reason: 'narx o‘rnida "Yo‘q" qolmasligi kerak');
    for (final price in [49000, 99000, 149000, 199000, 490000]) {
      expect(find.text(som(price)), findsWidgets,
          reason: '$price so‘m ko‘rinishi kerak');
    }
    // Bo'sh kod yo'qligi narxning o'rnida emas, alohida izohda.
    expect(find.text(tr('Bo‘sh kod hozircha yo‘q — kod yozib ko‘ring')),
        findsNWidgets(3));
  });

  testWidgets('do‘kon: beshala tarifda "…dan" narxi', (t) async {
    final s = auditState();
    await s.boot();
    await pumpScreen(t, const ShopScreen(), state: s);
    await settle(t);

    expect(find.text(tr('Katalogda')), findsNothing,
        reason: 'narx kelgan — "Katalogda" zaxira yozuvi chiqmasin');
    // Gorizontal ro'yxat faqat ko'ringan kartalarni quradi — shuning
    // uchun birinchi (Bronza) karta aniq tekshiriladi: soxta katalogda
    // Bronza bo'sh kodi bor-yo'qligidan qat'i nazar narx serverdan.
    expect(find.text(trf('{p} dan', {'p': som(49000)})), findsOneWidget);
    expect(find.text(trf('{p} dan', {'p': som(99000)})), findsOneWidget,
        reason: 'Silver uchun bo‘sh kod yo‘q, narx baribir bor');
  });

  // ── 2) BAZADA YO'Q KOD ──────────────────────────────────────
  test('to‘liq kod shakli: AAA000 yoki faqat harflar', () {
    expect(CodeSearch.isFullCode('iii777'), isTrue);
    expect(CodeSearch.isFullCode('III 777'), isTrue);
    expect(CodeSearch.isFullCode('VIP'), isTrue);
    expect(CodeSearch.isFullCode('BOSS'), isTrue);
    // Yarim yozilgan yoki boshqa shakl — baho so'ralmaydi.
    expect(CodeSearch.isFullCode('II'), isFalse);
    expect(CodeSearch.isFullCode('III77'), isFalse);
    expect(CodeSearch.isFullCode('12345678'), isFalse);
    expect(CodeSearch.normalizeCode(' iii-777 '), 'III777');
  });

  test('CodeQuote -> Record: bo‘sh kod narxi bilan, band kod narxsiz', () {
    final free = CodeQuote.fromJson({
      'code': 'iii777', 'exists': false, 'available': true,
      'tier': 'exclusive', 'price': 2990000,
    }).toRecord();
    expect(free.code, 'III777');
    expect(free.price, 2990000);
    expect(free.tier, Tier.exclusive);

    final taken = CodeQuote.fromJson({
      'code': 'VIP001', 'exists': true, 'available': false,
      'tier': 'exclusive', 'price': 0,
    }).toRecord();
    expect(taken.price, 0, reason: 'band kod sotuvda emas');

    // Oddiy AAA000 kod — server "bronze" deydi va u Bronza bo'lib
    // o'qiladi (ilgari "free" -> "Bepul" bo'lib chalkashardi).
    final bronze = CodeQuote.fromJson({
      'code': 'BQX417', 'exists': false, 'available': true,
      'tier': 'bronze', 'price': 49000,
    }).toRecord();
    expect(bronze.tier, Tier.bronze);
  });

  testWidgets('do‘kon: bazada yo‘q kod baholanadi, "topilmadi" emas',
      (t) async {
    final s = auditState();
    await s.boot();
    await pumpScreen(t, const ShopScreen(), state: s);
    await settle(t);

    // Soxta `/api/records/search` bu kodni qaytarmaydi; `/quote` esa
    // "bo'sh, gold, 149 000" deydi.
    await t.enterText(find.byType(TextField), 'QQQ999');
    await settle(t);

    expect(find.text(tr('Bunday kod topilmadi')), findsNothing);
    // Matn maydonidagi yozuvdan tashqari — natija qatorida ham.
    expect(
      find.descendant(of: find.byType(CodeRow), matching: find.text('QQQ999')),
      findsOneWidget,
    );
    expect(find.text(som(149000)), findsWidgets);
  });

  // ── 3) QIDIRUVDA SUZGICHLAR ─────────────────────────────────
  testWidgets('qidiruv: so‘rov bor holatda "Biznes" chipi ishlaydi',
      (t) async {
    final s = auditState();
    await s.boot();
    await pumpScreen(t, const DiscoverScreen(), state: s);
    await settle(t);

    await t.enterText(find.byType(TextField), 'muhammad');
    await settle(t);
    expect(find.text('VIP001'), findsOneWidget);
    expect(find.text(tr('Shaxsiy profillar')), findsOneWidget);
    // Eski "Odamlar" sarlavhasi yo'q — ko'rib chiqish bilan bir xil nom.
    expect(find.text(tr('Odamlar')), findsNothing);

    await t.tap(find.text(tr('Biznes')));
    await settle(t);
    expect(find.text('VIP001'), findsNothing,
        reason: '"Biznes" tanlanganda shaxsiy profil chiqmasin');

    await t.tap(find.text(tr('Hammasi')));
    await settle(t);
    expect(find.text('VIP001'), findsOneWidget);
  });

  // ── 4) MAYDON QUTISI BUTUNLAY BOSILADI ──────────────────────
  testWidgets('Field: qutining bo‘sh joyi bosilsa fokus beradi', (t) async {
    final one = TextEditingController();
    final many = TextEditingController();
    await t.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: 320,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Field(label: 'Shahar', controller: one, hint: 'Toshkent'),
                const SizedBox(height: 16),
                Field(label: 'Manzil', controller: many, maxLines: 2),
              ],
            ),
          ),
        ),
      ),
    ));
    await t.pump();

    final boxes = find.byType(AnimatedContainer);
    expect(boxes, findsNWidgets(2));

    // Bir qatorli: qutining pastki-o'ng burchagi (matn qatoridan tashqari).
    final r1 = t.getRect(boxes.at(0));
    await t.tapAt(r1.bottomRight - const Offset(10, 6));
    await t.pump();
    final fields = find.byType(TextField);
    expect(t.widget<TextField>(fields.at(0)).focusNode!.hasFocus, isTrue,
        reason: 'bir qatorli maydon: chekka bosilganda fokus');

    // Ko'p qatorli: qutining pastki yarmi — matn faqat tepada turadi.
    final r2 = t.getRect(boxes.at(1));
    await t.tapAt(Offset(r2.center.dx, r2.bottom - 10));
    await t.pump();
    expect(t.widget<TextField>(fields.at(1)).focusNode!.hasFocus, isTrue,
        reason: 'ko‘p qatorli maydon: pastki qismi bosilganda fokus');
    expect(t.widget<TextField>(fields.at(0)).focusNode!.hasFocus, isFalse);
  });

  testWidgets('buyurtma formasi klaviatura ustiga ko‘tariladi', (t) async {
    final s = auditState();
    await s.boot();
    await pumpScreen(
      t,
      OrderCardScreen(record: Record(code: 'VIP001', name: 'Muhammad')),
      state: s,
    );
    await settle(t);

    final before = t.getRect(find.text(tr('Buyurtma berish')));

    // Klaviatura 300 mantiqiy piksel (dpr 3 -> 900 fizik).
    t.view.viewInsets = const FakeViewPadding(bottom: 900);
    addTearDown(t.view.resetViewInsets);
    await t.pump();
    await t.pump(const Duration(milliseconds: 300));

    final after = t.getRect(find.text(tr('Buyurtma berish')));
    expect(after.bottom, lessThanOrEqualTo(auditSize.height - 300 + 1),
        reason: 'tugma klaviatura ostida qolmasin');
    expect(after.bottom, lessThan(before.bottom));
  });
}
