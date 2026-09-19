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
  test('beshta mavzu ham mavjud va kaliti takrorlanmaydi', () {
    expect(NfcTokens.all.length, 5);
    final ids = NfcTokens.all.map((t) => t.id).toSet();
    expect(ids.length, 5);
    expect(ids, {'pearl', 'graphite', 'ocean', 'aurora', 'midnight'});
  });

  test('noma’lum kalit Pearl’ga tushadi', () {
    expect(NfcTokens.byId('bunday-mavzu-yoq').id, 'pearl');
    expect(NfcTokens.byId(null).id, 'pearl');
    expect(NfcTokens.byId('midnight').id, 'midnight');
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
