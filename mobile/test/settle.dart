import 'package:flutter_test/flutter_test.dart';

/// KADRNI QO'LDA SURISH — `pumpAndSettle` O'RNIGA.
///
/// NIMA UCHUN KERAK: dizaynda ATAYLAB to'xtamaydigan animatsiyalar
/// bor:
///
/// • `LightSweep` — oltin yuzadan har 4.2 sekundda o'tadigan
///   yorug'lik chizig'i (metall taassuroti shundan);
/// • `StoryRing` — 9 sekundda bir marta aylanadigan halqa;
/// • `Skeleton` — yuklanish paytidagi yaltirash.
///
/// `pumpAndSettle` "boshqa kadr so'ralmaydigan holat" ni kutadi.
/// Yuqoridagi elementlardan bittasi ekranda bo'lsa, bunday holat
/// HECH QACHON kelmaydi va test 10 daqiqadan keyin "pumpAndSettle
/// timed out" bilan yiqiladi — kod to'g'ri bo'lsa ham.
///
/// Shuning uchun vaqt belgilangan qadamlar bilan suriladi: bu
/// o'tishlar (280ms), soxta tarmoq javoblari va kechiktirilgan
/// ishlar tugashi uchun yetarli, ammo cheksiz animatsiyaga
/// bog'lanib qolmaydi.
///
/// TESTDA `pumpAndSettle` ISHLATMANG — shu funksiyani chaqiring.
Future<void> settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(seconds: 2));
}
