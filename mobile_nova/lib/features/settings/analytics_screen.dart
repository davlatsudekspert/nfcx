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
import '../social/video_poster.dart';

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

/// Asosiy ekranda ko'rinadigan "eng ko'p ko'rilgan" soni.
const kAnalyticsTopShown = 5;

/// "Eng ko'p ko'rilganlar" — TO'LIQ ro'yxat.
class AnalyticsTopScreen extends StatelessWidget {
  const AnalyticsTopScreen({super.key, required this.top});

  final List<TopContent> top;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return NovaScaffold(
      title: l.analyticsTop,
      showBack: true,
      body: NovaScroll(children: [for (final p in top) _TopRow(p: p)]),
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
          _DayBars(days: a.byDay, period: a.days),
        ],
        SectionHeader(title: l.analyticsTop),
        if (a.top.isEmpty)
          StatePanel(
              icon: Icons.insights_outlined, title: l.analyticsNoPosts)
        else ...[
          // Faqat TOP-5 (egasi, 2026-10-05: "ro'yxat ko'p bo'lsa pastga
          // qarab ketadi"). Qolgani alohida sahifada.
          for (final p in a.top.take(kAnalyticsTopShown)) _TopRow(p: p),
          if (a.top.length > kAnalyticsTopShown)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                key: const ValueKey('an-top-all'),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => AnalyticsTopScreen(top: a.top),
                  ),
                ),
                child: Text(l.analyticsSeeAll(a.top.length)),
              ),
            ),
        ],
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
/// Kunlik qatorni BUTUN davrga to'ldiradi (ko'rish bo'lmagan kun = 0).
///
/// Server faqat ko'rish bo'lgan kunlarni beradi. Ilgari 2 kunlik
/// ma'lumot ekran kengligidagi ikkita qalin to'rtburchakka aylanardi
/// va buzilgan grafikdek ko'rinardi (egasi, 2026-10-05).
@visibleForTesting
List<({String day, int views})> fillDays(
    List<({String day, int views})> days, int period,
    {DateTime? today}) {
  if (days.isEmpty || period <= 0) return days;
  final byDay = {for (final d in days) d.day: d.views};
  var end = today ?? DateTime.now().toUtc();
  end = DateTime.utc(end.year, end.month, end.day);
  // Server kuni (UTC) bugundan keyin bo'lsa ham kesilmasin.
  for (final d in days) {
    final p = DateTime.tryParse(d.day);
    if (p != null && p.isAfter(end)) end = DateTime.utc(p.year, p.month, p.day);
  }
  String key(DateTime x) =>
      '${x.year.toString().padLeft(4, '0')}-${x.month.toString().padLeft(2, '0')}-${x.day.toString().padLeft(2, '0')}';
  final n = period.clamp(1, 90);
  return [
    for (var i = n - 1; i >= 0; i--)
      () {
        final k = key(end.subtract(Duration(days: i)));
        return (day: k, views: byDay[k] ?? 0);
      }(),
  ];
}

class _DayBars extends StatelessWidget {
  const _DayBars({required List<({String day, int views})> days, int period = 30})
      : _raw = days,
        _period = period;

  final List<({String day, int views})> _raw;
  final int _period;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final days = fillDays(_raw, _period);
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
                          color: d.views == 0
                              ? t.text3.withValues(alpha: .18)
                              : t.accentB.withValues(alpha: .75),
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
                  : p.isVideo
                  // Video — birinchi kadr (profil to'ri bilan bir xil
                  // muqova), ustida kichik ijro belgisi.
                  ? Stack(fit: StackFit.expand, children: [
                      VideoPoster(url: p.videoUrl),
                      const Center(
                        child: Icon(Icons.play_arrow_rounded,
                            color: Colors.white, size: 22,
                            shadows: [Shadow(blurRadius: 6, color: Colors.black54)]),
                      ),
                    ])
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
