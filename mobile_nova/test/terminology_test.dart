import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// BITTA TUSHUNCHA — BITTA SO'Z (dizayn auditi, 2026-09-28; egasi:
/// "chalkashliklar ham bo'lmasin").
///
/// "Istoriya qo'shish" ekranida bitta narsa uch xil yozilgan edi:
/// sarlavhada "Story", maydonda "Istorya", qoidalarda "istoriya".
/// Ruschada ham "story", "сторис" va "история" aralash edi.
void main() {
  Map<String, String> values(String lang) {
    final m = jsonDecode(File('lib/l10n/arb/app_$lang.arb').readAsStringSync())
        as Map<String, dynamic>;
    return {
      for (final e in m.entries)
        if (!e.key.startsWith('@') && e.value is String) e.key: e.value as String,
    };
  }

  test('o‘zbekcha: faqat "istoriya" (story / istorya emas)', () {
    final bad = values('uz').entries.where((e) =>
        RegExp(r'\bstor(y|ies|yni)\b|istory|istorya', caseSensitive: false)
            .hasMatch(e.value));
    expect(bad.map((e) => '${e.key}: ${e.value}'), isEmpty);
  });

  test('ruscha: faqat "история" (story / сторис emas)', () {
    final bad = values('ru').entries.where((e) =>
        RegExp(r'\bstor(y|ies)\b|сторис', caseSensitive: false)
            .hasMatch(e.value));
    expect(bad.map((e) => '${e.key}: ${e.value}'), isEmpty);
  });
}
