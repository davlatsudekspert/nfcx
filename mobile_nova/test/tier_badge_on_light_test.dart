import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/id_lux.dart';

/// "EKSKLYUZIV" OCH KARTADA KO'RINSIN (dizayn auditi, 2026-09-28; egasi
/// ruxsat berdi). Pudra/Sakura kabi mavzularda NFC ID kartasi oq — daraja
/// belgisi (och oltin yozuv, shaffof fon) deyarli ko'rinmasdi. Och yuzada
/// kapsula qora, yozuv o'sha daraja rangida (rang o'zgarmaydi).
double _lum(Color c) {
  double ch(double v) =>
      v <= .03928 ? v / 12.92 : math.pow((v + .055) / 1.055, 2.4).toDouble();
  return .2126 * ch(c.r) + .7152 * ch(c.g) + .0722 * ch(c.b);
}

double _contrast(Color a, Color b) {
  final x = _lum(a), y = _lum(b);
  return (math.max(x, y) + .05) / (math.min(x, y) + .05);
}

void main() {
  test('och yuzada: har pullik daraja yozuvi qora fonda ≥ 4.5', () {
    const dark = Color(0xFF14120F);
    for (final tier in ['exclusive', 'premium', 'gold']) {
      final lux = IdLux.of(NfcTokens.ivory, tier)!;
      expect(_contrast(lux.badgeInk, dark), greaterThanOrEqualTo(4.5),
          reason: tier);
    }
  });

  test('hero karta och mavzuda onLight beradi (Ivory — qora karta)', () {
    final src = File('lib/design/widgets/nfc_id_hero.dart').readAsStringSync();
    expect(src, contains("onLight: context.tokens.id != 'ivory' &&"));
    expect(src, contains('!context.tokens.isDark'));
  });
}
