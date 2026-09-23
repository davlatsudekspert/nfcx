// `integration_perf/app_perf_test.dart` ning haydovchisi.
//
// Qurilmadan kelgan o'lchovlarni `build/perf.json` ga yozadi va
// qisqa jadvalni chop etadi. Maxfiy qiymat yo'q — faqat millisekund.

import 'dart:convert';

import 'package:integration_test/integration_test_driver.dart';

Future<void> main() => integrationDriver(
      responseDataCallback: (data) async {
        if (data == null) return;
        // ignore: avoid_print
        print('<<<PERF_JSON>>>');
        // ignore: avoid_print
        print(const JsonEncoder.withIndent('  ').convert(data));
        // ignore: avoid_print
        print('<<<END_PERF_JSON>>>');
        await writeResponseData(data, testOutputFilename: 'perf');
      },
    );
