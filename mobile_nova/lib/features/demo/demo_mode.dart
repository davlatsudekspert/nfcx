import 'package:flutter_riverpod/flutter_riverpod.dart';

/// BU EKRAN DEMOMI — va demo bo'lsa, qoidalari qanday.
///
/// Ishlab chiqarishda bu DOIM `null`: ilova avvalgidek ishlaydi va
/// birorta ekran o'zini boshqacha tutmaydi. Faqat "NFC Mobile"
/// bo'limidan ochilgan demo daraxtida u to'ldiriladi.
///
/// Bitta tushuncha uch narsani hal qiladi:
///
///   1. DEMO EKANI KO'RINADI — ekranda "Demo" yorlig'i chiqadi,
///      ya'ni odam buni birovning haqiqiy profili deb o'ylamaydi;
///   2. ULASHISH VA QR ISHLAYDI — demo kodi (`ZZZ777`) saytda
///      mavjud emas, shuning uchun havola SAYTNING O'ZIGA
///      yo'naltiriladi. Aks holda "ulashish" tugmasi ishlagandek
///      ko'rinib, ochilgan havola 404 berardi;
///   3. MA'NOSIZ AMALLAR YASHIRILADI — demo profilni shikoyat
///      qilish yoki bloklash tugmasi chizilmaydi.
class DemoInfo {
  const DemoInfo({required this.shareUrl});

  /// QR va ulashish uchun HAQIQIY, ochiladigan manzil.
  final String shareUrl;
}

final demoModeProvider = Provider<DemoInfo?>((_) => null);
