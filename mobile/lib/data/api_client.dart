import 'dart:async';
import 'dart:convert';
import 'dart:io' show HandshakeException, IOException, SocketException;
import 'package:flutter/foundation.dart' show ValueNotifier;
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

  /// TEXNIK TAFSILOT — odamga emas, TUZATUVCHIGA.
  ///
  /// Server `detail` yuborsa o'sha; yubormasa javobning boshi
  /// (masalan Cloudflare bloklaganda HTML sarlavhasi) yoki
  /// istisnoning matni. Ekranda kichik kulrang qatorda ko'rsatiladi:
  /// usiz har xatoda taxmin qilishga to'g'ri kelardi.
  final String? detail;

  bool get isAuth => status == 401 || key == 'unauthorized';
  bool get isOffline => key == 'offline';

  /// Bir qatorli texnik tavsif — ekranda va logda bir xil ko'rinadi.
  String get technical => [
        key,
        if (status > 0) 'HTTP $status',
        if ((detail ?? '').isNotEmpty) detail,
      ].join(' · ');

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

  /// TARMOQ BORMI — butun ilova uchun bitta signal.
  ///
  /// NIMA UCHUN ALOHIDA PLAGIN EMAS: `connectivity_plus` faqat
  /// telefon Wi-Fi/mobil tarmoqqa ULANGANLIGINI aytadi, internet
  /// HAQIQATAN ishlayotganini emas (mehmonxona Wi-Fi'si, to'lanmagan
  /// paket). Bu yerdagi haqiqat aniqroq: so'rov serverga YETIB
  /// BORDIMI yoki yo'q.
  final ValueNotifier<bool> online = ValueNotifier<bool>(true);

  /// Sessiya tokeni. `null` — kirilmagan.
  String? get token => _token;
  set token(String? v) => _token = (v == null || v.isEmpty) ? null : v;

  /// Tarmoq kutish muddati. Mobil internet sekin bo'lishi mumkin,
  /// lekin 20 soniyadan ortiq kutish "osilib qolgan" degani.
  static const _timeout = Duration(seconds: 20);

  /// Fayl yuklash uchun alohida, uzunroq muddat: 10 MB rasm mobil
  /// internetda 20 soniyaga sig'maydi.
  static const _uploadTimeout = Duration(seconds: 90);

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

  Future<dynamic> patch(String path, [Object? body]) => _send(
        () => _http.patch(
          _uri(path),
          headers: _headers(json: true),
          body: jsonEncode(body ?? const {}),
        ),
      );

  Future<dynamic> delete(String path) => _send(() => _http.delete(_uri(path), headers: _headers()));

  /// FAYL YUKLASH — XOM BINAR.
  ///
  /// NIMA UCHUN base64 EMAS: base64 hajmni ~33% ga oshiradi va
  /// Workers izolyati 128 MB xotira bilan cheklangan — 10 MB rasm
  /// base64 yo'li bilan dekodlashda bir necha baravar joy oladi.
  /// `/api/upload-media` tanani xom holda o'qiydi, shuning uchun
  /// telefondan to'g'ridan-to'g'ri baytlar yuboriladi.
  ///
  /// Tur `content-type` orqali beriladi va SERVER uni fayl
  /// boshidagi baytlar bilan qayta tekshiradi — noto'g'ri tur
  /// yuborib qutulib bo'lmaydi.
  Future<dynamic> upload(
    String path,
    List<int> bytes, {
    String contentType = 'image/jpeg',
  }) =>
      _send(() async {
        final req = http.Request('POST', _uri(path))
          ..headers.addAll({
            'accept': 'application/json',
            'x-client': clientName,
            'content-type': contentType,
            if (_token != null) 'authorization': 'Bearer $_token',
          })
          ..bodyBytes = bytes;
        return http.Response.fromStream(await _http.send(req));
      }, timeout: _uploadTimeout);

  /// Barcha so'rovlar shu yerdan o'tadi — xato tarjimasi ham, offline
  /// aniqlash ham bitta joyda.
  Future<dynamic> _send(
    Future<http.Response> Function() run, {
    Duration? timeout,
  }) async {
    http.Response res;
    try {
      res = await run().timeout(timeout ?? _timeout);
      // Javob KELDI — status kodi qanday bo'lishidan qat'i nazar,
      // tarmoq ishlayapti.
      online.value = true;
    } on TimeoutException {
      online.value = false;
      throw ApiError('timeout');
    } on SocketException catch (e) {
      online.value = false;
      throw ApiError('offline', detail: e.message);
    } on HandshakeException catch (e) {
      // XAVFSIZ ULANISH O'RNATILMADI — bu "internet yo'q" EMAS.
      //
      // Eng ko'p uchraydigan sababi: telefondagi ildiz sertifikatlar
      // ro'yxati eskirgan (Android 7 va undan pastlarda) yoki
      // qurilmadagi sana-vaqt noto'g'ri. Brauzer o'z ro'yxati bilan
      // ishlagani uchun sayt ochiladi, ilova esa tizimnikini
      // ishlatadi va aynan shu yerda to'xtaydi.
      //
      // Ilgari bu istisno hech qayerda tutilmasdi va ekranda
      // "Nimadir noto'g'ri ketdi" chiqardi — ya'ni eng aniq
      // belgi yo'qolardi.
      online.value = false;
      throw ApiError('tls', detail: e.message);
    } on http.ClientException catch (e) {
      online.value = false;
      throw ApiError('offline', detail: e.message);
    } on IOException catch (e) {
      // Qolgan barcha kiritish-chiqarish xatolari ham tarmoqniki:
      // ular ushlanmasa yuqoriga xom holda chiqib ketardi.
      online.value = false;
      throw ApiError('offline', detail: '$e');
    }

    dynamic body;
    String? raw;
    if (res.body.isNotEmpty) {
      try {
        body = jsonDecode(utf8.decode(res.bodyBytes));
      } catch (_) {
        body = null;
        // JSON EMAS — DEMAK JAVOB SERVERDAN EMAS, ORADAN keldi.
        //
        // Bunday javob odatda himoya qatlamining HTML sahifasi
        // ("Attention Required! | Cloudflare") yoki operator
        // portalining yo'naltirishi bo'ladi. Uni yo'qotib yuborsak,
        // ekranda faqat "HTTP 403" qolardi va sabab noma'lum
        // bo'lardi. Shuning uchun boshini saqlaymiz.
        raw = _snippet(res.body);
      }
    }

    if (res.statusCode >= 200 && res.statusCode < 300) return body;

    final key = body is Map && body['error'] is String
        ? body['error'] as String
        : 'http_${res.statusCode}';
    throw ApiError(
      key,
      status: res.statusCode,
      detail: body is Map && body['detail'] is String
          ? body['detail'] as String
          : raw,
    );
  }

  /// Javobning boshini bir qatorga siqadi — logda ham, ekranda ham
  /// o'qish mumkin bo'lsin.
  static String _snippet(String body) {
    final one = body.replaceAll(RegExp(r'\s+'), ' ').trim();
    return one.length <= 120 ? one : '${one.substring(0, 117)}...';
  }

  void close() {
    online.dispose();
    _http.close();
  }
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
