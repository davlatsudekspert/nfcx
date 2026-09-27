import AVFoundation
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    if let registrar = self.registrar(forPlugin: "NovaVideoExport") {
      NovaVideoExport.register(messenger: registrar.messenger())
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}

/// iPhone videosi (.MOV, ko'pincha HEVC) → 1080p H.264 .mp4.
///
/// HEVC hamma Android telefon va brauzerda o'ynamaydi; H.264 esa
/// hamma joyda o'ynaydi. Dart tomoni: lib/core/media/video_prep.dart.
/// Xato bo'lsa Dart asl faylni yuboradi — yuklash to'xtab qolmaydi.
enum NovaVideoExport {
  static func register(messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(
      name: "uz.nfcstore.nova/video", binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      guard call.method == "toMp4",
        let args = call.arguments as? [String: Any],
        let path = args["path"] as? String
      else {
        result(FlutterMethodNotImplemented)
        return
      }
      toMp4(path: path, result: result)
    }
  }

  static func toMp4(path: String, result: @escaping FlutterResult) {
    let asset = AVURLAsset(url: URL(fileURLWithPath: path))
    // 1920x1080 — o'lcham CHEGARASI: kichik video kattalashtirilmaydi,
    // tik (portret) video tik qoladi. Mos kelmasa — eng yuqori sifat,
    // u ham H.264 (HEVC presetlari alohida nomlangan).
    let presets = AVAssetExportSession.exportPresets(compatibleWith: asset)
    let preset =
      presets.contains(AVAssetExportPreset1920x1080)
      ? AVAssetExportPreset1920x1080 : AVAssetExportPresetHighestQuality
    guard let export = AVAssetExportSession(asset: asset, presetName: preset) else {
      result(FlutterError(code: "export_unavailable", message: nil, details: nil))
      return
    }
    let out = FileManager.default.temporaryDirectory
      .appendingPathComponent("nova_\(UUID().uuidString).mp4")
    export.outputURL = out
    export.outputFileType = .mp4
    // `moov` fayl boshida — ijro to'liq yuklanishni kutmaydi.
    export.shouldOptimizeForNetworkUse = true
    export.exportAsynchronously {
      DispatchQueue.main.async {
        if export.status == .completed {
          result(out.path)
        } else {
          result(
            FlutterError(
              code: "export_failed",
              message: export.error?.localizedDescription, details: nil))
        }
      }
    }
  }
}
