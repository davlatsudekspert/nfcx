import 'phone_countries.dart';

export 'phone_countries.dart' show PhoneCountry;

/// Kiritish tekshiruvi — natija KALIT, tarjima emas.
///
/// `null` qaytsa — maydon to'g'ri.
abstract final class Validate {
  static final _email = RegExp(r'^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$');

  /// Backend `PHONE_RE` bilan bir xil shakl: +998 va 9 raqam.
  static final _phone = RegExp(r'^\+998\d{9}$');

  static String? email(String? v) {
    final s = (v ?? '').trim();
    if (s.isEmpty) return 'errRequired';
    if (!_email.hasMatch(s)) return 'errBadEmail';
    return null;
  }

  /// Telefon — tanlangan davlat bo'yicha MILLIY qism uzunligi
  /// (`PhoneCountry`, server bilan bir xil jadval). Raqam yetmasa —
  /// `errPhoneShort`, ortiqcha bo'lsa — `errBadPhone`.
  static String? phone(String? v, {PhoneCountry country = PhoneCountry.uz}) {
    final raw = (v ?? '').trim();
    if (raw.isEmpty) return 'errRequired';
    final national = nationalDigits(raw, country);
    if (national.length < country.min) return 'errPhoneShort';
    if (national.length > country.max) return 'errBadPhone';
    if (country == PhoneCountry.uz && !_phone.hasMatch('+998$national')) {
      return 'errBadPhone';
    }
    return null;
  }

  /// Maydondagi yozuvdan milliy qism: davlat kodi yozib qo'yilgan
  /// bo'lsa olib tashlanadi, mahalliy "0" / "8" prefiksi ham.
  static String nationalDigits(String raw, PhoneCountry country) {
    var d = raw.replaceAll(RegExp(r'\D'), '');
    if (raw.trim().startsWith('+') || d.length > country.max) {
      if (d.startsWith('00')) d = d.substring(2);
      if (d.startsWith(country.dial) && d.length - country.dial.length >= country.min) {
        d = d.substring(country.dial.length);
      }
    }
    // Mahalliy yozuv: `8 912...` (Rossiya), `0532...` (Turkiya, Britaniya).
    if (d.length == country.max + 1 && (d.startsWith('0') || (country.dial == '7' && d.startsWith('8')))) {
      d = d.substring(1);
    }
    return d;
  }

  /// `+998 90 123 45 67`, `998901234567`, `901234567` — hammasi
  /// `+998901234567` ga keltiriladi. Boshqa davlat tanlangan bo'lsa —
  /// `+<kod><milliy qism>`.
  ///
  /// NIMA UCHUN: foydalanuvchi raqamni xohlagan ko'rinishda yozadi, backend
  /// esa bitta qat'iy shaklni kutadi. Normalizatsiya UI'da bo'lmasa,
  /// to'g'ri raqam ham "noto'g'ri" deb rad etilardi.
  static String normalizePhone(String raw, {PhoneCountry? country}) {
    if (country != null && country != PhoneCountry.uz) {
      final n = nationalDigits(raw, country);
      return n.isEmpty ? '' : '+${country.dial}$n';
    }
    var d = raw.replaceAll(RegExp(r'[^\d+]'), '');
    if (d.startsWith('+')) d = d.substring(1);
    if (d.startsWith('998')) return '+$d';
    if (d.length == 9) return '+998$d';
    return d.isEmpty ? '' : '+$d';
  }

  /// Mashhur pochta domenidagi imlo xatosi (`gmial.com`, `mail.r`) —
  /// to'g'ri butun manzil; bo'lmasa `null`. Server bilan bir xil ro'yxat
  /// (`hosting/api/contact-check.js` → `emailTypoSuggestion`).
  static String? emailSuggestion(String? v) {
    final s = (v ?? '').trim().toLowerCase();
    final at = s.lastIndexOf('@');
    if (at < 1) return null;
    final local = s.substring(0, at);
    final domain = s.substring(at + 1);
    if (domain.isEmpty || popularEmailDomains.contains(domain)) return null;
    // `gmail` va `icloud` — faqat `.com`; `mail.kz`, `yandex.uz` — to'g'ri.
    final sld = domain.split('.').first;
    if (const {'gmail', 'googlemail', 'icloud'}.contains(sld)) return '$local@$sld.com';
    final tld = domain.length > sld.length ? domain.substring(sld.length + 1) : '';
    final popularSld = popularEmailDomains.map((d) => d.split('.').first).toSet();
    if (popularSld.contains(sld) &&
        RegExp(r'^[a-z]{2}$').hasMatch(tld) &&
        !const {'co', 'cm', 'om', 'cn'}.contains(tld)) {
      return null;
    }
    String? best;
    var bestD = 99;
    for (final d in popularEmailDomains) {
      final dist = _lev(domain, d);
      final limit = d.length <= 6 ? 1 : 2;
      if (dist <= limit && dist < bestD) {
        best = d;
        bestD = dist;
      }
    }
    if (best == null) {
      final bare = domain.replaceAll(RegExp(r'\.+$'), '');
      for (final d in popularEmailDomains) {
        if (d.split('.').first == bare) {
          best = d;
          break;
        }
      }
    }
    return best == null ? null : '$local@$best';
  }

  static const popularEmailDomains = [
    'gmail.com', 'mail.ru', 'yandex.ru', 'yandex.com', 'ya.ru', 'icloud.com',
    'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'inbox.ru', 'list.ru',
    'bk.ru', 'rambler.ru', 'protonmail.com', 'proton.me', 'me.com', 'mail.com',
    'umail.uz', 'inbox.uz',
  ];

  static int _lev(String a, String b) {
    if (a == b) return 0;
    var prev = List<int>.generate(b.length + 1, (j) => j);
    for (var i = 1; i <= a.length; i++) {
      final cur = <int>[i];
      for (var j = 1; j <= b.length; j++) {
        final cost = a[i - 1] == b[j - 1] ? 0 : 1;
        cur.add([prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost].reduce((x, y) => x < y ? x : y));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  static String? password(String? v) {
    final s = v ?? '';
    if (s.isEmpty) return 'errRequired';
    if (s.length < 8) return 'errPasswordShort';
    return null;
  }

  static String? required(String? v) =>
      (v ?? '').trim().isEmpty ? 'errRequired' : null;

  static String? name(String? v) {
    final s = (v ?? '').trim();
    if (s.isEmpty) return 'errRequired';
    if (s.length < 2) return 'errNameShort';
    return null;
  }

  /// 6 xonali tasdiqlash kodi.
  static String? code(String? v) {
    final s = (v ?? '').trim();
    if (s.isEmpty) return 'errRequired';
    if (!RegExp(r'^\d{6}$').hasMatch(s)) return 'errBadCode';
    return null;
  }
}
