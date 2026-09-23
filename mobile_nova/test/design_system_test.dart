import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';

/// BITTA DIZAYN TILI — QO'RIQCHI.
///
/// FINAL UI PASS dan keyin eski uslublar (qalin ko'k pill, to'la
/// oltin blok, qattiq yozilgan rang) jimgina qaytib kelishi oson.
/// Bu tekshiruvlar matn bo'yicha ishlaydi va bir soniyada tugaydi.
void main() {
  String read(String p) => File(p).readAsStringSync();

  /// Izohlarni olib tashlaydi — tekshiruv KOD haqida, izohda esa
  /// nima uchun shunday qilingani yozilgan.
  String codeOnly(String s) => s
      .split('\n')
      .where((l) {
        final t = l.trimLeft();
        return !t.startsWith('//') && !t.startsWith('///');
      })
      .join('\n');

  group('ranglar mavzudan keladi', () {
    test('lib/ da qattiq yozilgan rang deyarli yo‘q', () {
      // Ataylab qoldirilganlar: brend logotipi (o'z ranglari bor),
      // QR varaqasi (QR kontrasti uchun qat'iy qora kerak) va
      // `kOnAccent` (aksent sirti ustidagi siyoh — mavzu bilan
      // o'zgarmaydi, sababi `nfc_tokens.dart` da yozilgan).
      const allowed = {
        'lib/design/tokens/nfc_tokens.dart',
        'lib/design/widgets/brand_logo.dart',
        'lib/features/nfc/qr_sheet.dart',
        'lib/features/home/widgets/identity_card.dart',
        // BEGONA BREND RANGLARI — mavzudan kelmaydi va kelmasligi
        // ham kerak. Payme hamma joyda o'zining yashil-ko'kida,
        // Click esa ko'kida. Ularni NFCSTORE palitrasiga bo'yash
        // odamni chalkashtirardi: u tugmani RANGIDAN taniydi.
        // Qiymatlar saytdan olingan (`src/pages/PaymentsPage.jsx`)
        // va ikki joyda bir xil.
        'lib/features/shop/store_policy.dart',
        // NFC ID TOIFA RANGLARI — MAVZUDAN KELA OLMAYDI.
        //
        // Bronza, kumush, tilla, premium va ekslyuziv — bular
        // bezak emas, MAHSULOT DARAJASI. Ular saytda ham aynan
        // shu qiymatlarda (`src/lib/pricing.js` -> `TIER_COLOR`)
        // va ikkalasi mos kelishi SHART: bitta kod saytda oltin,
        // ilovada kulrang ko'rinsa odam qaysi biriga ishonishni
        // bilmaydi.
        //
        // Mavzu aksenti bitta rang, ya'ni undan besh darajani
        // ajratib bo'lmaydi — aynan shuning uchun ilgari hamma
        // kod bir xil ko'rinardi.
        //
        // Moslik `device_findings_test.dart` da SOLISHTIRIB
        // tekshiriladi, ya'ni bu ro'yxatga qo'shish nazoratsiz
        // qolmaydi.
        'lib/design/widgets/id_plate.dart',
      };

      final offenders = <String>[];
      for (final f in Directory('lib').listSync(recursive: true)) {
        if (f is! File || !f.path.endsWith('.dart')) continue;
        if (allowed.contains(f.path)) continue;
        if (f.path.startsWith('lib/l10n/')) continue;
        final src = codeOnly(f.readAsStringSync());
        if (RegExp(r'Color\(0xFF', caseSensitive: false).hasMatch(src)) {
          offenders.add(f.path);
        }
      }
      expect(offenders, isEmpty,
          reason: 'rang mavzudan (`context.tokens`) olinishi kerak: '
              '$offenders');
    });
  });

  group('oltin — aksent, fon emas', () {
    test('profil avatari TO‘LA oltin disk emas', () {
      final src = codeOnly(read('lib/features/home/widgets/avatar.dart'));
      // `_Initials` ichida to'g'ridan-to'g'ri `accentGradient`
      // ishlatilsa — bu to'la oltin disk demakdir.
      expect(src, isNot(contains('gradient: t.accentGradient')),
          reason: 'avatar yana to‘la oltin bo‘lib qolgan');
    });

    test('faol NFC ID kartasi TO‘LA oltin plita emas', () {
      final src =
          codeOnly(read('lib/features/home/widgets/my_ids_strip.dart'));
      expect(src, isNot(contains('t.accentGradient')),
          reason: 'faol karta yana to‘la oltin bo‘lib qolgan');
    });

    test('identity kartasi NAVY, chetida oltin', () {
      final src =
          codeOnly(read('lib/features/home/widgets/identity_card.dart'));
      // Qorong'i mavzuda yuza MAVZU YUZALARIDAN qurilishi kerak.
      // Ilgari bu yerda `surfaceSolid` USTIGA oltin tus qo'yilardi
      // va o'lchov `#1E1F1E` bergandi — ya'ni navy yo'qolib,
      // karta kulrang-jigarrang bo'lib chiqqandi.
      expect(src, contains('t.surface'),
          reason: 'karta yuzasi mavzu yuzasidan olinishi kerak');
      expect(src, contains('border: Border.all'),
          reason: 'chetida oltin chiziq bo‘lishi kerak');
      // To'la oltin gradient qaytmasin.
      expect(src, isNot(contains('colors: [tone, toneDark]')),
          reason: 'karta yana to‘la oltin gradient bo‘lgan');
    });

    test('tanlangan kapsula TUS, to‘ldirish emas', () {
      final src = codeOnly(read('lib/design/widgets/surfaces.dart'));
      // Tanlanganda fon `accent.withValues(...)` bo'lishi kerak,
      // sof `accent` emas.
      expect(src, isNot(contains('color: selected ? accent : t.surface2')),
          reason: 'chip yana to‘la aksent rangga bo‘yalgan');
      expect(src, contains('accent.withValues'),
          reason: 'tanlangan chip tusi yo‘q');
    });

    test('rejim almashtirgichi minimal segmented control', () {
      final src =
          codeOnly(read('lib/features/home/widgets/mode_switch.dart'));
      expect(src, isNot(contains('gradient: LinearGradient')),
          reason: 'almashtirgich yana to‘la gradient pill bo‘lgan');
    });
  });

  group('mavzular', () {
    test('standart — ivory, `noir` va `ocean` esa saqlangan', () {
      expect(NfcTokens.fallback.id, 'ivory');
      expect(NfcTokens.all.map((t) => t.id), contains('noir'),
          reason: '`noir` muqobil mavzu sifatida qolishi kerak');
      expect(NfcTokens.all.map((t) => t.id), contains('ocean'),
          reason: '`ocean` muqobil mavzu sifatida qolishi kerak');
    });

    test('har bir QORONG‘I mavzuda matn kontrasti yetarli', () {
      // WCAG AA katta matn uchun 3:1. Bu yerda asosiy matn
      // tekshiriladi — u ko‘p joyda kichik, shuning uchun 4.5:1.
      double lum(Color c) => c.computeLuminance();
      double ratio(Color a, Color b) {
        final hi = lum(a) > lum(b) ? lum(a) : lum(b);
        final lo = lum(a) > lum(b) ? lum(b) : lum(a);
        return (hi + 0.05) / (lo + 0.05);
      }

      for (final t in NfcTokens.all) {
        expect(ratio(t.text1, t.bg1), greaterThan(4.5),
            reason: '${t.id}: asosiy matn kontrasti past');
        expect(ratio(t.text2, t.bg1), greaterThan(3.0),
            reason: '${t.id}: ikkilamchi matn kontrasti past');
      }
    });

    test('har bir mavzuda karta fondan ajralib turadi', () {
      for (final t in NfcTokens.all) {
        final over = Color.alphaBlend(t.surface, t.bg1);
        expect((over.computeLuminance() - t.bg1.computeLuminance()).abs(),
            greaterThan(0.004),
            reason: '${t.id}: yuza fon bilan qo‘shilib ketadi');
      }
    });
  });
}
