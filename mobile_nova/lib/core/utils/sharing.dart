import 'package:share_plus/share_plus.dart';

/// Tizim "ulashish" oynasi.
///
/// NIMA UCHUN O'RAM: `share_plus` API'si versiyalar orasida o'zgaradi
/// (`Share.share` → `SharePlus.instance.share`). Chaqiruv o'nlab joyda
/// takrorlangani uchun paket yangilanganda shu bitta fayl tuzatiladi.
Future<void> shareLink(String url, {String? title}) =>
    Share.share(url, subject: title);

Future<void> shareText(String text) => Share.share(text);
