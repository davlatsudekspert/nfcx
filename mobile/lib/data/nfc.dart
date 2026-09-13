import 'dart:async';
import 'package:nfc_manager/nfc_manager.dart';

/// NFC — O'QISH VA YOZISH.
///
/// NIMA UCHUN ALOHIDA FAYL: `nfc_manager` platformaga bog'liq va
/// uning API'si versiyadan versiyaga o'zgaradi. Butun ilova unga
/// to'g'ridan-to'g'ri bog'lanmasin — ekranlar faqat shu yerdagi uchta
/// funksiyani biladi.
///
/// XAVFSIZLIK: yozish AYNAN NFCSTORE havolasini yozadi. Ixtiyoriy
/// matn yozishga yo'l qo'yilmaydi — aks holda ilova begona havola
/// tarqatish vositasiga aylanardi.
class Nfc {
  Nfc._();

  static const _host = 'nfcstore.uz';

  /// Qurilmada NFC bormi va yoqilganmi.
  ///
  /// MUDDAT QO'YILGAN: ba'zi qurilmalarda platforma kanali javob
  /// qaytarmasligi mumkin. Muddatsiz bo'lsa, ekran abadiy
  /// "yuklanmoqda" bo'lib qolardi — foydalanuvchi uchun bu ilova
  /// osilib qolgani bilan bir xil.
  static Future<bool> available() async {
    try {
      return await NfcManager.instance
          .isAvailable()
          .timeout(const Duration(seconds: 3), onTimeout: () => false);
    } catch (_) {
      return false;
    }
  }

  /// Tegizilgan kartadan NFCSTORE havolasini o'qish.
  ///
  /// Qaytaradi:
  ///   `link`    — topilgan kod (`null` bo'lsa tanilmadi);
  ///   `tagSeen` — karta UMUMAN tegizildimi.
  ///
  /// NIMA UCHUN IKKITA QIYMAT: "karta tegizilmadi" va "tegizildi,
  /// lekin bu bizniki emas" — bular BOSHQA muammo va foydalanuvchiga
  /// boshqacha aytilishi kerak. Faqat `null` qaytarsak, ikkalasiga
  /// ham bitta noaniq xabar chiqarardik.
  ///
  /// Sessiya birinchi natijadan keyin O'ZI yopiladi: ochiq qolgan
  /// sessiya keyingi o'qishni bloklaydi va batareyani yeydi.
  static Future<({NfcLink? link, bool tagSeen})> readLink({
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final completer = Completer<({NfcLink? link, bool tagSeen})>();
    Timer? timer;

    Future<void> stop([String? reason]) async {
      timer?.cancel();
      try {
        await NfcManager.instance.stopSession(alertMessage: reason);
      } catch (_) {}
    }

    try {
      await NfcManager.instance.startSession(
        pollingOptions: {NfcPollingOption.iso14443, NfcPollingOption.iso15693},
        onDiscovered: (tag) async {
          final link = _linkFromTag(tag);
          if (!completer.isCompleted) {
            completer.complete((link: link, tagSeen: true));
          }
          await stop();
        },
      );
    } catch (_) {
      return (link: null, tagSeen: false);
    }

    timer = Timer(timeout, () async {
      if (!completer.isCompleted) {
        completer.complete((link: null, tagSeen: false));
      }
      await stop();
    });

    return completer.future;
  }

  /// Kartaga profil havolasini yozish (faollashtirish).
  ///
  /// `true` — yozildi. `false` — karta yozib bo'lmaydigan yoki
  /// vaqt tugadi.
  static Future<bool> writeCode(
    String code, {
    bool company = false,
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final clean = code.trim().toUpperCase();
    if (clean.isEmpty || !RegExp(r'^[A-Z0-9]{3,16}$').hasMatch(clean)) return false;

    final completer = Completer<bool>();
    Timer? timer;

    Future<void> stop() async {
      timer?.cancel();
      try {
        await NfcManager.instance.stopSession();
      } catch (_) {}
    }

    try {
      await NfcManager.instance.startSession(
        pollingOptions: {NfcPollingOption.iso14443},
        onDiscovered: (tag) async {
          var ok = false;
          try {
            final ndef = Ndef.from(tag);
            if (ndef != null && ndef.isWritable) {
              await ndef.write(NdefMessage([
                NdefRecord.createUri(Uri.parse('https://$_host/${clean.toLowerCase()}')),
              ]));
              ok = true;
            }
          } catch (_) {
            ok = false;
          }
          if (!completer.isCompleted) completer.complete(ok);
          await stop();
        },
      );
    } catch (_) {
      return false;
    }

    timer = Timer(timeout, () async {
      if (!completer.isCompleted) completer.complete(false);
      await stop();
    });

    return completer.future;
  }

  /// O'qishni to'xtatish — ekran yopilganda chaqiriladi.
  static Future<void> stop() async {
    try {
      await NfcManager.instance.stopSession();
    } catch (_) {}
  }

  /// Tegdan NFCSTORE havolasini ajratib olish.
  static NfcLink? _linkFromTag(NfcTag tag) {
    try {
      final ndef = Ndef.from(tag);
      final message = ndef?.cachedMessage;
      if (message == null) return null;
      for (final r in message.records) {
        final uri = _uriOf(r);
        if (uri != null) {
          final link = NfcLink.parse(uri);
          if (link != null) return link;
        }
      }
    } catch (_) {}
    return null;
  }

  static String? _uriOf(NdefRecord r) {
    try {
      // URI yozuvi: birinchi bayt — prefiks kodi (http:// , https:// ...).
      if (r.typeNameFormat == NdefTypeNameFormat.nfcWellknown &&
          r.type.isNotEmpty &&
          r.type.first == 0x55) {
        const prefixes = [
          '', 'http://www.', 'https://www.', 'http://', 'https://',
        ];
        final p = r.payload.first;
        final rest = String.fromCharCodes(r.payload.sublist(1));
        return (p < prefixes.length ? prefixes[p] : '') + rest;
      }
    } catch (_) {}
    return null;
  }
}

/// NFCSTORE havolasidan olingan natija.
///
/// NIMA UCHUN KLASS: faqat kod qaytarsak, `/c/ddd333` (kompaniya) va
/// `/ddd333` (shaxsiy) bir xil ko'rinardi va noto'g'ri profil ochilardi.
class NfcLink {
  const NfcLink(this.code, {this.company = false});

  final String code;
  final bool company;

  /// Havolani tahlil qilish. Begona domen yoki noto'g'ri kod — `null`.
  ///
  /// Bu funksiya NFC dan ham, App Links (kartani tegizganda tizim
  /// ilovani ochishi) dan ham ishlatiladi — qoida bitta joyda bo'lsin.
  ///
  /// Qabul qilinadi:
  ///   https://nfcstore.uz/vip001      -> shaxsiy
  ///   https://nfcstore.uz/id/vip001   -> shaxsiy
  ///   https://nfcstore.uz/c/ddd333    -> kompaniya
  static NfcLink? parse(String raw) {
    final uri = Uri.tryParse(raw.trim());
    if (uri == null) return null;
    final host = uri.host.toLowerCase();
    if (host != 'nfcstore.uz' && !host.endsWith('.nfcstore.uz')) return null;
    final parts = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    if (parts.isEmpty) return null;

    final first = parts.first.toLowerCase();
    // Ilova ochmaydigan sahifalar: bular kod emas, sayt bo'limlari.
    const reserved = {
      'api', 'admin', 'login', 'register', 'cabinet', 'dashboard',
      'assets', 'static', 'pay', 'payme', 'click', 'terms', 'privacy',
    };

    final company = first == 'c';
    final candidate =
        (company || first == 'id') && parts.length > 1 ? parts[1] : parts.first;
    if (!company && first != 'id' && reserved.contains(first)) return null;

    final code = candidate.toUpperCase();
    if (!RegExp(r'^[A-Z0-9]{3,16}$').hasMatch(code)) return null;
    return NfcLink(code, company: company);
  }

  @override
  bool operator ==(Object other) =>
      other is NfcLink && other.code == code && other.company == company;

  @override
  int get hashCode => Object.hash(code, company);

  @override
  String toString() => 'NfcLink($code, company: $company)';
}
