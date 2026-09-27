import 'dart:io';
import 'dart:typed_data';

/// MP4 "FASTSTART" — `moov` ni fayl BOSHIGA ko'chirish (qayta
/// siqmasdan).
///
/// Egasi (2026-09-27): "reels keyingisiga o'tishda qora ekran, o'rtada
/// dumaloq, 1-2 soniya". O'lchov: Android kamerasi yozgan videoda
/// `moov` (qaysi kadr qayerda — pleyerga kerak "mundarija") fayl
/// OXIRIDA turadi (`ftyp · mdat · moov`). Pleyer boshlashdan oldin
/// faylning oxirini ham so'rashi kerak — 20 MB li reelda bu qo'shimcha
/// so'rov va kutish. `moov` boshda bo'lsa (`ftyp · moov · mdat`) ijro
/// birinchi baytlar bilanoq boshlanadi.
///
/// Qanday: yuqori darajadagi qutilar (box) o'qiladi; `moov` `mdat` dan
/// keyin bo'lsa, u `ftyp` ning ortiga qo'yiladi va ichidagi har bir
/// bo'lak manzili (`stco` / `co64`) `moov` hajmicha suriladi. Video va
/// ovoz baytlari o'zgarmaydi — faqat nusxalanadi.
///
/// Xavfsiz: tushunilmagan tuzilma (fragmentli MP4, siqilgan `moov`,
/// 4 GB dan oshadigan manzil) — `null`, ya'ni asl fayl yuboriladi.
Future<String?> mp4Faststart(String path, {required String outPath}) async {
  final src = File(path);
  final int len;
  final RandomAccessFile raf;
  try {
    len = await src.length();
    raf = await src.open();
  } on FileSystemException {
    return null;
  }
  try {
    final boxes = await _topBoxes(raf, len);
    if (boxes == null) return null;
    final moovI = boxes.indexWhere((b) => b.type == 'moov');
    final mdatI = boxes.indexWhere((b) => b.type == 'mdat');
    if (moovI < 0 || mdatI < 0) return null;
    // Allaqachon boshda — hech narsa qilinmaydi.
    if (moovI < mdatI) return null;
    if (boxes.any((b) => b.type == 'moof')) return null;
    final ftypI = boxes.indexWhere((b) => b.type == 'ftyp');
    final moov = boxes[moovI];
    if (moov.size > 64 * 1024 * 1024) return null;

    await raf.setPosition(moov.start);
    final moovBytes = Uint8List.fromList(await raf.read(moov.size));
    if (moovBytes.length != moov.size) return null;

    // `moov` shu nuqtaga qo'yiladi; undan keyin kelgan (lekin eski
    // `moov` dan oldin turgan) baytlar `moov` hajmicha suriladi.
    final insertAt = ftypI >= 0 ? boxes[ftypI].end : 0;
    if (!_shiftOffsets(moovBytes, moov.header, moovBytes.length,
        from: insertAt, until: moov.start, delta: moov.size)) {
      return null;
    }

    final out = await File(outPath).open(mode: FileMode.write);
    try {
      Future<void> copy(int start, int end) async {
        var pos = start;
        while (pos < end) {
          final n = (end - pos) < _chunk ? end - pos : _chunk;
          await raf.setPosition(pos);
          final data = await raf.read(n);
          if (data.isEmpty) throw const FileSystemException('qisqa fayl');
          await out.writeFrom(data);
          pos += data.length;
        }
      }

      await copy(0, insertAt);
      await out.writeFrom(moovBytes);
      await copy(insertAt, moov.start);
      await copy(moov.end, len);
    } finally {
      await out.close();
    }
    if (await File(outPath).length() != len) return null;
    return outPath;
  } catch (_) {
    return null;
  } finally {
    await raf.close();
  }
}

const _chunk = 1 << 20;

class _Box {
  _Box(this.type, this.start, this.size, this.header);
  final String type;
  final int start;
  final int size;
  final int header;
  int get end => start + size;
}

Future<List<_Box>?> _topBoxes(RandomAccessFile raf, int len) async {
  final out = <_Box>[];
  var pos = 0;
  while (pos + 8 <= len) {
    await raf.setPosition(pos);
    final h = Uint8List.fromList(await raf.read(16));
    if (h.length < 8) return null;
    final bd = ByteData.sublistView(h);
    var size = bd.getUint32(0);
    final type = String.fromCharCodes(h.sublist(4, 8));
    var header = 8;
    if (size == 1) {
      if (h.length < 16) return null;
      size = bd.getUint64(8);
      header = 16;
    } else if (size == 0) {
      size = len - pos;
    }
    if (size < header || pos + size > len) return null;
    out.add(_Box(type, pos, size, header));
    pos += size;
  }
  return pos == len ? out : null;
}

const _containers = {'moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'mvex'};

/// [buf] ichidagi `[start, end)` oralig'idagi qutilarni aylanib chiqib,
/// `stco` / `co64` manzillarini suradi. Muvaffaqiyatsiz bo'lsa `false`.
bool _shiftOffsets(Uint8List buf, int start, int end,
    {required int from, required int until, required int delta}) {
  final bd = ByteData.sublistView(buf);
  var pos = start;
  while (pos + 8 <= end) {
    var size = bd.getUint32(pos);
    final type = String.fromCharCodes(buf.sublist(pos + 4, pos + 8));
    var header = 8;
    if (size == 1) {
      if (pos + 16 > end) return false;
      size = bd.getUint64(pos + 8);
      header = 16;
    } else if (size == 0) {
      size = end - pos;
    }
    if (size < header || pos + size > end) return false;
    // Siqilgan `moov` — ichini o'qib bo'lmaydi.
    if (type == 'cmov') return false;
    if (_containers.contains(type)) {
      if (!_shiftOffsets(buf, pos + header, pos + size,
          from: from, until: until, delta: delta)) {
        return false;
      }
    } else if (type == 'stco' || type == 'co64') {
      final wide = type == 'co64';
      final body = pos + header;
      if (body + 8 > pos + size) return false;
      final n = bd.getUint32(body + 4);
      final step = wide ? 8 : 4;
      if (body + 8 + n * step > pos + size) return false;
      for (var i = 0; i < n; i++) {
        final at = body + 8 + i * step;
        final o = wide ? bd.getUint64(at) : bd.getUint32(at);
        if (o < from || o >= until) continue;
        final v = o + delta;
        if (wide) {
          bd.setUint64(at, v);
        } else {
          if (v > 0xFFFFFFFF) return false;
          bd.setUint32(at, v);
        }
      }
    }
    pos += size;
  }
  return true;
}
