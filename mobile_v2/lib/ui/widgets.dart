import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/theme.dart';

class Wordmark extends StatelessWidget {
  const Wordmark({super.key, this.compact = false});
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'NFCSTORE',
          style: TextStyle(
            color: p.ink,
            fontWeight: FontWeight.w600,
            fontSize: compact ? 17 : 22,
            height: 1,
            letterSpacing: compact ? 2.2 : 3.1,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          'M o r e   t h a n   a   l i n k',
          style: TextStyle(
            color: p.ink2,
            fontSize: compact ? 6.6 : 7.8,
            letterSpacing: .55,
          ),
        ),
      ],
    );
  }
}

class BrandAvatar extends StatelessWidget {
  const BrandAvatar({
    super.key,
    required this.url,
    this.size = 48,
    this.goldRing = false,
    this.fallback = '',
  });

  final String? url;
  final double size;
  final bool goldRing;
  final String fallback;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Container(
      width: size,
      height: size,
      padding: EdgeInsets.all(goldRing ? 1.7 : 1),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: goldRing ? p.accent : p.line,
      ),
      child: ClipOval(
        child: ColoredBox(
          color: p.background2,
          child: (url ?? '').isEmpty
              ? Center(
                  child: Text(
                    fallback.isEmpty ? 'N' : fallback.characters.first.toUpperCase(),
                    style: TextStyle(
                      color: p.ink,
                      fontWeight: FontWeight.w700,
                      fontSize: size * .34,
                    ),
                  ),
                )
              : CachedNetworkImage(
                  imageUrl: url!,
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => Icon(
                    Icons.person_outline_rounded,
                    color: p.ink2,
                    size: size * .42,
                  ),
                ),
        ),
      ),
    );
  }
}

class SurfaceCard extends StatelessWidget {
  const SurfaceCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.radius = 22,
    this.onTap,
    this.shadow = true,
  });

  final Widget child;
  final EdgeInsets padding;
  final double radius;
  final VoidCallback? onTap;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final body = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: p.line.withValues(alpha: .78)),
        boxShadow: shadow
            ? [
                BoxShadow(
                  color: p.shadow,
                  blurRadius: 22,
                  offset: const Offset(0, 9),
                ),
              ]
            : null,
      ),
      child: child,
    );
    if (onTap == null) return body;
    return GestureDetector(onTap: onTap, behavior: HitTestBehavior.opaque, child: body);
  }
}

class NfcIdentityCard extends StatelessWidget {
  const NfcIdentityCard({
    super.key,
    required this.code,
    required this.name,
    this.role = '',
    this.compact = false,
    this.onTap,
  });

  final String code;
  final String name;
  final String role;
  final bool compact;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: compact ? 108 : 154,
        padding: EdgeInsets.all(compact ? 15 : 19),
        decoration: BoxDecoration(
          color: p.hero,
          borderRadius: BorderRadius.circular(compact ? 19 : 25),
          border: Border.all(color: p.accent.withValues(alpha: .38)),
          boxShadow: [
            BoxShadow(
              color: p.shadow,
              blurRadius: 30,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Stack(
          children: [
            Positioned.fill(child: CustomPaint(painter: _LuxuryLines(p.accent))),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'NFC ID',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: .55),
                          fontSize: 9.5,
                          letterSpacing: 1.6,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        code,
                        style: TextStyle(
                          fontFamily: 'IBMPlexMono',
                          color: p.heroInk,
                          fontSize: compact ? 20 : 26,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 2,
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name.isEmpty ? 'NFCSTORE' : name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (role.isNotEmpty) ...[
                            const SizedBox(height: 3),
                            Text(
                              role,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: .62),
                                fontSize: 11.2,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  width: compact ? 50 : 66,
                  height: compact ? 50 : 66,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.black.withValues(alpha: .2),
                    border: Border.all(color: p.accent.withValues(alpha: .55)),
                  ),
                  child: Icon(
                    Icons.contactless_rounded,
                    color: p.heroInk,
                    size: compact ? 29 : 38,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LuxuryLines extends CustomPainter {
  const _LuxuryLines(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color.withValues(alpha: .14)
      ..style = PaintingStyle.stroke
      ..strokeWidth = .75;
    for (var i = 0; i < 7; i++) {
      final path = Path()
        ..moveTo(size.width * .44, size.height * (.16 + i * .085))
        ..cubicTo(
          size.width * .61,
          size.height * (.04 + i * .075),
          size.width * .77,
          size.height * (.51 + i * .03),
          size.width * 1.08,
          size.height * (.27 + i * .075),
        );
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _LuxuryLines oldDelegate) => oldDelegate.color != color;
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.action,
    this.onAction,
  });

  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 17),
          ),
        ),
        if (action != null)
          GestureDetector(
            onTap: onAction,
            child: Text(action!, style: TextStyle(color: p.ink2, fontSize: 12.5)),
          ),
      ],
    );
  }
}

class StatBlock extends StatelessWidget {
  const StatBlock({super.key, required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: TextStyle(
            color: p.ink,
            fontFamily: 'IBMPlexMono',
            fontWeight: FontWeight.w600,
            fontSize: 15.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(color: p.ink2, fontSize: 9.5)),
      ],
    );
  }
}

class Pill extends StatelessWidget {
  const Pill({
    super.key,
    required this.label,
    this.icon,
    this.selected = false,
    this.onTap,
  });

  final String label;
  final IconData? icon;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? p.hero : p.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? p.hero : p.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 15, color: selected ? p.heroInk : p.ink),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                color: selected ? p.heroInk : p.ink,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class RoundIcon extends StatelessWidget {
  const RoundIcon({
    super.key,
    required this.icon,
    this.onTap,
    this.size = 42,
    this.emphasis = false,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final double size;
  final bool emphasis;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: emphasis ? p.hero : p.surface,
          border: Border.all(color: emphasis ? p.accent.withValues(alpha: .4) : p.line),
          boxShadow: [
            BoxShadow(
              color: p.shadow.withValues(alpha: .5),
              blurRadius: 14,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Icon(icon, size: size * .44, color: emphasis ? p.heroInk : p.ink),
      ),
    );
  }
}

class ActionTile extends StatelessWidget {
  const ActionTile({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: p.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: p.line),
              boxShadow: [
                BoxShadow(
                  color: p.shadow.withValues(alpha: .5),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Icon(icon, color: p.ink, size: 21),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            style: TextStyle(color: p.ink, fontSize: 10.2, height: 1.15),
          ),
        ],
      ),
    );
  }
}
