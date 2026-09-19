import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/models.dart';
import '../../data/repositories/activity_repository.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';

final activityFeedProvider =
    FutureProvider.autoDispose<List<ActivityEvent>>((ref) async {
  final codes = ref.watch(myIdsProvider).map((e) => e.code).toList();
  if (codes.isEmpty) return const [];
  final res = await ref.watch(activityRepositoryProvider).feed(codes);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

final activityFilterProvider = StateProvider.autoDispose<bool>((_) => false);

/// Bildirishnomalar.
///
/// PUSH HAQIDA: backend'da qurilmani ro'yxatdan o'tkazish endpointi
/// hali yo'q, shuning uchun bu ro'yxat SO'RAB OLINADI. Soxta push
/// ko'rsatilmaydi — `API_GAPS.md` ga qarang.
class ActivityScreen extends ConsumerWidget {
  const ActivityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final feed = ref.watch(activityFeedProvider);
    final unreadOnly = ref.watch(activityFilterProvider);

    return NovaScaffold(
      title: l.activityTitle,
      showBack: true,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(
                horizontal: Gap.screenX, vertical: Gap.sm),
            child: Row(
              children: [
                Capsule(
                  label: l.activityAll,
                  selected: !unreadOnly,
                  onTap: () =>
                      ref.read(activityFilterProvider.notifier).state = false,
                ),
                const SizedBox(width: Gap.sm),
                Capsule(
                  label: l.activityUnread,
                  selected: unreadOnly,
                  onTap: () =>
                      ref.read(activityFilterProvider.notifier).state = true,
                ),
              ],
            ),
          ),
          Expanded(
            child: feed.when(
              loading: () => const SkeletonList(),
              error: (e, __) => StatePanel.fromError(context, asAppError(e),
                  onRetry: () => ref.invalidate(activityFeedProvider)),
              data: (all) {
                final items =
                    unreadOnly ? all.where((e) => !e.read).toList() : all;
                if (items.isEmpty) {
                  return StatePanel(
                    icon: Icons.notifications_none_rounded,
                    title: l.activityEmpty,
                    message: l.stateEmptyHint,
                  );
                }
                return RefreshIndicator(
                  color: t.accent2,
                  onRefresh: () async => ref.invalidate(activityFeedProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(
                        Gap.screenX, Gap.md, Gap.screenX, 120),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: Gap.sm),
                    itemBuilder: (context, i) => _EventTile(event: items[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({required this.event});
  final ActivityEvent event;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    final (icon, tone) = switch (event.kind) {
      ActivityKind.like => (Icons.favorite_rounded, t.error),
      ActivityKind.follow => (Icons.person_add_alt_rounded, t.accentB),
      ActivityKind.comment => (Icons.mode_comment_rounded, t.accentC),
      ActivityKind.scan => (Icons.nfc_rounded, t.accent2),
      ActivityKind.order => (Icons.receipt_long_rounded, t.accentD),
      ActivityKind.payment => (Icons.payments_rounded, t.success),
      ActivityKind.security => (Icons.shield_rounded, t.warn),
      ActivityKind.business => (Icons.storefront_rounded, t.accentB),
      ActivityKind.system => (Icons.info_rounded, t.text3),
    };

    return FloatingSurface(
      solid: true,
      padding: const EdgeInsets.all(Gap.md),
      onTap: event.targetCode.isEmpty
          ? null
          : () => context.push(Routes.user(event.targetCode)),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
                color: tone.withValues(alpha: .16), shape: BoxShape.circle),
            child: Icon(icon, size: 16, color: t.isDark ? tone : t.text1),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.title.isEmpty ? l.activityTitle : event.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                if (event.subtitle.isNotEmpty)
                  Text(event.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          if (!event.read)
            Container(
              width: 8,
              height: 8,
              decoration:
                  BoxDecoration(color: t.accent2, shape: BoxShape.circle),
            ),
        ],
      ),
    );
  }
}
