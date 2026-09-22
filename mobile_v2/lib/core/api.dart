import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  const ApiException(this.key, {this.status = 0, this.detail = ''});
  final String key;
  final int status;
  final String detail;

  bool get unauthorized => status == 401 || key == 'unauthorized';

  @override
  String toString() => [key, if (status > 0) 'HTTP $status', if (detail.isNotEmpty) detail].join(' · ');
}

class AuthResponse {
  const AuthResponse(this.body, this.headers);
  final Map<String, dynamic> body;
  final Map<String, String> headers;

  String get token {
    final direct = (body['token'] ?? '').toString().trim();
    if (direct.isNotEmpty) return direct;
    final raw = headers['set-cookie'] ?? '';
    final match = RegExp(r'(?:^|[,;]\s*)[^=;]*session[^=;]*=([^;,]+)', caseSensitive: false).firstMatch(raw);
    return match?.group(1)?.trim() ?? '';
  }
}

class ApiClient {
  ApiClient({http.Client? client}) : _http = client ?? http.Client();

  static const baseUrl = 'https://nfcstore.uz';
  static const _timeout = Duration(seconds: 20);
  final http.Client _http;
  String? token;

  Map<String, String> _headers({bool json = false}) => {
        'accept': 'application/json',
        'x-client': 'android',
        if (json) 'content-type': 'application/json',
        if ((token ?? '').isNotEmpty) 'authorization': 'Bearer $token',
      };

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final q = <String, String>{};
    query?.forEach((key, value) {
      if (value != null) q[key] = '$value';
    });
    return Uri.parse('$baseUrl$path').replace(queryParameters: q.isEmpty ? null : q);
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _send(() => _http.get(_uri(path, query), headers: _headers()));

  Future<dynamic> post(String path, [Object? body]) => _send(
        () => _http.post(_uri(path), headers: _headers(json: true), body: jsonEncode(body ?? const {})),
      );

  Future<AuthResponse> postAuth(String path, Object? body) async {
    final res = await _raw(
      () => _http.post(_uri(path), headers: _headers(json: true), body: jsonEncode(body ?? const {})),
    );
    return AuthResponse(
      res.body is Map ? (res.body as Map).cast<String, dynamic>() : const {},
      res.headers,
    );
  }

  Future<dynamic> delete(String path) =>
      _send(() => _http.delete(_uri(path), headers: _headers()));

  Future<dynamic> upload(
    String path,
    List<int> bytes, {
    String contentType = 'image/jpeg',
  }) =>
      _send(() async {
        final request = http.Request('POST', _uri(path))
          ..headers.addAll({
            'accept': 'application/json',
            'x-client': 'android-v2-preview',
            'content-type': contentType,
            if ((token ?? '').isNotEmpty) 'authorization': 'Bearer ' + token!,
          })
          ..bodyBytes = bytes;
        return http.Response.fromStream(await _http.send(request));
      });

  Future<dynamic> _send(Future<http.Response> Function() run) async => (await _raw(run)).body;

  Future<({dynamic body, Map<String, String> headers})> _raw(
    Future<http.Response> Function() run,
  ) async {
    http.Response response;
    try {
      response = await run().timeout(_timeout);
    } on TimeoutException {
      throw const ApiException('timeout');
    } on SocketException catch (e) {
      throw ApiException('offline', detail: e.message);
    } on HandshakeException catch (e) {
      throw ApiException('tls', detail: e.message);
    } on http.ClientException catch (e) {
      throw ApiException('offline', detail: e.message);
    }

    dynamic decoded;
    if (response.bodyBytes.isNotEmpty) {
      try {
        decoded = jsonDecode(utf8.decode(response.bodyBytes));
      } catch (_) {
        decoded = null;
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final map = decoded is Map ? decoded : const {};
      throw ApiException(
        map['error'] is String ? map['error'] as String : 'http_' + response.statusCode.toString(),
        status: response.statusCode,
        detail: map['detail'] is String ? map['detail'] as String : '',
      );
    }

    return (body: decoded, headers: response.headers);
  }

  void close() => _http.close();
}