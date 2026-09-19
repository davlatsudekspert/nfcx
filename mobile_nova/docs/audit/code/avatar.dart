import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

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
    return DecoratedBox(
      decoration: BoxDecoration(gradient: t.accentGradient),
      child: Center(
        child: Text(
          initials,
          style: AppType.displayStyle(
            color: const Color(0xFF1A1A1F),
            size: size * .40,
          ),
        ),
      ),
    );
  }
}
