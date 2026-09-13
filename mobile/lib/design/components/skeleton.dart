import 'package:flutter/widgets.dart';
import '../tokens.dart';

/// Skeleton — HAQIQIY maketning silueti, yalang'och spinner emas.
///
/// Handoff qoidasi: yuklanish holati ekranning o'z tuzilishini
/// takrorlashi kerak, shunda ma'lumot kelganda hech narsa siljimaydi.
/// Shu sabab bu yerda "umumiy yuklanish ekrani" yo'q — har ekran o'z
/// skeletonini shu g'ishtlardan yig'adi.
class Skeleton extends StatelessWidget {
  const Skeleton({
    super.key,
    this.width,
    this.height = 12,
    this.radius = 6,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) => _Shimmer(
        child: Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            color: const Color(0xFF1B1A21),
            borderRadius: BorderRadius.circular(radius),
          ),
        ),
      );
}

/// NOZIK SHIMMER.
///
/// Yorug'lik juda past kontrastda (5%) va sekin (1.4s) o'tadi: maqsad
/// "ma'lumot kelyapti" degan belgi berish, e'tiborni tortish emas.
/// Kuchli shimmer qorong'i interfeysda arzon ko'rinadi va handoff
/// uni aynan shu sababdan chiqarib tashlagan edi.
///
/// TEZLIK: `ShaderMask` faqat shu g'ishtni qayta chizadi va
/// animatsiya butun daraxtni qayta QURMAYDI (`AnimatedBuilder` ichida
/// `child` qayta ishlatiladi).
class _Shimmer extends StatefulWidget {
  const _Shimmer({required this.child});
  final Widget child;

  @override
  State<_Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<_Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        child: widget.child,
        builder: (context, child) => ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (rect) => LinearGradient(
            begin: Alignment(-1.6 + _c.value * 3.2, 0),
            end: Alignment(-1.1 + _c.value * 3.2, 0),
            colors: const [
              Color(0x00FFFFFF),
              Color(0x0DFFFFFF),
              Color(0x00FFFFFF),
            ],
          ).createShader(rect),
          child: child,
        ),
      );
}

/// Ro'yxat qatori skeleton'i: avatar + ikki qator matn.
class SkeletonRow extends StatelessWidget {
  const SkeletonRow({super.key, this.avatar = 44});
  final double avatar;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: S.x8),
        child: Row(
          children: [
            Skeleton(width: avatar, height: avatar, radius: avatar / 2),
            const SizedBox(width: S.x12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Skeleton(width: 140, height: 13),
                  SizedBox(height: S.x8),
                  Skeleton(width: 90, height: 10),
                ],
              ),
            ),
          ],
        ),
      );
}

/// Karta skeleton'i — berilgan nisbatda.
class SkeletonCard extends StatelessWidget {
  const SkeletonCard({super.key, this.aspect = 16 / 10, this.radius = R.card});
  final double aspect;
  final double radius;

  @override
  Widget build(BuildContext context) => AspectRatio(
        aspectRatio: aspect,
        child: Skeleton(height: double.infinity, radius: radius),
      );
}
