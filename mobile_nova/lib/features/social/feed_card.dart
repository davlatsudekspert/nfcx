import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/errors/app_error.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/sharing.dart';
import '../../data/models/models.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';
import 'engagement.dart';
import 'inline_video.dart';

/// LENTA KARTASI — LAYK, IZOH, ULASHISH VA OBUNA.
///
/// Ilgari bosh ekrandagi lenta 128px kenglikdagi gorizontal
/// "ko'rinish" kartalaridan iborat edi va ularda HECH QANDAY amal
/// yo'q edi: postni ochmasdan layk bosib bo'lmasdi, muallifga
/// obuna bo'lish uchun esa avval uning profiliga o'tish kerak
/// edi.
///
/// Endpointlarning hammasi serverda allaqachon bor edi.
class FeedCard extends ConsumerWidget {
  const FeedCard({super.key, required this.post});

  final Post post;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final l = L.of(context);

    final like = ref.watch(
      postLikesProvider.select(
        (m) => m[post.id] ?? (liked: post.liked, count: post.likes),
      ),
    );
    final mine = ref.watch(isMineProvider(post.code));
    final following = ref.watch(followingOfProvider(post.code));

    final name = post.authorName.isEmpty ? post.code : post.authorName;
    final media = post.mediaUrls.isEmpty ? '' : post.mediaUrls.first;

    void openPost() => context.push(Routes.post(post.id, code: post.code));

    /// Amal yiqilganda holat eskisiga qaytadi. Buni AYTISH kerak:
    /// jimgina orqaga sakragan yurak odamga "bosilmadi" emas,
    /// "ilova buzuq" bo'lib ko'rinadi.
    void reportIfFailed(AppError? e) {
      if (e == null || !context.mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(describeError(l, e))));
    }

    return FloatingSurface(
      solid: true,
      padding: const EdgeInsets.all(Gap.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Avatar(
                url: post.authorAvatar,
                initials: _initials(name),
                size: 38,
                onTap: post.code.isEmpty
                    ? null
                    : () => context.push(Routes.user(post.code)),
              ),
              const SizedBox(width: Gap.sm),
              Expanded(
                child: GestureDetector(
                  onTap: post.code.isEmpty
                      ? null
                      : () => context.push(Routes.user(post.code)),
                  behavior: HitTestBehavior.opaque,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: t.text1,
                        ),
                      ),
                      if (post.code.isNotEmpty)
                        Text(
                          post.code,
                          style: AppType.monoStyle(color: t.text3, size: 11),
                        ),
                    ],
                  ),
                ),
              ),
              // O'Z postingda obuna tugmasi UMUMAN chizilmaydi —
              // o'zingga obuna bo'lish ma'nosiz.
              if (!mine && post.code.isNotEmpty)
                _FollowChip(
                  following: following,
                  onTap: () async => reportIfFailed(await ref
                      .read(followOverridesProvider.notifier)
                      .toggle(post.code, following: following)),
                ),
            ],
          ),
          if (media.isNotEmpty) ...[
            const SizedBox(height: Gap.md),
            ClipRRect(
              borderRadius: R.gentle,
              child: AspectRatio(
                aspectRatio: 4 / 3,
                child: post.isVideo
                    ? InlineVideo(key: ValueKey(post.id), url: media)
                    : CachedNetworkImage(
                        imageUrl: media,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => ColoredBox(color: t.surface2),
                        errorWidget: (_, __, ___) =>
                            ColoredBox(color: t.surface2),
                      ),
              ),
            ),
          ],
          if (post.text.isNotEmpty) ...[
            const SizedBox(height: Gap.md),
            GestureDetector(
              onTap: openPost,
              behavior: HitTestBehavior.opaque,
              child: Text(
                post.text,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
          const SizedBox(height: Gap.sm),
          Divider(height: 1, color: t.border2),
          const SizedBox(height: 2),
          Row(
            children: [
              _CardAction(
                icon: like.liked
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                label: l.postLike,
                count: like.count,
                tint: like.liked ? t.error : null,
                onTap: () async => reportIfFailed(
                    await ref.read(postLikesProvider.notifier).toggle(post)),
              ),
              const SizedBox(width: Gap.lg),
              // Izoh — mavjud oqim: post ochiladi va izoh maydoni
              // fokusga keladi. Alohida izoh tizimi yaratilmaydi.
              _CardAction(
                icon: Icons.mode_comment_outlined,
                label: l.postComments,
                count: post.comments,
                onTap: openPost,
              ),
              const Spacer(),
              _CardAction(
                icon: Icons.ios_share_rounded,
                label: l.actionShare,
                onTap: () => shareLink(
                  '$kApiBase/${Uri.encodeComponent(post.code)}',
                  title: name,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _initials(String s) {
    final v = s.trim();
    if (v.isEmpty) return '?';
    return (v.length >= 2 ? v.substring(0, 2) : v).toUpperCase();
  }
}

/// Amal tugmasi — ikonka va (bo'lsa) sanoq.
class _CardAction extends StatelessWidget {
  const _CardAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.count,
    this.tint,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final int? count;
  final Color? tint;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final c = tint ?? t.text2;
    final n = (count ?? 0) > 0 ? formatCount(count!) : null;

    return Semantics(
      button: true,
      label: n == null ? label : '$label: $n',
      child: Tooltip(
        message: label,
        child: InkResponse(
          onTap: onTap,
          radius: 26,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 2),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 18, color: c),
                if (n != null) ...[
                  const SizedBox(width: 5),
                  Text(
                    n,
                    style: TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: c,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Obuna holati — ikki holat aniq farq qiladi.
class _FollowChip extends StatelessWidget {
  const _FollowChip({required this.following, required this.onTap});

  final bool following;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final label = following ? l.actionFollowing : l.actionFollow;

    return Semantics(
      button: true,
      label: label,
      child: PressableScale(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: 6),
          decoration: BoxDecoration(
            color: following ? Colors.transparent : t.accent2,
            borderRadius: R.pill,
            border: Border.all(color: following ? t.border2 : t.accent2),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: following ? t.text2 : t.onAccent,
            ),
          ),
        ),
      ),
    );
  }
}
