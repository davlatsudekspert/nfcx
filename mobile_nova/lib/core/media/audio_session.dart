import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// ILOVA OVOZI — iPhone audio sessiyasi (egasi, TestFlight 331:
/// "Ko'rgazmada musiqa avto qo'yilmayapti").
///
/// `AVAudioSession` butun ilova uchun BITTA va uni hamma o'zgartiradi:
///
/// * `video_player` faqat BIRINCHI pleerda turkumni `.playback` qiladi;
///   keyingi har pleer ochilganda faqat `mixWithOthers` belgisini
///   o'sha paytdagi turkumga qo'yadi/olib tashlaydi (yangi paket emas —
///   `video_player_avfoundation`, `FVPVideoPlayerPlugin.m`);
/// * Asosiydagi ovozsiz reklama kartasi (`mixWithOthers: true`) sessiyani
///   "aralashuvchi" qilib qoldiradi;
/// * YouTube/Instagram WebView'i o'z ijrosi bilan sessiyani uzib
///   qo'yishi mumkin.
///
/// Ilovada sessiyani qayta yoqadigan joy yo'q edi. Endi Ko'rgazma
/// musiqasi (yoki o'z ovozli video reklama) `play()` dan OLDIN
/// [claimPlayback] ni chaqiradi: iOS'da turkum `.playback`
/// (aralashmaydi), sessiya faol (`ios/Runner/AppDelegate.swift`,
/// `NovaAudioSession`). Android'da hech narsa qilinmaydi — u yerda
/// fokusni har pleerning o'zi oladi.
const audioSessionChannel = MethodChannel('uz.nfcstore.nova/audio');

/// iOS: ilova ovozi uchun sessiyani tayyorlaydi. Xato yoki kanal yo'q
/// (sinov, eski build) — jim o'tadi, ijro odatdagidek urinadi.
Future<void> claimPlayback() async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.iOS) return;
  try {
    await audioSessionChannel.invokeMethod<bool>('playback');
  } catch (_) {
    // Sessiya band yoki kanal yo'q — pleer baribir `play()` qiladi.
  }
}
