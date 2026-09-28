package uz.nfcstore.nova

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
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
                    else -> result.notImplemented()
                }
            }
    }
}
