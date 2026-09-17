// PROFIL TABI — REFERENCE 5-EKRAN ("Profil (egasi)").
//
// NIMA UCHUN GOLDEN EMAS: bu ekranda YOTIQ KARTA KARUSELI bor va
// uning boshlang'ich o'rni test tartibiga qarab bir necha piksel
// siljiydi. Golden shu sababli beqaror bo'ldi (0.11% farq —
// kartaning NFC belgisi ikki xil joyda). Beqaror kadr yolg'on
// signal beradi va vaqt o'tib "shunchaki qayta chiz" odatini
// tug'diradi.
//
// Shuning uchun bu yerda KO'RINISH emas, TARKIB qulflanadi:
// reference'dagi har bir element ekranda bormi va bosiladimi.
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/design/components/identity_card.dart';
import 'package:nfcstore/screens/identity/profile_tab.dart';
import 'package:nfcstore/state/app_state.dart';

import 'audit/fixtures.dart';
import 'audit/harness.dart';
import 'settle.dart';

void main() {
  setUpAll(loadAuditFonts);
  setUp(mockImageCacheDir);

  Future<AppState> ready() async {
    final s = auditState();
    await s.boot();
    return s;
  }

  testWidgets('reference 5-ekrandagi hamma element bor', (t) async {
    final s = await ready();
    await pumpScreen(t, const ProfileTab(), state: s);
    await settle(t);

    // Sarlavha bloki: eyebrow, ism, havola.
    expect(find.text('MENING PROFILIM'), findsOneWidget);
    // Ism sarlavhada ham, kartaning yuzida ham bor.
    expect(find.text('Muhammad Yusuf'), findsWidgets);
    expect(find.textContaining('nfcstore.uz/vip001'), findsWidgets);

    // KARTA KARUSELI — bittadan ortiq ID bo'lsa surish mumkin.
    expect(find.byType(IdentityCard), findsWidgets);
    expect(
      find.byWidgetPredicate(
        (w) => w is ScrollView && w.scrollDirection == Axis.horizontal,
      ),
      findsWidgets,
      reason: 'ID lar yotiq karusel bo‘lishi kerak',
    );

    // Ikki asosiy amal.
    expect(find.text('Story qo‘shish'), findsOneWidget);
    expect(find.text('Post qo‘shish'), findsOneWidget);

    // Statistika bloki va unga o'tish.
    expect(find.text('Statistika'), findsOneWidget);
    expect(find.text('Ko‘rish'), findsOneWidget);
    expect(find.text('Obunachi'), findsOneWidget);

    // Postlar bloki va uni boshqarish.
    expect(find.text('Postlarim'), findsOneWidget);
  });

  testWidgets('ID SIZ hisobda boshi berk emas — do‘konga yo‘l bor',
      (t) async {
    // Yangi foydalanuvchida karta yo'q. Ekran bo'sh qolsa, odam
    // nima qilishni bilmaydi — shuning uchun bu holatda ham
    // harakatga chaqiruv bo'lishi SHART.
    final s = auditState(mode: AuditMode.newUser);
    await s.boot();
    await pumpScreen(t, const ProfileTab(), state: s);
    await settle(t);

    expect(find.text('Hali profil yo‘q'), findsOneWidget);
    expect(find.text('ID katalogini ochish'), findsOneWidget);
  });
}
