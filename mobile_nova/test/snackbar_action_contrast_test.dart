import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';

/// "Yangi versiya yuklandi" xabaridagi "Qayta ishga tushirish" tugmasi
/// oq fonda xira sariq edi (egasi, 2026-09-27). Har mavzuda xabar tugmasi
/// o'z foniga nisbatan aniq ko'rinsin (kontrast >= 4.5).
double _contrast(Color a, Color b) {
  final la = a.computeLuminance(), lb = b.computeLuminance();
  final hi = la > lb ? la : lb, lo = la > lb ? lb : la;
  return (hi + .05) / (lo + .05);
}

void main() {
  for (final t in NfcTokens.all) {
    test('snackbar tugmasi aniq — ${t.id}', () {
      final s = buildTheme(t).snackBarTheme;
      expect(s.actionTextColor, isNotNull);
      expect(s.actionBackgroundColor, isNotNull);
      final c = _contrast(s.actionTextColor!, s.actionBackgroundColor!);
      expect(c, greaterThanOrEqualTo(4.5), reason: '${t.id}: tugma yozuvi $c');
      // Tugma kapsulasi xabar fonidan ajralib tursin.
      expect(_contrast(s.actionBackgroundColor!, s.backgroundColor!),
          greaterThanOrEqualTo(3));
    });
  }

  for (final t in NfcTokens.all) {
    test('kalit tutqichi ko‘rinadi — ${t.id}', () {
      final sw = buildTheme(t).switchTheme;
      const on = {WidgetState.selected};
      final thumb = sw.thumbColor!.resolve(on)!;
      final track = sw.trackColor!.resolve(on)!;
      expect(_contrast(thumb, track), greaterThanOrEqualTo(3),
          reason: '${t.id}: yoqilgan kalit tutqichi yo‘lakchada ko‘rinmaydi');
      final offThumb = sw.thumbColor!.resolve({})!;
      final offTrack = sw.trackColor!.resolve({})!;
      expect(_contrast(offThumb, offTrack), greaterThanOrEqualTo(3),
          reason: '${t.id}: o‘chiq kalit tutqichi xira');
    });
  }

  test('kalitlarda tutqich rangi qo‘lda accent2 qilinmaydi', () {
    for (final f in Directory('lib').listSync(recursive: true).whereType<File>()) {
      if (!f.path.endsWith('.dart')) continue;
      expect(f.readAsStringSync().contains('activeThumbColor: t.accent2'), isFalse,
          reason: '${f.path}: tutqich yo‘lakcha bilan bir rangda bo‘lib qoladi');
    }
  });
}
