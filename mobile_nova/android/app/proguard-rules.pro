# PLAY CORE — R8 UCHUN ENG MUHIM QATOR.
#
# Flutter embeddingi ichida `FlutterPlayStoreSplitApplication` va
# `PlayStoreDeferredComponentManager` bor. Ular Play Core kutubxonasiga
# havola qiladi, lekin bu ilova deferred component ishlatmagani uchun
# Play Core bog'liqlik sifatida qo'shilmagan.
#
# R8 (AGP 8) yetishmayotgan sinfni OGOHLANTIRISH emas, XATO deb
# hisoblaydi va qurilishni to'xtatadi:
#
#   Missing class com.google.android.play.core.splitcompat.SplitCompatApplication
#   Execution failed for task ':app:minifyReleaseWithR8'
#
# Bu sinflar ISHLATILMAYDI — ularga faqat ishlatilmaydigan kod
# havola qiladi. Shuning uchun ogohlantirishni o'chirish xavfsiz.
-dontwarn com.google.android.play.core.**

# Flutter va plaginlar refleksiya ishlatadi — ularning sinflari
# qisqartirishda yo'q qilinmasligi kerak.
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.plugins.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }

# NFC: tizim teg obyektlarini refleksiya orqali yaratadi.
-keep class android.nfc.** { *; }

# `flutter_secure_storage` Keystore bilan ishlaydi.
-keep class androidx.security.crypto.** { *; }

# Ogohlantirishlar: bu sinflar Android'da yo'q, lekin kutubxonalar
# ularga havola qiladi. Ular ishlatilmaydi, shuning uchun xavfsiz.
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
