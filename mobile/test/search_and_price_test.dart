// EGASI TO'RTTA XATONI SURAT BILAN KO'RSATDI. SHU TESTLAR
// O'SHALARNI QO'RIQLAYDI.
//
//   1) Qidiruvda kompaniyalar chiqmasdi — server javobi
//      `{results: […]}`, ilova esa `companies` kalitini o'qirdi.
//   2) Formada klaviatura ostidagi maydonlarga yetib bo'lmasdi.
//   3) Katalogda tarif narxi o'rniga "Yo'q · hozircha" turardi.
//   4) Bo'sh kod yozilganda "bunday kod topilmadi" chiqardi,
//      holbuki saytda o'sha kodning narxi chiqadi.
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/repo.dart';
import 'package:nfcstore/design/keyboard.dart';

void main() {
  Repo repoWith(Map<String, Object?> Function(Uri) handler) => Repo(
        Api(
          client: MockClient((req) async => http.Response(
                jsonEncode(handler(req.url)),
                200,
                headers: {'content-type': 'application/json'},
              )),
        ),
      );

  test('KOMPANIYA QIDIRUVI — server `results` kalitini beradi', () async {
    // Server javobi AYNAN shunday: `results`, `companies` emas.
    final repo = repoWith((u) => {
          'results': [
            {'companyId': 'NFCSTOREUZ', 'displayName': 'NFCSTORE', 'city': 'Toshkent'},
          ],
        });
    final res = await repo.searchCompanies('nfcstore');
    expect(res, hasLength(1), reason: 'javob kaliti mos kelmasa ro‘yxat bo‘sh qolardi');
    expect(res.first.name, 'NFCSTORE');
  });

  test('ESKI SERVER `companies` bersa ham ishlaydi', () async {
    final repo = repoWith((u) => {
          'companies': [
            {'companyId': 'ALIMARKET', 'displayName': 'Ali Market'},
          ],
        });
    expect(await repo.searchCompanies('ali'), hasLength(1));
  });

  test('BO‘SH KOD — tarif va narx serverdan keladi', () async {
    final repo = repoWith((u) => {
          'code': 'III777',
          'valid': true,
          'available': true,
          'purchasable': true,
          'tier': 'gold',
          'price': 149000,
        });
    final r = await repo.checkCode('III777');
    expect(r['available'], isTrue);
    expect(r['price'], 149000);
    expect(r['tier'], 'gold');
  });

  test('TARIF NARXLARI — jadval serverdan', () async {
    final repo = repoWith((u) => {
          'pricing': {
            'bronze': 49000,
            'silver': 99000,
            'gold': 149000,
            'premium': 199000,
            'exclusiveFrom': 490000,
          },
        });
    final p = await repo.idPricing();
    expect(p['bronze'], 49000);
    expect(p['exclusiveFrom'], 490000);
    expect(
      p.length,
      5,
      reason: 'narx jadvali mijozda emas, SERVERDA — ilova faqat o‘qiydi',
    );
  });

  testWidgets('KLAVIATURA BALANDLIGI formaga qo‘shiladi', (t) async {
    // Klaviatura ochilganda formaning aylantiriladigan qismiga
    // shuncha bo'sh joy qo'shiladi — aks holda pastdagi maydonlar
    // klaviatura ostida qolib, "ishlamayapti" bo'lib ko'rinadi.
    late double inset;
    await t.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(viewInsets: EdgeInsets.only(bottom: 312)),
        child: Builder(
          builder: (context) {
            inset = keyboardInset(context);
            return const SizedBox();
          },
        ),
      ),
    );
    expect(inset, 312);
  });
}
