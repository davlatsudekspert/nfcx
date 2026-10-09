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
    if let registrar = self.registrar(forPlugin: "NovaAudioSession") {
      NovaAudioSession.register(messenger: registrar.messenger())
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}

/// ILOVA OVOZI — iPhone audio sessiyasi (egasi, TestFlight 331:
/// "Ko'rgazmada musiqa avto qo'yilmayapti").
///
/// `AVAudioSession` butun ilova uchun BITTA. `video_player` uni faqat
/// birinchi pleerda `.playback` qiladi, keyin har pleer ochilganda faqat
/// `mixWithOthers` belgisini o'sha paytdagi turkumga qo'shadi/olib
/// tashlaydi. Asosiydagi ovozsiz reklama kartasi (`mixWithOthers: true`)
/// sessiyani "aralashuvchi" qilib qoldirardi, WebView (YouTube/Instagram)
/// esa o'z ijrosi bilan sessiyani to'xtatib (uzib) qo'yishi mumkin —
/// ilovada sessiyani qayta yoqadigan joy yo'q edi. Natija: musiqa
/// "o'ynayapti", lekin eshitilmaydi yoki umuman boshlanmaydi.
///
/// Dart (`lib/core/media/audio_session.dart`) Ko'rgazma musiqasi yoki
/// ovozli video `play()` dan OLDIN `playback` ni chaqiradi: turkum
/// `.playback` (jim rejim tugmasiga bo'ysunmaydi), aralashmaydi (boshqa
/// ilova ovozi to'xtaydi), sessiya faol. Kamera/mikrofon
/// (`.playAndRecord`) ishlayotgan bo'lsa turkumga tegilmaydi.
enum NovaAudioSession {
  static func register(messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(
      name: "uz.nfcstore.nova/audio", binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      switch call.method {
      case "playback":
        let session = AVAudioSession.sharedInstance()
        do {
          if session.category != .playAndRecord {
            try session.setCategory(.playback, mode: .default, options: [])
          }
          try session.setActive(true)
          result(true)
        } catch {
          // Sessiya band (masalan, qo'ng'iroq) — ijro odatdagidek urinadi.
          result(false)
        }
      default:
        result(FlutterMethodNotImplemented)
      }
    }
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
      guard let args = call.arguments as? [String: Any],
        let path = args["path"] as? String
      else {
        result(FlutterMethodNotImplemented)
        return
      }
      switch call.method {
      case "toMp4":
        toMp4(path: path, result: result)
      case "toJpeg":
        guard let out = args["out"] as? String else {
          result(nil)
          return
        }
        let maxSide = args["maxSide"] as? Int ?? 1600
        let quality = args["quality"] as? Int ?? 85
        DispatchQueue.global(qos: .userInitiated).async {
          let res = toJpeg(path: path, out: out, maxSide: maxSide, quality: quality)
          DispatchQueue.main.async { result(res) }
        }
      case "toPng":
        guard let out = args["out"] as? String else {
          result(nil)
          return
        }
        let maxSide = args["maxSide"] as? Int ?? 1600
        DispatchQueue.global(qos: .userInitiated).async {
          let res = toPng(path: path, out: out, maxSide: maxSide)
          DispatchQueue.main.async { result(res) }
        }
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }

  /// SHAFFOF rasm: uzun tomoni `maxSide` gacha, PNG — shaffoflik
  /// saqlanadi (audit 2026-10-06: 700 KB dan katta logotip PNG server
  /// tomonidan rad etilardi). Natija kichraymasa yoki xato — `nil`.
  static func toPng(path: String, out: String, maxSide: Int) -> String? {
    guard let image = UIImage(contentsOfFile: path) else { return nil }
    let w = image.size.width
    let h = image.size.height
    guard w > 0, h > 0 else { return nil }
    let scale = min(1.0, CGFloat(maxSide) / max(w, h))
    let size = CGSize(width: (w * scale).rounded(), height: (h * scale).rounded())
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    format.opaque = false
    let drawn = UIGraphicsImageRenderer(size: size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
    guard let data = drawn.pngData() else { return nil }
    let original = (try? FileManager.default.attributesOfItem(atPath: path)[.size] as? Int) ?? 0
    if original > 0 && data.count >= original { return nil }
    do {
      try data.write(to: URL(fileURLWithPath: out))
      return out
    } catch {
      return nil
    }
  }

  /// Rasm yuklashdan oldin: uzun tomoni `maxSide` gacha, JPEG (Dart:
  /// lib/core/media/image_prep.dart). `image_picker` PNG'ni siqmaydi —
  /// skrinshot 2 MB bo'lib ketardi, server esa 700 KB dan kattasini
  /// qabul qilmaydi. Shaffof piksel bo'lsa, natija kichraymasa yoki
  /// xato — `nil` (Dart asl faylni yuboradi). `UIImage` EXIF burilishini
  /// o'zi hisobga oladi.
  static func toJpeg(path: String, out: String, maxSide: Int, quality: Int) -> String? {
    guard let image = UIImage(contentsOfFile: path), let cg = image.cgImage else { return nil }
    if hasTransparency(cg) { return nil }
    let w = image.size.width
    let h = image.size.height
    guard w > 0, h > 0 else { return nil }
    let scale = min(1.0, CGFloat(maxSide) / max(w, h))
    let size = CGSize(width: (w * scale).rounded(), height: (h * scale).rounded())
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    format.opaque = true
    let drawn = UIGraphicsImageRenderer(size: size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
    guard let data = drawn.jpegData(compressionQuality: CGFloat(quality) / 100) else { return nil }
    let original = (try? FileManager.default.attributesOfItem(atPath: path)[.size] as? Int) ?? 0
    if original > 0 && data.count >= original { return nil }
    do {
      try data.write(to: URL(fileURLWithPath: out))
      return out
    } catch {
      return nil
    }
  }

  static func hasTransparency(_ cg: CGImage) -> Bool {
    switch cg.alphaInfo {
    case .none, .noneSkipFirst, .noneSkipLast:
      return false
    default:
      break
    }
    let w = cg.width
    let h = cg.height
    var px = [UInt8](repeating: 0, count: w * h * 4)
    guard
      let ctx = CGContext(
        data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    else { return true }
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
    var i = 3
    while i < px.count {
      if px[i] != 255 { return true }
      i += 4
    }
    return false
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
