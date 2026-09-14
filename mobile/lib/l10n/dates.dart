import 'strings.dart';

/// SANA VA VAQT — o'zbekcha.
///
/// `intl` paketi QO'SHILMAYDI: u ~1 MB qo'shadi va bizga faqat oy
/// nomlari hamda "necha vaqt oldin" kerak. Ikkalasi ham qo'lda
/// yozilganda aniqroq chiqadi — o'zbek tilida "2 soat oldin"
/// emas, lentada qisqa "2 SOAT" ishlatiladi.

const _monthsUz = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
];

/// "14 sentabr" — sarlavha ostidagi eyebrow uchun.
String monthDay(DateTime d) => '${d.day} ${tr(_monthsUz[d.month - 1])}';

/// "14.09.2026" — buyurtma va to'lov tarixida.
///
/// Mono shriftda ustma-ust tekis turishi uchun har qism ikki
/// xonali.
String shortDate(DateTime d) =>
    '${_two(d.day)}.${_two(d.month)}.${d.year}';

/// "14.09.2026 · 14:22".
String dateTime(DateTime d) =>
    '${shortDate(d)} · ${_two(d.hour)}:${_two(d.minute)}';

/// "14:22".
String clock(DateTime d) => '${_two(d.hour)}:${_two(d.minute)}';

/// LENTADAGI QISQA VAQT — "HOZIR", "2 SOAT", "1 KUN".
///
/// "oldin" so'zi ATAYLAB yo'q: lentada har qatorda takrorlansa
/// shovqin bo'ladi, ma'no esa kontekstdan tushunarli.
String ago(DateTime? d) {
  if (d == null) return '';
  final diff = DateTime.now().difference(d);
  if (diff.inMinutes < 1) return tr('hozir');
  if (diff.inMinutes < 60) return '${diff.inMinutes} ${tr('daqiqa')}';
  if (diff.inHours < 24) return '${diff.inHours} ${tr('soat')}';
  if (diff.inDays < 7) return '${diff.inDays} ${tr('kun')}';
  return monthDay(d);
}

/// STORY QOLGAN VAQTI — "18 soat qoldi".
String remaining(DateTime? expiresAt) {
  if (expiresAt == null) return '';
  final diff = expiresAt.difference(DateTime.now());
  if (diff.isNegative) return tr('tugadi');
  if (diff.inHours < 1) return '${diff.inMinutes} ${tr('daqiqa qoldi')}';
  return '${diff.inHours} ${tr('soat qoldi')}';
}

String _two(int v) => v < 10 ? '0$v' : '$v';
