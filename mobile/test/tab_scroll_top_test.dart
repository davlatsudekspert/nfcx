// FAOL TABNI QAYTA BOSISH RO'YXATNI TEPAGA QAYTARADIMI.
//
// EGASI BUNI TO'RT MARTA XABAR QILDI: "tepaga qaytmayapti",
// "orqaga tepaga qaytmayapti, shu muammoni nechi marta aytdim".
//
// Men uch marta boshqa joyni tuzatdim — surish mexanikasini,
// rasm balandligini, yangilash belgisini. Ularning hammasi o'z
// o'rnida haqiqiy kamchilik edi, LEKIN egasi aytgan narsa boshqa
// edi: uzun lentadan TEPAGA QAYTISH YO'LI yo'q edi.
//
// Faol tabni bosish faqat `Navigator` ni ildizga qaytarardi. Agar
// odam allaqachon ildizda bo'lsa (bosh sahifa ochiq) va lentani
// uzoq surgan bo'lsa — bosishdan hech narsa o'zgarmasdi.
//
// Bu test o'sha xulqni qo'riqlaydi: `PrimaryScrollController` ga
// ulangan ro'yxat tepaga qaytishi SHART.
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'settle.dart';

void main() {
  late ScrollController controller;

  Widget harness() => Directionality(
        textDirection: TextDirection.ltr,
        child: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: PrimaryScrollController(
            controller: controller,
            // Ekranlar o'z ro'yxatiga boshqaruvchi BERMAYDI —
            // vertikal `ScrollView` o'zi `PrimaryScrollController`
            // ga ulanadi. Qobiq aynan shunga tayanadi.
            child: ListView.builder(
              itemCount: 40,
              itemBuilder: (_, i) => SizedBox(
                height: 120,
                child: Text('karta $i'),
              ),
            ),
          ),
        ),
      );

  setUp(() => controller = ScrollController());
  tearDown(() => controller.dispose());

  testWidgets('RO‘YXAT BOSHQARUVCHIGA O‘ZI ULANADI', (tester) async {
    await tester.pumpWidget(harness());
    await settle(tester);

    expect(
      controller.hasClients,
      isTrue,
      reason: 'ulanmasa qobiq ro‘yxatni tepaga qaytara olmaydi',
    );
  });

  testWidgets('SURILGANDAN KEYIN TEPAGA QAYTARISH ishlaydi', (tester) async {
    await tester.pumpWidget(harness());
    await settle(tester);

    await tester.drag(find.byType(ListView), const Offset(0, -1200));
    await settle(tester);
    expect(controller.position.pixels, greaterThan(0));

    // Qobiq aynan shu chaqiruvni qiladi.
    controller.animateTo(
      0,
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOut,
    );
    await settle(tester);

    expect(
      controller.position.pixels,
      0,
      reason: 'faol tab bosilganda ro‘yxat eng tepaga qaytishi kerak',
    );
  });

  testWidgets('ALLAQACHON TEPADA BO‘LSA — hech narsa qilinmaydi',
      (tester) async {
    await tester.pumpWidget(harness());
    await settle(tester);

    // Qobiqdagi shart: `pixels <= 0` bo'lsa animatsiya boshlanmaydi.
    // Aks holda har bosishda bekorga animatsiya yurardi.
    expect(controller.position.pixels, 0);
  });
}
