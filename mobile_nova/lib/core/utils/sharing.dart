import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../network/api_client.dart';
import 'external_link.dart';

/// Tizim "ulashish" oynasini ochadigan yagona joy.
///
/// NIMA UCHUN O'RAM: `share_plus` API'si versiyalar orasida o'zgaradi
/// (`Share.share` → `SharePlus.instance.share`). Chaqiruv o'nlab joyda
/// takrorlangani uchun paket yangilanganda shu bitta fayl tuzatiladi.
///
/// ## NIMA UCHUN TIMEOUT BOR — "QOTIB QOLISH" SHU YERDAN
///
/// Telefon testida "har qanday profilga kirib ulashishni bossa qotib
/// qolyapti" deb xabar qilindi. Sabab shu: `Share.share()` PLATFORMA
/// KANALI orqali ishlaydi va agar qurilmada `ACTION_SEND` ni qabul
/// qiladigan ilova bo'lmasa (emulyator, BlueStacks, yalang'och
/// Android obrazi), kanal javobni UMUMAN QAYTARMAYDI — xato ham
/// otilmaydi. `await` shu yerda abadiy osilib qoladi: tugma
/// bosilgan, "yuklanmoqda" holati tushib qolgan, hech narsa
/// bo'lmaydi.
///
/// `try/catch` buni USHLAMAYDI, chunki istisno yo'q — javob yo'q.
/// Faqat `timeout` qutqaradi.
///
/// Shuning uchun uch qavatli himoya:
///   1. `timeout` — kanal javob bermasa kutish TO'XTAYDI;
///   2. `catch`  — kanal xato qaytarsa ushlanadi;
///   3. ikkala holatda ham manzil BUFERGA ko'chiriladi, ya'ni odam
///      baribir havolani qo'lga oladi.
///
/// `true`  — tizim oynasi ochildi, qo'shimcha hech narsa kerak emas.
/// `false` — ochilmadi; manzil buferga ko'chirildi, ekran shuni
///           aytib qo'yishi kerak.

/// Platforma chaqiruvining o'rnini bosuvchi — FAQAT sinov uchun.
///
/// Sinovda haqiqiy platforma kanali yo'q, shuning uchun osilib
/// qolish yoki xato otilishini shu nuqtadan taqlid qilamiz.
@visibleForTesting
Future<void> Function(String text, String? subject)? shareInvokerOverride;

/// Kanal javobini kutish chegarasi.
///
/// Android'da `Share.share` `startActivity` dan keyin DARHOL
/// qaytadi (natijani kutadigani — `shareWithResult`), shuning uchun
/// 5 soniya haqiqiy oyna uchun ortig'i bilan yetarli, osilib
/// qolgan kanal uchun esa sezilarli kutish emas.
@visibleForTesting
Duration shareTimeout = const Duration(seconds: 5);

Future<void> _invoke(String text, String? subject, Rect origin) {
  final o = shareInvokerOverride;
  if (o != null) return o(text, subject);
  return Share.share(text, subject: subject, sharePositionOrigin: origin);
}

/// Ulashish oynasi "chiqadigan" nuqta — iOS UCHUN SHART.
///
/// `share_plus` iOS'da oyna popover bo'lib ochilsa (iPad, iOS 26 da
/// iPhone ham) va nuqta bo'sh bo'lsa, oynani UMUMAN OCHMAYDI —
/// darhol `sharePositionOrigin: argument must be set` xatosi qaytadi.
/// Ilova hech qayerda nuqta bermagani uchun iPhone'da "Ulashish"
/// bosilardi-yu, hech narsa bo'lmasdi (egasi, 2026-10-04).
///
/// Tugma `context` i berilsa — oyna aynan undan chiqadi; aks holda
/// ekran markazidagi kichik to'rtburchak (doim ko'rinish ichida).
Rect shareOrigin([BuildContext? context]) {
  final box = context?.findRenderObject();
  if (box is RenderBox && box.hasSize && !box.size.isEmpty) {
    return box.localToGlobal(Offset.zero) & box.size;
  }
  final views = WidgetsBinding.instance.platformDispatcher.views;
  if (views.isNotEmpty) {
    final v = views.first;
    final size = v.physicalSize / v.devicePixelRatio;
    if (!size.isEmpty) {
      return Rect.fromCenter(
          center: size.center(Offset.zero), width: 2, height: 2);
    }
  }
  return const Rect.fromLTWH(1, 1, 2, 2);
}

Future<bool> _share(String raw, {String? subject, BuildContext? context}) async {
  final s = raw.trim();
  if (s.isEmpty) return false;
  try {
    final call = _invoke(s, subject, shareOrigin(context));
    // iOS'da natija oyna YOPILGANDA keladi (odam ilovani tanlab
    // turgan bo'lishi mumkin) — u yerda taymaut "ochilmadi" deb
    // noto'g'ri xulosa qilardi. Xato esa iOS'da darhol qaytadi.
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      await call;
    } else {
      await call.timeout(shareTimeout);
    }
    return true;
  } catch (_) {
    // Osilib qolgan ham, xato bergan ham bir xil yakun topadi:
    // havola odamning bufferida.
    await copyToClipboard(s);
    return false;
  }
}

/// Havolani ulashadi (profil, karta, post manzili).
Future<bool> shareLink(String url, {String? title, BuildContext? context}) =>
    _share(url, subject: title, context: context);

/// Matnni ulashadi (post matni).
Future<bool> shareText(String text, {BuildContext? context}) =>
    _share(text, context: context);

/// Tugmadan ulashadi va oyna ochilmasa (havola buferga ko'chgan)
/// buni ekranda aytadi — jim qolib "ishlamayapti" taassuroti bermaydi.
Future<void> shareWithFeedback(
  BuildContext context,
  String text, {
  String? subject,
  required String copiedMessage,
}) async {
  final ok = await _share(text, subject: subject, context: context);
  if (ok || !context.mounted) return;
  ScaffoldMessenger.maybeOf(context)
    ?..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(copiedMessage)));
}

/// Post / Reels uchun ulashiladigan matn: izoh + AYNAN SHU POST havolasi.
///
/// Havola — `/post/<id>?code=<kod>` (kompaniya posti — `&company=1`).
/// Egasi (2026-10-04): ilgari muallif profili ulashilardi va havolani
/// ochgan odam Reels'ni emas, profilni ko'rardi. Sayt bu yo'lda postning
/// o'z sahifasini beradi (video, muallif, Telegram kartochkasi), Android'da
/// ilova o'rnatilgan bo'lsa havola ilovada shu postni ochadi (App Links
/// `/post/`). [postId] bo'lmasa (masalan istorya) — muallif sahifasi.
String contentShareText({
  required String caption,
  required String code,
  required bool company,
  int postId = 0,
}) {
  final c = code.trim();
  final enc = Uri.encodeComponent(c);
  final link = postId > 0
      ? '$kApiBase/post/$postId${c.isEmpty ? '' : '?code=$enc'}'
          '${company ? (c.isEmpty ? '?company=1' : '&company=1') : ''}'
      : c.isEmpty
          ? ''
          : company
              ? '$kApiBase/c/$enc'
              : '$kApiBase/$enc';
  return [caption.trim(), link].where((s) => s.isNotEmpty).join('\n\n');
}
