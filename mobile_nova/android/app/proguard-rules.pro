# Flutter va plaginlar refleksiya ishlatadi — ularning sinflari
# qisqartirishda YO'Q QILINMASLIGI kerak.
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-keep class io.flutter.plugin.** { *; }

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
