import 'ru.dart';
import 'en.dart';

/// ILOVA TILI.
enum AppLocale {
  uz('uz', 'O‘zbekcha'),
  ru('ru', 'Русский'),
  en('en', 'English');

  const AppLocale(this.code, this.label);

  /// `uz` / `ru` / `en` — saqlanadigan kalit.
  final String code;

  /// Sozlamalarda ko'rinadigan nom. TARJIMA QILINMAYDI: har til o'z
  /// nomini o'z tilida ko'rsatadi, aks holda odam ro'yxatdan o'z
  /// tilini topa olmasdi.
  final String label;

  static AppLocale byCode(String? code) =>
      AppLocale.values.firstWhere((l) => l.code == code, orElse: () => AppLocale.uz);
}

/// TARJIMA — kalit sifatida O'ZBEKCHA MATNNING O'ZI ishlatiladi.
///
/// NIMA UCHUN `K.saveButton` kabi kalitlar EMAS:
///
///  1. TARJIMA TOPILMASA HAM TO'G'RI MATN CHIQADI. Kalitli tizimda
///     unutilgan satr ekranda `save_button` bo'lib chiqadi — bu
///     foydalanuvchi uchun buzilgan ilova. Bu yerda esa eng yomon
///     holatda o'zbekcha matn qoladi, ya'ni ilova ishlayveradi.
///  2. Kod O'QILADIGAN bo'lib qoladi: `tr('Saqlash')` nima
///     yozilishini ko'rsatadi, `tr(K.s_042)` esa yo'q.
///  3. Yangi satr qo'shganda kalit o'ylab topish shart emas —
///     unutilgan tarjima esa skript bilan topiladi
///     (`dart run tool/l10n_check.dart`).
///
/// MAVZU BILAN BIR XIL MEXANIZM: `tr()` — funksiya chaqiruvi, ya'ni
/// uni ishlatgan widget `const` bo'la olmaydi va til almashganda
/// QAYTA QURILADI.
AppLocale _locale = AppLocale.uz;

/// Joriy til.
AppLocale get currentLocale => _locale;

/// Tilni almashtirish. Chaqirgandan keyin ildizda `setState` SHART.
void applyLocale(AppLocale l) => _locale = l;

/// O'zbekcha matnni joriy tilga o'giradi.
///
/// Topilmasa — o'zbekcha matnning o'zi qaytadi.
String tr(String uz) {
  switch (_locale) {
    case AppLocale.uz:
      return uz;
    case AppLocale.ru:
      return ruStrings[uz] ?? uz;
    case AppLocale.en:
      return enStrings[uz] ?? uz;
  }
}

/// O'RNI ALMASHADIGAN MATN.
///
/// NIMA UCHUN KERAK: "Payme tomonidan himoyalangan" — o'zbekchada
/// nom OLDIN, ruschada KEYIN keladi ("Защищено Payme"). Matnni
/// bo'laklarga bo'lib ulash bu farqni yo'qotadi va tarjima
/// g'aliz chiqadi. Shuning uchun butun jumla tarjima qilinadi,
/// o'zgaruvchi esa `{nom}` bo'lib turadi.
///
///   trf('{tizim} tomonidan himoyalangan', {'tizim': 'Payme'})
String trf(String uz, Map<String, String> vars) {
  var out = tr(uz);
  vars.forEach((k, v) => out = out.replaceAll('{$k}', v));
  return out;
}

/// Tarjima jadvallari — tekshiruv vositalari uchun.
Map<String, String> tableFor(AppLocale l) => switch (l) {
      AppLocale.uz => const {},
      AppLocale.ru => ruStrings,
      AppLocale.en => enStrings,
    };
