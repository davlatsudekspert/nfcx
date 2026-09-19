import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // Flutter Gradle plagini Android va Kotlin plaginlaridan KEYIN qo'llanadi.
    id("dev.flutter.flutter-gradle-plugin")
}

// IMZO KALITI — bo'lsa ishlatiladi, bo'lmasa yo'q.
//
// `android/key.properties` repozitoriyaga QO'YILMAYDI (.gitignore da).
// CI uni GitHub secrets'dan yasaydi. Fayl bo'lmasa release debug kaliti
// bilan imzolanadi: APK o'rnatiladi va ishlaydi, lekin Play Store'ga
// yaramaydi.
val keystoreProperties = Properties().apply {
    val f = rootProject.file("key.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val hasReleaseKey = keystoreProperties.getProperty("storeFile") != null

android {
    namespace = "uz.nfcstore.nova"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // PAKET NOMI — qurilmada va Play Store'da shu ko'rinadi.
        //
        // Eski NFCSTORE ilovasi `uz.nfcstore.app`. Ular BOSHQA-BOSHQA
        // paketlar, shuning uchun bitta telefonda yonma-yon turadi va
        // Nova eski ilovaning yangilanishi sifatida qabul qilinmaydi.
        applicationId = "uz.nfcstore.nova"

        // NFC `nfc_manager` uchun minimal 21 kifoya, lekin
        // `flutter_secure_storage` ning shifrlangan saqlagichi 23 dan
        // ishlaydi. 24 — Flutter'ning joriy minimumi.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseKey) {
                signingConfigs.getByName("release")
            } else {
                // Kalit yo'q — APK baribir quriladi va o'rnatiladi.
                signingConfigs.getByName("debug")
            }
            // Dart kodi allaqachon AOT'ga o'giriladi; R8 faqat Java/Kotlin
            // qatlamini qisqartiradi. Plaginlar refleksiya ishlatgani uchun
            // `isShrinkResources` yoqilmaydi: u resurslarni ortiqcha kesadi.
            isMinifyEnabled = true
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
        debug {
            // Eski ilova bilan bir vaqtda o'rnatish uchun debug qurilma
            // ham alohida paket bo'ladi.
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    // ABI bo'yicha bo'lish uchun bu yerda `splits` bloki YO'Q.
    //
    // Flutter Gradle plagini `--split-per-abi` bayrog'i berilganda
    // `android.splits.abi` ni O'ZI sozlaydi. Bu yerda qo'lda yozilgan
    // blok o'sha sozlamaning ustiga chiqib, bayroqni jimgina
    // ishlamaydigan qilib qo'yishi mumkin edi.
}

flutter {
    source = "../.."
}
