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

  static String? phone(String? v) {
    final s = normalizePhone(v ?? '');
    if (s.isEmpty) return 'errRequired';
    if (!_phone.hasMatch(s)) return 'errBadPhone';
    return null;
  }

  /// `+998 90 123 45 67`, `998901234567`, `901234567` — hammasi
  /// `+998901234567` ga keltiriladi.
  ///
  /// NIMA UCHUN: foydalanuvchi raqamni xohlagan ko'rinishda yozadi, backend
  /// esa bitta qat'iy shaklni kutadi. Normalizatsiya UI'da bo'lmasa,
  /// to'g'ri raqam ham "noto'g'ri" deb rad etilardi.
  static String normalizePhone(String raw) {
    var d = raw.replaceAll(RegExp(r'[^\d+]'), '');
    if (d.startsWith('+')) d = d.substring(1);
    if (d.startsWith('998')) return '+$d';
    if (d.length == 9) return '+998$d';
    return d.isEmpty ? '' : '+$d';
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
