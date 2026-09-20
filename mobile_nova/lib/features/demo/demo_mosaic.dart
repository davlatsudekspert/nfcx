import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/models.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/surfaces.dart';
import '../../routing/routes.dart';
import '../social/media_frame.dart';

/// DEMO PROFILDAGI POSTLAR — MOZAIK, 3x3 TO'R EMAS.
///
/// ## NIMA UCHUN
///
/// 3x3 kvadrat to'r har qanday ilovada bir xil ko'rinadi va
/// suratning o'zini ko'rsatmaydi — u faqat "kontent bor" deydi.
/// Demo esa REKLAMA: odam shaxsiy NFC profil qanday chiroyli
/// bo'lishini ko'rishi kerak.
///
/// Shuning uchun bu yerda tahririy oqim: birinchi post KATTA
/// bo'lib chiziladi, ikkinchisi keng lenta, qolganlari juft
/// bo'lib. Har bir plitka bosiladi va post tafsilotini ochadi.
///
/// ## FAQAT DEMO'DA
///
/// Haqiqiy profil avvalgidek 3x3 to'rda qoladi — bu vidjet
/// `demoModeProvider` bo'sh bo'lmaganda ishlatiladi. Ya'ni
/// haqiqiy foydalanuvchining profili UMUMAN o'zgarmaydi.
class DemoMosaicPosts extends StatelessWidget {
  const DemoMosaicPosts({super.key, required this.items, required this.code});

  final List<Post> items;
  final String code;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    final hero = items.first;
    final rest = items.skip(1).toList();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
      child: Column(
        children: [
          // 1. KATTA HERO — eng kuchli surat.
          _Tile(post: hero, code: code, aspect: 4 / 5, radius: 26),
          if (rest.isNotEmpty) ...[
            const SizedBox(height: Gap.sm),
            // 2. KENG LENTA.
            _Tile(post: rest.first, code: code, aspect: 16 / 9, radius: 22),
          ],
          if (rest.length > 1) ...[
            const SizedBox(height: Gap.sm),
            // 3. QOLGANLARI JUFT-JUFT.
            for (var i = 1; i < rest.length; i += 2)
              Padding(
                padding: const EdgeInsets.only(bottom: Gap.sm),
                child: Row(
                  children: [
                    Expanded(
                      child: _Tile(
                        post: rest[i],
                        code: code,
                        aspect: 1,
                        radius: 20,
                      ),
                    ),
                    if (i + 1 < rest.length) ...[
                      const SizedBox(width: Gap.sm),
                      Expanded(
                        child: _Tile(
                          post: rest[i + 1],
                          code: code,
                          aspect: 1,
                          radius: 20,
                        ),
                      ),
                    ] else
                      // Juft bo'lmasa ikkinchi yarmi BO'SH qoladi:
                      // bitta plitka butun kenglikka cho'zilsa
                      // ritm buzilardi.
                      const Expanded(child: SizedBox.shrink()),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.post,
    required this.code,
    required this.aspect,
    required this.radius,
  });

  final Post post;
  final String code;
  final double aspect;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final media = post.mediaUrls.isEmpty ? '' : post.mediaUrls.first;

    return PressableScale(
      onTap: () => context.push(Routes.post(post.id, code: code)),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: AspectRatio(
          aspectRatio: aspect,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (media.isEmpty)
                ColoredBox(color: t.surface2)
              else
                mediaImage(context, media, fit: BoxFit.cover),
              // Matn o'qilishi uchun pastdan YUMSHOQ soya —
              // rang emas, soya: surat o'z rangida qoladi.
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.center,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Color(0x9E000000)],
                  ),
                ),
              ),
              if (post.text.isNotEmpty)
                Align(
                  alignment: Alignment.bottomLeft,
                  child: Padding(
                    padding: const EdgeInsets.all(Gap.md),
                    child: Text(
                      post.text,
                      maxLines: aspect < 1 ? 3 : 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.white,
                            height: 1.35,
                          ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
