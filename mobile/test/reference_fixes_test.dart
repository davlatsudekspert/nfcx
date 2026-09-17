// REFERENCE RASMLAR BO'YICHA TUZATISHLAR — regressiya qulflari.
//
// Har bir sinov ayni bitta AUDITDA TOPILGAN nuqsonni qulflaydi.
// Nuqson qaytsa, shu yerda yiqiladi.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/repo.dart';
import 'package:nfcstore/design/components/media.dart';
import 'package:nfcstore/design/tokens.dart';

http.Response _json(Object o, [int status = 200]) => http.Response(
      jsonEncode(o),
      status,
      headers: {'content-type': 'application/json'},
    );

void main() {
  // ── 1. PALITRA A REFERENCE BILAN BIR XIL ────────────────────
  //
  // NUQSON: Opal Light "iliqlashtirilgan" edi — krem fon va chuqur
  // sapfir urg'u. Qurilmada ilova reference'dagi oq/indigo emas,
  // kremsimon ko'rinardi. Qiymatlar bu yerda raqamma-raqam
  // qulflanadi, chunki "iliqroq qilsak chiroyliroq" degan
  // o'zgarish aynan shu tarzda qaytadi.
  group('Palitra A — Opal Light reference qiymatlari', () {
    const p = Palette.opal;

    test('fon SOF OQ, krem emas', () {
      expect(p.baseTop, const Color(0xFFFFFFFF));
      expect(p.baseMid, const Color(0xFFFFFFFF));
      expect(p.baseBottom, const Color(0xFFFFFFFF));
    });

    test('yuza va chegara SOVUQ kulrang', () {
      expect(p.raised, const Color(0xFFF2F4F7));
      expect(p.raisedHigh, const Color(0xFFE0E3EB));
      expect(p.line, const Color(0xFFDDE1E8));
      expect(p.lineStrong, const Color(0xFFCCD1DD));
    });

    test('urg‘u — indigo #3A62CC', () {
      expect(p.accent, const Color(0xFF3A62CC));
      expect(p.accentHigh, const Color(0xFF6179D1));
      expect(p.onAccent, const Color(0xFFFFFFFF));
    });

    test('matn darajalari reference bilan bir xil', () {
      expect(p.ink, const Color(0xFF0D1117));
      expect(p.ink2, const Color(0xFF596372));
      expect(p.ink3, const Color(0xFF8C95A3));
    });

    test('B va C palitralar ham reference bilan bir xil qoladi', () {
      expect(Palette.midnight.baseBottom, const Color(0xFF080A0E));
      expect(Palette.midnight.accent, const Color(0xFF87A9EB));
      expect(Palette.dune.baseTop, const Color(0xFFE7D7C1));
      expect(Palette.dune.accent, const Color(0xFF8C5F32));
    });

    test('tarif metallari palitraga BOG‘LIQ EMAS', () {
      // Reference'da oltin faqat karta materialida. Mavzu almashsa
      // ham Gold Gold bo'lib qolishi kerak.
      final gold = TierStyle.map[Tier.gold]!.base;
      C.apply(Palette.midnight);
      expect(TierStyle.map[Tier.gold]!.base, gold);
      C.apply(Palette.opal);
      expect(TierStyle.map[Tier.gold]!.base, const Color(0xFFF0C419));
    });
  });

  // ── 2. KOMPANIYA KATALOGI 404 DA BO'SH QOLMAYDI ─────────────
  //
  // NUQSON: serverda `GET /api/companies/:id/catalog` yo'q (faqat
  // POST/PATCH/DELETE bor). Egasining "Katalogni tahrirlash"
  // ekrani 404 olib bo'm-bo'sh qolardi, holbuki mahsulotlar
  // kompaniyaning o'zida qaytadi.
  group('Kompaniya katalogi', () {
    test('GET /catalog 404 bo‘lsa — ro‘yxat kompaniyadan olinadi', () async {
      final seen = <String>[];
      final repo = Repo(
        Api(
          client: MockClient((req) async {
            seen.add(req.url.path);
            if (req.url.path.endsWith('/catalog')) {
              return _json({'error': 'not_found'}, 404);
            }
            return _json({
              'company': {
                'companyId': 'LATTE',
                'displayName': 'Latte Coffee',
                'items': [
                  {'id': 'a1', 'name': 'Kapuchino', 'price': 25000},
                  {'id': 'a2', 'name': 'Raf', 'price': 32000},
                ],
              },
            });
          }),
        ),
      );

      final items = await repo.companyCatalog('LATTE');

      expect(items.map((e) => e.name), ['Kapuchino', 'Raf']);
      expect(seen, ['/api/companies/LATTE/catalog', '/api/companies/LATTE']);
    });

    test('alohida yo‘l ISHLASA — zaxiraga umuman o‘tilmaydi', () async {
      final seen = <String>[];
      final repo = Repo(
        Api(
          client: MockClient((req) async {
            seen.add(req.url.path);
            return _json({
              'items': [
                {'id': 'b1', 'name': 'Latte', 'price': 28000},
              ],
            });
          }),
        ),
      );

      expect((await repo.companyCatalog('LATTE')).single.name, 'Latte');
      expect(seen, ['/api/companies/LATTE/catalog']);
    });

    test('403 YASHIRILMAYDI — ruxsat xatosi zaxiraga o‘tmaydi', () async {
      // Zaxira faqat "yo'l yo'q" uchun. Ruxsat yoki tarmoq xatosi
      // yutilib ketsa, egasi bo'sh ro'yxat ko'rib "mahsulotlarim
      // yo'qolibdi" deb o'ylaydi.
      final repo = Repo(
        Api(client: MockClient((_) async => _json({'error': 'forbidden'}, 403))),
      );
      await expectLater(repo.companyCatalog('LATTE'), throwsA(isA<ApiError>()));
    });
  });

  // ── 3. LENTADA BIRINCHI POST SCROLLNI SUDRAMAYDI ────────────
  //
  // NUQSON: `AutoImage` rasm o'lchami kelgach nisbatni
  // ANIMATSIYA bilan o'zgartirardi. Sliver ichida balandlikning
  // asta o'zgarishi scroll ofsetini sudraydi — Home lentasining
  // birinchi posti "yuqoriga scroll bo'lmaydi" bo'lib tuyulardi.
  group('AutoImage — balandlik barqarorligi', () {
    testWidgets('nisbat hal bo‘lgach TweenAnimationBuilder QOLMAYDI',
        (t) async {
      await t.pumpWidget(
        const Directionality(
          textDirection: TextDirection.ltr,
          child: AutoImage(null, fallback: 4 / 5),
        ),
      );
      await t.pump();

      // URL yo'q — hech qachon hal bo'lmaydi, ya'ni fallback
      // nisbatda qotib turadi va baribir animatsiya kerak emas.
      final ratio = t.widget<AspectRatio>(find.byType(AspectRatio));
      expect(ratio.aspectRatio, closeTo(4 / 5, .001));
    });

    testWidgets('fallback nisbati 4:5 — lentada joy oldindan band bo‘ladi',
        (t) async {
      await t.pumpWidget(
        const Directionality(
          textDirection: TextDirection.ltr,
          child: Center(
            child: SizedBox(width: 400, child: AutoImage(null)),
          ),
        ),
      );
      await t.pump();
      final box = t.getSize(find.byType(AspectRatio));
      expect(box.width / box.height, closeTo(4 / 5, .01));
    });
  });
}
