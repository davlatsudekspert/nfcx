/// Ro'yxatdan o'tishdagi telefon davlatlari (2026-09-25).
///
/// Egasi: standart +998, lekin chet eldagi o'zbeklar (Rossiya,
/// Qozog'iston, Turkiya, Koreya...) o'sha yerdagi raqami bilan ham kira
/// olsin — to'lov telefonga emas, O'zbekiston kartasiga bog'liq.
///
/// [min]/[max] — MILLIY qism uzunligi (davlat kodisiz). Server bilan
/// BIR XIL jadval: `hosting/api/contact-check.js` → `PHONE_PLANS`.
class PhoneCountry {
  const PhoneCountry(this.iso, this.flag, this.name, this.dial, this.min, this.max, this.hint);

  final String iso;
  final String flag;
  final String name;
  final String dial;
  final int min;
  final int max;
  final String hint;

  static const uz = PhoneCountry('UZ', '🇺🇿', 'O‘zbekiston', '998', 9, 9, '90 123 45 67');

  static const all = <PhoneCountry>[
    uz,
    PhoneCountry('RU', '🇷🇺', 'Rossiya', '7', 10, 10, '912 345 67 89'),
    PhoneCountry('KZ', '🇰🇿', 'Qozog‘iston', '7', 10, 10, '701 234 56 78'),
    PhoneCountry('KG', '🇰🇬', 'Qirg‘iziston', '996', 9, 9, '700 123 456'),
    PhoneCountry('TJ', '🇹🇯', 'Tojikiston', '992', 9, 9, '90 123 4567'),
    PhoneCountry('TM', '🇹🇲', 'Turkmaniston', '993', 8, 8, '65 123456'),
    PhoneCountry('AZ', '🇦🇿', 'Ozarbayjon', '994', 9, 9, '50 123 45 67'),
    PhoneCountry('TR', '🇹🇷', 'Turkiya', '90', 10, 10, '532 123 45 67'),
    PhoneCountry('KR', '🇰🇷', 'Janubiy Koreya', '82', 9, 10, '10 1234 5678'),
    PhoneCountry('AE', '🇦🇪', 'BAA', '971', 9, 9, '50 123 4567'),
    PhoneCountry('SA', '🇸🇦', 'Saudiya Arabistoni', '966', 9, 9, '50 123 4567'),
    PhoneCountry('US', '🇺🇸', 'AQSh', '1', 10, 10, '201 555 0123'),
    PhoneCountry('GB', '🇬🇧', 'Buyuk Britaniya', '44', 10, 10, '7400 123456'),
    PhoneCountry('DE', '🇩🇪', 'Germaniya', '49', 7, 11, '1512 3456789'),
    PhoneCountry('PL', '🇵🇱', 'Polsha', '48', 9, 9, '512 345 678'),
    PhoneCountry('UA', '🇺🇦', 'Ukraina', '380', 9, 9, '50 123 4567'),
    PhoneCountry('BY', '🇧🇾', 'Belarus', '375', 9, 9, '29 123 45 67'),
    PhoneCountry('GE', '🇬🇪', 'Gruziya', '995', 9, 9, '555 12 34 56'),
    PhoneCountry('AF', '🇦🇫', 'Afg‘oniston', '93', 9, 9, '70 123 4567'),
    PhoneCountry('CN', '🇨🇳', 'Xitoy', '86', 11, 11, '131 2345 6789'),
    PhoneCountry('JP', '🇯🇵', 'Yaponiya', '81', 10, 10, '90 1234 5678'),
    PhoneCountry('IT', '🇮🇹', 'Italiya', '39', 9, 10, '312 345 6789'),
    PhoneCountry('FR', '🇫🇷', 'Fransiya', '33', 9, 9, '6 12 34 56 78'),
    PhoneCountry('ES', '🇪🇸', 'Ispaniya', '34', 9, 9, '612 34 56 78'),
    PhoneCountry('IN', '🇮🇳', 'Hindiston', '91', 10, 10, '81234 56789'),
    PhoneCountry('PK', '🇵🇰', 'Pokiston', '92', 10, 10, '301 2345678'),
  ];

  /// `+998901234567` → O'zbekiston (eng uzun kod birinchi tekshiriladi).
  static PhoneCountry? ofE164(String e164) {
    final d = e164.replaceAll(RegExp(r'\D'), '');
    PhoneCountry? best;
    for (final c in all) {
      if (d.startsWith(c.dial) && (best == null || c.dial.length > best.dial.length)) {
        best = c;
      }
    }
    return best;
  }
}
