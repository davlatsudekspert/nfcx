import 'package:flutter/widgets.dart';
import 'package:share_plus/share_plus.dart' show Share;

import '../../state/app_state.dart';

/// ULASHISH VA PROFIL MANZILI.
///
/// BAZA MANZILI BU YERDA YOZILMAYDI. U `Api.baseUrl` da bitta joyda
/// turadi va shu yerdan o'qiladi — aks holda ilova va sayt ikkiga
/// bo'linib ketardi (buni `test/rules_test.dart` qo'riqlaydi).

/// Tizimning o'z ulashish oynasi.
///
/// Ilova ichida "ulashish" ro'yxati chizilmaydi: odam Telegram,
/// WhatsApp yoki nusxalashni allaqachon tizimdan biladi va u yerda
/// uning barcha ilovalari bor.
///
/// Xato yutiladi: ulashish oynasi ochilmasa ham oqim to'xtamaydi.
Future<void> shareText(BuildContext context, String text) async {
  try {
    await Share.share(text);
  } catch (_) {}
}

/// To'liq profil havolasi — ulashish uchun.
String profileUrl(
  BuildContext context,
  String code, {
  bool company = false,
}) {
  final base = AppScope.read(context).api.baseUrl;
  return '$base/${company ? 'c/' : ''}${code.toLowerCase()}';
}

/// Ekranda ko'rsatiladigan qisqa ko'rinish — `nfcstore.uz/gld777`.
///
/// Sxema (`https://`) olib tashlanadi: u ekranda joy egallaydi va
/// hech qanday ma'no bermaydi.
String profileHandle(
  BuildContext context,
  String code, {
  bool company = false,
}) =>
    profileUrl(context, code, company: company)
        .replaceFirst(RegExp(r'^https?://'), '');
