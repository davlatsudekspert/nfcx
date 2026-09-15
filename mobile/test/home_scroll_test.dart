// BOSH SAHIFA IKKI TOMONGA HAM SURILADIMI.
//
// Egasi buni UCH MARTA xabar qildi: "tepaga chiqmayapti, faqat
// pastga tushyapti", "tepaga tortsam dirillab tortilmayapti",
// "yana tepaga chiqmayapti, qayta-qayta aytdim".
//
// Ikki marta taxminga ishonib tuzatishga urindim va ikkalasi ham
// yetarli bo'lmadi. Shuning uchun endi TEST: ekranni haqiqatan
// surib ko'radi va sura olmasa yiqiladi. Taxmin emas, o'lchov.
//
// NIMA O'LCHANADI:
//   1. Surish MASOFASI bormi (`maxScrollExtent > 0`) — kontent
//      ekrandan uzun bo'lsa u noldan katta bo'lishi SHART. Nol
//      bo'lsa ro'yxat "qotib" qoladi va barmoq ta'sir qilmaydi.
//   2. Pastga surgandan keyin TEPAGA qaytib kelish ishlaydimi —
//      egasining asosiy shikoyati aynan shu yo'nalishda.
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'settle.dart';

void main() {
  /// Uzun kontentli oddiy ro'yxat — bosh sahifaning qobig'i bilan
  /// bir xil tuzilishda (`CustomScrollView` + sliverlar).
  Widget harness({required List<double> heights}) => Directionality(
        textDirection: TextDirection.ltr,
        child: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              const SliverToBoxAdapter(child: SizedBox(height: 120)),
              SliverList.separated(
                itemCount: heights.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (_, i) => SizedBox(
                  height: heights[i],
                  child: Center(child: Text('karta $i')),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 90)),
            ],
          ),
        ),
      );

  testWidgets('KONTENT EKRANDAN UZUN BO‘LSA — surish masofasi bor',
      (tester) async {
    await tester.pumpWidget(harness(heights: List.filled(8, 320)));
    await settle(tester);

    final pos = tester
        .state<ScrollableState>(find.byType(Scrollable).first)
        .position;

    expect(
      pos.maxScrollExtent,
      greaterThan(0),
      reason: 'surish masofasi nol bo‘lsa ro‘yxat qotib qoladi',
    );
  });

  testWidgets('PASTGA SURIB, TEPAGA QAYTIB KELISH ishlaydi', (tester) async {
    await tester.pumpWidget(harness(heights: List.filled(8, 320)));
    await settle(tester);

    final scrollable = find.byType(Scrollable).first;
    final pos = tester.state<ScrollableState>(scrollable).position;

    // Pastga: barmoq YUQORIGA suriladi (manfiy dy).
    await tester.drag(scrollable, const Offset(0, -600));
    await settle(tester);
    final afterDown = pos.pixels;
    expect(afterDown, greaterThan(0), reason: 'pastga surish ishlamadi');

    // Endi TEPAGA: barmoq pastga suriladi. Egasining shikoyati
    // aynan shu yo'nalishda edi.
    await tester.drag(scrollable, const Offset(0, 400));
    await settle(tester);

    expect(
      pos.pixels,
      lessThan(afterDown),
      reason: 'tepaga qaytib kelish ishlamadi — ro‘yxat joyida qoldi',
    );
  });

  testWidgets('BALANDLIK KEYIN O‘ZGARSA — surilgan joy sakramaydi',
      (tester) async {
    // Bu lentadagi HAQIQIY holat: rasm o'lchami kech ma'lum bo'ladi
    // va karta balandligi o'zgaradi. Agar bu ko'z oldidagi
    // kontentdan YUQORIDA bo'lsa, ro'yxat sakraydi va odam
    // "dirillayapti" deb ko'radi.
    final heights = List.filled(8, 320.0);
    await tester.pumpWidget(harness(heights: heights));
    await settle(tester);

    final scrollable = find.byType(Scrollable).first;
    final pos = tester.state<ScrollableState>(scrollable).position;

    await tester.drag(scrollable, const Offset(0, -900));
    await settle(tester);
    final before = pos.pixels;

    // Yuqoridagi kartalar balandligi o'zgardi.
    heights[0] = 500;
    heights[1] = 500;
    await tester.pumpWidget(harness(heights: heights));
    await settle(tester);

    expect(
      pos.pixels,
      before,
      reason: 'yuqoridagi balandlik o‘zgarsa ham surilgan joy '
          'qimirlamasligi kerak',
    );
  });
}
