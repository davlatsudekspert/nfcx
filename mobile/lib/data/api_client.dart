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

/// SERVER JAVOBI — tanasi bilan birga sarlavhasi ham.
///
/// Odatda faqat tana kerak. Sessiya ochadigan so'rovlarda esa
/// `Set-Cookie` ham kerak bo'ladi: ba'zi server versiyalari tokenni
/// javob tanasiga qo'ymaydi va uni faqat cookie orqali beradi.
class ApiResponse {
  const ApiResponse({
    required this.status,
    required this.body,
    required this.headers,
    required this.raw,
  });

  final int status;
  final dynamic body;
  final Map<String, String> headers;

  /// Javobning boshi — xato tafsiloti uchun (JSON bo'lmasa ham).
  final String raw;

  Map<String, dynamic> get map =>
      body is Map ? (body as Map).cast<String, dynamic>() : <String, dynamic>{};

  /// `Set-Cookie` ichidagi sessiya tokeni. Topilmasa `null`.
  ///
  /// Sarlavha shakli: `nfc_session=<token>; Path=/; HttpOnly; ...`
  /// Bir nechta cookie bitta qatorda vergul bilan kelishi mumkin,
  /// shuning uchun nomga qarab qidiriladi.
  String? get sessionCookie {
    final raw = headers['set-cookie'] ?? headers['Set-Cookie'];
    if (raw == null || raw.isEmpty) return null;
    for (final part in raw.split(RegExp(r'[,;]\s*'))) {
      final eq = part.indexOf('=');
      if (eq <= 0) continue;
      final name = part.substring(0, eq).trim().toLowerCase();
      if (!name.contains('session')) continue;
      final value = part.substring(eq + 1).trim();
      if (value.isEmpty || value == 'deleted') continue;
      return value;
    }
    return null;
  }
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
  set token(String? v) {
    _token = (v == null || v.isEmpty) ? null : v;
    // Yangi token — sessiya oqimi yana yoqiladi.
    if (_token != null) _resetAuthGuard();
  }

  /// SESSIYA TUGAGANDA BIR MARTA CHAQIRILADI (401).
  ///
  /// NIMA UCHUN KERAK EDI: `ApiError.isAuth` yozilgan, lekin hech
  /// qayerda O'QILMAGAN edi. Ya'ni token muddati tugasa ilova buni
  /// umuman sezmasdi: eski token har so'rovga qo'shilaverardi, har
  /// ekran "Sessiya tugagan. Qaytadan kiring." deb turardi —
  /// lekin KIRISH EKRANIGA chiqishning yo'li yo'q edi.
  ///
  /// MARKAZIY JOY — HAR EKRANDA EMAS. Har ekranga alohida
  /// tekshiruv yozish o'nlab joyda takrorlash va bittasini
  /// unutish degani; bu yerda esa BITTA so'rov yo'li bor va
  /// hammasi shu yerdan o'tadi.
  void Function()? onUnauthorized;

  /// REFRESH-TOKEN MEXANIZMI LOYIHADA YO'Q.
  ///
  /// Server bitta shaffof sessiya tokeni beradi (`sessions` jadvali,
  /// `expires_at`), yangilash yo'li esa umuman mavjud emas. Shuning
  /// uchun bu yerda "refresh" TO'QIB CHIQARILMAYDI — bunday
  /// mexanizmni faqat mijozda yasash ishlamaydi va uni bor deb
  /// ko'rsatish yolg'on bo'lardi. 401 kelganda yagona to'g'ri yo'l
  /// — xavfsiz chiqish.
  static const hasRefreshToken = false;

  /// SESSIYA TUGAGANI BIR MARTA E'LON QILINADI.
  ///
  /// Ekran ochilganda 5-10 ta so'rov BIR VAQTDA ketadi (lenta,
  /// profil, obunalar, kartalar...). Token eskirgan bo'lsa
  /// hammasi 401 qaytaradi. Bayroqsiz bu 5-10 marta chiqish, 5-10
  /// marta navigatsiya va 5-10 ta bir xil xabar bo'lardi.
  bool _authExpiredFired = false;

  /// Sessiya oqimini qayta yoqadi — yangi token kelganda.
  void _resetAuthGuard() => _authExpiredFired = false;

  /// KIRISH VA RO'YXATDAN O'TISH YO'LLARI — 401 bu yerda
  /// "sessiya tugadi" EMAS.
  ///
  /// Noto'g'ri parol ham 401 berishi mumkin. Agar odam allaqachon
  /// kirgan bo'lsa-yu, boshqa hisobga kirmoqchi bo'lib parolni
  /// xato tersa, global oqim uni JORIY sessiyasidan ham
  /// chiqarib yuborardi.
  static bool _isAuthPath(String path) =>
      path.startsWith('/api/auth/login') ||
      path.startsWith('/api/auth/register') ||
      path.startsWith('/api/auth/request-register-code') ||
      path.startsWith('/api/auth/request-password-reset') ||
      path.startsWith('/api/auth/reset-password') ||
      path.startsWith('/api/auth/logout');

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
      _send(path, () => _http.get(_uri(path, query), headers: _headers()));

  Future<dynamic> post(String path, [Object? body]) => _send(
        path,
        () => _http.post(
          _uri(path),
          headers: _headers(json: true),
          body: jsonEncode(body ?? const {}),
        ),
      );

  /// SESSIYA OCHADIGAN SO'ROV — javob TANASI ham, SARLAVHASI ham kerak.
  ///
  /// Kirish va ro'yxatdan o'tishda token ikki yo'l bilan kelishi
  /// mumkin: javob tanasida (`{"token": "..."}`) yoki `Set-Cookie`
  /// sarlavhasida. Ikkalasi ham BIR XIL token — server uni bir xil
  /// SHA-256 bilan saqlaydi va `Authorization: Bearer` orqali ham
  /// qabul qiladi.
  ///
  /// Oddiy `post()` faqat tanani qaytaradi, ya'ni cookie'dagi token
  /// yo'qolardi. Shuning uchun bu yerda javob to'liq beriladi.
  Future<ApiResponse> postAuth(String path, [Object? body]) => _sendFull(
        path,
        () => _http.post(
          _uri(path),
          headers: _headers(json: true),
          body: jsonEncode(body ?? const {}),
        ),
      );

  Future<dynamic> put(String path, [Object? body]) => _send(
        path,
        () => _http.put(
          _uri(path),
          headers: _headers(json: true),
          body: jsonEncode(body ?? const {}),
        ),
      );

  Future<dynamic> patch(String path, [Object? body]) => _send(
        path,
        () => _http.patch(
          _uri(path),
          headers: _headers(json: true),
          body: jsonEncode(body ?? const {}),
        ),
      );

  Future<dynamic> delete(String path) =>
      _send(path, () => _http.delete(_uri(path), headers: _headers()));

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
      _send(path, () async {
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
    String path,
    Future<http.Response> Function() run, {
    Duration? timeout,
  }) async =>
      (await _sendFull(path, run, timeout: timeout)).body;

  /// BARCHA SO'ROVLAR SHU YERDAN O'TADI — 401 ham shu yerda hal
  /// qilinadi, har ekranda alohida emas.
  Future<ApiResponse> _sendFull(
    String path,
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

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return ApiResponse(
        status: res.statusCode,
        body: body,
        headers: res.headers,
        raw: raw ?? _snippet(res.body),
      );
    }

    final key = body is Map && body['error'] is String
        ? body['error'] as String
        : 'http_${res.statusCode}';

    // ── SESSIYA TUGADI: MARKAZIY QAROR ────────────────────────
    //
    // Uchta shart ham ZARUR:
    //
    // 1. `401` — 403 EMAS. 403 "ruxsat yetarli emas" degani:
    //    sessiya tirik, faqat shu amalga haqing yo'q. Uni chiqish
    //    deb hisoblash odamni bitta rad javob uchun butun
    //    sessiyasidan ayirardi.
    //
    // 2. TOKEN BOR. Mehmonda 401 oddiy rad javob ("bu yo'l kirishni
    //    talab qiladi"), sessiyaning tugashi emas.
    //
    // 3. KIRISH YO'LI EMAS. Noto'g'ri parol ham 401 beradi; kirgan
    //    odam boshqa hisobga kirmoqchi bo'lib xato tersa, global
    //    oqim uni joriy sessiyasidan ham chiqarib yuborardi.
    //
    // Tarmoq xatolari bu yergacha umuman yetib kelmaydi: ular
    // yuqorida `ApiError('offline' | 'timeout' | 'tls')` bo'lib
    // uziladi, ya'ni internet uzilishi hech qachon chiqish
    // bo'lmaydi.
    if (res.statusCode == 401 && _token != null && !_isAuthPath(path)) {
      _token = null;
      // BIR MARTA. Ekran ochilganda o'nlab so'rov birga ketadi va
      // token eskirgan bo'lsa hammasi 401 qaytaradi — bayroqsiz bu
      // o'nta chiqish, o'nta navigatsiya va o'nta bir xil xabar
      // bo'lardi.
      if (!_authExpiredFired) {
        _authExpiredFired = true;
        onUnauthorized?.call();
      }
    }
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
