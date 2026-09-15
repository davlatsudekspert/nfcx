// PULLIK BIZNES NOMI — NARXI KO'RINADIMI VA XARID SAYTGA
// YO'NALTIRILADIMI.
//
// EGASI: "narxini ko'rsatsin qanchaligini, sotib olish uchun
// saytga kiring deb qo'y".
//
// NIMA UCHUN AYNAN SHUNDAY. Shaxsiy ID ni ilovaning o'zida Payme
// yoki Click bilan olish mumkin. Biznes NOMI uchun esa serverda
// to'lov oqimi ochilmagan: `/api/companies/:id/payment` so'rovni
// "kompaniya tarifi belgilanmagan" deb RAD ETADI. Ya'ni ilovadagi
// "Davom etish" tugmasi hisob ochardi, hisob esa "to'lov
// kutilmoqda" holatida qolib ketardi va odam nima bo'lganini
// bilmasdi.
//
// Bu test o'sha kelishuvni qo'riqlaydi: narx KO'RINADI, tugma esa
// hisob OCHMAYDI — saytga olib boradi.
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/l10n/strings.dart';
import 'package:nfcstore/screens/business/create_company.dart';

import 'audit/harness.dart';
import 'settle.dart';

void main() {
  setUpAll(loadAuditFonts);

  testWidgets('PULLIK NOM — narx va "saytda sotib olish"', (t) async {
    final s = auditState();
    await s.boot();
    await pumpScreen(t, const CreateCompanyScreen(), state: s);
    await settle(t);

    // "O'z nomim" yo'li tanlanadi va nom yoziladi.
    await t.tap(find.text(tr('O‘z nomim')));
    await settle(t);
    await t.enterText(find.byType(EditableText).first, 'NFCSTOREUZ');
    // Qidiruv kechikishi (debounce) va server javobi.
    await t.pump(const Duration(milliseconds: 600));
    await t.pump(const Duration(milliseconds: 100));
    await settle(t);
    expect(
      find.text(tr('Saytda sotib olish')),
      findsWidgets,
      reason: 'pullik nomda xarid saytga yo‘naltirilishi kerak',
    );
    expect(
      find.text(tr('Biznes ochish')),
      findsNothing,
      reason: 'ilovada to‘lab bo‘lmaydigan hisob ochilmasin',
    );
  });

  testWidgets('BEPUL ID — hisob ilovada ochiladi', (t) async {
    final s = auditState();
    await s.boot();
    await pumpScreen(t, const CreateCompanyScreen(), state: s);
    await settle(t);

    // Standart holat — bepul ID.
    expect(find.text(tr('Biznes ochish')), findsWidgets);
    expect(find.text(tr('Saytda sotib olish')), findsNothing);
  });
}
