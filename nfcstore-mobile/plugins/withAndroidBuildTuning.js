const { withGradleProperties } = require('expo/config-plugins');

/**
 * Android yig'ish sozlamalari — `android/gradle.properties` ga
 * avtomatik yoziladi.
 *
 * Nega plugin kerak: bu qiymatlar `gradle.properties` da turadi, o'sha
 * fayl esa `expo prebuild --clean` da QAYTA YARATILADI. Qo'lda
 * qo'shilgan har qanday qator yo'qoladi va yig'ish yana sinadi. Plugin
 * esa har bir prebuild'da qayta qo'llanadi.
 *
 * 1. reactNativeArchitectures = arm64-v8a
 *    Standart holatda RN TO'RTTA arxitektura uchun C++ kodini
 *    yig'adi: armeabi-v7a, arm64-v8a, x86, x86_64. x86 lar faqat
 *    emulyator uchun, armeabi-v7a esa 2019-yilgacha chiqqan
 *    telefonlar uchun. Barcha zamonaviy Android qurilmalari
 *    arm64-v8a. Faqat shuni yig'ish:
 *      • vaqtni ~4 barobar qisqartiradi,
 *      • xotira sarfini keskin kamaytiradi (Gradle daemon "disappeared
 *        unexpectedly" bilan o'lishining asosiy sababi shu edi),
 *      • APK hajmini ~3 barobar kichraytiradi.
 *    Emulyatorda (x86_64) sinash kerak bo'lsa, shu qatorga
 *    `,x86_64` qo'shiladi.
 *
 * 2. org.gradle.jvmargs
 *    Standart 2 GB nativ modullar (reanimated, worklets, screens,
 *    expo-modules-core) bir vaqtda kompilyatsiya qilinganda yetmaydi.
 *    4 GB + kengaytirilgan metaspace daemon'ning o'lib qolishini
 *    oldini oladi.
 */
module.exports = function withAndroidBuildTuning(config) {
  return withGradleProperties(config, (cfg) => {
    const set = (key, value) => {
      const next = { type: 'property', key, value };
      const i = cfg.modResults.findIndex(
        (item) => item.type === 'property' && item.key === key,
      );
      if (i >= 0) cfg.modResults[i] = next;
      else cfg.modResults.push(next);
    };

    set('reactNativeArchitectures', 'arm64-v8a');
    set('org.gradle.jvmargs', '-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8');

    return cfg;
  });
};
