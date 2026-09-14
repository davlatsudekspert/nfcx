import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/app_version.dart';

void main() {
  test('appVersion pubspec.yaml bilan bir xil', () {
    final line = File('pubspec.yaml')
        .readAsLinesSync()
        .firstWhere((l) => l.startsWith('version:'));
    expect(line.split(':')[1].trim(), appVersion);
  });
}
