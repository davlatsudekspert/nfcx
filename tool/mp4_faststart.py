#!/usr/bin/env python3
"""MP4 FASTSTART — `moov` ni fayl boshiga ko'chirish (qayta siqmasdan).

Ilovadagi `mobile_nova/lib/core/media/mp4_faststart.dart` bilan AYNAN
bir xil algoritm: yuqori darajadagi qutilar o'qiladi, `moov` `mdat`
dan keyin bo'lsa `ftyp` ortiga qo'yiladi va `stco`/`co64` manzillari
`moov` hajmicha suriladi. Video/ovoz baytlari faqat nusxalanadi.

    python3 tool/mp4_faststart.py kirish.mp4 chiqish.mp4
    chiqish kodi: 0 — yozildi, 3 — allaqachon boshda, 2 — tushunilmagan fayl
"""
import struct
import sys

CONTAINERS = {b'moov', b'trak', b'mdia', b'minf', b'stbl', b'edts', b'mvex'}


def top_boxes(f, length):
    out, pos = [], 0
    while pos + 8 <= length:
        f.seek(pos)
        h = f.read(16)
        size, typ = struct.unpack('>I4s', h[:8])
        header = 8
        if size == 1:
            size = struct.unpack('>Q', h[8:16])[0]
            header = 16
        elif size == 0:
            size = length - pos
        if size < header or pos + size > length:
            return None
        out.append((typ, pos, size, header))
        pos += size
    return out if pos == length else None


def shift(buf, start, end, lo, hi, delta):
    pos = start
    while pos + 8 <= end:
        size, typ = struct.unpack('>I4s', buf[pos:pos + 8])
        header = 8
        if size == 1:
            size = struct.unpack('>Q', buf[pos + 8:pos + 16])[0]
            header = 16
        elif size == 0:
            size = end - pos
        if size < header or pos + size > end:
            return False
        if typ == b'cmov':
            return False
        if typ in CONTAINERS:
            if not shift(buf, pos + header, pos + size, lo, hi, delta):
                return False
        elif typ in (b'stco', b'co64'):
            wide = typ == b'co64'
            body = pos + header
            n = struct.unpack('>I', buf[body + 4:body + 8])[0]
            step = 8 if wide else 4
            if body + 8 + n * step > pos + size:
                return False
            fmt = '>Q' if wide else '>I'
            for i in range(n):
                at = body + 8 + i * step
                o = struct.unpack(fmt, buf[at:at + step])[0]
                if o < lo or o >= hi:
                    continue
                v = o + delta
                if not wide and v > 0xFFFFFFFF:
                    return False
                buf[at:at + step] = struct.pack(fmt, v)
        pos += size
    return True


def main(src, dst):
    with open(src, 'rb') as f:
        f.seek(0, 2)
        length = f.tell()
        boxes = top_boxes(f, length)
        if boxes is None:
            return 2
        types = [b[0] for b in boxes]
        if b'moov' not in types or b'mdat' not in types or b'moof' in types:
            return 2
        mi, di = types.index(b'moov'), types.index(b'mdat')
        if mi < di:
            return 3
        _, mstart, msize, mheader = boxes[mi]
        f.seek(mstart)
        moov = bytearray(f.read(msize))
        insert = boxes[types.index(b'ftyp')][1] + boxes[types.index(b'ftyp')][2] if b'ftyp' in types else 0
        if not shift(moov, mheader, msize, insert, mstart, msize):
            return 2
        with open(dst, 'wb') as o:
            def copy(a, b):
                f.seek(a)
                while a < b:
                    chunk = f.read(min(1 << 20, b - a))
                    if not chunk:
                        raise IOError('qisqa fayl')
                    o.write(chunk)
                    a += len(chunk)
            copy(0, insert)
            o.write(moov)
            copy(insert, mstart)
            copy(mstart + msize, length)
    with open(dst, 'rb') as o:
        o.seek(0, 2)
        if o.tell() != length:
            return 2
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1], sys.argv[2]))
