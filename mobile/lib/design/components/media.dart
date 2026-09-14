import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/widgets.dart';
import '../tokens.dart';
import '../type.dart';

/// Rasm o'rni — rasm hali kelmaganda ko'rinadigan yuza.
///
/// Ilgari bu yerda qiya sariq-qora yo'llar bor edi. Ular "bu yerda
/// rasm bo'ladi" deb turardi, lekin assotsiatsiyasi noto'g'ri: qurilish
/// ogohlantirish lentasi. Saytda ham xuddi shu naqsh bor edi va olib
/// tashlandi — mahsulot kartochkasi uchun eng yaroqsiz fon.
///
/// O'rniga tinch oltin nur: yuza baribir "bo'sh emas" deb turadi,
/// lekin diqqatni o'ziga tortmaydi.
class MediaSlot extends StatelessWidget {
  const MediaSlot({super.key, this.label, this.radius = R.card});

  final String? label;
  final double radius;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: CustomPaint(
          painter: _SlotPainter(
            C.placeholder,
            C.placeholderAlt,
            C.champagne.withValues(alpha: .10),
          ),
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

class _SlotPainter extends CustomPainter {
  _SlotPainter(this.base, this.deep, this.glow);

  /// Ranglar MAVZUGA bog'liq, shuning uchun ular tashqaridan
  /// beriladi: `shouldRepaint` ularni solishtirib, mavzu almashganda
  /// yuzani qayta chizadi. Painter ichida `C.…` o'qilsa, eski kadr
  /// keshda qolib ketardi.
  final Color base;
  final Color deep;
  final Color glow;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    // 1) Asos — yuqoridan pastga sal quyuqlashadigan yuza.
    canvas.drawRect(
      rect,
      Paint()
        ..shader = LinearGradient(
          begin: const Alignment(-0.7, -1),
          end: const Alignment(0.7, 1),
          colors: [base, deep],
        ).createShader(rect),
    );
    // 2) Yuqori-o'rtadan tushadigan yumshoq nur.
    canvas.drawRect(
      rect,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(0, -0.24),
          radius: .95,
          colors: [glow, const Color(0x00000000)],
          stops: const [0, .72],
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(_SlotPainter old) =>
      old.base != base || old.deep != deep || old.glow != glow;
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
