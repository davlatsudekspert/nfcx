import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';

/// So'rov tanasini o'qib, necha bayt va qaysi sarlavha kelganini yozadi.
class _Capture implements HttpClientAdapter {
  int received = 0;
  int calls = 0;
  Object? length;
  bool streamed = false;

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? body,
      Future<void>? cancel) async {
    calls++;
    length = o.headers['content-length'];
    streamed = o.data is Stream;
    await for (final chunk in body!) {
      received += chunk.length;
    }
    return ResponseBody.fromString(
      jsonEncode({'url': '/uploads/cardvid_x.mp4'}),
      200,
      headers: {
        'content-type': ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// VIDEO YUKLASH — OQIM, XOTIRAGA BUTUN FAYL OLINMAYDI (audit P-H4).
void main() {
  late Directory dir;
  setUp(() => dir = Directory.systemTemp.createTempSync('nova_up'));
  tearDown(() => dir.deleteSync(recursive: true));

  test('fayl diskdan OQIM bilan yuboriladi, hajmi aniq', () async {
    final f = File('${dir.path}/a.mp4')
      ..writeAsBytesSync(List<int>.filled(300 * 1024, 7));
    final cap = _Capture();
    final dio = Dio()..httpClientAdapter = cap;
    final repo = ProfileRepository(ApiClient(dio: dio));
    final r = await repo.uploadVideo(f.path);
    expect(r, isA<Ok<String>>());
    expect(cap.streamed, isTrue, reason: 'readAsBytes emas — openRead');
    expect(cap.received, 300 * 1024);
    expect('${cap.length}', '${300 * 1024}');
  });

  test('100 MB dan katta — so‘rov YUBORILMAYDI, aniq xato', () async {
    // Siyrak fayl: diskda joy olmaydi, lekin uzunligi 101 MB.
    final f = File('${dir.path}/big.mp4');
    final raf = f.openSync(mode: FileMode.write)
      ..setPositionSync(kUploadMaxBytes + 1024 * 1024)
      ..writeByteSync(0);
    raf.closeSync();
    final cap = _Capture();
    final repo = ProfileRepository(ApiClient(dio: Dio()..httpClientAdapter = cap));
    final r = await repo.uploadVideo(f.path);
    expect(cap.calls, 0, reason: 'odam 100 MB yuklab bo‘lgach 413 olmasin');
    final e = (r as Err<String>).error;
    expect(e.code, 'too_large');
    expect(e.kind, AppErrorKind.validation);
  });
}
