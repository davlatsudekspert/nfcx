import 'dart:async';

import 'package:app_links/app_links.dart';

import 'nfc.dart';

/// TASHQI HAVOLALAR (App Links).
///
/// Jismoniy NFC kartani tegizganda Android `https://nfcstore.uz/<kod>`
/// havolasini ochadi. Manifestdagi `autoVerify` tasdiqlangan bo'lsa,
/// bu havola brauzerga emas, SHU ILOVAGA keladi. Shu yerda u kodga
/// aylantiriladi.
///
/// NIMA UCHUN O'RAMA KLASS: `app_links` platforma kanallariga tayanadi
/// va testda mavjud emas. Ilova unga to'g'ridan-to'g'ri bog'lansa,
/// widget testlari yiqilardi. Bu yerda barcha xatolar yutiladi va
/// testga soxta oqim berish mumkin.
class DeepLinks {
  DeepLinks({Stream<Uri>? stream, Future<Uri?>? initial})
      : _injected = stream,
        _injectedInitial = initial;

  final Stream<Uri>? _injected;
  final Future<Uri?>? _injectedInitial;
  AppLinks? _links;

  AppLinks? get _plugin {
    if (_injected != null) return null;
    try {
      return _links ??= AppLinks();
    } catch (_) {
      return null;
    }
  }

  /// Ilova YOPIQ bo'lganda kartani tegizish — ilova shu havola bilan
  /// ishga tushadi. Oqim bunday holatni bermaydi, alohida so'raladi.
  Future<NfcLink?> initial() async {
    try {
      final uri = await (_injectedInitial ?? _plugin?.getInitialLink());
      return uri == null ? null : NfcLink.parse(uri.toString());
    } catch (_) {
      return null;
    }
  }

  /// Ilova OCHIQ turganda kelgan havolalar.
  ///
  /// Faqat NFCSTORE havolalari o'tadi — begonalari e'tiborsiz
  /// qoldiriladi, aks holda ilova ixtiyoriy havola bo'yicha profil
  /// ochishga urinardi.
  Stream<NfcLink> stream() {
    final source = _injected ?? _plugin?.uriLinkStream;
    if (source == null) return const Stream<NfcLink>.empty();
    return source
        .map((uri) => NfcLink.parse(uri.toString()))
        .where((link) => link != null)
        .cast<NfcLink>()
        .handleError((_) {});
  }
}
