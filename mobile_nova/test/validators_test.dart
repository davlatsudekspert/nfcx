import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/utils/validators.dart';

void main() {
  group('email', () {
    test('to‘g‘ri manzillarni qabul qiladi', () {
      expect(Validate.email('aziz@nfcstore.uz'), isNull);
      expect(Validate.email('  a.b+c@mail.co  '), isNull);
    });

    test('noto‘g‘ri manzillarni rad etadi', () {
      expect(Validate.email(''), 'errRequired');
      expect(Validate.email('aziz'), 'errBadEmail');
      expect(Validate.email('aziz@mail'), 'errBadEmail');
      expect(Validate.email('a b@mail.uz'), 'errBadEmail');
    });
  });

  group('telefon', () {
    test('turli shakllarni bitta ko‘rinishga keltiradi', () {
      const want = '+998901234567';
      expect(Validate.normalizePhone('901234567'), want);
      expect(Validate.normalizePhone('998901234567'), want);
      expect(Validate.normalizePhone('+998 90 123 45 67'), want);
      expect(Validate.normalizePhone('+998-90-123-45-67'), want);
    });

    test('bo‘sh qiymatdan bo‘sh natija', () {
      expect(Validate.normalizePhone(''), '');
    });

    test('standart O‘zbekiston: 9 raqam; kam bo‘lsa — «to‘liq emas»', () {
      expect(Validate.phone('901234567'), isNull);
      expect(Validate.phone('+998901234567'), isNull);
      expect(Validate.phone(''), 'errRequired');
      // Raqam yetmaydi — aniq sabab (2026-09-25, egasi).
      expect(Validate.phone('12345'), 'errPhoneShort');
      // Davlat O'zbekiston tanlangan, raqam esa Rossiyaniki — rad.
      expect(Validate.phone('+79161234567'), 'errBadPhone');
    });
  });

  group('parol', () {
    test('kamida 8 belgi talab qiladi', () {
      expect(Validate.password('12345678'), isNull);
      expect(Validate.password('1234567'), 'errPasswordShort');
      expect(Validate.password(''), 'errRequired');
    });
  });

  group('tasdiqlash kodi', () {
    test('roppa-rosa 6 raqam', () {
      expect(Validate.code('123456'), isNull);
      expect(Validate.code('12345'), 'errBadCode');
      expect(Validate.code('1234567'), 'errBadCode');
      expect(Validate.code('12345a'), 'errBadCode');
      expect(Validate.code(''), 'errRequired');
    });
  });

  group('ism', () {
    test('kamida ikki belgi', () {
      expect(Validate.name('Ali'), isNull);
      expect(Validate.name('A'), 'errNameShort');
      expect(Validate.name('   '), 'errRequired');
    });
  });
}
