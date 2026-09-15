// EGASINING TELEFONDAN YUBORGAN SKRINSHOTLARIDAN QOLGAN TO'RT KAMCHILIK
// (2026-09-15). Asosiy to'rt xato boshqa ishda tuzatilgan (narx
// serverdan, bo'sh kod bahosi, klaviatura, kompaniya qidiruvi); bu yerda
// o'sha ishda qolib ketganlar:
//
//   1. Qidiruv ekranida so'rov yozilganda "Hammasi/Shaxsiy/Ekspert/
//      Biznes" va soha chiplari UMUMAN ishlamasdi — server natijasi
//      suzgichsiz chizilardi; biznes turidagi karta "Odamlar" ostida
//      chiqardi.
//   2. Maydon qutisi: `TextField` faqat matn qatorini egallaydi
//      (~24 dp), quti esa 56/104 dp — qutining bo'sh qismi bosilganda
//      hech narsa bo'lmasdi.
//   3. Do'kondagi tarif kartalari narxni faqat katalogdagi bo'sh
//      koddan olardi — bo'sh kodi yo'q tarif "Katalogda" bo'lib
//      turardi, ID katalogida esa narxi bor edi.
//   4. ID katalogi egasi bor profilni ham "bo'sh kod" deb hisoblab,
//      xarid ekraniga olib borardi.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/design/components/input.dart';
import 'package:nfcstore/design/tokens.dart';
import 'package:nfcstore/design/type.dart';
import 'package:nfcstore/l10n/strings.dart';
import 'package:nfcstore/screens/discover/discover.dart';
import 'package:nfcstore/screens/nfc/id_catalog.dart';
import 'package:nfcstore/screens/shop/shop.dart';

import 'audit/harness.dart';
import 'settle.dart';

void main() {
  setUpAll(loadAuditFonts);

  // ── 1) QIDIRUVDA SUZGICHLAR ─────────────────────────────────
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

  // ── 2) MAYDON QUTISI BUTUNLAY BOSILADI ──────────────────────
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

  // ── 3) DO'KONDA NARX HAR TARIFDA ────────────────────────────
  //
  // Soxta katalogda Silver bo'sh kodi yo'q — ilgari uning kartasi
  // "Katalogda" bo'lib turardi. Endi narx `/api/settings/id-pricing`
  // dan, ID katalogi bilan bir xil manbadan.
  testWidgets('do‘kon: bo‘sh kodi yo‘q tarifning ham "…dan" narxi bor',
      (t) async {
    final s = auditState();
    await s.boot();
    await pumpScreen(t, const ShopScreen(), state: s);
    await settle(t);

    expect(find.text(tr('Katalogda')), findsNothing);
    expect(find.text(trf('{p} dan', {'p': som(49000)})), findsOneWidget);
    expect(find.text(trf('{p} dan', {'p': som(99000)})), findsOneWidget,
        reason: 'Silver uchun bo‘sh kod yo‘q, narx baribir serverdan');
  });

  // ── 4) EGASI BOR PROFIL "BO'SH KOD" EMAS ────────────────────
  //
  // Soxta katalogda EXP318 — Premium tarifli, narxi bor, lekin egasi
  // bor (ismi yozilgan) profil. U bo'sh kodlar ro'yxatiga tushmasligi
  // kerak: aks holda xarid ekraniga olib borardi.
  testWidgets('ID katalogi: egasi bor profil bo‘sh kodlar ro‘yxatida yo‘q',
      (t) async {
    final s = auditState();
    await s.boot();
    await pumpScreen(t, const IdCatalogScreen(), state: s);
    await settle(t);

    // Premium qatori ekranning pastida — avval ko'rinadigan joyga
    // suriladi, aks holda bosish kadrdan tashqariga tushadi.
    final row = find.text(TierStyle.of(Tier.premium).label).first;
    await t.ensureVisible(row);
    await settle(t);
    await t.tap(row);
    await settle(t);

    // Premium tarifida haqiqiy bo'sh kod yo'q — bo'sh holat chiqadi;
    // ilgari bu yerda EXP318 (egasi bor profil) "bo'sh kod" bo'lib
    // turardi.
    expect(find.text(tr('Tayyor ro‘yxat yo‘q')), findsOneWidget,
        reason: 'tarif kodlari ekrani ochilib, bo‘sh holat ko‘rinishi kerak');
    expect(find.text('EXP318'), findsNothing);
  });
}
