import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/utils/validators.dart';

/// RO'YXATDA EMAIL VA TELEFON (2026-09-25). Server bilan bir xil qoida:
/// `hosting/api/contact-check.js` (scripts/test-register-contact-check.mjs).
void main() {
  test('email imlo xatosi — to‘g‘ri manzil taklif qilinadi', () {
    expect(Validate.emailSuggestion('ali@gmial.com'), 'ali@gmail.com');
    expect(Validate.emailSuggestion('ali@gmail.co'), 'ali@gmail.com');
    expect(Validate.emailSuggestion('ali@mail.r'), 'ali@mail.ru');
    expect(Validate.emailSuggestion('ali@yandx.ru'), 'ali@yandex.ru');
    expect(Validate.emailSuggestion('ali@gmail.com'), isNull);
    expect(Validate.emailSuggestion('ali@mail.kz'), isNull, reason: 'mahalliy domen');
    expect(Validate.emailSuggestion('ali@nfcstore.uz'), isNull);
  });

  test('telefon: O‘zbekiston — 9 raqam, yetmasa rad', () {
    expect(Validate.phone('90 123 45 67'), isNull);
    expect(Validate.phone('90 123 45 6'), 'errPhoneShort');
    expect(Validate.normalizePhone('90 123 45 67'), '+998901234567');
  });

  test('telefon: boshqa davlat — o‘z uzunligi bilan', () {
    final ru = PhoneCountry.all.firstWhere((c) => c.iso == 'RU');
    final kg = PhoneCountry.all.firstWhere((c) => c.iso == 'KG');
    expect(Validate.phone('916 123 45 67', country: ru), isNull);
    expect(Validate.phone('916 123 45 6', country: ru), 'errPhoneShort');
    expect(Validate.phone('8 916 123 45 67', country: ru), isNull, reason: 'mahalliy 8');
    expect(Validate.normalizePhone('8 916 123 45 67', country: ru), '+79161234567');
    expect(Validate.phone('+7 916 123 45 67', country: ru), isNull);
    expect(Validate.phone('700 111 222', country: kg), isNull);
    expect(Validate.phone('700 111 22', country: kg), 'errPhoneShort');
    expect(Validate.normalizePhone('700 111 222', country: kg), '+996700111222');
  });
}
