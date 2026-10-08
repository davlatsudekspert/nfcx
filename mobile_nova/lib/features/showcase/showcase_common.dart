import '../../l10n/gen/app_localizations.dart';

/// KO'RGAZMA — umumiy qoidalar (ekran, yaratish, lenta kartasi).

/// Ko'rgazmadagi tashqi havola turi. Ilova uni FAQAT tashqarida ochadi
/// (`openLink`): ichiga joylanmaydi, o'zi o'ynamaydi.
enum ShowcaseLinkKind { youtube, instagram }

/// Havola ruxsat etilganmi (shartnoma §3): faqat `https` va
/// `youtube.com` / `youtu.be` / `instagram.com` (`www.` yoki `m.` bilan
/// ham). Boshqasi — `null`.
ShowcaseLinkKind? showcaseLinkKind(String url) {
  final s = url.trim();
  if (s.isEmpty || s.contains(RegExp(r'\s'))) return null;
  final u = Uri.tryParse(s);
  if (u == null || u.scheme != 'https' || u.host.isEmpty) return null;
  // `https://youtube.com@boshqa.uz` — Uri xostni to'g'ri ajratadi, lekin
  // foydalanuvchi qismi bilan havola umuman qabul qilinmaydi.
  if (u.userInfo.isNotEmpty || u.hasPort) return null;
  var h = u.host.toLowerCase();
  if (h.startsWith('www.')) {
    h = h.substring(4);
  } else if (h.startsWith('m.')) {
    h = h.substring(2);
  }
  return switch (h) {
    'youtube.com' || 'youtu.be' => ShowcaseLinkKind.youtube,
    'instagram.com' => ShowcaseLinkKind.instagram,
    _ => null,
  };
}

/// "YouTube'da ochish" / "Instagram'da ochish".
String showcaseLinkLabel(L l, ShowcaseLinkKind k) => switch (k) {
  ShowcaseLinkKind.youtube => l.showcaseOpenYoutube,
  ShowcaseLinkKind.instagram => l.showcaseOpenInstagram,
};

/// Raqamni uch xonadan ajratadi: 1250000 → "1 250 000".
String groupThousands(int n) {
  final neg = n < 0;
  final s = n.abs().toString();
  final buf = StringBuffer(neg ? '-' : '');
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
    buf.write(s[i]);
  }
  return buf.toString();
}

/// Narx — faqat so'mda: "125 000 so‘m" / "125 000 сум" / "125 000 UZS".
String formatUzs(L l, int amount) =>
    '${groupThousands(amount)} ${l.currencyUzs}';

/// Ko'rgazma cheklovlari (server bilan bir xil).
abstract final class ShowcaseLimits {
  static const minImages = 1;
  static const maxImages = 5;
  static const titleMax = 80;
  static const maxPrice = 10000000000;

  /// Slayd almashish vaqti tanlovlari (soniya).
  static const slideSeconds = [3, 5, 8, 10];
  static const defaultSlideSeconds = 5;
}

/// Ko'rgazma formasidagi muammo (mijoz tomonida, serverdan OLDIN).
enum ShowcaseIssue {
  noImages,
  tooManyImages,
  titleTooLong,
  badPrice,
  priceTooHigh,
  badLink,
}

String showcaseIssueText(L l, ShowcaseIssue i) => switch (i) {
  ShowcaseIssue.noImages => l.errShowcaseNoImages,
  ShowcaseIssue.tooManyImages => l.errShowcaseTooManyImages,
  ShowcaseIssue.titleTooLong => l.errShowcaseTitleLong,
  ShowcaseIssue.badPrice => l.errShowcaseBadPrice,
  ShowcaseIssue.priceTooHigh => l.errShowcasePriceHigh,
  ShowcaseIssue.badLink => l.errShowcaseBadLink,
};

/// Narx maydoni: bo'sh — `null` (narxsiz); faqat raqam (oraliq
/// bo'shliqlar — ming ajratgichi — e'tiborsiz). Raqam bo'lmasa
/// [FormatException].
int? parsePriceInput(String raw) {
  final s = raw.replaceAll(RegExp(r'[\s ]'), '');
  if (s.isEmpty) return null;
  if (!RegExp(r'^\d+$').hasMatch(s)) {
    throw FormatException('price', raw);
  }
  // Juda uzun satr `int` dan oshmasin — chegaradan katta deb olinadi.
  if (s.length > 13) return ShowcaseLimits.maxPrice + 1;
  return int.parse(s);
}

/// Butun formani tekshiradi; muammolar tartib bilan (birinchisi —
/// ko'rsatiladigani).
List<ShowcaseIssue> validateShowcase({
  required int images,
  String title = '',
  String price = '',
  String link = '',
}) {
  final out = <ShowcaseIssue>[];
  if (images < ShowcaseLimits.minImages) out.add(ShowcaseIssue.noImages);
  if (images > ShowcaseLimits.maxImages) out.add(ShowcaseIssue.tooManyImages);
  // Server ham UTF-16 uzunligini sanaydi (JS `length`).
  if (title.trim().length > ShowcaseLimits.titleMax) {
    out.add(ShowcaseIssue.titleTooLong);
  }
  try {
    final p = parsePriceInput(price);
    if (p != null && p > ShowcaseLimits.maxPrice) {
      out.add(ShowcaseIssue.priceTooHigh);
    }
  } on FormatException {
    out.add(ShowcaseIssue.badPrice);
  }
  if (link.trim().isNotEmpty && showcaseLinkKind(link) == null) {
    out.add(ShowcaseIssue.badLink);
  }
  return out;
}
