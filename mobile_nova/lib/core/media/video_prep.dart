import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// IPHONE VIDEOSI → H.264 MP4 (egasi, 2026-09-27: "reels qo'yish, post
/// qo'yishni ham tekshir").
///
/// iPhone kamerasi va galereyasi videoni `.MOV` qilib beradi, kodek esa
/// odatda HEVC ("Yuqori samaradorlik" rejimi). Server faylni qabul
/// qiladi, lekin HEVC hamma Android telefon va brauzerda o'ynamaydi —
/// iPhone'dan qo'yilgan reels boshqalarda qora ekran bo'lib qolardi.
///
/// Shuning uchun iOS'da yuklashdan OLDIN video iOS'ning o'z
/// `AVAssetExportSession` i bilan 1080p H.264 `.mp4` ga o'tkaziladi
/// (`ios/Runner/AppDelegate.swift`, kanal [videoPrepChannel]). 4K
/// video ham 1080p ga tushadi — yuklash bir necha barobar tezroq,
/// `moov` fayl boshida bo'lgani uchun ijro ham darhol boshlanadi.
///
/// Android va boshqa platformada fayl O'ZGARMAYDI. Eksport biror
/// sababdan o'xshamasa ham asl fayl yuboriladi: eng yomon holatda
/// avvalgidek ishlaydi, foydalanuvchi to'xtab qolmaydi.
const videoPrepChannel = MethodChannel('uz.nfcstore.nova/video');

/// Yuklashga tayyor video yo'li. iOS'da — yangi vaqtinchalik `.mp4`
/// (chaqiruvchi yuklagandan keyin o'chirishi mumkin), boshqa joyda —
/// [path] ning o'zi.
Future<String> prepareVideoForUpload(String path) async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.iOS) return path;
  try {
    final out = await videoPrepChannel
        .invokeMethod<String>('toMp4', <String, Object>{'path': path});
    return (out == null || out.isEmpty) ? path : out;
  } on PlatformException {
    return path;
  } on MissingPluginException {
    return path;
  }
}
