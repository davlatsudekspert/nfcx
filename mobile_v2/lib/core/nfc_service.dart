import 'dart:async';

import 'package:nfc_manager/nfc_manager.dart';

class NfcLink {
  const NfcLink(this.code);
  final String code;

  static NfcLink? parse(String raw) {
    final uri = Uri.tryParse(raw.trim());
    if (uri == null) return null;
    final host = uri.host.toLowerCase();
    if (host != 'nfcstore.uz' && !host.endsWith('.nfcstore.uz')) return null;
    final parts = uri.pathSegments.where((e) => e.isNotEmpty).toList();
    if (parts.isEmpty) return null;
    final code = (parts.first == 'id' && parts.length > 1 ? parts[1] : parts.first).toUpperCase();
    if (!RegExp(r'^[A-Z0-9]{3,16}$').hasMatch(code)) return null;
    return NfcLink(code);
  }
}

class NfcService {
  const NfcService();

  Future<bool> available() async {
    try {
      return await NfcManager.instance.isAvailable();
    } catch (_) {
      return false;
    }
  }

  Future<NfcLink?> read({Duration timeout = const Duration(seconds: 20)}) async {
    final completer = Completer<NfcLink?>();
    Timer? timer;

    Future<void> stop() async {
      timer?.cancel();
      try {
        await NfcManager.instance.stopSession();
      } catch (_) {}
    }

    try {
      await NfcManager.instance.startSession(
        pollingOptions: {
          NfcPollingOption.iso14443,
          NfcPollingOption.iso15693,
        },
        onDiscovered: (tag) async {
          final link = _extract(tag);
          if (!completer.isCompleted) completer.complete(link);
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

  Future<bool> write(String code, {Duration timeout = const Duration(seconds: 20)}) async {
    final clean = code.trim().toUpperCase();
    if (!RegExp(r'^[A-Z0-9]{3,16}$').hasMatch(clean)) return false;

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
              await ndef.write(
                NdefMessage([
                  NdefRecord.createUri(
                    Uri.parse('https://nfcstore.uz/' + clean.toLowerCase()),
                  ),
                ]),
              );
              ok = true;
            }
          } catch (_) {}
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

  NfcLink? _extract(NfcTag tag) {
    try {
      final ndef = Ndef.from(tag);
      final message = ndef?.cachedMessage;
      if (message == null) return null;
      for (final record in message.records) {
        final uri = _uri(record);
        if (uri != null) {
          final parsed = NfcLink.parse(uri);
          if (parsed != null) return parsed;
        }
      }
    } catch (_) {}
    return null;
  }

  String? _uri(NdefRecord r) {
    try {
      if (r.typeNameFormat == NdefTypeNameFormat.nfcWellknown &&
          r.type.isNotEmpty &&
          r.type.first == 0x55 &&
          r.payload.isNotEmpty) {
        const prefixes = ['', 'http://www.', 'https://www.', 'http://', 'https://'];
        final prefix = r.payload.first;
        final tail = String.fromCharCodes(r.payload.sublist(1));
        return (prefix < prefixes.length ? prefixes[prefix] : '') + tail;
      }
    } catch (_) {}
    return null;
  }
}