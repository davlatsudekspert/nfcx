import 'package:flutter/widgets.dart';

import '../tokens.dart';

/// SKELETON — yuklanish paytida bo'sh ekran EMAS.
///
/// Dizayn qoidasi: "Yuklanish paytida bo'sh ekran emas, skeleton
/// ko'rsatilsin" va "Skeleton haqiqiy kontent o'lchamlariga mos
/// bo'lsin". Ikkinchisi muhimroq: agar skeleton qatori 60 dp bo'lsa,
/// kontent esa 72 dp kelsa — ro'yxat sakraydi va "tez" his yo'qoladi.
///
/// Shuning uchun har skeleton haqiqiy komponentning O'LCHAMLARINI
/// takrorlaydi: avatar 48, radius 18, matn qatori 15 balandlikda.

/// Yumshoq yorug'lik o'tadigan to'rtburchak.
class Skeleton extends StatelessWidget {
  const Skeleton({
    super.key,
    this.width,
    this.height = 12,
    this.radius = 6,
    this.circle = false,
  });

  final double? width;
  final double height;
  final double radius;
  final bool circle;

  @override
  Widget build(BuildContext context) => _Shimmer(
        child: Container(
          width: circle ? height : width,
          height: height,
          decoration: BoxDecoration(
            color: C.surfaceHigh,
            shape: circle ? BoxShape.circle : BoxShape.rectangle,
            borderRadius: circle ? null : BorderRadius.circular(radius),
          ),
        ),
      );
}

/// Lenta qatori — 48 dp avatar, 18 radius.
class SkeletonRow extends StatelessWidget {
  const SkeletonRow({super.key, this.avatar = 48});

  final double avatar;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: S.x8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Skeleton(height: avatar, circle: true),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 4),
                  Skeleton(width: 140, height: 13, radius: 5),
                  const SizedBox(height: S.x8),
                  Skeleton(width: double.infinity, height: 11, radius: 5),
                  const SizedBox(height: 6),
                  Skeleton(width: 190, height: 11, radius: 5),
                ],
              ),
            ),
          ],
        ),
      );
}

/// Media kartasi.
class SkeletonCard extends StatelessWidget {
  const SkeletonCard({super.key, this.aspect = 16 / 10, this.radius = R.card});

  final double aspect;
  final double radius;

  @override
  Widget build(BuildContext context) => AspectRatio(
        aspectRatio: aspect,
        child: Skeleton(
          width: double.infinity,
          height: double.infinity,
          radius: radius,
        ),
      );
}

/// Grid katakchalari — Kashfiyot va post gridi.
class SkeletonGrid extends StatelessWidget {
  const SkeletonGrid({super.key, this.count = 9, this.columns = 3});

  final int count;
  final int columns;

  @override
  Widget build(BuildContext context) => GridView.builder(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        padding: EdgeInsets.zero,
        itemCount: count,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: columns,
          crossAxisSpacing: 3,
          mainAxisSpacing: 3,
        ),
        itemBuilder: (context, i) => const Skeleton(
          width: double.infinity,
          height: double.infinity,
          radius: 2,
        ),
      );
}

/// Story qatori.
class SkeletonStories extends StatelessWidget {
  const SkeletonStories({super.key, this.count = 5});

  final int count;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 86,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          itemCount: count,
          separatorBuilder: (_, __) => const SizedBox(width: S.x12),
          itemBuilder: (context, i) => const Column(
            children: [
              Skeleton(height: 58, circle: true),
              SizedBox(height: 7),
              Skeleton(width: 38, height: 9, radius: 4),
            ],
          ),
        ),
      );
}

// ─────────────────────────────────────────────────────────────

/// Yorug'lik o'tishi.
///
/// Tezlik ATAYLAB sekin (1.5 s): tez shimmer "yuklanmoqda" emas,
/// "xato" hissini beradi. Harakatni kamaytirish rejimida yorug'lik
/// o'chadi va tekis yuza qoladi.
class _Shimmer extends StatefulWidget {
  const _Shimmer({required this.child});

  final Widget child;

  @override
  State<_Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<_Shimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  );

  bool _running = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final should = !reduceMotion(context);
    if (should != _running) {
      _running = should;
      if (should) {
        _c.repeat();
      } else {
        _c.stop();
      }
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_running) return widget.child;
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) => ShaderMask(
        blendMode: BlendMode.srcATop,
        shaderCallback: (bounds) {
          // -1 dan 2 gacha — yorug'lik chapdan kirib o'ngdan chiqadi
          // va qaytishda sakramaydi.
          final t = _c.value * 3 - 1;
          return LinearGradient(
            begin: Alignment(t - .6, 0),
            end: Alignment(t + .6, 0),
            colors: [
              const Color(0x00FFFFFF),
              C.accent.withValues(alpha: .07),
              const Color(0x00FFFFFF),
            ],
            stops: const [0, .5, 1],
          ).createShader(bounds);
        },
        child: child,
      ),
    );
  }
}
