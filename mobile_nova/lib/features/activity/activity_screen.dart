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

/// BILDIRISHNOMALAR — SAYT BILAN BITTA MANBADAN.
///
/// Ilgari bu yerda har bir NFC ID uchun analitika so'ralar va
/// javobdan `events` kaliti o'qilardi — server esa uni hech qachon
/// yubormaydi. Ro'yxat DOIM bo'sh edi.
final activityFeedProvider =
    FutureProvider.autoDispose<NotificationPage>((ref) async {
  final res = await ref.watch(activityRepositoryProvider).list();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// O'qilmaganlar sanog'i — sarlavhadagi nishon uchun.
final unreadCountProvider = Provider.autoDispose<int>((ref) =>
    ref.watch(activityFeedProvider).valueOrNull?.unreadCount ?? 0);

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
            // FILTR KAPSULALARI — GORIZONTAL SURILADI.
            //
            // Qat'iy `Row` da ikkita kapsula 320dp li telefonda 18
            // piksel toshib ketardi. Yorliqni qisqartirib bo'lmaydi
            // (filtr nomi yarim ko'rinsa foydasi yo'q), shuning
            // uchun qator suriladi — filtr chiplarida odatiy yo'l.
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
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
                  // "Hammasini o'qildi" — FAQAT o'qilmagani bo'lsa.
                  // Bosiladigan, lekin hech narsa qilmaydigan tugma
                  // qoldirilmaydi.
                  if (ref.watch(unreadCountProvider) > 0) ...[
                    const SizedBox(width: Gap.sm),
                    Capsule(
                      label: l.activityMarkAll,
                      selected: false,
                      onTap: () async {
                        await ref
                            .read(activityRepositoryProvider)
                            .markAllRead();
                        // Kutish paytida ekran yopilgan bo'lsa `ref`
                        // istisno otadi.
                        if (!context.mounted) return;
                        ref.invalidate(activityFeedProvider);
                      },
                    ),
                  ],
                ],
              ),
            ),
          ),
          Expanded(
            child: feed.when(
              loading: () => const SkeletonList(),
              error: (e, __) => StatePanel.fromError(context, asAppError(e),
                  onRetry: () => ref.invalidate(activityFeedProvider)),
              data: (all) {
                final rows = all.items;
                final items =
                    unreadOnly ? rows.where((e) => !e.read).toList() : rows;
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

class _EventTile extends ConsumerWidget {
  const _EventTile({required this.event});
  final ActivityEvent event;

  /// NISHON — server bergan turga qarab.
  ///
  /// Obunada — obuna bo'lgan odamning profili; like va izohda — post
  /// turgan profil. Ikkalasi ham bo'sh bo'lsa (yozuv o'chirilgan)
  /// hech qayerga o'tilmaydi: mavjud bo'lmagan ekranga yuborish
  /// ilovani yiqitardi.
  String? _actionText(L l) => switch (event.kind) {
        ActivityKind.follow => l.activityFollowed,
        ActivityKind.like => l.activityLiked,
        ActivityKind.comment => l.activityCommented,
        _ => null,
      };

  String? get _target {
    final code = event.kind == ActivityKind.follow
        ? (event.actorCode.isNotEmpty ? event.actorCode : event.targetCode)
        : event.targetCode;
    return code.isEmpty ? null : Routes.user(code);
  }

  Future<void> _open(BuildContext context, WidgetRef ref) async {
    // O'QILDI — OCHISHDAN OLDIN.
    //
    // Server aniq sanoqni qaytaradi, lekin ro'yxat baribir qayta
    // o'qiladi: boshqa qurilmada o'qilganlar ham hisobga olinsin.
    // Xatosi jimgina yutiladi — bildirishnomani ocholmaslik
    // sababi bo'lolmaydi.
    if (!event.read) {
      await ref.read(activityRepositoryProvider).markRead(event.id);
      if (!context.mounted) return;
      ref.invalidate(activityFeedProvider);
    }
    final to = _target;
    if (to != null && context.mounted) context.push(to);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
      // O'qilmagan yozuv nishonsiz bo'lsa ham bosiladi — hech
      // bo'lmasa o'qilgan deb belgilanadi.
      onTap: (_target == null && event.read) ? null : () => _open(context, ref),
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
                // JUMLA SHU YERDA YIG'ILADI.
                //
                // Server tayyor matn emas, `type` va aktyor ismini
                // beradi. Serverda yozilsa, u yozilgan tilda muzlab
                // qolardi va til almashtirilganda eski xabarlar
                // o'zbekcha qolib ketardi.
                if (_actionText(l) != null)
                  Text(_actionText(l)!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall),
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
