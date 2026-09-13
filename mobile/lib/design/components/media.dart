import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/widgets.dart';
import '../tokens.dart';
import '../type.dart';

/// Diagonal chiziqli rasm o'rni.
///
/// Dizayn prototipida hamma rasm shunday ko'rsatilgan va bu ATAYLAB:
/// rasm hali kelmaganida bo'sh kulrang to'rtburchak "buzilgan" ko'rinadi,
/// chiziqli yuza esa "bu yerda rasm bo'ladi" deb turadi.
class MediaSlot extends StatelessWidget {
  const MediaSlot({super.key, this.label, this.radius = R.card});

  final String? label;
  final double radius;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: CustomPaint(
          painter: _StripePainter(),
          child: Center(
            child: label == null
                ? null
                : Padding(
                    padding: const EdgeInsets.all(S.x8),
                    child: Text(
                      label!.toUpperCase(),
                      textAlign: TextAlign.center,
                      style: T.eyebrow.copyWith(color: C.placeholderInk),
                    ),
                  ),
          ),
        ),
      );
}

class _StripePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = C.placeholder);
    final p = Paint()
      ..color = C.placeholderAlt
      ..strokeWidth = 7;
    // 45° chiziqlar. Qadam 14 — chiziq va oraliq teng ko'rinadi.
    for (var x = -size.height; x < size.width; x += 14) {
      canvas.drawLine(Offset(x, size.height), Offset(x + size.height, 0), p);
    }
  }

  @override
  bool shouldRepaint(_StripePainter old) => false;
}

/// Keshlanadigan rasm.
///
/// UCHTA TALAB bir joyda bajariladi:
///   1) disk + xotira keshi (takroriy tarmoq so'rovi bo'lmasin);
///   2) skeletondan 240ms yumshoq o'tish — "pop" ham, "scale" ham yo'q;
///   3) xato bo'lsa rasm o'rni ko'rinadi, qizil belgi emas.
///
/// `memCacheWidth` — MUHIM: 1000px rasmni 80px avatarga qo'yish xotirani
/// behuda yeydi va ro'yxat aylanishini sekinlashtiradi.
class NetImage extends StatelessWidget {
  const NetImage(
    this.url, {
    super.key,
    this.radius = R.card,
    this.fit = BoxFit.cover,
    this.slotLabel,
    this.cacheWidth,
  });

  final String? url;
  final double radius;
  final BoxFit fit;
  final String? slotLabel;
  final int? cacheWidth;

  @override
  Widget build(BuildContext context) {
    final u = (url ?? '').trim();
    if (u.isEmpty) return MediaSlot(label: slotLabel, radius: radius);
    final dpr = MediaQuery.maybeDevicePixelRatioOf(context) ?? 2.0;
    // XOTIRA CHEGARASI — HAR DOIM.
    //
    // Foydalanuvchi yuklagan rasm 3000px bo'lishi mumkin. Uni xom
    // holda dekodlash ~36 MB xotira oladi va ro'yxat aylanganda
    // kadrlar tushib ketadi. `cacheWidth` berilmagan joylarda ham
    // ekran enidan kattaroq dekodlash MA'NOSIZ, shuning uchun
    // chegara qo'yiladi: rasm ekranga sig'adigan o'lchamda
    // dekodlanadi.
    final logicalCap = cacheWidth ?? MediaQuery.sizeOf(context).width.round();
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: CachedNetworkImage(
        imageUrl: u,
        fit: fit,
        fadeInDuration: M.image,
        fadeOutDuration: Duration.zero,
        memCacheWidth: (logicalCap * dpr).round(),
        placeholder: (_, __) => ColoredBox(color: C.placeholder),
        errorWidget: (_, __, ___) => MediaSlot(label: slotLabel, radius: 0),
      ),
    );
  }
}

/// Avatar — doira, chegarali. Bo'sh bo'lsa ism bosh harfi.
class Avatar extends StatelessWidget {
  const Avatar({super.key, this.url, this.name = '', this.size = 44});

  final String? url;
  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final u = (url ?? '').trim();
    final letter = name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: C.graphite,
        border: Border.all(color: C.hairline),
      ),
      clipBehavior: Clip.antiAlias,
      child: u.isEmpty
          ? Center(
              child: Text(
                letter,
                style: T.cardTitle.copyWith(fontSize: size * .38, color: C.antiqueGold),
              ),
            )
          : NetImage(u, radius: size, cacheWidth: size.round()),
    );
  }
}
