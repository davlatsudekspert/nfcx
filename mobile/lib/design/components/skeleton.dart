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
  Widget build(BuildContext context) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: const Color(0xFF1B1A21),
          borderRadius: BorderRadius.circular(radius),
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
