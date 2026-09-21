import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../social/media_frame.dart';

import '../../../design/theme/typography.dart';
import '../../../design/tokens/nfc_tokens.dart';

/// Foydalanuvchi rasmi.
///
/// Rasm bo'lmasa bosh harflar ko'rsatiladi — bo'sh kulrang doira
/// o'rniga. Shuning uchun ro'yxatlar rasmsiz ham "tugallangan" ko'rinadi.
class Avatar extends StatelessWidget {
  const Avatar({
    super.key,
    required this.initials,
    this.url = '',
    this.size = 44,
    this.ring = true,
    this.ringColor,
    this.onTap,
  });

  final String url;
  final String initials;
  final double size;

  /// Story halqasi — ko'rilmagan story bo'lsa aksent rangida.
  final bool ring;
  final Color? ringColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final inner = size - (ring ? 6 : 0);

    final content = ClipOval(
      child: SizedBox(
        width: inner,
        height: inner,
        child: url.isEmpty
            ? _Initials(initials: initials, size: inner)
            : isAssetMedia(url)
                // Demo avatarlari ilova ichida saqlanadi.
                ? Image.asset(url,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                        _Initials(initials: initials, size: inner))
                : CachedNetworkImage(
                    imageUrl: url,
                    fit: BoxFit.cover,
                    fadeInDuration: const Duration(milliseconds: 240),
                    placeholder: (_, __) => ColoredBox(color: t.surface2),
                    errorWidget: (_, __, ___) =>
                        _Initials(initials: initials, size: inner),
                  ),
      ),
    );

    final body = ring
        ? Container(
            width: size,
            height: size,
            padding: const EdgeInsets.all(2.2),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: ringColor == null
                  ? t.accentGradient
                  : LinearGradient(colors: [ringColor!, ringColor!]),
            ),
            child: Container(
              padding: const EdgeInsets.all(1.6),
              decoration: BoxDecoration(color: t.bg1, shape: BoxShape.circle),
              child: content,
            ),
          )
        : SizedBox(width: size, height: size, child: Center(child: content));

    return onTap == null
        ? body
        : GestureDetector(onTap: onTap, behavior: HitTestBehavior.opaque, child: body);
  }
}

class _Initials extends StatelessWidget {
  const _Initials({required this.initials, required this.size});

  final String initials;
  final double size;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    // TO'LA OLTIN DISK EMAS — QORONG'I DOIRA, OLTIN HARF.
    //
    // Ilgari bu yer butunlay aksent gradient bilan bo'yalardi.
    // Qora mavzuda u katta, qattiq oltin dog' bo'lib ko'rinardi
    // va `nfcstore.uz/c/...` dagi kayfiyatdan uzoq edi: o'sha
    // yerda logotip doirasining ICHI qorong'i, oltin esa faqat
    // ingichka halqa va harfda.
    //
    // Ichki fon juda nozik gradient: tekis rang "yassi", kuchli
    // gradient esa "neon" bo'lib ko'rinardi.
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: const Alignment(-0.6, -1),
          end: const Alignment(0.6, 1),
          colors: [
            // Yorug' mavzuda `washScale` orqali: oq-qora mavzuda
            // .26 qora kulrang doira berardi.
            t.wash(t.accent2, t.isDark ? .16 : .26),
            t.wash(t.accent3, t.isDark ? .07 : .14),
          ],
        ),
      ),
      child: Center(
        child: Text(
          initials,
          style: AppType.displayStyle(
            // Qorong'i mavzuda och oltin, OCHIQ mavzuda to'q:
            // `accent1` ochiq fonda deyarli o'qilmasdi.
            color: t.isDark ? t.accent1 : t.accent3,
            size: size * .40,
          ),
        ),
      ),
    );
  }
}
