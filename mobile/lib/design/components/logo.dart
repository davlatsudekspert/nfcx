import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../tokens.dart';

/// BREND MEDALYONI — logotip har doim DUMALOQ.
///
/// Dizayn qarori: logotip faqat to'liq to'ldirilgan doira ichida,
/// atrofida oltin halqa bilan ko'rsatiladi. O'lchamlari:
/// top bar 42, kartada 44, NFC tabi 64, splash va NFC markazi 104.
///
/// NIMA UCHUN DOIRA: hozirgi logotip fayli QORA FONLI JPG/PNG
/// (shaffof emas). To'rtburchak holda u har qanday fonda qora
/// kvadrat bo'lib turadi. Doira ichida esa qora fon medalyonning
/// o'z yuzasiga aylanadi va tabiiy ko'rinadi.
///
/// TEXNIK ESLATMA: manba 1024×1024. `cacheWidth` siz u to'liq
/// hajmda dekodlanadi (~4 MB xotira). Shuning uchun har doim
/// ko'rsatilayotgan o'lchamga qarab kesiladi.
class BrandMark extends StatelessWidget {
  const BrandMark({
    super.key,
    this.size = 44,
    this.ring = true,
    this.glow = false,
  });

  final double size;

  /// Atrofidagi oltin halqa.
  final bool ring;

  /// Ortidagi issiq nur — splash va NFC markazida.
  final bool glow;

  @override
  Widget build(BuildContext context) {
    final dpr = MediaQuery.maybeDevicePixelRatioOf(context) ?? 3;
    // 1024 dan katta so'ralmaydi; kichik medalyonlarda esa
    // kerakligicha.
    final cache = math.min(1024, (size * dpr * 1.4).round());

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: glow
            ? [
                BoxShadow(
                  color: C.accent.withValues(alpha: .42),
                  blurRadius: size * .55,
                  spreadRadius: -size * .12,
                ),
              ]
            : null,
      ),
      // MEDALYON — SAYTDAGI BILAN AYNAN BIR XIL FAYL.
      //
      // Ilgari ilova doirani, gardishni va fonni O'ZI chizardi,
      // ustiga esa logotipning kvadrat rasmini qo'yardi: to'lqin
      // uchlari gardishga tegib turardi va rang saytdagidan bir oz
      // farq qilardi.
      //
      // Endi `logo_medallion.png` — saytning `public/logo-512.png`
      // faylining o'zi: oltin gardish, quyuq yuza va belgi atrofidagi
      // nafas allaqachon rasmda. Demak ilovada ham, saytda ham,
      // ikonkada ham BITTA ko'rinish.
      //
      // `ring` endi bezak chizmaydi (gardish rasmda), lekin parametr
      // saqlandi: chaqiruv joylari o'zgarmasin.
      child: Image.asset(
        'assets/img/logo_medallion.png',
        width: size,
        height: size,
        cacheWidth: cache,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.medium,
      ),
    );
  }
}

/// BELGINING O'ZI — DOIRASIZ, FONSIZ.
///
/// Medalyon quyuq yuzaga ega va uni suv belgisi (watermark) yoki
/// yorug' fon ustida ishlatib bo'lmaydi: shaffoflik berilsa qora
/// disk ko'rinib qoladi. Bu yerda esa faqat oltin belgi — foni
/// butunlay shaffof.
class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 44, this.opacity = 1});

  final double size;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    final dpr = MediaQuery.maybeDevicePixelRatioOf(context) ?? 3;
    final cache = math.min(1024, (size * dpr).round());
    return Opacity(
      opacity: opacity,
      child: Image.asset(
        'assets/img/logo_mark.png',
        width: size,
        height: size,
        cacheWidth: cache,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.medium,
      ),
    );
  }
}

/// WORDMARK — "N F C S T O R E".
class Wordmark extends StatelessWidget {
  const Wordmark({super.key, this.size = 11, this.color});

  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) => Text(
        'NFCSTORE',
        style: TextStyle(
          fontFamily: 'SpaceMono',
          fontFamilyFallback: const ['PlexMonoCyr'],
          fontWeight: FontWeight.w600,
          fontSize: size,
          height: 1.2,
          letterSpacing: size * .31,
          color: color ?? C.accent.withValues(alpha: .85),
        ),
      );
}

/// BREND YORLIG'I — punktir chegarali "[LOGO]" (prototip: `.logo`).
///
/// Punktir ATAYLAB: bu yorliq bosiladigan tugma emas, u BRENDNI
/// bildiradi. To'liq chiziq uni tugmaga o'xshatib qo'yardi va
/// yonidagi haqiqiy tugmalar bilan chalkashardi.
class BrandTag extends StatelessWidget {
  const BrandTag({super.key, this.color});

  final Color? color;

  @override
  Widget build(BuildContext context) => CustomPaint(
        painter: _DashedTag(color ?? C.lineStrong),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
          child: Wordmark(size: 11, color: color ?? C.ink2),
        ),
      );
}

class _DashedTag extends CustomPainter {
  _DashedTag(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = color;
    final path = Path()
      ..addRRect(RRect.fromRectAndRadius(
        Offset.zero & size,
        const Radius.circular(10),
      ));
    for (final m in path.computeMetrics()) {
      var start = 0.0;
      while (start < m.length) {
        final end = start + 5 < m.length ? start + 5 : m.length;
        canvas.drawPath(m.extractPath(start, end), paint);
        start = end + 4;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedTag old) => old.color != color;
}
