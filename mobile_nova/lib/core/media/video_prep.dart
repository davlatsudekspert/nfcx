import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'mp4_faststart.dart';

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
/// Android'da video qayta siqilmaydi, faqat `moov` fayl boshiga
/// ko'chiriladi ([mp4Faststart]) — Android kamerasi uni oxiriga yozadi
/// va Reels'da har video 1-2 soniya qora ekran bilan ochilardi (egasi,
/// 2026-09-27). Biror qadam o'xshamasa ham asl fayl yuboriladi: eng
/// yomon holatda avvalgidek ishlaydi, foydalanuvchi to'xtab qolmaydi.
const videoPrepChannel = MethodChannel('uz.nfcstore.nova/video');

/// Yuklashga tayyor video yo'li: yangi vaqtinchalik `.mp4` (chaqiruvchi
/// yuklagandan keyin o'chiradi) yoki o'zgartirish kerak bo'lmasa —
/// [path] ning o'zi.
Future<String> prepareVideoForUpload(String path) async {
  if (kIsWeb) return path;
  if (defaultTargetPlatform != TargetPlatform.iOS) {
    final dir = Directory.systemTemp.path;
    final out = '$dir/nova_fs_${DateTime.now().microsecondsSinceEpoch}.mp4';
    return await mp4Faststart(path, outPath: out) ?? path;
  }
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
