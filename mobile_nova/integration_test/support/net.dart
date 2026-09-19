import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';

import 'creds.dart';
import 'report.dart';

/// Har bir so'rovni yozib boruvchi Dio interceptori.
///
/// Repozitoriy metodlari `Result` qaytaradi va xato ichida faqat
/// `AppErrorKind` bilan status bo'ladi — qaysi manzilga, qanday tana
/// bilan borilgani ko'rinmaydi. Hisobotda esa aynan shu kerak:
/// endpoint, metod, payload, status, javob. Shuning uchun oxirgi
/// so'rov shu yerda saqlanadi.
///
/// Maxfiy qiymatlar [redact] orqali o'tadi — parol logga TUSHMAYDI.
class RequestLog extends Interceptor {
  Trace? last;
  final List<Trace> all = [];

  static const _maxBody = 400;

  String _short(dynamic data) {
    if (data == null) return '';
    String s;
    if (data is FormData) {
      s = '(multipart: ${data.files.map((f) => f.key).join(',')})';
    } else if (data is String) {
      s = data;
    } else {
      try {
        s = jsonEncode(data);
      } catch (_) {
        s = '$data';
      }
    }
    s = redact(s);
    return s.length <= _maxBody ? s : '${s.substring(0, _maxBody)}…';
  }

  void _record(Trace t) {
    last = t;
    all.add(t);
  }

  @override
  void onResponse(Response<dynamic> res, ResponseInterceptorHandler h) {
    _record(Trace(
      method: res.requestOptions.method,
      path: res.requestOptions.path,
      status: res.statusCode,
      request: _short(res.requestOptions.data),
      response: _short(res.data),
    ));
    h.next(res);
  }

  @override
  void onError(DioException e, ErrorInterceptorHandler h) {
    _record(Trace(
      method: e.requestOptions.method,
      path: e.requestOptions.path,
      status: e.response?.statusCode,
      request: _short(e.requestOptions.data),
      response: e.response?.data == null
          ? '${e.type.name}: ${redact(e.message)}'
          : _short(e.response!.data),
    ));
    h.next(e);
  }

  /// Berilgan yo'l bo'yicha oxirgi iz — qaysi chaqiruv yiqilganini
  /// aniq ko'rsatish uchun.
  Trace? lastFor(String pathFragment) {
    for (var i = all.length - 1; i >= 0; i--) {
      if (all[i].path.contains(pathFragment)) return all[i];
    }
    return null;
  }
}

/// E2E uchun tayyor mijoz.
///
/// `baseUrl` ataylab `kApiBase` dan olinadi: sinov ilovaning O'ZI
/// ishlatadigan manzilga boradi, alohida "test serveri" ga emas.
({ApiClient api, RequestLog log}) buildClient() {
  final log = RequestLog();
  final dio = Dio()..interceptors.add(log);
  return (api: ApiClient(dio: dio), log: log);
}

/// Sinov davomida yaratilgan obyektlar ro'yxati.
///
/// Har bir yaratilgan narsa DARHOL shu yerga qo'shiladi — test
/// o'rtasida yiqilsa ham tozalash bosqichi uni topadi. Aks holda
/// haqiqiy hisobda "NOVA E2E" axlati qolib ketardi.
class Litter {
  final List<({String what, Future<void> Function() remove})> _items = [];

  void track(String what, Future<void> Function() remove) =>
      _items.add((what: what, remove: remove));

  /// `Result` QAYTARADIGAN tozalash uchun.
  ///
  /// ## NIMA UCHUN ALOHIDA METOD
  ///
  /// Repozitoriya metodlari ISTISNO OTMAYDI — ular `Result`
  /// qaytaradi (`result.dart` dagi qoida). `sweep()` esa faqat
  /// istisnoni ko'radi:
  ///
  ///     try { await item.remove(); } catch (e) { ... }
  ///
  /// Ya'ni `Err` qaytgan o'chirish JIMGINA muvaffaqiyat bo'lib
  /// hisoblanardi va hisobotda "hammasi o'chirildi" deb turardi.
  /// Aslida obyekt joyida qolardi.
  ///
  /// Istoryalar aynan shu sababdan yig'ilib qolgan: har ishga
  /// tushirishda bittadan qo'shilib, chegaraga (10 ta) yetgan va
  /// E2E #14 da `limit_reached` bergan — hisobot esa har safar
  /// "tozalandi" deb yozardi.
  void trackResult(String what, Future<Result<void>> Function() remove) =>
      _items.add((
        what: what,
        remove: () async {
          final res = await remove();
          if (res case Err(:final error)) {
            throw StateError('o\'chmadi: ${error.kind.name} '
                '(${error.status}) ${error.code ?? ""}');
          }
        },
      ));

  /// Teskari tartibda tozalaydi (izoh postdan oldin o'chadi).
  Future<void> sweep() async {
    for (final item in _items.reversed) {
      try {
        await item.remove();
      } catch (e) {
        E2EReport.instance.cleanupProblem('${item.what} — $e');
      }
    }
    _items.clear();
  }
}
