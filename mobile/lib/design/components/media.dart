import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/widgets.dart';

import '../tokens.dart';
import '../type.dart';
import 'icons.dart';
import 'skeleton.dart';

/// MEDIA — rasm har doim yumshoq paydo bo'ladi.
///
/// TEZLIK QOIDASI (dizayn 11c): kesh → skeleton → 240 ms xiralik.
/// Hech qayerda bo'sh oq ekran yoki joy sakrashi yo'q. Shu sababli:
///
/// • rasm kelmaguncha o'sha o'lchamdagi skeleton turadi;
/// • rasm kelganda 240 ms ichida ochiladi, darhol "otilib" chiqmaydi;
/// • `cacheWidth` HAR DOIM beriladi — aks holda 4000 px li rasm
///   to'liq dekodlanib, xotirani yeydi va lenta sakraydi.
class NetImage extends StatelessWidget {
  const NetImage(
    this.url, {
    super.key,
    this.radius = R.card,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.cacheWidth,
    this.slotIcon,
  });

  final String? url;
  final double radius;
  final BoxFit fit;
  final double? width;
  final double? height;

  /// Dekodlash kengligi (piksel). Berilmasa widget kengligidan
  /// hisoblanadi.
  final int? cacheWidth;

  /// Rasm yo'q bo'lganda ko'rinadigan belgi.
  final Ico? slotIcon;

  @override
  Widget build(BuildContext context) {
    final u = url?.trim() ?? '';
    if (u.isEmpty) {
      return MediaSlot(radius: radius, icon: slotIcon, width: width, height: height);
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: LayoutBuilder(
        builder: (context, box) {
          final dpr = MediaQuery.maybeDevicePixelRatioOf(context) ?? 3;
          final logical = box.hasBoundedWidth ? box.maxWidth : (width ?? 400);
          final decode = cacheWidth ?? (logical * dpr).round().clamp(64, 2048);

          return CachedNetworkImage(
            imageUrl: u,
            width: width ?? double.infinity,
            height: height,
            fit: fit,
            memCacheWidth: decode,
            fadeInDuration: M.image,
            fadeOutDuration: M.fade,
            placeholder: (context, _) => Skeleton(
              width: double.infinity,
              height: height ?? double.infinity,
              radius: radius,
            ),
            errorWidget: (context, _, __) => MediaSlot(
              radius: radius,
              icon: slotIcon ?? Ico.image,
              width: width,
              height: height,
            ),
          );
        },
      ),
    );
  }
}

/// Rasm o'rni — media yo'q yoki kelmadi.
///
/// Bo'sh kulrang to'rtburchak emas: yuzada nozik gradient va
/// markazida belgi bor, shunda u "buzilgan" emas, "bo'sh"
/// ko'rinadi.
class MediaSlot extends StatelessWidget {
  const MediaSlot({
    super.key,
    this.radius = R.card,
    this.icon,
    this.label,
    this.width,
    this.height,
  });

  final double radius;
  final Ico? icon;
  final String? label;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) => Container(
        width: width ?? double.infinity,
        height: height,
        decoration: BoxDecoration(
          gradient: C.raisedSurface,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: C.line),
        ),
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null)
              NIcon(icon!, size: 22, color: C.ink3.withValues(alpha: .7)),
            if (label != null) ...[
              const SizedBox(height: 6),
              Text(label!, style: T.meta),
            ],
          ],
        ),
      );
}

/// AVATAR — 5 o'lcham: 28 / 36 / 44 / 56 / 72.
///
/// Rasm bo'lmasa ismning bosh harflari ko'rsatiladi. Bu bo'sh
/// doiradan yaxshiroq: foydalanuvchi kimligini baribir taniydi.
class Avatar extends StatelessWidget {
  const Avatar({
    super.key,
    this.url,
    this.name = '',
    this.size = 44,
    this.square = false,
  });

  final String? url;
  final String name;
  final double size;

  /// Biznes profilida logotip KVADRAT (radius 24) — shaxsiy
  /// profildagi dumaloq avatardan farqlanishi uchun. Bu dizaynning
  /// aniq qoidasi.
  final bool square;

  String get _initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return '';
    if (parts.length == 1) {
      return parts.first.characters.take(1).toString().toUpperCase();
    }
    return parts
        .take(2)
        .map((p) => p.characters.take(1).toString())
        .join()
        .toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final radius = square ? size * .3 : size / 2;
    final u = url?.trim() ?? '';

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: C.raisedSurface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: C.line),
      ),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: u.isEmpty
          ? Text(
              _initials,
              style: TextStyle(
                fontFamily: 'InstrumentSerif',
                fontSize: size * .40,
                height: 1,
                color: C.accent.withValues(alpha: .85),
              ),
            )
          : NetImage(u, radius: radius, width: size, height: size),
    );
  }
}
