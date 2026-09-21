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
  test('yettita mavzu ham mavjud va kaliti takrorlanmaydi', () {
    // `noir` — NFCSTORE premium mavzusi, `src/themes.css` dagi
    // saytning qorong'i palitrasidan olingan. Eskilariga tegilmadi.
    expect(NfcTokens.all.length, 7);
    final ids = NfcTokens.all.map((t) => t.id).toSet();
    expect(ids.length, 7);
    expect(ids,
        {'pearl', 'graphite', 'ocean', 'aurora', 'midnight', 'onyx', 'noir'});
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

  test('onyx ILIQ, midnight esa SOVUQ qora', () {
    // Sayt fonidan o'lchangan qoida: iliq qorada qizil kanal
    // ko'kdan KATTA. `midnight` da aksincha — u ko'k-qora.
    // Ikkalasi bitta oilaga tushib qolsa, saytga moslik yo'qoladi.
    final onyx = NfcTokens.onyx.bg1;
    final mid = NfcTokens.midnight.bg1;
    expect(onyx.r, greaterThan(onyx.b),
        reason: 'onyx foni iliq bo‘lishi kerak (qizil > ko‘k)');
    expect(mid.b, greaterThan(mid.r),
        reason: 'midnight foni sovuq bo‘lib qolishi kerak');
  });

  test('noma’lum kalit STANDART mavzuga tushadi', () {
    // Egasining qarori (2026-09): ilova birinchi ochilganda
    // NFCSTORE brend rangida — `noir`. `ocean` o'chirilmadi, u
    // Sozlamalarda muqobil bo'lib qoladi.
    expect(NfcTokens.fallback.id, 'noir');
    expect(NfcTokens.byId('bunday-mavzu-yoq').id, 'noir');
    expect(NfcTokens.byId(null).id, 'noir');
    expect(NfcTokens.byId('midnight').id, 'midnight');
    // `ocean` HALI HAM mavjud — o'chirib yuborilmaganiga ishonch.
    expect(NfcTokens.byId('ocean').id, 'ocean');
  });

  test('faqat Pearl yorug‘, qolganlari qorong‘i', () {
    expect(NfcTokens.pearl.isDark, isFalse);
    for (final t in NfcTokens.all.where((e) => e.id != 'pearl')) {
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
    final mid = NfcTokens.pearl.lerp(NfcTokens.midnight, 0.5);
    expect(mid.bg1, isNot(NfcTokens.pearl.bg1));
    expect(mid.bg1, isNot(NfcTokens.midnight.bg1));

    // Chegaralarda aniq mavzular qaytadi.
    expect(NfcTokens.pearl.lerp(NfcTokens.midnight, 0).id, 'pearl');
    expect(NfcTokens.pearl.lerp(NfcTokens.midnight, 1).id, 'midnight');
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

  test('Midnight’da oltin aksent ishlatiladi', () {
    // Champagne oltin: qizil komponent ko'kdan sezilarli katta.
    final gold = NfcTokens.midnight.accent2;
    expect(gold.r, greaterThan(gold.b));
    // Fon esa qora emas, CHUQUR KO'K.
    final bg = NfcTokens.midnight.bg1;
    expect(bg.b, greaterThan(bg.r));
  });
}
