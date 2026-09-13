import 'dart:async';
import 'dart:convert';
import 'dart:io' show SocketException;
import 'package:http/http.dart' as http;

/// API xatosi — server qaytargan KALIT bilan.
///
/// Kalit foydalanuvchiga ko'rsatilmaydi: `humanError()` uni o'zbekcha
/// jumlaga aylantiradi. Bu yerda u faqat mantiq uchun saqlanadi
/// (masalan `bad_email_code` bo'lsa kod maydonini qizartirish).
class ApiError implements Exception {
  ApiError(this.key, {this.status = 0, this.detail});

  final String key;
  final int status;
  final String? detail;

  bool get isAuth => status == 401 || key == 'unauthorized';
  bool get isOffline => key == 'offline';

  @override
  String toString() => key;
}

/// NFCSTORE backend klienti.
///
/// MUHIM QARORLAR:
///
/// 1) SESSIYA — `Authorization: Bearer <token>`, cookie EMAS.
///    Backend buni allaqachon qo'llab-quvvatlaydi (`getCurrentUser`
///    cookie bo'lmasa Bearer'ni o'qiydi). Mobil cookie jar platformalar
///    orasida turlicha ishlaydi va ilova fondan qaytganda yo'qolishi
///    mumkin — token esa Keystore/Keychain da ishonchli turadi.
///
/// 2) `X-Client` — ro'yxatdan o'tish manbasini belgilaydi (Android
///    ilovadan kelganlar admin "Trafik" bo'limida alohida ko'rinadi).
///
/// 3) ALOHIDA BAZA YO'Q. Sayt va ilova bitta manbadan o'qiydi: saytda
///    ism o'zgarsa, ilova keyingi so'rovda yangisini ko'radi.
class Api {
  Api({
    this.baseUrl = 'https://nfcstore.uz',
    http.Client? client,
    this.clientName = 'android',
  }) : _http = client ?? http.Client();

  final String baseUrl;
  final String clientName;
  final http.Client _http;

  String? _token;

  /// Sessiya tokeni. `null` — kirilmagan.
  String? get token => _token;
  set token(String? v) => _token = (v == null || v.isEmpty) ? null : v;

  /// Tarmoq kutish muddati. Mobil internet sekin bo'lishi mumkin,
  /// lekin 20 soniyadan ortiq kutish "osilib qolgan" degani.
  static const _timeout = Duration(seconds: 20);

  Map<String, String> _headers({bool json = false}) => {
        'accept': 'application/json',
        'x-client': clientName,
        if (json) 'content-type': 'application/json',
        if (_token != null) 'authorization': 'Bearer $_token',
      };

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final q = <String, String>{};
    query?.forEach((k, v) {
      if (v != null) q[k] = '$v';
    });
    return Uri.parse('$baseUrl$path').replace(queryParameters: q.isEmpty ? null : q);
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _send(() => _http.get(_uri(path, query), headers: _headers()));

  Future<dynamic> post(String path, [Object? body]) => _send(
        () => _http.post(
          _uri(path),
          headers: _headers(json: true),
          body: jsonEncode(body ?? const {}),
        ),
      );

  Future<dynamic> put(String path, [Object? body]) => _send(
        () => _http.put(
          _uri(path),
          headers: _headers(json: true),
          body: jsonEncode(body ?? const {}),
        ),
      );

  Future<dynamic> delete(String path) => _send(() => _http.delete(_uri(path), headers: _headers()));

  /// Barcha so'rovlar shu yerdan o'tadi — xato tarjimasi ham, offline
  /// aniqlash ham bitta joyda.
  Future<dynamic> _send(Future<http.Response> Function() run) async {
    http.Response res;
    try {
      res = await run().timeout(_timeout);
    } on TimeoutException {
      throw ApiError('timeout');
    } on SocketException {
      throw ApiError('offline');
    } on http.ClientException {
      throw ApiError('offline');
    }

    dynamic body;
    if (res.body.isNotEmpty) {
      try {
        body = jsonDecode(utf8.decode(res.bodyBytes));
      } catch (_) {
        body = null;
      }
    }

    if (res.statusCode >= 200 && res.statusCode < 300) return body;

    final key = body is Map && body['error'] is String
        ? body['error'] as String
        : 'http_${res.statusCode}';
    throw ApiError(
      key,
      status: res.statusCode,
      detail: body is Map && body['detail'] is String ? body['detail'] as String : null,
    );
  }

  void close() => _http.close();
}

/// Nisbiy manzilni to'liq manzilga aylantiradi.
///
/// Backend rasm yo'llarini `/uploads/...` ko'rinishida qaytaradi.
/// Brauzerda bu ishlaydi (bir xil domen), ilovada esa ishlamaydi —
/// shuning uchun har bir rasm shu funksiyadan o'tishi SHART.
String? absUrl(String? raw, {String base = 'https://nfcstore.uz'}) {
  final v = (raw ?? '').trim();
  if (v.isEmpty) return null;
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:')) return v;
  return v.startsWith('/') ? '$base$v' : '$base/$v';
}
