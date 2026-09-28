package uz.nfcstore.nova

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Video tayyorlash — iPhone bilan bir xil kanal (video_prep.dart).
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
                    else -> result.notImplemented()
                }
            }
    }
}
