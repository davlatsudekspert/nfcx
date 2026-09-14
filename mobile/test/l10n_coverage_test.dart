import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/l10n/en.dart';
import 'package:nfcstore/l10n/ru.dart';

/// TARJIMA QAMROVI.
///
/// NIMA UCHUN BU TEST BOR: `tr()` tarjima topilmasa o'zbekcha
/// matnni qaytaradi — ya'ni unutilgan satr ILOVANI BUZMAYDI va
/// aynan shuning uchun SEZILMAY qoladi. Rus va ingliz tilidagi
/// foydalanuvchi ekranning o'rtasida o'zbekcha jumlani ko'radi,
/// hech qanday xato esa hech qayerda chiqmaydi.
///
/// Auditda shu tarzda 15 ta satr topildi. Test qo'yilmasa, ular
/// keyingi o'zgarishda yana yig'ila boshlaydi.
/// Dart satr literalini ISH PAYTIDAGI qiymatiga aylantirish.
///
/// Fayl MATN sifatida o'qiladi, ya'ni `\n` bu yerda ikki belgi
/// bo'lib keladi. Tarjima jadvalidagi kalit esa haqiqiy yangi
/// qator bilan turadi (jadvalni Dart kompilyatori o'qigan).
/// Ochmasak, ko'p qatorli sarlavhalar "tarjimasiz" bo'lib
/// ko'rinardi — test esa yolg'on ogohlantirish berardi.
String _unescape(String raw) {
  final out = StringBuffer();
  for (var i = 0; i < raw.length; i++) {
    if (raw[i] != r'\' || i + 1 >= raw.length) {
      out.write(raw[i]);
      continue;
    }
    final next = raw[++i];
    out.write(switch (next) {
      'n' => '\n',
      't' => '\t',
      'r' => '\r',
      _ => next,
    });
  }
  return out.toString();
}

void main() {
  test('har bir tr() satri ruscha va inglizchaga o‘girilgan', () {
    // `tr('...')` va `trf('...')`, shu jumladan qatorlarga
    // bo'lingan (Dart qo'shni satr literallarini birlashtiradi).
    final call = RegExp(r"""\btrf?\(\s*((?:'(?:\\.|[^'\\])*'\s*)+)""", dotAll: true);
    final piece = RegExp(r"'((?:\\.|[^'\\])*)'");

    final missing = <String, String>{};
    for (final f in Directory('lib').listSync(recursive: true).whereType<File>()) {
      final path = f.path.replaceAll(r'\', '/');
      if (!path.endsWith('.dart') || path.contains('/l10n/')) continue;
      for (final m in call.allMatches(f.readAsStringSync())) {
        final uz =
            piece.allMatches(m.group(1)!).map((p) => _unescape(p.group(1)!)).join();
        if (uz.isEmpty) continue;
        if (!ruStrings.containsKey(uz) || !enStrings.containsKey(uz)) {
          missing[uz] = path;
        }
      }
    }

    expect(
      missing,
      isEmpty,
      reason: 'Tarjimasiz satr(lar). tool/l10n.json ga qo‘shing va\n'
          'python3 tool/l10n_build.py ni ishga tushiring:\n'
          '${const JsonEncoder.withIndent('  ').convert(missing)}',
    );
  });

  test('ru va en jadvallari bir xil kalitlarga ega', () {
    expect(ruStrings.keys.toSet().difference(enStrings.keys.toSet()), isEmpty);
    expect(enStrings.keys.toSet().difference(ruStrings.keys.toSet()), isEmpty);
  });
}
