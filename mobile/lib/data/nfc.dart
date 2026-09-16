import 'dart:async';
import 'dart:typed_data';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:nfc_manager/platform_tags.dart';

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

  /// TEG MA'LUMOTI — texnik tafsilotlar.
  ///
  /// Prototipdagi "Teg ma'lumoti" ekrani uchun: turi, hajmi, yozish
  /// mumkinmi, qulflanganmi, ichidagi yozuv va seriya raqami.
  ///
  /// NIMA UCHUN KERAK: karta ishlamaganda sabab shu yerda ko'rinadi
  /// — teg qulflangan, hajmi yetmaydi yoki umuman boshqa turdagi
  /// teg. Busiz odam "nega yozilmayapti?" degan savol bilan qolardi.
  ///
  /// Hech qanday qiymat TO'QILMAYDI: mavjud bo'lmagan maydon `null`
  /// bo'lib qaytadi va ekranda "—" chiziladi.
  static Future<TagInfo?> readTagInfo({
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final completer = Completer<TagInfo?>();
    Timer? timer;

    Future<void> stop() async {
      timer?.cancel();
      try {
        await NfcManager.instance.stopSession();
      } catch (_) {}
    }

    try {
      await NfcManager.instance.startSession(
        pollingOptions: {NfcPollingOption.iso14443, NfcPollingOption.iso15693},
        onDiscovered: (tag) async {
          if (!completer.isCompleted) completer.complete(_infoFromTag(tag));
          await stop();
        },
      );
    } catch (_) {
      return null;
    }

    timer = Timer(timeout, () async {
      if (!completer.isCompleted) completer.complete(null);
      await stop();
    });

    return completer.future;
  }

  static TagInfo _infoFromTag(NfcTag tag) {
    String? kind;
    int? maxSize;
    bool? writable;
    String? serial;
    String? payload;

    try {
      final ndef = Ndef.from(tag);
      if (ndef != null) {
        maxSize = ndef.maxSize;
        writable = ndef.isWritable;
        final msg = ndef.cachedMessage;
        if (msg != null && msg.records.isNotEmpty) {
          payload = _uriOf(msg.records.first);
        }
      }
    } catch (_) {}

    try {
      final mifare = MifareUltralight.from(tag);
      if (mifare != null) {
        // NTAG213/215/216 — turi Ultralight oilasida `type` bilan
        // emas, HAJM bilan ajratiladi: ular bir xil texnologiya.
        final size = maxSize ?? 0;
        kind = size >= 800
            ? 'NTAG216'
            : size >= 480
                ? 'NTAG215'
                : size >= 130
                    ? 'NTAG213'
                    : 'MIFARE Ultralight';
        serial = _hexId(mifare.identifier);
      }
    } catch (_) {}

    if (serial == null) {
      try {
        final a = NfcA.from(tag);
        if (a != null) serial = _hexId(a.identifier);
      } catch (_) {}
    }

    return TagInfo(
      kind: kind,
      maxSize: maxSize,
      writable: writable,
      serial: serial,
      payload: payload,
    );
  }

  static String _hexId(Uint8List bytes) => bytes
      .map((b) => b.toRadixString(16).toUpperCase().padLeft(2, '0'))
      .join(':');

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

/// TEG HAQIDAGI TEXNIK MA'LUMOT.
///
/// Har maydon `null` bo'lishi mumkin: teg turi yoki platforma buni
/// bermasligi mumkin, va bunda ekranda "—" chiziladi. To'qilgan
/// qiymat foydalanuvchini noto'g'ri yo'lga boshlardi.
class TagInfo {
  const TagInfo({
    this.kind,
    this.maxSize,
    this.writable,
    this.serial,
    this.payload,
  });

  /// `NTAG215` kabi nom.
  final String? kind;

  /// NDEF uchun ajratilgan joy, bayt.
  final int? maxSize;

  /// Yozish mumkinmi (qulflanmaganmi).
  final bool? writable;

  /// Seriya raqami — `04:A3:2F:...`.
  final String? serial;

  /// Ichidagi yozuv (havola).
  final String? payload;

  /// NFCSTORE kartasimi — ichidagi havola shu domenga tegishlimi.
  bool get isOurs => NfcLink.parse(payload ?? '') != null;
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
    // ILOVA OCHMAYDIGAN SAHIFALAR: bular kod emas, sayt bo'limlari.
    //
    // NIMA UCHUN BU RO'YXAT UZUN. App Links tasdiqlangandan keyin
    // `nfcstore.uz` ning HAR QANDAY havolasi ilovaga keladi —
    // saytning o'z sahifalari ham. Ro'yxatda bo'lmagan nom esa
    // `^[A-Z0-9]{3,16}$` ga tushadi va PROFIL KODI deb o'qiladi:
    // odam «Narxlar» havolasini bosib, «profil topilmadi» degan
    // ekranga tushardi. Brauzerda hammasi joyida ishlagani uchun
    // buni faqat telefonda, reliz kunidan keyin sezish mumkin edi.
    //
    // MANBA — SAYTNING O'Z RO'YXATI (`src/App.jsx`, `RESERVED`).
    // Saytga yangi bo'lim qo'shilsa, shu yerga ham qo'shiladi.
    // Chiziqchali nomlar (`qanday-ishlaydi`) baribir kod shabloniga
    // tushmaydi, lekin bir joyda tursin.
    const reserved = {
      // Texnik
      'api', 'admin', 'assets', 'static', 'cabinet', 'dashboard',
      // Kirish va hisob
      'login', 'register', 'account', 'sozlamalar', 'bildirishnomalar',
      // To'lov
      'pay', 'payme', 'click', 'tolovlar',
      // Sayt bo'limlari
      'narxlar', 'qanday-ishlaydi', 'yangiliklar', 'katalog', 'savollar',
      'aloqa', 'shartlar', 'terms', 'maxfiylik', 'privacy', 'qollanma',
      'reyting', 'gifts', 'xabarlar', 'kompaniyalar',
      'business', 'workspace', 'company', 'biznes-namuna', 'karta-dizayni',
      // Auksion bekor qilingan, lekin havolalar tashqarida qolgan
      // va ular narxlar sahifasiga yo'naltiriladi.
      'auksion', 'auksion-qoidalari',
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
