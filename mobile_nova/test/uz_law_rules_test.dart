import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// O'ZBEKISTON QONUNI — ro'yxatdan o'tish roziligi va izoh qoidalari.
///
/// Rozilik uchta narsani qamrashi shart: oferta, shaxsga doir
/// ma'lumotlarni qayta ishlash (O'RQ-547, maxfiylik siyosati asosida)
/// va 18 yosh. Izoh yozish maydoni esa taqiqlarni (haqorat, diniy va
/// siyosiy targ'ibot) yozishdan OLDIN ko'rsatadi.
Map<String, dynamic> _arb(String lang) => jsonDecode(
    File('lib/l10n/arb/app_$lang.arb').readAsStringSync()) as Map<String, dynamic>;

void main() {
  for (final lang in ['uz', 'ru', 'en']) {
    test('$lang: rozilik — oferta, shaxsiy ma’lumot, 18+', () {
      final a = _arb(lang);
      final full = [
        a['registerTosPrefix'], a['registerTosLink'], a['registerTosSuffix'],
        a['registerPrivacyLink'], a['registerPrivacySuffix'],
      ].join();
      expect(full, contains('18'));
      expect((a['registerPrivacyLink'] as String).isNotEmpty, isTrue);
      final personal = {'uz': 'shaxsga doir', 'ru': 'персональных', 'en': 'personal data'}[lang]!;
      expect(full.toLowerCase(), contains(personal));
    });

    test('$lang: izoh qoidalari eslatmasi', () {
      final note = (_arb(lang)['commentRulesNote'] as String).toLowerCase();
      final words = {
        'uz': ['haqorat', 'diniy', 'siyosiy'],
        'ru': ['оскорблен', 'религиоз', 'политическ'],
        'en': ['insult', 'religious', 'political'],
      }[lang]!;
      for (final w in words) {
        expect(note, contains(w));
      }
    });
  }

  test('izoh maydoni ustida qoidalar ko‘rinadi, havolalar mavjud sahifalarga', () {
    final comments = File('lib/features/social/comments.dart').readAsStringSync();
    expect(comments, contains("ValueKey('comment-rules-note')"));
    expect(comments, contains('l.commentRulesNote'));
    final reg = File('lib/features/auth/register_screen.dart').readAsStringSync();
    expect(reg, contains(r"openLink('$kApiBase/shartlar')"));
    expect(reg, contains(r"openLink('$kApiBase/privacy')"));
  });
}
