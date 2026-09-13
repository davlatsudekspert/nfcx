import 'dart:async';

import 'package:flutter/services.dart' show HapticFeedback;

/// MUVAFFAQIYAT TEBRANISHI — ikki zarba.
///
/// NIMA UCHUN IKKITA: Flutter'da "muvaffaqiyat" naqshi yo'q, bitta
/// zarba esa oddiy tugma bosishdan farq qilmaydi. To'lov o'tdi,
/// buyurtma qabul qilindi, PIN o'rnatildi — bular boshqa hodisa va
/// telefon ham buni boshqacha aytishi kerak.
///
/// Xato yutiladi: haptika bo'lmagan qurilmada oqim to'xtamasin.
Future<void> successHaptic() async {
  try {
    await HapticFeedback.mediumImpact();
    await Future<void>.delayed(const Duration(milliseconds: 90));
    await HapticFeedback.lightImpact();
  } catch (_) {}
}

/// XATO TEBRANISHI — bitta qattiq zarba.
Future<void> errorHaptic() async {
  try {
    await HapticFeedback.heavyImpact();
  } catch (_) {}
}
