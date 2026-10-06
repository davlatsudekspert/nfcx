package uz.nfcstore.nova

import android.os.Build
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/// `FlutterActivity` EMAS, `FlutterFragmentActivity`.
///
/// `local_auth` biometrik oynani `BiometricPrompt` orqali ochadi va u
/// `FragmentActivity` talab qiladi. Oddiy `FlutterActivity` bilan
/// biometrika `no_fragment_activity` xatosi bilan yiqiladi — ilova
/// qulfi faqat PIN bilan ishlagan bo'lardi.
class MainActivity : FlutterFragmentActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Android API darajasi — ilova qulfi biometrikani faqat Android 9+
        // da taklif qiladi (app_lock.dart, `biometricAvailableProvider`).
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "uz.nfcstore.nova/device")
            .setMethodCallHandler { call, result ->
                if (call.method == "sdkInt") result.success(Build.VERSION.SDK_INT) else result.notImplemented()
            }
        // Video va rasm tayyorlash — iPhone bilan bir xil kanal
        // (video_prep.dart, image_prep.dart).
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "uz.nfcstore.nova/video")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "compress" -> {
                        val path = call.argument<String>("path")
                        val out = call.argument<String>("out")
                        if (path == null || out == null) {
                            result.success(null)
                        } else {
                            VideoCompressor.compress(applicationContext, path, out, result)
                        }
                    }
                    "toJpeg" -> {
                        val path = call.argument<String>("path")
                        val out = call.argument<String>("out")
                        if (path == null || out == null) {
                            result.success(null)
                        } else {
                            ImageShrinker.toJpeg(
                                path, out,
                                call.argument<Int>("maxSide") ?: 1600,
                                call.argument<Int>("quality") ?: 85,
                                result,
                            )
                        }
                    }
                    "toPng" -> {
                        val path = call.argument<String>("path")
                        val out = call.argument<String>("out")
                        if (path == null || out == null) {
                            result.success(null)
                        } else {
                            ImageShrinker.toPng(
                                path, out,
                                call.argument<Int>("maxSide") ?: 1600,
                                result,
                            )
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
