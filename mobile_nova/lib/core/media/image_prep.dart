import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'video_prep.dart' show videoPrepChannel;

/// RASM YUKLASHDAN OLDIN TELEFONGA MOSLANADI (egasi, 2026-09-28: "rasm,
/// video qo'yilganda razmerni ham, ko'rinishini ham telefonga moslab
/// oladimi — iOS'da ham, APK'da ham"; "shunaqa narsalarga o'zing e'tibor
/// ber").
///
/// Audit: lentadagi ikki post rasmi 2.2 va 1.9 MB PNG edi. `image_picker`
/// `imageQuality` bilan faqat JPEG'ni siqadi — PNG (skrinshot, tayyor
/// dizayn) siqilmasdan o'tadi. Server esa oddiy rasm uchun 700 KB dan
/// kattasini qabul qilmaydi — bunday post xato bilan tugardi.
///
/// Endi [kImagePrepMinBytes] dan katta rasm telefonning o'z vositasi
/// bilan (Android `Bitmap`, iPhone `UIImage`) uzun tomoni [maxSide]
/// gacha kichraytirilib, JPEG ga o'tkaziladi; EXIF burilishi hisobga
/// olinadi. SHAFFOF piksel bo'lsa (logotip) yoki natija kichraymasa —
/// asl fayl. GIF (animatsiya) — tegilmaydi.
const kImagePrepMinBytes = 400 * 1024;
const kImagePrepMaxSide = 1600;
const kImagePrepQuality = 85;

/// Yuklashga tayyor rasm yo'li: yangi vaqtinchalik `.jpg` (chaqiruvchi
/// yuklagandan keyin o'chiradi) yoki o'zgartirish kerak bo'lmasa —
/// [path] ning o'zi.
Future<String> prepareImageForUpload(String path,
    {int maxSide = kImagePrepMaxSide}) async {
  if (kIsWeb) return path;
  if (path.toLowerCase().endsWith('.gif')) return path;
  final int len;
  try {
    len = await File(path).length();
  } on FileSystemException {
    return path;
  }
  if (len <= kImagePrepMinBytes) return path;
  final stamp = DateTime.now().microsecondsSinceEpoch;
  try {
    final out = await videoPrepChannel.invokeMethod<String>('toJpeg', <String, Object>{
      'path': path,
      'out': '${Directory.systemTemp.path}/nova_i_$stamp.jpg',
      'maxSide': maxSide,
      'quality': kImagePrepQuality,
    }).timeout(const Duration(seconds: 30));
    return (out == null || out.isEmpty) ? path : out;
  } on PlatformException {
    return path;
  } on MissingPluginException {
    return path;
  } on TimeoutException {
    return path;
  }
}
