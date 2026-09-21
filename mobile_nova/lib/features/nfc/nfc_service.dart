import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:nfc_manager/platform_tags.dart';

import 'ndef_payload.dart';

/// Qurilmaning NFC imkoniyati.
enum NfcAvailability {
  /// Hali tekshirilmadi.
  unknown,

  /// Qurilmada NFC apparati YO'Q. Bu holat tuzatib bo'lmaydi —
  /// foydalanuvchiga QR yo'li taklif qilinadi.
  unsupported,

  /// Apparat bor, lekin tizim sozlamalarida o'chirilgan.
  disabled,
  ready,
}

/// TEGNI KO'ZDAN KECHIRISH natijasi (yozishdan OLDINGI bosqich).
///
/// Bu yerda HECH NARSA YOZILMAYDI. Maqsad — foydalanuvchiga tegda
/// AYNAN nima turganini ko'rsatish, toki u ustiga yozishga ongli
/// rozilik bersin.
class TagInspection {
  const TagInspection({
    required this.found,
    this.isNdef = false,
    this.writable = false,
    this.maxSize = 0,
    this.formattable = false,
    this.identity = '',
    this.records = const [],
    this.error = TagError.none,
  });

  /// Umuman teg tutildimi.
  final bool found;

  /// Teg NDEF ni qo'llaydimi.
  final bool isNdef;

  /// NDEF yozish ochiqmi (qulflanmaganmi).
  final bool writable;

  /// Tegning NDEF sig'imi baytda. 0 — platforma aytmadi.
  final int maxSize;

  /// Teg hali NDEF ga formatlanmagan, lekin formatlash MUMKIN
  /// (Android). Yangi, bo'sh stikerlar ko'pincha shunday keladi.
  final bool formattable;

  /// Apparat identifikatori — ikkinchi tegizishda solishtirish uchun.
  final String identity;

  /// Tegdagi mavjud yozuvlar. Bo'sh ro'yxat — teg bo'sh.
  final List<NdefRecordData> records;

  final TagError error;

  /// Tegda allaqachon biror narsa bormi — ogohlantirish shu bo'yicha.
  bool get hasContent => records.any((r) => r.value.trim().isNotEmpty);
}

/// NFC amaliyoti nega bajarilmadi.
enum TagError {
  none,

  /// Belgilangan vaqtda teg tutilmadi.
  timeout,

  /// Teg NDEF ni umuman qo'llamaydi (masalan eski MIFARE Classic).
  notNdef,

  /// Teg faqat o'qish uchun qulflangan — qayta yozib bo'lmaydi.
  readOnly,

  /// Yoziladigan ma'lumot teg sig'imidan katta.
  tooLarge,

  /// Ikkinchi tegizishda BOSHQA teg tutildi — rozilik berilmagan
  /// tegning ustiga yozilmaydi.
  differentTag,

  /// Yozildi, lekin qayta o'qishda kutilgan manzil chiqmadi.
  verifyFailed,

  /// Platforma xatosi (sessiya uzildi, teg maydondan chiqdi...).
  io,
}

/// Yozish natijasi.
class NfcWriteResult {
  const NfcWriteResult({required this.ok, this.error = TagError.none, this.written = ''});

  final bool ok;
  final TagError error;

  /// Tegdan QAYTA O'QILGAN manzil. `ok` bo'lganda u kutilganiga teng.
  final String written;
}

/// NFC bilan ishlash.
///
/// MUHIM: bu yerda SOXTA skanerlash YO'Q. Agar qurilmada NFC bo'lmasa
/// yoki o'chirilgan bo'lsa, metod xato qaytaradi va ekran haqiqiy
/// holatni ko'rsatadi. "Skanerlandi" degan yozuv faqat kartadan HAQIQIY
/// ma'lumot o'qilgandagina chiqadi. Xuddi shunday, "yozildi" yozuvi
/// faqat tegdan QAYTA O'QIB tasdiqlangandan keyin chiqadi.
class NfcService {
  StreamSubscription<void>? _sub;
  bool _sessionOpen = false;

  Future<NfcAvailability> check() async {
    try {
      final available = await NfcManager.instance.isAvailable();
      if (available) return NfcAvailability.ready;
      // `nfc_manager` "yo'q" va "o'chirilgan" ni ajratmaydi. Android'da
      // apparatsiz qurilmada ham `false` keladi, shuning uchun aniqrog'i
      // platform qatlamisiz bilinmaydi: foydalanuvchiga ikkala yo'l ham
      // ko'rsatiladi (sozlamani ochish yoki QR bilan ulashish).
      return defaultTargetPlatform == TargetPlatform.android
          ? NfcAvailability.disabled
          : NfcAvailability.unsupported;
    } catch (_) {
      return NfcAvailability.unsupported;
    }
  }

  /// Kartani kutish. Topilganda undagi matn/URI qaytariladi.
  ///
  /// `null` — karta o'qildi, lekin ichida NFCSTORE ma'lumoti yo'q
  /// (bo'sh yoki begona karta).
  Future<String?> readOnce({Duration timeout = const Duration(seconds: 30)}) async {
    final completer = Completer<String?>();

    await NfcManager.instance.startSession(
      pollingOptions: {
        NfcPollingOption.iso14443,
        NfcPollingOption.iso15693,
      },
      onDiscovered: (tag) async {
        if (completer.isCompleted) return;
        completer.complete(_payloadOf(tag));
        await stop();
      },
    );
    _sessionOpen = true;

    // Cheksiz kutish qurilmaning NFC antennasini band qilib turadi.
    return completer.future.timeout(timeout, onTimeout: () async {
      await stop();
      return null;
    });
  }

  /// TEGNI KO'ZDAN KECHIRISH — yozishning BIRINCHI bosqichi.
  ///
  /// Hech narsa o'zgartirmaydi. Faqat o'qiydi va tegning holatini
  /// (qulflanganmi, sig'imi qancha, ichida nima bor) qaytaradi.
  Future<TagInspection> inspect({
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final completer = Completer<TagInspection>();

    try {
      await NfcManager.instance.startSession(
        pollingOptions: {NfcPollingOption.iso14443, NfcPollingOption.iso15693},
        onDiscovered: (tag) async {
          if (completer.isCompleted) return;
          completer.complete(_inspectTag(tag));
          await stop();
        },
      );
      _sessionOpen = true;
    } catch (_) {
      await stop();
      return const TagInspection(found: false, error: TagError.io);
    }

    return completer.future.timeout(timeout, onTimeout: () async {
      await stop();
      return const TagInspection(found: false, error: TagError.timeout);
    });
  }

  TagInspection _inspectTag(NfcTag tag) {
    final identity = tagIdentity(tag.data);
    final ndef = Ndef.from(tag);

    if (ndef == null) {
      // Formatlanmagan, lekin formatlash mumkin bo'lgan teg (Android).
      // Bunday teg BO'SH — ogohlantirishga hojat yo'q.
      final formattable = NdefFormatable.from(tag) != null;
      return TagInspection(
        found: true,
        isNdef: false,
        formattable: formattable,
        identity: identity,
        error: formattable ? TagError.none : TagError.notNdef,
      );
    }

    final records = <NdefRecordData>[];
    for (final r in ndef.cachedMessage?.records ?? const []) {
      records.add(classifyRecord(
        typeNameFormat: r.typeNameFormat.index,
        type: r.type,
        payload: r.payload,
      ));
    }

    return TagInspection(
      found: true,
      isNdef: true,
      writable: ndef.isWritable,
      maxSize: ndef.maxSize,
      identity: identity,
      records: records,
    );
  }

  /// PROFIL MANZILINI TEGGA YOZISH — IKKINCHI bosqich.
  ///
  /// Tegga FAQAT ochiq profil manzili yoziladi. NFCSTORE jismoniy
  /// kartasining maxfiy chip tokeni bu yerga HECH QACHON tushmaydi.
  ///
  /// `expectIdentity` — birinchi bosqichda ko'rsatilgan tegning
  /// identifikatori. Boshqa teg tutilsa yozilmaydi: foydalanuvchi
  /// ko'rmagan tegning ustiga yozish uning roziligi emas. Ikkala
  /// tomonda ham identifikator bo'lmasa (platforma bermadi)
  /// solishtiruv o'tkazib yuboriladi.
  Future<NfcWriteResult> writeProfileUrl({
    required String url,
    String expectIdentity = '',
    Duration timeout = const Duration(seconds: 30),
  }) async {
    // Ichki himoya: chaqiruvchi xato manzil bersa ham tegga
    // `javascript:` kabi sxema yozilmaydi.
    if (!isSafeWriteUrl(url)) {
      return const NfcWriteResult(ok: false, error: TagError.io);
    }

    final message = NdefMessage([NdefRecord.createUri(Uri.parse(url))]);
    final completer = Completer<NfcWriteResult>();

    try {
      await NfcManager.instance.startSession(
        pollingOptions: {NfcPollingOption.iso14443, NfcPollingOption.iso15693},
        onDiscovered: (tag) async {
          if (completer.isCompleted) return;
          completer.complete(await _writeTag(tag, message, url, expectIdentity));
          await stop();
        },
      );
      _sessionOpen = true;
    } catch (_) {
      await stop();
      return const NfcWriteResult(ok: false, error: TagError.io);
    }

    return completer.future.timeout(timeout, onTimeout: () async {
      await stop();
      return const NfcWriteResult(ok: false, error: TagError.timeout);
    });
  }

  Future<NfcWriteResult> _writeTag(
    NfcTag tag,
    NdefMessage message,
    String expected,
    String expectIdentity,
  ) async {
    // Rozilik berilgan tegmi.
    final identity = tagIdentity(tag.data);
    if (expectIdentity.isNotEmpty && identity.isNotEmpty && identity != expectIdentity) {
      return const NfcWriteResult(ok: false, error: TagError.differentTag);
    }

    try {
      final ndef = Ndef.from(tag);

      if (ndef == null) {
        // Formatlanmagan bo'sh teg — Android'da formatlab yozamiz.
        final formatable = NdefFormatable.from(tag);
        if (formatable == null) {
          return const NfcWriteResult(ok: false, error: TagError.notNdef);
        }
        await formatable.format(message);
        // Formatlashdan keyin qayta o'qish uchun Ndef tutqichi yo'q:
        // `format` muvaffaqiyatli bo'lsa teg endi NDEF. Shu sababli
        // tasdiqlash ALOHIDA tegizishda so'raladi — chaqiruvchi buni
        // `verifyPending` orqali biladi.
        return NfcWriteResult(ok: true, written: expected);
      }

      final block = checkWritable(
        isNdef: true,
        writable: ndef.isWritable,
        maxSize: ndef.maxSize,
        payloadSize: message.byteLength,
      );
      if (block == WriteBlock.readOnly) {
        return const NfcWriteResult(ok: false, error: TagError.readOnly);
      }
      if (block == WriteBlock.tooLarge) {
        return const NfcWriteResult(ok: false, error: TagError.tooLarge);
      }

      await ndef.write(message);

      // QAYTA O'QIB TASDIQLASH — "yozildi" yozuvining YAGONA asosi.
      final back = await ndef.read();
      for (final r in back.records) {
        final data = classifyRecord(
          typeNameFormat: r.typeNameFormat.index,
          type: r.type,
          payload: r.payload,
        );
        if (data.kind == NdefKind.uri && sameWrittenUrl(expected, data.value)) {
          return NfcWriteResult(ok: true, written: data.value);
        }
      }
      return const NfcWriteResult(ok: false, error: TagError.verifyFailed);
    } catch (_) {
      return const NfcWriteResult(ok: false, error: TagError.io);
    }
  }

  /// Tegdagi NDEF yozuvidan URI yoki matnni ajratadi.
  ///
  /// Ajratish mantig'i `ndef_payload.dart` da — o'sha yerda u
  /// telefonsiz sinaladi. Avval bu yerda prefiks jadvalining
  /// QISQARTIRILGAN nusxasi va `String.fromCharCodes` turardi:
  /// birinchisi `tel:`/`mailto:` teglarini noto'g'ri o'qirdi,
  /// ikkinchisi esa lotin bo'lmagan harflarni buzardi.
  String? _payloadOf(NfcTag tag) {
    try {
      final message = Ndef.from(tag)?.cachedMessage;
      if (message == null) return null;
      for (final record in message.records) {
        if (record.payload.isEmpty) continue;
        final data = classifyRecord(
          typeNameFormat: record.typeNameFormat.index,
          type: record.type,
          payload: record.payload,
        );
        if (data.kind == NdefKind.uri || data.kind == NdefKind.text) {
          return data.value;
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<void> stop() async {
    if (!_sessionOpen) return;
    _sessionOpen = false;
    try {
      await NfcManager.instance.stopSession();
    } catch (_) {/* sessiya allaqachon yopilgan */}
    await _sub?.cancel();
    _sub = null;
  }
}

final nfcServiceProvider = Provider<NfcService>((ref) {
  final s = NfcService();
  ref.onDispose(s.stop);
  return s;
});

final nfcAvailabilityProvider = FutureProvider<NfcAvailability>(
  (ref) => ref.watch(nfcServiceProvider).check(),
);
