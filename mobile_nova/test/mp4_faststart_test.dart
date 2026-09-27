import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/media/mp4_faststart.dart';

/// Reels'da video 1-2 soniya qora ekran bilan ochilardi (egasi,
/// 2026-09-27): Android videosida `moov` fayl oxirida. [mp4Faststart]
/// uni boshga ko'chiradi va bo'lak manzillarini suradi.
///
/// Haqiqiy 21 MB li reel (cardvid_e6a5…mp4) bilan qo'lda tekshirilgan:
/// 262 ms, ffmpeg framemd5 — 880 ta kadr aslidagi bilan bir xil.
Uint8List _box(String type, List<int> body, {bool large = false}) {
  final b = BytesBuilder();
  if (large) {
    b.add(_u32(1));
    b.add(type.codeUnits);
    b.add(_u64(16 + body.length));
  } else {
    b.add(_u32(8 + body.length));
    b.add(type.codeUnits);
  }
  b.add(body);
  return b.toBytes();
}

List<int> _u32(int v) => (ByteData(4)..setUint32(0, v)).buffer.asUint8List();
List<int> _u64(int v) => (ByteData(8)..setUint64(0, v)).buffer.asUint8List();

Uint8List _chunkTable(String type, List<int> offsets) => _box(type, [
      0, 0, 0, 0, // versiya + bayroqlar
      ..._u32(offsets.length),
      for (final o in offsets) ...(type == 'co64' ? _u64(o) : _u32(o)),
    ]);

/// ftyp · mdat · moov (Android kamerasi kabi). Ikki trek: biri `stco`,
/// biri `co64`. Bo'laklar — mdat ichidagi aniq baytlar.
({Uint8List file, List<int> chunks, List<int> payloads}) _moovAtEnd(
    {bool largeMdat = false}) {
  final ftyp = _box('ftyp', 'isom\x00\x00\x02\x00isomiso2mp41'.codeUnits);
  final payload = List<int>.generate(4000, (i) => (i * 7) % 251);
  final mdat = _box('mdat', payload, large: largeMdat);
  final dataStart = ftyp.length + (largeMdat ? 16 : 8);
  final offsets = [dataStart, dataStart + 1000, dataStart + 2500];
  Uint8List trak(Uint8List table) => _box('trak', [
        ..._box('mdia', [
          ..._box('minf', [..._box('stbl', table)])
        ])
      ]);
  final moov = _box('moov', [
    ..._box('mvhd', List.filled(100, 0)),
    ...trak(_chunkTable('stco', offsets.sublist(0, 2))),
    ...trak(_chunkTable('co64', offsets.sublist(2))),
  ]);
  final file = Uint8List.fromList([...ftyp, ...mdat, ...moov]);
  return (
    file: file,
    chunks: offsets,
    payloads: [for (final o in offsets) file[o]],
  );
}

List<(String, int)> _top(Uint8List b) {
  final bd = ByteData.sublistView(b);
  final out = <(String, int)>[];
  var p = 0;
  while (p + 8 <= b.length) {
    var s = bd.getUint32(p);
    if (s == 1) s = bd.getUint64(p + 8);
    out.add((String.fromCharCodes(b.sublist(p + 4, p + 8)), p));
    p += s;
  }
  return out;
}

/// Natijadagi hamma stco/co64 manzillari.
List<int> _offsets(Uint8List b) {
  final bd = ByteData.sublistView(b);
  final out = <int>[];
  for (var p = 0; p + 8 < b.length; p++) {
    final t = String.fromCharCodes(b.sublist(p + 4, p + 8));
    if (t != 'stco' && t != 'co64') continue;
    final n = bd.getUint32(p + 12);
    for (var i = 0; i < n; i++) {
      out.add(t == 'co64'
          ? bd.getUint64(p + 16 + i * 8)
          : bd.getUint32(p + 16 + i * 4));
    }
  }
  return out;
}

void main() {
  late Directory dir;
  setUp(() => dir = Directory.systemTemp.createTempSync('fs_test'));
  tearDown(() => dir.deleteSync(recursive: true));

  Future<Uint8List?> run(Uint8List input) async {
    final src = File('${dir.path}/in.mp4')..writeAsBytesSync(input);
    final out = '${dir.path}/out.mp4';
    final r = await mp4Faststart(src.path, outPath: out);
    return r == null ? null : File(r).readAsBytesSync();
  }

  for (final large in [false, true]) {
    test('moov boshga, manzillar surildi, baytlar o‘sha (katta mdat: $large)',
        () async {
      final src = _moovAtEnd(largeMdat: large);
      final out = await run(src.file);
      expect(out, isNotNull);
      expect(out!.length, src.file.length, reason: 'hajm o‘zgarmaydi');
      final top = _top(out).map((e) => e.$1).toList();
      expect(top, ['ftyp', 'moov', 'mdat']);
      final offs = _offsets(out);
      expect(offs.length, 3);
      // Har bir manzil hali ham O'SHA baytni ko'rsatadi.
      for (var i = 0; i < offs.length; i++) {
        expect(out[offs[i]], src.payloads[i], reason: 'bo‘lak $i');
        expect(offs[i], greaterThan(src.chunks[i]));
      }
    });
  }

  test('allaqachon boshda — tegilmaydi (null)', () async {
    final src = _moovAtEnd();
    final once = await run(src.file);
    expect(await run(once!), isNull);
  });

  test('fragmentli MP4 va buzuq fayl — asl fayl (null)', () async {
    final src = _moovAtEnd();
    final frag = Uint8List.fromList([...src.file, ..._box('moof', [1, 2, 3])]);
    expect(await run(frag), isNull);
    expect(await run(Uint8List.fromList(src.file.sublist(0, 50))), isNull);
    expect(await run(Uint8List.fromList(List.filled(64, 0))), isNull);
  });
}
