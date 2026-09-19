import '../network/api_client.dart';

/// Serverdan kelgan media manzilini TO'LIQ manzilga aylantiradi.
///
/// ## NIMA UCHUN KERAK
///
/// Backend yuklangan fayllarni NISBIY yo'l bilan qaytaradi. Buni
/// `hosting/worker.js` dagi `safeUrl` ochiq ko'rsatadi:
///
///     if (url.startsWith('/uploads/') ||
///         url.startsWith('/business-assets/')) return url;
///
/// Ya'ni avatar, muqova, post rasmi, istorya, video va musiqa —
/// hammasi `/uploads/xxxx` ko'rinishida keladi, domensiz.
///
/// SAYT uchun bu to'g'ri: brauzer sahifani o'sha domendan ochgan,
/// shuning uchun nisbiy yo'l o'zi to'liq manzilga aylanadi. ILOVA
/// esa hech qanday domenda turmaydi. `Uri.parse('/uploads/x')` —
/// sxemasiz, xostsiz manzil; ExoPlayer ham, rasm keshi ham uni
/// ocholmaydi.
///
/// Aynan shu sababdan E2E #6 da `Music player` FAIL bo'ldi:
/// hisobdagi trek `/uploads/6b8fd42d944f7543da7c` edi va
/// `VideoPlayerController.networkUrl` uni darhol rad etdi.
///
/// MENING SINOVIM BU XATONI YASHIRGAN edi: backend to'plamida men
/// manzilni O'ZIM to'ldirib yuborardim —
///
///     api.get(url.startsWith('http') ? url : '/$url')
///
/// — shuning uchun "trek fayli serverdan olindi" qatori PASS
/// bo'lardi, ilovada esa o'sha fayl hech qachon ochilmasdi. Sinov
/// ilova qiladigan ishni qilishi kerak edi, o'zinikini emas.
///
/// ## QOIDA
///
/// * bo'sh — bo'sh qoladi (chaqiruvchi o'zi zaxira ko'rinish beradi);
/// * `http://` yoki `https://` — TEGILMAYDI. Server tashqi havolaga
///   ham ruxsat beradi (`safeUrl` ichidagi `new URL(...)` shoxi);
/// * `data:` — tegilmaydi, bu allaqachon o'zida to'liq;
/// * qolgani — `kApiBase` ga ulanadi.
String mediaUrl(String raw) {
  final s = raw.trim();
  if (s.isEmpty) return '';
  if (s.startsWith('http://') ||
      s.startsWith('https://') ||
      s.startsWith('data:')) {
    return s;
  }
  // Qo'sh slashdan saqlanamiz: `kApiBase` oxirida `/` bo'lishi
  // mumkin, nisbiy yo'l boshida ham `/` bor.
  final base = kApiBase.endsWith('/')
      ? kApiBase.substring(0, kApiBase.length - 1)
      : kApiBase;
  return s.startsWith('/') ? '$base$s' : '$base/$s';
}

/// `mediaUrl` ning TESKARISI — serverga YOZISH uchun.
///
/// ## NIMA UCHUN KERAK
///
/// O'qishda model manzilni to'ldiradi, shuning uchun tahrirlash
/// ekranidagi maydon TO'LIQ manzil bilan to'ladi:
///
///     _avatarUrl = id.avatarUrl;   // https://nfcstore.uz/uploads/av.jpg
///
/// Foydalanuvchi faqat ismini o'zgartirib saqlasa, o'sha to'liq
/// manzil serverga qaytib ketardi. Server uni RAD ETMAYDI —
/// `safeUrl` ichidagi `new URL(...)` shoxi to'g'ri http(s) manzilni
/// qabul qiladi — va bazaga absolyut manzil yozilardi.
///
/// Ishlashda ko'rinmaydi, lekin yozuv DOMENGA bog'lanib qoladi:
/// domen o'zgarsa yoki yozuv boshqa muhitga ko'chirilsa, rasm
/// yo'qoladi. Saqlanadigan shakl o'zgarmasligi kerak.
///
/// Shuning uchun yozishdan oldin bazamizning prefiksi olib
/// tashlanadi. BEGONA domen tegilmaydi: u haqiqatan tashqi havola.
String storageUrl(String full) {
  final s = full.trim();
  if (s.isEmpty) return '';
  final base = kApiBase.endsWith('/')
      ? kApiBase.substring(0, kApiBase.length - 1)
      : kApiBase;
  return s.startsWith('$base/') ? s.substring(base.length) : s;
}
