/// ILOVA VERSIYASI — bitta manba.
///
/// NIMA UCHUN QO'LDA YOZILGAN CONST: versiyani o'qish uchun
/// `package_info_plus` kabi NATIV plagin kerak bo'lardi. Bitta
/// satrlik yozuv uchun yangi nativ bog'liqlik qo'shish — ortiqcha
/// xavf (Play Store imzosi, ruxsatlar, iOS tayyorgarligi).
///
/// DRIFT BO'LMAYDI: `test/app_version_test.dart` bu qiymatni
/// `pubspec.yaml` bilan solishtiradi. Biri o'zgarib, ikkinchisi
/// qolib ketsa test yiqiladi.
///
/// NIMA UCHUN UMUMAN KERAK: telefonda sinovda "bu o'zgarish
/// ko'rinmayapti" deyilganda ILOVA QAYSI BUILD ekanini aniqlashning
/// yo'li yo'q edi. Endi Sozlamalar oxirida turadi.
const String appVersion = '1.0.0+1';
