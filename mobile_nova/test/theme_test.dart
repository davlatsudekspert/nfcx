import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';

/// Ikki rang orasidagi kontrast nisbati (WCAG 2.1).
///
/// Mavzu ranglari qo'lda tanlangan, shuning uchun "chiroyli" ko'ringani
/// yetarli emas: bu yerda ular O'QILADIGANLIGI o'lchanadi.
double _contrast(Color a, Color b) {
  double luminance(Color c) {
    double channel(double v) =>
        v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
    return 0.2126 * channel(c.r) +
        0.7152 * channel(c.g) +
        0.0722 * channel(c.b);
  }

  final la = luminance(a);
  final lb = luminance(b);
  final hi = math.max(la, lb);
  final lo = math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

void main() {
  test('oltita mavzu ham mavjud va kaliti takrorlanmaydi', () {
    // `noir` — NFCSTORE premium mavzusi, `src/themes.css` dagi
    // saytning qorong'i palitrasidan olingan. Eskilariga tegilmadi.
    expect(NfcTokens.all.length, 6);
    final ids = NfcTokens.all.map((t) => t.id).toSet();
    expect(ids.length, 6);
    expect(ids, {'noir', 'ocean', 'mono', 'graphite', 'aurora', 'onyx'});
    // OQ MAVZU TANLANMAYDI.
    //
    // `pearl` ta'rifi qoladi (sinovlar undan yorug' palitra namunasi
    // sifatida foydalanadi), lekin ro'yxatda YO'Q. Qurilmada butun
    // ilova oqarib turgan edi: sabab standart mavzu emas, eski
    // o'rnatishdan xotirada qolgan tanlov edi.
    expect(ids.contains('pearl'), isFalse);
    // Birinchi o'rin — standart mavzu.
    expect(NfcTokens.all.first.id, 'noir');
    // FAQAT BITTA YORUG' MAVZU — `mono` (oq-qora).
    //
    // Qolgani qorong'i. `pearl` olib tashlanganidan keyin yorug'
    // mavzu umuman yo'q edi; `mono` egasining so'rovi bilan
    // qaytdi, lekin u BOShQACHA: oq fon, tim qora matn va qora
    // chegaralar, oltin umuman yo'q.
    final light = NfcTokens.all.where((t) => !t.isDark).map((t) => t.id);
    expect(light, ['mono']);
  });

  test('noir AKSENTI shampan oltin', () {
    final n = NfcTokens.noir;
    expect(n.accent1, const Color(0xFFE4C97A), reason: 'yumshoq oltin');
    expect(n.accent2, const Color(0xFFD6B25E), reason: 'shampan');
  });

  test('noir FONI midnight navy — jigarrang ham, kulrang ham EMAS', () {
    // Ikki marta noto'g'ri chiqqan joy, shuning uchun test bor:
    //   1) sayt palitrasidan olingan iliq qora -> "tim jigarrang";
    //   2) neytral ko'mir -> jigarranglik ketdi, premium hissi ham.
    // To'g'ri javob — qoraga juda yaqin SOVUQ ko'k.
    final n = NfcTokens.noir;
    int ch(double v) => (v * 255).round();

    // 1. Sovuq: ko'k kanal qizildan katta.
    expect(ch(n.bg1.b), greaterThan(ch(n.bg1.r)),
        reason: 'fon sovuq bo‘lishi kerak (ko‘k > qizil) — sepia emas');

    // 2. Lekin YORQIN ko'k emas: farq o'lchovli qoladi.
    final cool = ch(n.bg1.b) - ch(n.bg1.r);
    expect(cool, inInclusiveRange(12, 40),
        reason: 'navy sezilsin, lekin ko‘k bo‘lib yonmasin, topildi $cool');

    // 3. Qoraga yaqin.
    expect(n.bg1.computeLuminance(), lessThan(0.02),
        reason: 'fon qoraga juda yaqin bo‘lishi kerak');

    // 4. Matn ham iliq-jigarrang bo‘lmasin.
    expect(ch(n.text2.b), greaterThanOrEqualTo(ch(n.text2.r)),
        reason: 'ikkilamchi matn sepia bo‘lib qolgan');
  });

  test('noir kartalari FON bilan qo‘shilib ketmaydi', () {
    // Yuzalar juda shaffof bo‘lsa, qora fonda karta ko‘rinmay
    // qoladi — "hammasi bitta qora dog‘". Yuza fon ustiga
    // qo‘yilganda yorqinlik farqi seziladigan bo‘lishi kerak.
    final n = NfcTokens.noir;
    final bg = n.bg1;
    final over = Color.alphaBlend(n.surface, bg);
    expect(over.computeLuminance(), greaterThan(bg.computeLuminance()),
        reason: 'yuza fondan ochroq bo‘lishi kerak');
    expect(over.computeLuminance() - bg.computeLuminance(),
        greaterThan(0.012),
        reason: 'farq juda kichik — karta fon bilan qo‘shilib ketadi');
  });

  test('onyx ILIQ qora — oq-qora mavzu esa butunlay rangsiz', () {
    // `midnight` o'rnini `mono` egalladi, shuning uchun eski
    // "iliq/sovuq" taqqoslash ma'nosini yo'qotdi. Endi tekshiruv
    // boshqacha: `onyx` iliq qolsin, `mono` esa RANGSIZ bo'lsin —
    // uning fonida qizil va ko'k deyarli teng bo'lishi kerak,
    // aks holda u "oq" emas, tusli bo'lib ko'rinadi.
    final onyx = NfcTokens.onyx.bg1;
    expect(onyx.r, greaterThan(onyx.b), reason: 'onyx iliq bo\u2018lishi kerak');

    final mono = NfcTokens.mono.bg1;
    expect((mono.r - mono.b).abs(), lessThan(0.03),
        reason: 'oq-qora mavzu fonida rang tusi bo\u2018lmasin');
  });
  test('noma’lum kalit STANDART mavzuga tushadi', () {
    // Egasining qarori (2026-09): ilova birinchi ochilganda
    // NFCSTORE brend rangida — `noir`. `ocean` o'chirilmadi, u
    // Sozlamalarda muqobil bo'lib qoladi.
    expect(NfcTokens.fallback.id, 'noir');
    expect(NfcTokens.byId('bunday-mavzu-yoq').id, 'noir');
    expect(NfcTokens.byId(null).id, 'noir');
    expect(NfcTokens.byId('mono').id, 'mono');
    // `ocean` HALI HAM mavjud — o'chirib yuborilmaganiga ishonch.
    expect(NfcTokens.byId('ocean').id, 'ocean');
  });

  test('faqat oq-qora mavzu yorug‘, qolganlari qorong‘i', () {
    expect(NfcTokens.mono.isDark, isFalse);
    for (final t in NfcTokens.all.where((e) => e.id != 'mono')) {
      expect(t.isDark, isTrue, reason: t.id);
    }
  });

  test('har mavzuda asosiy matn fonga nisbatan o‘qiladi', () {
    for (final t in NfcTokens.all) {
      // WCAG AA oddiy matn uchun 4.5 talab qiladi.
      expect(_contrast(t.text1, t.bg1), greaterThan(4.5), reason: t.id);
    }
  });

  test('aksent ustidagi siyoh har mavzuda yetarli kontrastga ega', () {
    for (final t in NfcTokens.all) {
      // Tugma yozuvi — katta va qalin, shuning uchun chegara 3.0.
      expect(_contrast(t.onAccent, t.accent2), greaterThan(3.0), reason: t.id);
      expect(_contrast(t.onAccent, t.accent1), greaterThan(3.0), reason: t.id);
    }
  });

  test('mavzular orasida lerp qiladi — almashuv silliq', () {
    final mid = NfcTokens.pearl.lerp(NfcTokens.mono, 0.5);
    expect(mid.bg1, isNot(NfcTokens.pearl.bg1));
    expect(mid.bg1, isNot(NfcTokens.mono.bg1));

    // Chegaralarda aniq mavzular qaytadi.
    expect(NfcTokens.pearl.lerp(NfcTokens.mono, 0).id, 'pearl');
    expect(NfcTokens.pearl.lerp(NfcTokens.mono, 1).id, 'mono');
  });

  test('ThemeData har mavzu uchun quriladi va kengaytmani saqlaydi', () {
    for (final t in NfcTokens.all) {
      final theme = buildTheme(t);
      expect(theme.extension<NfcTokens>(), same(t), reason: t.id);
      expect(theme.scaffoldBackgroundColor, t.bg1, reason: t.id);
      expect(
        theme.brightness,
        t.isDark ? Brightness.dark : Brightness.light,
        reason: t.id,
      );
    }
  });

  test('BEZAK YUVINDISI oq-qora mavzuda IFLOS DOG\u2018 BO\u2018LMAYDI', () {
    // Egasining shikoyati: "yumshoq mayin baribir qila olmadik".
    // Ekranning tepasida iflos kulrang chiziq, avatar o‘rnida
    // kulrang doira, rejim kapsulasida kulrang plastina turardi.
    //
    // Uchalasi ham bitta sababdan: aksent rangini SHAFFOFLIK
    // bilan fonga surish. Oltin aksentda bu yumshoq tus beradi,
    // `mono` da esa aksent QORA — qoraning 26% i tus emas, dog‘.
    //
    // Shuning uchun `washScale` bor va bu test uning HAQIQATAN
    // ishlayotganini tekshiradi.
    final m = NfcTokens.mono;

    // 1. Oq-qora mavzuda yuvindi sezilarli darajada susaytiriladi.
    expect(m.washScale, lessThan(.5),
        reason: 'qora aksentli yorug‘ mavzuda yuvindi kuchsiz bo‘lsin');

    // 2. Lekin BUTUNLAY yo‘qolmaydi — aks holda avatar doirasi
    //    va kapsula ko‘rinmay qoladi.
    expect(m.washScale, greaterThan(0),
        reason: 'yumshoq boshqa, yo‘q boshqa');

    // 3. Muqova atmosferasi oq fon ustida deyarli sezilmaydigan
    //    bo‘lib qolsin. .17 — `profile_screen.dart` dagi
    //    radial gradientning eng kuchli nuqtasi.
    final cover = Color.alphaBlend(m.wash(m.accent1, .17), m.bg1);
    expect((cover.computeLuminance() - m.bg1.computeLuminance()).abs(),
        lessThan(.18),
        reason: 'ekran tepasidagi chiziq fondan uzoqlashmasin');

    // 4. QORONG‘I mavzularga tegilmagan — ular o‘sha-o‘sha.
    for (final t in NfcTokens.all.where((e) => e.isDark)) {
      expect(t.washScale, 1.0, reason: t.id);
    }
  });

  test('Oq-qora mavzu HAQIQATAN rangsiz', () {
    // Egasining so'rovi: "faqat oq va qora". Demak bu mavzuda
    // oltin ham, ko'k ham bo'lmasligi kerak — hamma rang
    // kulrangning darajasi.
    final m = NfcTokens.mono;
    for (final (name, c) in [
      ('accent1', m.accent1),
      ('accent2', m.accent2),
      ('bg1', m.bg1),
      ('surfaceSolid', m.surfaceSolid),
      ('text1', m.text1),
    ]) {
      final spread = [c.r, c.g, c.b];
      expect(spread.reduce((a, b) => a > b ? a : b) -
              spread.reduce((a, b) => a < b ? a : b),
          lessThan(0.05),
          reason: '$name rangsiz bo\u2018lishi kerak');
    }

    // Fon YORUG', matn esa TIM QORA.
    expect(m.bg1.computeLuminance(), greaterThan(.85));
    expect(m.text1.computeLuminance(), lessThan(.05));

    // Chegaralar QORADAN — egasining aniq so'rovi.
    expect(m.border1.computeLuminance(), lessThan(.15));

    // Karta fondan ajralsin, aks holda qutilar ko'rinmaydi.
    expect(m.surfaceSolid.computeLuminance(),
        greaterThan(m.bg1.computeLuminance()));
  });
}
