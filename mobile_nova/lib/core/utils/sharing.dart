import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

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

Future<void> _invoke(String text, String? subject) {
  final o = shareInvokerOverride;
  if (o != null) return o(text, subject);
  return Share.share(text, subject: subject);
}

Future<bool> _share(String raw, {String? subject}) async {
  final s = raw.trim();
  if (s.isEmpty) return false;
  try {
    await _invoke(s, subject).timeout(shareTimeout);
    return true;
  } catch (_) {
    // Osilib qolgan ham, xato bergan ham bir xil yakun topadi:
    // havola odamning bufferida.
    await _copy(s);
    return false;
  }
}

Future<void> _copy(String s) async {
  try {
    await Clipboard.setData(ClipboardData(text: s));
  } catch (_) {
    // Bufer ham ishlamasa qiladigan ish qolmadi — lekin ilova
    // yiqilmasligi kerak.
  }
}

/// Havolani ulashadi (profil, karta, post manzili).
Future<bool> shareLink(String url, {String? title}) =>
    _share(url, subject: title);

/// Matnni ulashadi (post matni).
Future<bool> shareText(String text) => _share(text);
