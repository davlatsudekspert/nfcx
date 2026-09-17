// BIZNES PROFILLAR PROFIL TABIDA KO'RINSIN.
//
// EGASINING SHIKOYATI: "accountimdagi business profillar
// ko'rinmayapti".
//
// PRODUCTIONDA O'LCHANDI (CI, haqiqiy hisob bilan):
//   /api/companies/mine → HTTP 200, 3 ta kompaniya, hammasi active
//   /api/me            → 8 ta karta
// Ya'ni SERVER JOYIDA. Muammo ilovada edi: Profil tabidagi karusel
// FAQAT `state.cards` — shaxsiy kartalarni chizardi. Kompaniyalar
// esa faqat menyu ostidagi varaqada bor edi va uni topish kerak
// edi. Endi ikkalasi bitta qatorda.
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/screens/identity/profile_tab.dart';
import 'package:nfcstore/state/app_state.dart';

import 'audit/harness.dart';
import 'settle.dart';
import 'widget_test.dart' show FakeStore;

/// Egasining hisobining SHAKLI: sakkizta shaxsiy karta va uchta
/// faol kompaniya. Qiymatlar productiondan olingan (nomlar ochiq
/// ma'lumot — kompaniya profillari saytda ham ko'rinadi).
AppState realAccount() => AppState(
      api: Api(
        client: MockClient((req) async {
          final p = req.url.path;
          Object body;
          if (p == '/api/auth/me') {
            body = {
              'user': {'id': 1, 'email': 'egasi@nfcstore.uz', 'isPremium': true},
              'cards': [
                for (var i = 1; i <= 8; i++)
                  {
                    'code': 'CRD00$i',
                    'name': 'Karta $i',
                    'isPrimary': i == 1,
                    'price': 149000,
                  },
              ],
            };
          } else if (p == '/api/companies/mine') {
            body = {
              'companies': [
                {'companyId': 'NFCSTOREUZ', 'displayName': 'NFCSTORE', 'status': 'active'},
                {'companyId': 'ALI', 'displayName': 'Ali Market', 'status': 'active'},
                {'companyId': 'NFC', 'displayName': 'NFCStore Mobile', 'status': 'active'},
              ],
            };
          } else {
            body = const <String, Object?>{};
          }
          return http.Response(
            jsonEncode(body),
            200,
            headers: const {'content-type': 'application/json'},
          );
        }),
      ),
      storage: FakeStore({'nfc_session_token': 'sinov'}),
    );

void main() {
  setUpAll(loadAuditFonts);
  setUp(mockImageCacheDir);

  testWidgets('holatga UCHALA kompaniya ham yuklanadi', (t) async {
    final s = realAccount();
    await s.boot();
    expect(s.cards.length, 8);
    expect(s.companies.map((c) => c.id), ['NFCSTOREUZ', 'ALI', 'NFC']);
  });

  testWidgets('PROFIL TABIDAGI KARUSELDA biznes profillar ham bor', (t) async {
    final s = realAccount();
    await s.boot();
    await pumpScreen(t, const ProfileTab(), state: s);
    await settle(t);

    // Karusel — DANGASA yotiq ro'yxat: hamma karta birdan
    // qurilmaydi. `scrollUntilVisible` uni kompaniya kartasi
    // ko'ringuncha suradi. Topilmasa — sinov yiqiladi, ya'ni
    // kompaniya ro'yxatga umuman qo'shilmagan.
    final rowFinder = find.byType(Scrollable);
    await t.scrollUntilVisible(
      find.text('NFCSTOREUZ'),
      320,
      scrollable: rowFinder.at(1),
      maxScrolls: 30,
    );
    await settle(t);

    expect(find.text('NFCSTOREUZ'), findsWidgets,
        reason: 'biznes profil karuselda ko‘rinishi kerak — '
            'serverda u bor, ilova uni yashirmasligi kerak');
  });

  testWidgets('biznes shaxsga almashish ishlaydi', (t) async {
    final s = realAccount();
    await s.boot();
    expect(s.active!.isBusiness, isFalse);

    // Karusel aynan shu chaqiruvni qiladi.
    s.switchIdentity(Identity.business(s.companies.first));

    expect(s.active!.isBusiness, isTrue);
    expect(s.active!.code, 'NFCSTOREUZ');
    expect(s.active!.name, 'NFCSTORE');
  });

  testWidgets('TANLOV qurilmada saqlanadi — qayta ochilganda qoladi',
      (t) async {
    // Ilgari faol shaxs faqat xotirada turardi: ilova qayta
    // ochilganda asosiy kartaga qaytardi va odam biznes profilini
    // har safar qaytadan tanlashga majbur edi.
    final store = FakeStore({'nfc_session_token': 'sinov'});

    final first = realAccount();
    // Bir xil xotira ikkala "ishga tushish" uchun.
    final s1 = AppState(api: first.api, storage: store);
    await s1.boot();
    s1.switchIdentity(Identity.business(s1.companies.first));
    expect(s1.active!.code, 'NFCSTOREUZ');
    // Yozish asinxron — keyingi kadrda tugaydi.
    await t.pump(const Duration(milliseconds: 50));

    final s2 = AppState(api: realAccount().api, storage: store);
    await s2.boot();
    expect(s2.active!.code, 'NFCSTOREUZ',
        reason: 'qayta ochilganda tanlangan shaxs qolishi kerak');
    expect(s2.active!.isBusiness, isTrue);
  });

  testWidgets('PROFIL SARLAVHASIDA tahrirlash tugmasi bor', (t) async {
    final s = realAccount();
    await s.boot();
    await pumpScreen(t, const ProfileTab(), state: s);
    await settle(t);
    expect(find.text('Profilni tahrirlash'), findsOneWidget);
  });
}
