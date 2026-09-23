// REELS VIDEO O'LCHOVI — "katta video sekin ochiladi" (egasi, 2026-09).
//
// Taxmin bilan tuzatmaslik uchun HAQIQIY lentadagi videolarda o'lchaydi:
//
//   * server: hajm, content-type, Accept-Ranges, Range -> 206, CDN kesh;
//   * MP4 tuzilishi: yuqori darajadagi atomlar tartibi — `moov` boshida
//     (faststart) yoki `mdat` dan keyin (oxirida);
//   * tarmoq: birinchi baytgacha vaqt, 2 MB o'tkazuvchanlik;
//   * pleyer: `initialize()` vaqti va BIRINCHI KADR (position > 0) vaqti.
//
// Login YO'Q: `/api/feed` ochiq. Shuning uchun kirish chegarasiga
// (15 daqiqada 5 urinish) tegmaydi va E2E bilan to'qnashmaydi.
//
//   flutter test integration_probe/reels_video_probe_test.dart -d <device>
import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:video_player/video_player.dart';

void out(Map<String, Object?> m) {
  // ignore: avoid_print
  print('[PROBE] ${jsonEncode(m)}');
}

/// Yuqori darajadagi MP4 atomlari (box) — [bytes] fayl boshidan.
List<({String type, int size, int offset})> atomsIn(Uint8List bytes) {
  final out = <({String type, int size, int offset})>[];
  var off = 0;
  while (off + 8 <= bytes.length && out.length < 12) {
    final bd = ByteData.sublistView(bytes, off);
    var size = bd.getUint32(0);
    final type = String.fromCharCodes(bytes.sublist(off + 4, off + 8));
    if (size == 1 && off + 16 <= bytes.length) {
      size = bd.getUint64(8);
    }
    out.add((type: type, size: size, offset: off));
    if (size < 8) break;
    off += size;
  }
  return out;
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Reels video — server, MP4 tuzilishi, birinchi kadr',
      (tester) async {
    final repo = SocialRepository(ApiClient());
    final urls = <String>{};
    for (var page = 1; page <= 4 && urls.length < 40; page++) {
      final r = await repo.feed(page: page);
      if (r case Ok(:final value)) {
        for (final p in value) {
          if (p.isVideo && p.mediaUrls.isNotEmpty) urls.add(p.mediaUrls.first);
        }
        if (value.isEmpty) break;
      }
    }
    out({'stage': 'feed', 'videos': urls.length});
    if (urls.isEmpty) return;

    final dio = Dio(BaseOptions(
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 60),
      validateStatus: (_) => true,
      responseType: ResponseType.bytes,
    ));

    // ── HEAD: hajm va sarlavhalar ────────────────────────────────
    final heads = <({String url, int size})>[];
    for (final u in urls) {
      final sw = Stopwatch()..start();
      final h = await dio.head<dynamic>(u);
      final size = int.tryParse(h.headers.value('content-length') ?? '') ?? -1;
      heads.add((url: u, size: size));
      out({
        'stage': 'head',
        'url': u.split('/').last,
        'status': h.statusCode,
        'ms': sw.elapsedMilliseconds,
        'mb': (size / 1048576).toStringAsFixed(2),
        'type': h.headers.value('content-type'),
        'acceptRanges': h.headers.value('accept-ranges'),
        'cache': h.headers.value('cf-cache-status'),
        'cacheControl': h.headers.value('cache-control'),
      });
    }
    heads.sort((a, b) => b.size.compareTo(a.size));
    // Eng kattalari (egasining shikoyati) + solishtirish uchun eng kichigi.
    final picked = [
      ...heads.take(4),
      if (heads.length > 4) heads.last,
    ];

    for (final v in picked) {
      final name = v.url.split('/').last;
      Future<T?> step<T>(String what, Future<T> Function() run,
          {Duration limit = const Duration(seconds: 45)}) async {
        final sw = Stopwatch()..start();
        try {
          final r = await run().timeout(limit);
          return r;
        } catch (e) {
          out({'stage': 'error', 'url': name, 'step': what,
            'ms': sw.elapsedMilliseconds, 'error': '$e'.split('\n').first});
          return null;
        }
      }

      // ── Range: birinchi 64 KB — TTFB va birinchi atomlar ─────────
      var sw = Stopwatch()..start();
      final r0 = await step('range0', () => dio.get<List<int>>(v.url,
          options: Options(headers: {'range': 'bytes=0-65535'})));
      final ttfb = sw.elapsedMilliseconds;
      final top = atomsIn(Uint8List.fromList(r0?.data ?? const []));
      out({'stage': 'range0', 'url': name, 'status': r0?.statusCode,
        'ms': ttfb, 'contentRange': r0?.headers.value('content-range'),
        'firstAtoms': top.map((a) => '${a.type}:${a.size}').join(',')});

      // ── Yuqori darajadagi atomlar butun fayl bo'ylab (16 bayt) ───
      final layout = <String>[];
      var off = 0;
      for (var i = 0; i < 10 && off < v.size; i++) {
        final rr = await step('atom@$off', () => dio.get<List<int>>(v.url,
            options: Options(headers: {'range': 'bytes=$off-${off + 15}'})),
            limit: const Duration(seconds: 20));
        final b = Uint8List.fromList(rr?.data ?? const []);
        if (b.length < 8) break;
        final bd = ByteData.sublistView(b);
        var size = bd.getUint32(0);
        final type = String.fromCharCodes(b.sublist(4, 8));
        if (size == 1 && b.length >= 16) size = bd.getUint64(8);
        if (size == 0) size = v.size - off;
        layout.add('$type@$off+$size');
        if (size < 8) break;
        off += size;
      }
      final moovIdx = layout.indexWhere((e) => e.startsWith('moov'));
      final mdatIdx = layout.indexWhere((e) => e.startsWith('mdat'));
      out({'stage': 'layout', 'url': name, 'layout': layout.join(' '),
        'moovAtEnd': moovIdx >= 0 && mdatIdx >= 0 && moovIdx > mdatIdx});

      // ── O'tkazuvchanlik: 2 MB ───────────────────────────────────
      final want = v.size > 0 && v.size < 2097152 ? v.size : 2097152;
      sw = Stopwatch()..start();
      final r2 = await step('dl2mb', () => dio.get<List<int>>(v.url,
          options: Options(headers: {'range': 'bytes=0-${want - 1}'})));
      final dlMs = sw.elapsedMilliseconds;
      final got = r2?.data?.length ?? 0;
      out({'stage': 'download', 'url': name, 'bytes': got, 'ms': dlMs,
        'mbps': dlMs > 0 ? (got * 8 / 1000 / dlMs).toStringAsFixed(1) : null});

      // ── Pleyer: initialize va birinchi kadr (listener) ──────────
      final c = VideoPlayerController.networkUrl(Uri.parse(v.url));
      sw = Stopwatch()..start();
      final inited = await step<bool>('initialize', () async {
        await c.initialize();
        return true;
      },
          limit: const Duration(seconds: 60));
      final initMs = sw.elapsedMilliseconds;
      int? firstFrameMs;
      if (c.value.isInitialized) {
        final first = Completer<int>();
        void onTick() {
          if (!first.isCompleted && c.value.position > Duration.zero) {
            first.complete(sw.elapsedMilliseconds);
          }
        }
        c.addListener(onTick);
        await step<bool>('play', () async {
          await c.play();
          return true;
        }, limit: const Duration(seconds: 10));
        firstFrameMs = await step('firstFrame', () => first.future,
            limit: const Duration(seconds: 60));
        c.removeListener(onTick);
      }
      final dur = c.value.duration;
      final size = c.value.size;
      await step<bool>('dispose', () async {
        await c.dispose();
        return true;
      },
          limit: const Duration(seconds: 10));
      out({
        'stage': 'video',
        'url': name,
        'mb': (v.size / 1048576).toStringAsFixed(2),
        'durationS': dur.inMilliseconds / 1000,
        'kbps': dur.inMilliseconds > 0
            ? (v.size * 8 / dur.inMilliseconds).round()
            : null,
        'resolution': '${size.width.round()}x${size.height.round()}',
        'initOk': inited != null || c.value.isInitialized,
        'initMs': initMs,
        'firstFrameMs': firstFrameMs,
      });
      // ignore: unused_local_variable
      final _ = tester;
    }
  }, timeout: const Timeout(Duration(minutes: 20)));
}
