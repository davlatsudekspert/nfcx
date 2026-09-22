import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// IMZO KALITI — bo'lsa ishlatiladi, bo'lmasa yo'q.
//
// `android/key.properties` repozitoriyaga QO'YILMAYDI (.gitignore da).
// CI uni GitHub secrets'dan yasaydi. Fayl bo'lmasa release debug
// kaliti bilan imzolanadi: APK o'rnatiladi va ishlaydi, lekin Play
// Store'ga yaramaydi.
val keystoreProperties = Properties().apply {
    val f = rootProject.file("key.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val hasReleaseKey = keystoreProperties.getProperty("storeFile") != null

android {
    namespace = "uz.nfcstore.preview"
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
        // Paket nomi — Play Store'da va qurilmada shu ko'rinadi.
        // KEYIN O'ZGARTIRILMAYDI: o'zgarsa Play Store uni BOSHQA ilova
        // deb hisoblaydi va yangilanish o'rnatilmaydi.
        applicationId = "uz.nfcstore.preview"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
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
            // Kalit bo'lsa — u bilan. Bo'lmasa debug kaliti bilan,
            // shunda `flutter run --release` ham, CI dagi sinov APK'si
            // ham ishlaydi.
            signingConfig = signingConfigs.getByName(if (hasReleaseKey) "release" else "debug")
            // Kod kichraytirish YOQILMAYDI. Flutter kodi allaqachon
            // AOT kompilyatsiya qilingan; R8 faqat kichik Java/Kotlin
            // qatlamiga tegadi va foydasi arzimas, lekin plagin
            // reflektsiyasini buzish xavfi bor.
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}


flutter {
    source = "../.."
}