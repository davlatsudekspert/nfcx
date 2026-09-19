import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nfc_manager/nfc_manager.dart';

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

/// NFC bilan ishlash.
///
/// MUHIM: bu yerda SOXTA skanerlash YO'Q. Agar qurilmada NFC bo'lmasa
/// yoki o'chirilgan bo'lsa, metod xato qaytaradi va ekran haqiqiy
/// holatni ko'rsatadi. "Skanerlandi" degan yozuv faqat kartadan HAQIQIY
/// ma'lumot o'qilgandagina chiqadi.
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
  /// `null` — karta o'qildi, lekin ичida NFCSTORE ma'lumoti yo'q
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

  /// Tegdagi NDEF yozuvidan URI yoki matnni ajratadi.
  String? _payloadOf(NfcTag tag) {
    try {
      final ndef = Ndef.from(tag);
      final message = ndef?.cachedMessage;
      if (message == null) return null;
      for (final record in message.records) {
        final payload = record.payload;
        if (payload.isEmpty) continue;

        // NDEF URI yozuvi: birinchi bayt — prefiks kodi
        // (0x04 = "https://"), qolgani matn.
        if (record.typeNameFormat == NdefTypeNameFormat.nfcWellknown &&
            record.type.isNotEmpty &&
            record.type.first == 0x55) {
          const prefixes = [
            '', 'http://www.', 'https://www.', 'http://', 'https://',
          ];
          final code = payload.first;
          final prefix = code < prefixes.length ? prefixes[code] : '';
          return prefix + String.fromCharCodes(payload.sublist(1));
        }

        // Matn yozuvi: birinchi bayt til kodining uzunligini beradi.
        if (record.type.isNotEmpty && record.type.first == 0x54) {
          final langLen = payload.first & 0x3F;
          return String.fromCharCodes(payload.sublist(1 + langLen));
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
