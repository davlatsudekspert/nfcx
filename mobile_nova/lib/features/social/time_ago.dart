import '../../l10n/gen/app_localizations.dart';

/// "2 soat oldin" — lenta kartasi, post tafsiloti va izohlar uchun
/// BITTA qoida (Instagram kabi).
///
/// Ilgari postda ham, izohda ham vaqt umuman ko'rinmasdi: odam
/// e'lon bugun yozilganmi yoki bir yil oldinmi — bilmasdi. Uch joyda
/// alohida hisoblansa, biri "3 kun", boshqasi sana ko'rsatib qolardi —
/// shuning uchun bitta yordamchi.
///
/// Telefon vaqtida (`toLocal`): server UTC beradi. Kelajakdagi sana
/// (telefon soati orqada) "hozirgina" bo'ladi — "-2 daqiqa" emas.
/// Bir oydan eskisi — aniq sana: "34 hafta oldin" o'qishga noqulay.
String timeAgo(DateTime at, L l, {DateTime? now}) {
  final local = at.toLocal();
  final d = (now ?? DateTime.now()).difference(local);
  if (d.inMinutes < 1) return l.timeAgoJustNow;
  if (d.inHours < 1) return l.timeAgoMinutes(d.inMinutes);
  if (d.inDays < 1) return l.timeAgoHours(d.inHours);
  if (d.inDays < 7) return l.timeAgoDays(d.inDays);
  if (d.inDays < 28) return l.timeAgoWeeks(d.inDays ~/ 7);
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(local.day)}.${two(local.month)}.${local.year}';
}
