import '../../routing/routes.dart';

/// NFC YORLIG'IDAN O'QILGAN MATN — QAYERGA OLIB BORADI.
///
/// Ilgari har qanday manzilning OXIRGI bo'lagi NFC ID kodi deb
/// olinardi: `https://example.com/menu` tegini skanerlagan odam
/// `MENU` degan BEGONA profilga tushardi. Endi faqat NFCSTORE
/// manzillari ichkariga olib kiradi:
///
///   * `https://nfcstore.uz/...` va `www.nfcstore.uz` (hamda
///     `nfcstore://...` sxemasi) — ilova marshrutlari bilan bir xil
///     yo'l: `/t/<token>` stiker, `/u/<kod>` yoki `/<KOD>` profil,
///     qolgani (`/c/...`, `/post/...`, `/story/...`) routerga;
///   * boshqa har qanday matn yoki manzil — "Bu NFCSTORE yorlig'i
///     emas": mazmuni ko'rsatiladi, veb manzil bo'lsa brauzerda
///     ochish taklif qilinadi.
sealed class ScanTarget {
  const ScanTarget();
}

/// Stiker / chip tokeni (`/t/<token>`) — serverda kodga aylanadi.
class ScanChip extends ScanTarget {
  const ScanChip(this.token);
  final String token;
}

/// Shaxsiy NFC ID profili.
class ScanProfile extends ScanTarget {
  const ScanProfile(this.code);
  final String code;
}

/// Boshqa NFCSTORE sahifasi — router yo'li (`/c/KARTAUZ`, `/post/5`).
class ScanRoute extends ScanTarget {
  const ScanRoute(this.location);
  final String location;
}

/// NFCSTORE yorlig'i emas.
class ScanForeign extends ScanTarget {
  const ScanForeign(this.raw, {this.webUrl});
  final String raw;

  /// `http(s)` manzil bo'lsa — brauzerda ochish uchun.
  final Uri? webUrl;
}

const kNfcstoreHosts = {'nfcstore.uz', 'www.nfcstore.uz'};

final _code = RegExp(r'^[A-Za-z0-9]{2,32}$');

ScanTarget classifyScan(String payload) {
  final raw = payload.trim();
  final uri = Uri.tryParse(raw);
  if (uri == null || !uri.hasScheme) return ScanForeign(raw);

  final web = uri.scheme == 'http' || uri.scheme == 'https';
  final List<String> seg;
  if (web && kNfcstoreHosts.contains(uri.host.toLowerCase())) {
    seg = uri.pathSegments.where((e) => e.isNotEmpty).toList();
  } else if (uri.scheme == 'nfcstore') {
    seg = [
      if (uri.host.isNotEmpty) uri.host,
      ...uri.pathSegments.where((e) => e.isNotEmpty),
    ];
  } else {
    return ScanForeign(raw, webUrl: web && uri.host.isNotEmpty ? uri : null);
  }

  if (seg.isEmpty) return const ScanRoute(Routes.home);
  if ((seg.first == 't' || seg.first == 'tap') && seg.length >= 2) {
    return ScanChip(seg[1]);
  }
  if (seg.first == 'u' && seg.length >= 2 && _code.hasMatch(seg[1])) {
    return ScanProfile(seg[1].toUpperCase());
  }
  if (seg.length == 1 && _code.hasMatch(seg[0])) {
    return ScanProfile(seg[0].toUpperCase());
  }
  return ScanRoute(
      '/${seg.join('/')}${uri.hasQuery ? '?${uri.query}' : ''}');
}
