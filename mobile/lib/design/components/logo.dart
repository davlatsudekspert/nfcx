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
        color: const Color(0xFF0D0B08),
        border: ring
            ? Border.all(color: C.accent.withValues(alpha: .55), width: 1.2)
            : null,
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
      child: ClipOval(
        child: OverflowBox(
          maxWidth: size * 1.34,
          maxHeight: size * 1.34,
          child: Image.asset(
            'assets/img/logo.png',
            width: size * 1.34,
            height: size * 1.34,
            cacheWidth: cache,
            fit: BoxFit.cover,
            filterQuality: FilterQuality.medium,
          ),
        ),
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
          fontFamily: 'IBMPlexMono',
          fontWeight: FontWeight.w600,
          fontSize: size,
          height: 1.2,
          letterSpacing: size * .31,
          color: color ?? C.accent.withValues(alpha: .85),
        ),
      );
}
