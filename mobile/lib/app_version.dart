/// ILOVA VERSIYASI — Sozlamalar oxirida ko'rsatiladi.
///
/// NIMA UCHUN UMUMAN KERAK: telefonda sinovda "bu o'zgarish
/// ko'rinmayapti" deyilganda ILOVA QAYSI BUILD ekanini aniqlashning
/// yo'li yo'q edi.
///
/// QAYERDAN KELADI: CI har qurilishda `--dart-define=APP_VERSION`
/// beradi va u YERDAGI raqam `--build-number` bilan bir xil
/// (GitHub Actions qurilish raqami). Ya'ni ekrandagi yozuv aynan
/// o'sha qurilishni ko'rsatadi.
///
/// NIMA UCHUN `package_info_plus` EMAS: bitta satr uchun yangi
/// NATIV bog'liqlik qo'shish ortiqcha xavf (Play Store imzosi,
/// ruxsatlar, iOS tayyorgarligi).
///
/// ZAXIRA QIYMAT — `pubspec.yaml` dagi versiya. U mahalliy
/// qurilishda va testda ishlaydi.
/// `test/app_version_test.dart` zaxira qiymat `pubspec.yaml` bilan
/// bir xilligini tekshiradi: biri o'zgarib, ikkinchisi qolib
/// ketsa test yiqiladi.
const String appVersionFallback = '1.0.0+1';

const String appVersion =
    String.fromEnvironment('APP_VERSION', defaultValue: appVersionFallback);
