import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// ID SHRIFT QOIDASI (egasining qat'iy talabi):
///
///   * katta dekorativ hero ID (Home kartasi) — Playfair (`heroId`),
///     raqamlar to'liq balandlikda (lining figures);
///   * qidiruv, input, kichik ID chiplar, natijalar — IBM Plex Mono;
///   * sarlavhalar — Instrument Serif; UI/matn — Manrope.
///
/// Sabab: serif shriftlarda `0` va `O`, `1` va `I` bir xil ko'rinadi —
/// odam boshqa kodni yozishi yoki sotib olishi mumkin.
///
/// Bu test `lib/` dagi HAR BIR `Text(<...>.code ...)` va
/// `Text(<...>.companyId ...)` ni topadi va uning uslubi serif
/// (`AppType.display`, `displayStyle`, `heroId`) EMASLIGINI tekshiradi.
/// Yagona istisno — hero karta (`nfc_id_hero.dart`).
void main() {
  test('ID matnlari serifda chizilmaydi (hero kartadan tashqari)', () {
    final bad = <String>[];
    final idText = RegExp(
        r'Text\(\s*(?:[\w!]+\.)*(?:code|companyId|resolvedCode)!?\s*[,)]');
    for (final f in Directory('lib').listSync(recursive: true)) {
      if (f is! File || !f.path.endsWith('.dart')) continue;
      if (f.path.endsWith('nfc_id_hero.dart')) continue;
      final src = f.readAsStringSync();
      for (final m in idText.allMatches(src)) {
        final tail = src.substring(m.start, (m.start + 420).clamp(0, src.length));
        // Keyingi `Text(` gacha — boshqa vidjetning uslubini olmaslik uchun.
        final next = tail.indexOf('Text(', 5);
        final body = next < 0 ? tail : tail.substring(0, next);
        if (body.contains('AppType.display') ||
            body.contains('displayStyle(') ||
            body.contains('heroId(') ||
            body.contains("'InstrumentSerif'") ||
            body.contains("'PlayfairDisplay'")) {
          final line = '\n'.allMatches(src.substring(0, m.start)).length + 1;
          bad.add('${f.path}:$line');
        }
      }
    }
    expect(bad, isEmpty, reason: 'ID serif shriftda: ${bad.join(', ')}');
  });

  test('hero ID — Playfair + lining raqamlar, faqat hero kartada', () {
    final type = File('lib/design/theme/typography.dart').readAsStringSync();
    expect(type, contains("heroIdFamily = 'PlayfairDisplay'"));
    expect(type, contains('FontFeature.liningFigures()'));
    final users = Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'))
        .where((f) => f.readAsStringSync().contains('AppType.heroId('))
        .map((f) => f.path.split('/').last)
        .toSet();
    expect(users, {'nfc_id_hero.dart'});
  });

  test('ID kiritiladigan maydonlar — mono', () {
    final market = File('lib/features/shop/nfc_id_market.dart').readAsStringSync();
    expect(market, contains('technical: true'),
        reason: 'NFC ID qidiruv maydoni mono emas');
    final biz = File('lib/features/business/business_forms.dart').readAsStringSync();
    final idField = biz.substring(biz.indexOf('label: l.bizId'));
    expect(idField.substring(0, 200), contains('technical: true'),
        reason: 'Business ID maydoni mono emas');
  });
}
