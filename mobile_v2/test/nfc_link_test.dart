import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_v2/core/nfc_service.dart';

void main() {
  group('NfcLink.parse', () {
    test('accepts NFCSTORE short profile URL', () {
      expect(NfcLink.parse('https://nfcstore.uz/vip001')?.code, 'VIP001');
    });

    test('accepts /id/ URL', () {
      expect(NfcLink.parse('https://nfcstore.uz/id/ali000')?.code, 'ALI000');
    });

    test('rejects foreign domain', () {
      expect(NfcLink.parse('https://example.com/VIP001'), isNull);
    });

    test('rejects malformed code', () {
      expect(NfcLink.parse('https://nfcstore.uz/a!'), isNull);
    });
  });
}
