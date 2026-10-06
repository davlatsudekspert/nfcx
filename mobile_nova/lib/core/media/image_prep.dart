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

/// Server chegarasi — oddiy rasm (`kind` siz). Muqova 20 MB.
const kServerImageLimit = 700 * 1024;

/// Yuklashga tayyor rasm yo'li: yangi vaqtinchalik `.jpg` / `.png`
/// (chaqiruvchi yuklagandan keyin o'chiradi) yoki o'zgartirish kerak
/// bo'lmasa — [path] ning o'zi.
///
/// IKKINCHI BOSQICH (audit 2026-10-06). Birinchi o'tish (1600 px,
/// sifat 85) ham [limitBytes] dan katta bo'lsa — kichikroq o'lcham va
/// sifat bilan yana urinib ko'riladi. Shaffof rasm (logotip) JPEG'ga
/// o'tmaydi: u PNG holida, shaffofligi SAQLANGAN holda kichraytiriladi
/// (`toPng`). Ilgari bunday rasm asl holida ketib, server 700 KB
/// chegarasida rad etardi.
Future<String> prepareImageForUpload(String path,
    {int maxSide = kImagePrepMaxSide, int limitBytes = kServerImageLimit}) async {
  if (kIsWeb) return path;
  if (path.toLowerCase().endsWith('.gif')) return path;
  final int len;
  try {
    len = await File(path).length();
  } on FileSystemException {
    return path;
  }
  if (len <= kImagePrepMinBytes) return path;

  Future<int> sizeOf(String p) async {
    try {
      return await File(p).length();
    } on FileSystemException {
      return 0;
    }
  }

  // 1) JPEG: oddiy o'tish, keyin kerak bo'lsa kichikroq.
  final jpegPasses = <(int, int)>[
    (maxSide, kImagePrepQuality),
    (maxSide < 1280 ? maxSide : 1280, 70),
    (maxSide < 1024 ? maxSide : 1024, 60),
  ];
  String? best;
  for (final (side, q) in jpegPasses) {
    final out = await _native('toJpeg', path, '.jpg', side, quality: q);
    if (out == null) break; // shaffof / kichraymadi / xato
    if (best != null && best != out) File(best).delete().ignore();
    best = out;
    if (await sizeOf(out) <= limitBytes) return out;
  }
  if (best != null) return best;

  // 2) Shaffof (yoki JPEG kichraymagan) va hali ham chegaradan katta —
  //    PNG holida kichraytiriladi, shaffoflik saqlanadi.
  if (len <= limitBytes) return path;
  for (final side in <int>{
    maxSide,
    maxSide < 1280 ? maxSide : 1280,
    maxSide < 1024 ? maxSide : 1024,
    maxSide < 768 ? maxSide : 768,
  }) {
    final out = await _native('toPng', path, '.png', side);
    if (out == null) continue;
    if (best != null && best != out) File(best).delete().ignore();
    best = out;
    if (await sizeOf(out) <= limitBytes) return out;
  }
  return best ?? path;
}

int _seq = 0;

Future<String?> _native(String method, String path, String ext, int maxSide,
    {int? quality}) async {
  final stamp = '${DateTime.now().microsecondsSinceEpoch}_${_seq++}';
  try {
    final out = await videoPrepChannel.invokeMethod<String>(method, <String, Object>{
      'path': path,
      'out': '${Directory.systemTemp.path}/nova_i_$stamp$ext',
      'maxSide': maxSide,
      if (quality != null) 'quality': quality,
    }).timeout(const Duration(seconds: 30));
    return (out == null || out.isEmpty) ? null : out;
  } on PlatformException {
    return null;
  } on MissingPluginException {
    return null;
  } on TimeoutException {
    return null;
  }
}
