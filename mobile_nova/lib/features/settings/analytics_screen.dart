import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/models.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../home/widgets/identity_card.dart' show formatCount;
import '../social/media_frame.dart' show mediaImage;

/// Sozlamalar → Analitika (`GET /api/my/analytics`, oxirgi 30 kun).
///
/// Hammasi foydalanuvchining O'Z kartalari va kompaniyalari bo'yicha:
/// profil ko'rishlari, tugma bosishlar, obunachilar, post va Reels
/// ko'rishlari hamda eng ko'p ko'rilgan postlar. Raqamlar sayt bilan
/// bitta manbadan — ilova o'zi hech narsa sanamaydi.
final myAnalyticsProvider =
    FutureProvider.autoDispose<MyAnalytics>((ref) async {
  final res = await ref.watch(socialRepositoryProvider).myAnalytics();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

class AnalyticsScreen extends ConsumerWidget {
  const AnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final data = ref.watch(myAnalyticsProvider);
    return NovaScaffold(
      title: l.settingsAnalytics,
      showBack: true,
      body: data.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(Gap.screenX),
          child: SkeletonList(count: 4),
        ),
        error: (e, _) => StatePanel.fromError(
          context,
          asAppError(e),
          onRetry: () => ref.invalidate(myAnalyticsProvider),
        ),
        data: (a) => RefreshIndicator(
          onRefresh: () => ref.refresh(myAnalyticsProvider.future),
          child: _Body(a: a),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.a});

  final MyAnalytics a;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    Widget pair(Widget x, Widget y) => Padding(
          padding: const EdgeInsets.only(bottom: Gap.md),
          child: Row(
            children: [
              Expanded(child: x),
              const SizedBox(width: Gap.md),
              Expanded(child: y),
            ],
          ),
        );
    return NovaScroll(
      children: [
        Text(l.analyticsPeriod(a.days),
            style: Theme.of(context).textTheme.labelMedium),
        const SizedBox(height: Gap.md),
        pair(
          _Stat(
              key: const ValueKey('an-content-views'),
              label: l.analyticsContentViews,
              value: a.contentViews,
              icon: Icons.visibility_outlined,
              tone: t.accentB),
          _Stat(
              key: const ValueKey('an-profile-views'),
              label: l.analyticsProfileViews,
              value: a.profileViews,
              icon: Icons.person_search_outlined,
              tone: t.accentC),
        ),
        pair(
          _Stat(
              label: l.profileFollowers,
              value: a.followers,
              icon: Icons.people_alt_outlined,
              tone: t.accent1),
          _Stat(
              label: l.analyticsClicks,
              value: a.clicks,
              icon: Icons.touch_app_outlined,
              tone: t.accentD),
        ),
        pair(
          _Stat(
              label: l.analyticsLikes,
              value: a.likes,
              icon: Icons.favorite_border_rounded,
              tone: t.error),
          _Stat(
              label: l.postComments,
              value: a.comments,
              icon: Icons.chat_bubble_outline_rounded,
              tone: t.accentB),
        ),
        Text(
          l.analyticsAllTime(formatCount(a.profileTotalViews),
              formatCount(a.uniqueVisitors)),
          style: Theme.of(context).textTheme.bodySmall,
        ),
        if (a.byDay.isNotEmpty) ...[
          SectionHeader(title: l.analyticsByDay),
          _DayBars(days: a.byDay),
        ],
        SectionHeader(title: l.analyticsTop),
        if (a.top.isEmpty)
          StatePanel(
              icon: Icons.insights_outlined, title: l.analyticsNoPosts)
        else
          for (final p in a.top) _TopRow(p: p),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.tone,
  });

  final String label;
  final int value;
  final IconData icon;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: R.gentle,
        border: Border.all(color: tone.withValues(alpha: .3)),
        boxShadow: t.shadowTiny,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: tone),
          const SizedBox(height: Gap.xs),
          Text(formatCount(value),
              style: Theme.of(context)
                  .textTheme
                  .displayMedium
                  ?.copyWith(fontSize: 26)),
          Text(label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium),
        ],
      ),
    );
  }
}

/// Kunlik ko'rishlar — oddiy ustunlar (kutubxonasiz). Eng baland
/// kun to'liq balandlikda, qolganlari unga nisbatan.
class _DayBars extends StatelessWidget {
  const _DayBars({required this.days});

  final List<({String day, int views})> days;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final max = days.fold<int>(1, (m, d) => d.views > m ? d.views : m);
    return Semantics(
      container: true,
      child: SizedBox(
        height: 96,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            for (final d in days)
              Expanded(
                child: Tooltip(
                  message: '${d.day}: ${d.views}',
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 1.5),
                    child: FractionallySizedBox(
                      heightFactor: (d.views / max).clamp(.04, 1.0),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: t.accentB.withValues(alpha: .75),
                          borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(3)),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _TopRow extends StatelessWidget {
  const _TopRow({required this.p});

  final TopContent p;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final text = Theme.of(context).textTheme;
    return Padding(
      key: ValueKey('an-top-${p.kind}-${p.id}'),
      padding: const EdgeInsets.only(bottom: Gap.md),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: R.tile,
            child: SizedBox(
              width: 52,
              height: 52,
              child: p.imageUrl.isNotEmpty
                  ? mediaImage(context, p.imageUrl, fit: BoxFit.cover)
                  : ColoredBox(
                      color: t.surface2,
                      child: Icon(
                          p.isVideo
                              ? Icons.play_circle_outline_rounded
                              : Icons.image_outlined,
                          color: t.text2),
                    ),
            ),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  p.caption.isEmpty
                      ? (p.isVideo ? l.analyticsReel : l.analyticsPost)
                      : p.caption,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: text.titleSmall,
                ),
                const SizedBox(height: 2),
                Text(
                  '${l.viewsCount(formatCount(p.views))} · '
                  '${formatCount(p.likes)} ♥ · ${formatCount(p.comments)} 💬',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: text.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
