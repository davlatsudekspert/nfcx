import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

/// TASHQI MANZILNI OCHADIGAN YAGONA JOY (to'lov sahifasi, havolalar).
///
/// ## NIMA UCHUN TIMEOUT
///
/// `launchUrl` ham, `Share.share` kabi, PLATFORMA KANALI orqali
/// ishlaydi va kanal javob bermasligi mumkin: brauzer o'rnatilmagan
/// muhitda, cheklangan Android obrazida yoki emulyatorda chaqiruv
/// javobsiz qoladi — istisno OTILMAYDI. O'shanda `await` abadiy
/// osilib qoladi va tugma cheksiz "yuklanmoqda" holatida turadi.
///
/// Bu xulq sinovda ham aynan takrorlanadi: `launchUrl` ni oddiy
/// widget testida chaqirsangiz test TUGAMAYDI. Ya'ni bu nazariy
/// ehtimol emas, o'lchangan haqiqat.
///
/// Shuning uchun uch qavat: `timeout`, `catch` va oxirida manzilni
/// BUFERGA ko'chirish — odam havolani baribir qo'lga oladi.
///
/// `true`  — tashqi ilova ochildi.
/// `false` — ochilmadi; manzil buferga ko'chirildi.

@visibleForTesting
Future<bool> Function(Uri url)? openLinkOverride;

@visibleForTesting
Duration openLinkTimeout = const Duration(seconds: 5);

Future<bool> _invoke(Uri u) {
  final o = openLinkOverride;
  if (o != null) return o(u);
  return launchUrl(u, mode: LaunchMode.externalApplication);
}

Future<bool> openLink(String url) async {
  final s = url.trim();
  if (s.isEmpty) return false;
  final uri = Uri.tryParse(s);
  if (uri == null) return false;

  try {
    final ok = await _invoke(uri).timeout(openLinkTimeout);
    if (ok) return true;
  } catch (_) {
    // Javobsizlik ham, xato ham pastdagi bir xil yakunga boradi.
  }
  await copyToClipboard(s);
  return false;
}

/// Buferga ko'chirish — U HAM OSILIB QOLISHI MUMKIN.
///
/// `Clipboard.setData` ham platforma kanali. O'lchandi: kanal
/// javob bermasa chaqiruv qaytmaydi. Ya'ni "zaxira yo'l" ning
/// o'zi tugmani qotirib qo'yishi mumkin edi — shuning uchun unga
/// ham chegara qo'yilgan.
Future<bool> copyToClipboard(String text) async {
  try {
    await Clipboard.setData(ClipboardData(text: text))
        .timeout(const Duration(seconds: 2));
    return true;
  } catch (_) {
    // Bufer ham ishlamasa qiladigan ish qolmadi — lekin ilova
    // yiqilmasligi ham, qotib qolmasligi ham kerak.
    return false;
  }
}
