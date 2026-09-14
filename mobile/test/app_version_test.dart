import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/app_version.dart';

void main() {
  test('zaxira versiya pubspec.yaml bilan bir xil', () {
    // CI `--dart-define=APP_VERSION` beradi; mahalliy qurilishda va
    // shu testda zaxira qiymat ishlaydi. U eskirib qolmasin.
    final line = File('pubspec.yaml')
        .readAsLinesSync()
        .firstWhere((l) => l.startsWith('version:'));
    expect(line.split(':')[1].trim(), appVersionFallback);
  });
}
