allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// PLAGINLARNING compileSdk NI KO'TARISH.
//
// `nfc_manager` 3.5.1 o'z modulini android-31 ga qarshi quradi,
// lekin uning bog'liqliklari (androidx.core, androidx.window …)
// 33+ talab qiladi. Natijada `assembleRelease` yiqiladi va xabar
// PLAGIN ichidan chiqadi — ilovaning o'z `compileSdk` sini
// ko'tarish yordam bermaydi.
//
// Bu Flutter ekotizimidagi odatiy vaziyat: plaginlar SDK
// yangilanishidan orqada qoladi. Qiymat SHU YERDA, bitta joyda
// majburlanadi — har bir plaginni kutib o'tirmaymiz.
//
// NIMA UCHUN REFLEKSIYA: Android Gradle Plugin sinflari ILDIZ
// skriptning classpath'ida yo'q (Flutter shabloni uni
// `settings.gradle.kts` orqali qo'llaydi), shuning uchun
// `BaseExtension` turini to'g'ridan-to'g'ri yozib bo'lmaydi —
// skript kompilyatsiya qilinmaydi.
//
// `:app` TEGILMAYDI: uning qiymati `flutter.compileSdkVersion` dan
// keladi va u odatda kattaroq. Bu yerda uni pasaytirib qo'yish
// mumkin edi.
val pluginCompileSdk = 35

subprojects {
    if (name == "app") return@subprojects
    afterEvaluate {
        val ext = extensions.findByName("android") ?: return@afterEvaluate
        runCatching {
            val current = ext.javaClass.methods
                .firstOrNull { it.name == "getCompileSdkVersion" && it.parameterCount == 0 }
                ?.invoke(ext) as? String
            val level = current?.removePrefix("android-")?.toIntOrNull()
            if (level == null || level < pluginCompileSdk) {
                ext.javaClass.methods
                    .firstOrNull {
                        it.name == "compileSdkVersion" &&
                            it.parameterCount == 1 &&
                            it.parameterTypes[0] == Int::class.javaPrimitiveType
                    }
                    ?.invoke(ext, pluginCompileSdk)
                logger.lifecycle("compileSdk $pluginCompileSdk ga ko'tarildi: $path (edi: $current)")
            }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
