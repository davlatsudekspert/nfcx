import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// SESSIYA TOKENI ZAXIRAGA KIRMAYDI (release audit, 2026-09).
///
/// `flutter_secure_storage` tokeni Keystore kaliti bilan shifrlaydi;
/// kalit qurilmadan chiqmaydi. Android Auto Backup / telefondan-telefonga
/// ko'chirish shifrlangan faylni yangi qurilmaga olib o'tsa, uni o'qib
/// ham, yozib ham bo'lmasdi — foydalanuvchi har ochilishda qayta
/// kirishga majbur bo'lardi.
void main() {
  test('manifest zaxira qoidalariga ishora qiladi', () {
    final m = File('android/app/src/main/AndroidManifest.xml')
        .readAsStringSync();
    expect(m, contains('android:fullBackupContent="@xml/backup_rules"'));
    expect(m,
        contains('android:dataExtractionRules="@xml/data_extraction_rules"'));
  });

  test('token fayli bulut zaxirasi va ko‘chirishdan chiqarilgan', () {
    const path = 'path="FlutterSecureStorage.xml"';
    final legacy =
        File('android/app/src/main/res/xml/backup_rules.xml').readAsStringSync();
    expect(legacy, contains(path));
    final rules = File('android/app/src/main/res/xml/data_extraction_rules.xml')
        .readAsStringSync();
    expect(RegExp(RegExp.escape(path)).allMatches(rules).length, 2,
        reason: 'cloud-backup VA device-transfer ikkalasida');
  });

  test('buzilgan shifrlangan saqlagich o‘zi tozalanadi', () {
    final s = File('lib/core/storage/secure_store.dart').readAsStringSync();
    expect(s, contains('resetOnError: true'));
  });
}
