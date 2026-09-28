import 'dart:async';
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
/// Android'da: katta video (qisqa tomoni > 1080 yoki bitreyti > 8 Mbit/s)
/// Media3 Transformer bilan 1080p H.264 ~6 Mbit/s ga tushadi (egasi,
/// 2026-09-28: "katta video yuklashda o'zi moslash" — "ha, albatta");
/// so'ng `moov` fayl boshiga ko'chiriladi ([mp4Faststart]) — Android
/// kamerasi uni oxiriga yozadi va Reels'da video 1-2 soniya qora ekran
/// bilan ochilardi (2026-09-27). Biror qadam o'xshamasa ham asl fayl
/// yuboriladi: eng yomon holatda avvalgidek, foydalanuvchi to'xtamaydi.
const videoPrepChannel = MethodChannel('uz.nfcstore.nova/video');

/// Yuklashga tayyor video yo'li: yangi vaqtinchalik `.mp4` (chaqiruvchi
/// yuklagandan keyin o'chiradi) yoki o'zgartirish kerak bo'lmasa —
/// [path] ning o'zi.
Future<String> prepareVideoForUpload(String path) async {
  if (kIsWeb) return path;
  if (defaultTargetPlatform != TargetPlatform.iOS) {
    final dir = Directory.systemTemp.path;
    final stamp = DateTime.now().microsecondsSinceEpoch;
    // 1) Katta video — Android'ning Media3 Transformer'i bilan 1080p
    //    H.264 ga (MainActivity / VideoCompressor.kt). Kichik video
    //    yoki xato — `null`, asl fayl bilan davom etamiz.
    String? small;
    if (defaultTargetPlatform == TargetPlatform.android) {
      try {
        small = await videoPrepChannel.invokeMethod<String>('compress',
            <String, Object>{'path': path, 'out': '$dir/nova_c_$stamp.mp4'}
        ).timeout(const Duration(minutes: 4));
      } on PlatformException {
        small = null;
      } on MissingPluginException {
        small = null;
      } on TimeoutException {
        small = null;
      }
      if (small != null && small.isEmpty) small = null;
    }
    final base = small ?? path;
    // 2) `moov` fayl boshida bo'lsin — Reels'da darhol ochiladi.
    final fs = await mp4Faststart(base, outPath: '$dir/nova_fs_$stamp.mp4');
    if (fs != null && small != null) File(small).delete().ignore();
    return fs ?? base;
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
