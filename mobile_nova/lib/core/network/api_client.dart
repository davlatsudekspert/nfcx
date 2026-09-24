import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../errors/app_error.dart';
import '../storage/secure_store.dart';
import '../utils/result.dart';

/// NFCSTORE backend manzili.
///
/// `--dart-define=NOVA_API_BASE=...` bilan almashtiriladi, shuning uchun
/// staging'ga ulanish uchun kod o'zgartirilmaydi.
/// CI qurilish raqami (`--dart-define=NOVA_BUILD`), mahalliyda bo'sh.
const kNovaBuild = String.fromEnvironment('NOVA_BUILD');

const kApiBase = String.fromEnvironment(
  'NOVA_API_BASE',
  defaultValue: 'https://nfcstore.uz',
);

/// Backend bilan yagona aloqa nuqtasi.
///
/// QARORLAR:
///
/// 1) SESSIYA — `Authorization: Bearer <token>`, cookie EMAS. Backend
///    `currentUser()` ichida cookie bo'lmasa Bearer'ni o'qiydi. Mobil
///    cookie jar ilova fondan qaytganda yo'qolishi mumkin, Keystore esa yo'q.
///
/// 2) `X-Client: android` — BU QIYMAT ANIQ TANLANGAN, xohlagancha
///    o'zgartirilmaydi. Backend uni TO'LIQ moslik bilan tekshiradi:
///
///        const MOBILE_CLIENTS_D1 = new Set(['mobile', 'android', 'ios']);
///        MOBILE_CLIENTS_D1.has(headers.get('x-client').toLowerCase())
///
///    Ya'ni `android-nova` bu to'plamga TUSHMAYDI. Natijada
///    `/api/auth/login` javob TANASIDA token qaytarmasdi va sessiya
///    faqat `Set-Cookie` ni qo'lda o'qish hisobiga tirik qolardi —
///    backend mobil uchun ataylab qurgan yo'l esa o'lik edi.
///
///    Ilgari bu yerda `android-nova` turardi va izohda "admin panelida
///    Nova trafigi ajralib ko'rinadi" deyilgandi. Bu NOTO'G'RI edi:
///    backend'da `nova` degan qiymat umuman o'qilmaydi. Nova'ni
///    ajratish uchun alohida `X-App` sarlavhasi yuboriladi — u
///    `x-client` tekshiruviga xalaqit bermaydi.
///
///    Eski ilova ham aynan `android` yuboradi, demak ikkalasi ham
///    `signupSourceD1` da `android` bo'lib qoladi.
///
/// 3) Metodlar ISTISNO OTMAYDI: `Result` qaytaradi. Shu sabab har bir
///    chaqiruvda xato holati hisobga olinishi shart bo'ladi.
class ApiClient {
  ApiClient({Dio? dio, SecureStore? store, this.baseUrl = kApiBase})
      : _store = store ?? SecureStore(),
        _dio = dio ?? Dio() {
    _dio.options = _dio.options.copyWith(
      baseUrl: baseUrl,
      // Mobil internet sekin bo'lishi mumkin, lekin 20 soniyadan ortiq
      // kutish "osilib qolgan" degani.
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
      headers: {
        'accept': 'application/json',
        'x-client': 'android',
        'x-app': 'nova',
        // Qurilish raqami (CI beradi) — admin panelda "kim qaysi
        // versiyada" ko'rinadi. Mahalliy qurilishda yuborilmaydi.
        if (kNovaBuild.isNotEmpty) 'x-app-build': kNovaBuild,
      },
      // Status kodini o'zimiz tahlil qilamiz — Dio 4xx uchun istisno
      // otmasligi kerak, aks holda `Result` naqshi buzilardi.
      validateStatus: (_) => true,
    );
  }

  final Dio _dio;
  final SecureStore _store;
  final String baseUrl;

  String? _token;

  /// Tarmoq bormi — butun ilova uchun bitta signal.
  ///
  /// NIMA UCHUN `connectivity_plus` EMAS: u faqat Wi-Fi/mobil tarmoqqa
  /// ULANGANLIKNI aytadi, internet HAQIQATAN ishlayotganini emas
  /// (mehmonxona Wi-Fi'si, to'lanmagan paket). Bu yerdagi haqiqat aniqroq:
  /// so'rov serverga yetib bordimi yoki yo'q.
  final ValueNotifier<bool> online = ValueNotifier<bool>(true);

  /// Sessiya tugaganda (401) ishga tushadi — router kirish ekraniga oladi.
  final ValueNotifier<int> sessionExpired = ValueNotifier<int>(0);

  String? get token => _token;

  Future<void> loadToken() async => _token = await _store.readToken();

  Future<void> setToken(String? v) async {
    _token = (v == null || v.isEmpty) ? null : v;
    if (_token == null) {
      await _store.clear();
    } else {
      await _store.writeToken(_token!);
    }
  }

  Map<String, dynamic> get _auth =>
      _token == null ? const {} : {'authorization': 'Bearer $_token'};

  Future<Result<T>> get<T>(String path, {Map<String, dynamic>? query}) =>
      _run<T>(() => _dio.get(path,
          queryParameters: _clean(query), options: Options(headers: _auth)));

  Future<Result<T>> post<T>(String path, [Object? body]) => _run<T>(
      () => _dio.post(path, data: body ?? const {}, options: Options(headers: _auth)));

  Future<Result<T>> patch<T>(String path, [Object? body]) => _run<T>(
      () => _dio.patch(path, data: body ?? const {}, options: Options(headers: _auth)));

  Future<Result<T>> put<T>(String path, [Object? body]) => _run<T>(
      () => _dio.put(path, data: body ?? const {}, options: Options(headers: _auth)));

  Future<Result<T>> delete<T>(String path, [Object? body]) => _run<T>(
      () => _dio.delete(path, data: body, options: Options(headers: _auth)));

  /// RASM YUKLASH — `data:` URL, multipart EMAS.
  ///
  /// ## NIMA UCHUN MULTIPART EMAS
  ///
  /// Bu ilgari `FormData` bilan yuborilardi va HAR SAFAR 422
  /// `bad_image` qaytarardi — ya'ni ilovadan birorta rasm (avatar,
  /// muqova, post, istorya, katalog) yuklanmagan. Sabab serverda:
  ///
  ///     const body = await request.json().catch(() => ({}));
  ///     const match = UPLOAD_IMAGE_RE.exec(String(body.dataUrl || ''));
  ///     if (!match) return json({ error: 'bad_image' }, 422);
  ///
  /// `request.json()` multipart tanani o'qiy olmaydi, `catch` uni
  /// bo'sh obyektga aylantiradi, `dataUrl` esa `undefined` bo'ladi.
  /// Xato hech qachon ko'rinmagan, chunki server 2xx o'rniga 422
  /// qaytargan va UI buni "rasm yaroqsiz" deb ko'rsatgan.
  ///
  /// Server kutadigan shakl QAT'IY:
  ///
  ///     /^data:(image\/(png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+\/=]+)$/
  ///
  /// Shuning uchun `mime` shu ro'yxatdan bo'lishi va base64 da
  /// satr uzilishi BO'LMASLIGI shart.
  ///
  /// HAJM: server base64 ni ochgandan KEYIN o'lchaydi — oddiy rasm
  /// uchun 700 KB, `kind: 'cover'` uchun 20 MB, gif uchun 3 MB.
  /// Shuning uchun rasm tanlashda `maxWidth`/`imageQuality` bilan
  /// siqiladi.
  Future<Result<Map<String, dynamic>>> uploadDataUrl(
    String path,
    List<int> bytes,
    String mime, {
    String? kind,
    void Function(int sent, int total)? onProgress,
  }) =>
      _run<Map<String, dynamic>>(
        () => _dio.post(
          path,
          data: {
            'dataUrl': 'data:$mime;base64,${base64Encode(bytes)}',
            if (kind != null) 'kind': kind,
          },
          onSendProgress: onProgress,
          options: Options(
            headers: _auth,
            sendTimeout: const Duration(seconds: 90),
            receiveTimeout: const Duration(seconds: 90),
          ),
        ),
      );

  /// VIDEO YUKLASH — XOM BINAR.
  ///
  /// Video uchun server boshqa yo'l tutadi: `/api/upload-card-video`
  /// tanani `streamUploadToR2` orqali oqim sifatida o'qiydi va
  /// to'g'ridan-to'g'ri R2 ga yozadi. Ya'ni bu yerda na base64, na
  /// multipart — faqat fayl baytlari va to'g'ri `content-type`.
  ///
  /// Base64 bu yerda ATAYLAB ishlatilmaydi: u hajmni ~33% oshiradi
  /// va videoda bu o'nlab megabaytga aylanadi.
  ///
  /// FAYL DISKDAN OQIM BILAN O'QILADI (64 KB bo'laklar). Ilgari butun
  /// fayl `readAsBytes()` bilan xotiraga olinardi — 300 MB video
  /// shuncha RAM talab qilib, eski telefonda ilovani o'ldirardi.
  /// Yuborish vaqti hajmga qarab: kamida 180 s, ~100 KB/s dan sekin
  /// bo'lmasa uzilmaydi.
  Future<Result<Map<String, dynamic>>> uploadBinary(
    String path,
    String filePath,
    String contentType, {
    void Function(int sent, int total)? onProgress,
  }) =>
      _run<Map<String, dynamic>>(() async {
        final file = File(filePath);
        final len = await file.length();
        return _dio.post(
          path,
          data: file.openRead(),
          onSendProgress: onProgress,
          options: Options(
            headers: {
              ..._auth,
              'content-type': contentType,
              'content-length': len,
            },
            sendTimeout: Duration(seconds: len ~/ (100 * 1024) < 180
                ? 180
                : len ~/ (100 * 1024)),
            receiveTimeout: const Duration(seconds: 180),
          ),
        );
      });

  /// SESSIYA OCHADIGAN SO'ROV — javob TANASI ham, SARLAVHASI ham kerak.
  ///
  /// Backend'ning ayrim versiyalari tokenni javob tanasiga QO'YMAYDI va
  /// uni faqat `Set-Cookie` orqali beradi. Oddiy `post()` sarlavhani
  /// tashlab yuborardi va kirish "muvaffaqiyatli" bo'lsa-da sessiyasiz
  /// qolardi.
  Future<Result<({Map<String, dynamic> body, String? session})>> postSession(
    String path,
    Object? body,
  ) async {
    try {
      final res = await _dio.post(path, data: body ?? const {},
          options: Options(headers: _auth));
      online.value = true;
      final status = res.statusCode ?? 0;
      final map = _asMap(res.data);
      if (status >= 200 && status < 300) {
        return Ok((body: map, session: _sessionFrom(res.headers)));
      }
      return Err(_httpError(status, res.data, res.requestOptions.path));
    } on DioException catch (e) {
      final err = _dioError(e);
      if (err.kind == AppErrorKind.offline) online.value = false;
      return Err(err);
    } catch (e) {
      return Err(AppError(AppErrorKind.unknown, detail: '$e'));
    }
  }

  /// `Set-Cookie` ichidan sessiya tokenini ajratadi.
  ///
  /// Sarlavha shakli: `nfc_session=<token>; Path=/; HttpOnly; ...`
  /// Bir nechta cookie bitta qatorda kelishi mumkin, shuning uchun
  /// qiymat emas, NOM bo'yicha qidiriladi.
  String? _sessionFrom(Headers headers) {
    for (final raw in headers.map['set-cookie'] ?? const <String>[]) {
      for (final part in raw.split(RegExp(r'[,;]\s*'))) {
        final eq = part.indexOf('=');
        if (eq <= 0) continue;
        final name = part.substring(0, eq).trim().toLowerCase();
        if (!name.contains('session')) continue;
        final value = part.substring(eq + 1).trim();
        if (value.isEmpty || value == 'deleted') continue;
        return value;
      }
    }
    return null;
  }

  Map<String, dynamic>? _clean(Map<String, dynamic>? q) {
    if (q == null) return null;
    final out = <String, dynamic>{};
    q.forEach((k, v) {
      if (v != null && '$v'.isNotEmpty) out[k] = v;
    });
    return out.isEmpty ? null : out;
  }

  Future<Result<T>> _run<T>(Future<Response<dynamic>> Function() send) async {
    try {
      final res = await send();
      online.value = true;
      final status = res.statusCode ?? 0;
      final body = res.data;

      if (status >= 200 && status < 300) {
        if (T == Map<String, dynamic>) {
          return Ok(_asMap(body) as T);
        }
        if (body is T) return Ok(body);
        // `void` kutilgan joylar: tana muhim emas.
        if (null is T) return Ok(null as T);
        return Ok(_asMap(body) as T);
      }
      return Err(_httpError(status, body, res.requestOptions.path));
    } on DioException catch (e) {
      final err = _dioError(e);
      if (err.kind == AppErrorKind.offline) online.value = false;
      return Err(err);
    } catch (e) {
      return Err(AppError(AppErrorKind.unknown, detail: '$e'));
    }
  }

  Map<String, dynamic> _asMap(dynamic body) {
    if (body is Map) return body.cast<String, dynamic>();
    if (body is List) return {'items': body};
    return {'value': body};
  }

  AppError _httpError(int status, dynamic body, [String path = '']) {
    final map = body is Map ? body.cast<String, dynamic>() : const <String, dynamic>{};
    final code = (map['error'] ?? map['code'])?.toString();
    // `content_blocked` — rasm filtri sababni `category` da beradi.
    // `email_send_failed` — sabab kodi (`http_403`, `network`) `reason` da.
    final detail = map['detail']?.toString() ??
        map['category']?.toString() ??
        map['reason']?.toString() ??
        (body is String && body.isNotEmpty ? body.substring(0, body.length.clamp(0, 120)) : null);

    final kind = switch (status) {
      401 => AppErrorKind.unauthorized,
      403 => AppErrorKind.forbidden,
      // 404 — endpoint umuman yo'q bo'lsa server HTML qaytaradi; resurs
      // topilmasa esa JSON. Farqi shu: HTML kelsa bu backend bo'shlig'i.
      404 => body is Map ? AppErrorKind.notFound : AppErrorKind.endpointMissing,
      405 => AppErrorKind.endpointMissing,
      409 => AppErrorKind.conflict,
      422 => AppErrorKind.validation,
      429 => AppErrorKind.rateLimited,
      _ => status >= 500 ? AppErrorKind.server : AppErrorKind.unknown,
    };

    if (kind == AppErrorKind.unauthorized) _onUnauthorized(path);
    return AppError(kind, code: code, detail: detail, status: status);
  }

  /// SESSIYA TUGAGANINI BOSHQA QATLAM ANIQLAGANDA.
  ///
  /// ## NIMA UCHUN KERAK
  ///
  /// `/api/auth/me` eskirgan token uchun 401 QAYTARMAYDI. Server
  /// kodi buni ochiq ko'rsatadi:
  ///
  ///     const user = await getCurrentUser(request, env);
  ///     if (!user) return json({ user: null, cards: [] });
  ///
  /// Ya'ni HTTP 200, tanasida esa `user: null`. Demak sessiyani
  /// tekshiradigan ASOSIY yo'l uchun 401 hech qachon kelmaydi va
  /// faqat holat kodiga tayangan har qanday tekshiruv bu holatni
  /// ko'rmaydi.
  ///
  /// `AuthRepository.me()` bo'sh foydalanuvchini ko'rganda shu
  /// metodni chaqiradi — shunda oqim 401 bilan bir xil bo'ladi:
  /// token tozalanadi, signal beriladi, router kirish ekraniga
  /// ko'chiradi.
  void notifySessionExpired() => _onUnauthorized('');

  /// SINOV UCHUN TESHIK.
  ///
  /// 401 ni tarmoqsiz qayta ishlab ko'rish imkonini beradi: qaysi
  /// yo'lda sessiya yopilishi, qaysisida yopilmasligi aynan shu
  /// yerda hal bo'ladi va uni haqiqiy server bilan sinash qimmat.
  /// Sinovda tokenni tarmoqsiz o'rnatadi (Keystore'ga tegmasdan).
  @visibleForTesting
  void debugSetTokenForTest(String? v) => _token = v;

  @visibleForTesting
  void debugHandleStatus(int status, String path) =>
      _httpError(status, const <String, dynamic>{}, path);

  /// KIRISH YO'LLARI — u yerdagi 401 "sessiya tugadi" EMAS.
  ///
  /// `/api/auth/login` noto'g'ri parolda ham 401 qaytaradi. Buni
  /// sessiya tugashi deb qabul qilsak, parolni bir marta xato
  /// yozgan odam saqlangan sessiyasidan ham ayrilardi.
  static bool _isAuthEntry(String path) =>
      path.contains('/auth/login') ||
      path.contains('/auth/register') ||
      path.contains('/auth/verify') ||
      path.contains('/auth/request');

  /// SESSIYA TUGADI.
  ///
  /// ## NIMA UCHUN KERAK BO'LDI
  ///
  /// `sessionExpired` hisoblagichi BOR edi va 401 da o'sardi, lekin
  /// uni HECH KIM TINGLAMASDI — butun `lib/` da yagona boshqa
  /// chaqiruv `dispose()` edi. Izohda "router kirish ekraniga
  /// oladi" deyilgan, router esa unga obuna bo'lmagan.
  ///
  /// Natijasi: token eskirsa yoki bekor qilinsa, ilova o'sha o'lik
  /// token bilan ishlayverardi — har so'rov 401 olardi, ekran esa
  /// bo'sh yoki xato holatida turardi va foydalanuvchi kirish
  /// ekraniga QAYTA OLMASDI.
  ///
  /// Endi: token tozalanadi (keyingi so'rov o'lik token bilan
  /// ketmasin) va signal beriladi.
  ///
  /// TAKRORLANMAYDI: token allaqachon `null` bo'lsa, signal ham
  /// bermaymiz. Aks holda parallel ketayotgan o'nta so'rovning
  /// har biri 401 olib, o'nta signal chiqarardi.
  void _onUnauthorized(String path) {
    if (_isAuthEntry(path)) return;
    if (_token == null) return;
    // Natijasi kutilmaydi: xato javobni qaytarish kechikmasligi
    // kerak. Xatosi ham yutiladi — token o'chmasa ham signal
    // beriladi va sessiya baribir yopiladi.
    unawaited(setToken(null).catchError((_) {}));
    sessionExpired.value++;
  }

  AppError _dioError(DioException e) {
    final offline = e.error is SocketException ||
        e.error is HandshakeException ||
        e.type == DioExceptionType.connectionError;
    if (offline) return AppError(AppErrorKind.offline, detail: '${e.message}');
    final timeout = e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout;
    if (timeout) return const AppError(AppErrorKind.timeout);
    return AppError(AppErrorKind.unknown, detail: '${e.message}');
  }
}
