import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// VARAQLAR PASTKI PANEL OSTIDA QOLMASIN.
///
/// Telefonda topildi: QR varag'ining eng pastki tugmalari
/// ko'rinmasdi. Sabab — varaq TAB navigatorida ochilardi, pastki
/// suzuvchi navigatsiya paneli esa uning ustiga chizilardi.
///
/// Yechim: `useRootNavigator: true`. Shunda varaq butun ekranni
/// qoplaydi va panel uni yopmaydi.
///
/// Bu test yangi varaq qo'shilganda o'sha xato qaytmasligi uchun.
void main() {
  test('har bir varaq ILDIZ navigatorda ochiladi', () {
    final bad = <String>[];

    for (final e in Directory('lib').listSync(recursive: true)) {
      if (e is! File || !e.path.endsWith('.dart')) continue;
      final src = e.readAsStringSync();
      if (!src.contains('showModalBottomSheet')) continue;

      // Har bir chaqiruvni alohida ko'ramiz: bitta faylda bir
      // nechta varaq bo'lishi mumkin va faqat biri unutilgan
      // bo'lsa ham topilsin.
      var from = 0;
      while (true) {
        final i = src.indexOf('showModalBottomSheet', from);
        if (i < 0) break;
        from = i + 1;
        // Chaqiruv argumentlari — keyingi `builder:` gacha.
        final b = src.indexOf('builder:', i);
        final head = b < 0 ? src.substring(i) : src.substring(i, b);
        if (!head.contains('useRootNavigator: true')) {
          final line = '\n'.allMatches(src.substring(0, i)).length + 1;
          bad.add('${e.path}:$line');
        }
      }
    }

    expect(bad, isEmpty,
        reason: 'bu varaqlar tab navigatorida ochiladi va pastki '
            'panel ostida qoladi: ${bad.join(', ')}');
  });
}
