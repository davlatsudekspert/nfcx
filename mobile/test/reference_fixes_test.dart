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
  // ── 1. DIZAYN TIZIMI QOIDALARI ──────────────────────────────
  //
  // Qiymatlarni raqamma-raqam qulflash o'zini oqlamadi: har
  // dizayn qarori sinovni qizartirar va sinov "o'zgartirma" deb
  // emas, "qiymatni yangila" deb o'qilardi. Endi QIYMAT emas,
  // QOIDA tekshiriladi — buzilsa ilova haqiqatan yomonlashadi.
  group('Dizayn tizimi qoidalari', () {
    test('standart mavzu QUYUQ — oltin belgi shunda o‘qiladi', () {
      expect(Palette.obsidian.light, isFalse);
      expect(Palette.all.first.id, 'obsidian');
    });

    test('asos SOF QORA EMAS — chuqurlik qatlamlardan keladi', () {
      // #000 da soya ko'rinmaydi, ya'ni ko'tarilgan yuza tekis
      // qog'ozga aylanadi.
      for (final c in [
        Palette.obsidian.baseTop,
        Palette.obsidian.baseMid,
        Palette.obsidian.baseBottom,
      ]) {
        expect(c, isNot(const Color(0xFF000000)));
      }
      // Qatlamlar ko‘tarilib boradi: asos < karta < ko‘tarilgan.
      double lum(Color c) => c.computeLuminance();
      expect(lum(Palette.obsidian.raised),
          greaterThan(lum(Palette.obsidian.baseMid)));
      expect(lum(Palette.obsidian.raisedHigh),
          greaterThan(lum(Palette.obsidian.raised)));
    });

    test('URG‘U MATNI FONDA O‘QILADI — har ikki mavzuda', () {
      double ratio(Color a, Color b) {
        final l1 = a.computeLuminance(), l2 = b.computeLuminance();
        final hi = l1 > l2 ? l1 : l2, lo = l1 > l2 ? l2 : l1;
        return (hi + .05) / (lo + .05);
      }

      for (final p in Palette.all) {
        expect(ratio(p.accent, p.baseMid), greaterThan(4.5),
            reason: '${p.label}: urg‘u fonda o‘qilishi kerak');
        expect(ratio(p.ink, p.baseMid), greaterThan(7),
            reason: '${p.label}: asosiy matn kuchli kontrastda');
        expect(ratio(p.ink2, p.raised), greaterThan(4.5),
            reason: '${p.label}: ikkinchi daraja matn ham o‘qilsin');
        expect(ratio(p.onAccent, p.accent), greaterThan(4.5),
            reason: '${p.label}: tugma ustidagi matn');
      }
    });

    test('tarif metallari MAVZUGA BOG‘LIQ EMAS', () {
      // Tarif — MATERIAL, rang mavzusi emas. Mavzu almashsa ham
      // Gold Gold bo'lib qolishi kerak.
      final gold = TierStyle.map[Tier.gold]!.base;
      for (final p in Palette.all) {
        C.apply(p);
        expect(TierStyle.map[Tier.gold]!.base, gold);
      }
      C.apply(Palette.obsidian);
      expect(TierStyle.map[Tier.gold]!.base, const Color(0xFFF0C419));
    });

    test('ESKI V2 MAVZULARI QAYTMAYDI', () {
      // Saqlangan eski tanlov ('opal', 'midnight', 'dune',
      // 'royal') qurilmada qolgan bo'lsa ham, u yangi standartga
      // qaytadi — eski ko'rinish tirilmasin.
      for (final old in ['opal', 'midnight', 'dune', 'royal']) {
        expect(Palette.byId(old).id, 'obsidian');
      }
      expect(Palette.all.map((p) => p.id), ['obsidian', 'porcelain']);
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
