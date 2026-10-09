import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/utils/external_link.dart';
import '../../data/models/models.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import 'showcase_common.dart';
import 'showcase_instagram.dart';
import 'showcase_video.dart';

/// KO'RGAZMA MA'LUMOTI — lenta kartasi va post tafsilotida (yorug' fon).
///
/// Sarlavha, narx, "Mahsulotni ko'rish" va havola: YouTube — "Videoni
/// ko'rish" (ilova ichida, rasmiy pleer), Instagram post/reel —
/// "Instagram'da ko'rish" (ilova ichida, rasmiy embed), profil —
/// tashqarida.
/// Ma'lumot yo'q — hech narsa chizilmaydi.
class ShowcaseExtras extends StatelessWidget {
  const ShowcaseExtras({
    super.key,
    required this.post,
    this.keyPrefix = 'showcase-extras',
  });

  final Post post;
  final String keyPrefix;

  static bool hasAny(Post p) =>
      p.title.isNotEmpty ||
      p.priceUzs != null ||
      p.catalogItem != null ||
      showcaseLinkKind(p.linkUrl) != null;

  @override
  Widget build(BuildContext context) {
    final p = post;
    if (!hasAny(p)) return const SizedBox.shrink();
    final l = L.of(context);
    final t = context.tokens;
    final link = showcaseLinkKind(p.linkUrl);
    final videoId = youtubeVideoId(p.linkUrl);
    final igEmbed = instagramEmbedUri(p.linkUrl);
    final item = p.catalogItem;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (p.title.isNotEmpty)
          Text(
            p.title,
            key: ValueKey('$keyPrefix-title'),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 15.5,
              fontWeight: FontWeight.w800,
              height: 1.25,
              color: t.text1,
            ),
          ),
        if (p.priceUzs != null) ...[
          if (p.title.isNotEmpty) const SizedBox(height: 2),
          Text(
            formatUzs(l, p.priceUzs!),
            key: ValueKey('$keyPrefix-price'),
            style: AppType.monoStyle(
                color: t.text1, size: 14, weight: FontWeight.w700),
          ),
        ],
        if (item != null || link != null) ...[
          const SizedBox(height: Gap.sm),
          Wrap(
            spacing: Gap.sm,
            runSpacing: 6,
            children: [
              if (item != null)
                _Pill(
                  key: ValueKey('$keyPrefix-product'),
                  icon: Icons.shopping_bag_outlined,
                  label: l.showcaseViewProduct,
                  filled: true,
                  onTap: () => context.push(
                      Routes.catalogProduct(item.companyId, item.id)),
                ),
              if (videoId != null)
                _Pill(
                  key: ValueKey('$keyPrefix-video'),
                  icon: Icons.play_circle_outline_rounded,
                  label: l.showcaseWatchVideo,
                  onTap: () => showShowcaseVideo(
                    context,
                    url: p.linkUrl,
                    videoId: videoId,
                    title: p.title,
                  ),
                )
              else if (igEmbed != null)
                _Pill(
                  key: ValueKey('$keyPrefix-instagram'),
                  icon: Icons.camera_alt_outlined,
                  label: l.showcaseWatchInstagram,
                  onTap: () => showShowcaseInstagram(
                    context,
                    url: p.linkUrl,
                    embed: igEmbed,
                    title: p.title,
                  ),
                )
              else if (link != null)
                _Pill(
                  key: ValueKey('$keyPrefix-link'),
                  icon: Icons.open_in_new_rounded,
                  label: showcaseLinkLabel(l, link),
                  onTap: () => openLink(p.linkUrl),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.filled = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final fg = filled ? t.surfaceSolid : t.text1;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: PressableScale(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 40),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: filled ? t.text1 : t.surfaceSolid,
              borderRadius: R.pill,
              border: Border.all(color: filled ? t.text1 : t.border2),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 15, color: fg),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: fg,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
