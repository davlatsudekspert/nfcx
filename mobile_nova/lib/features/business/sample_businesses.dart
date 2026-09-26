import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/models.dart';
import '../../data/repositories/discover_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../social/media_frame.dart';
import 'business_providers.dart' show myBusinessesProvider;

/// NAMUNA BIZNESLAR KARUSELI (2026-09-26).
///
/// Egasi: "ilovada ham ko'rinsin" — tanlangan joylar: biznes ochish
/// ekrani, biznesi yo'q odamning Asosiy sahifasi va Tanlov → Bizneslar.
/// Ma'lumot `/api/companies` dan (`demo: true`), rasmlar saytdagi
/// namunalar bilan bir xil. Namunalar yo'q bo'lsa (admin o'chirgan) —
/// hech narsa chizilmaydi.
final sampleBusinessesProvider =
    FutureProvider.autoDispose<List<Business>>((ref) async {
  final res = await ref.watch(discoverRepositoryProvider).companies();
  return res.when(
    ok: (v) => [for (final b in v) if (b.isDemo) b],
    err: (_) => const <Business>[],
  );
});

class SampleBusinessesStrip extends ConsumerWidget {
  const SampleBusinessesStrip({
    super.key,
    this.title,
    this.subtitle,
    this.horizontalPadding = Gap.screenX,
    this.header = true,
    this.items,
  });

  /// Tayyor ro'yxat (masalan, Tanlov allaqachon yuklagan) — berilsa
  /// qayta so'rov yuborilmaydi.
  final List<Business>? items;

  /// Sarlavha — berilmasa "Namuna profillar".
  final String? title;
  final String? subtitle;
  final double horizontalPadding;

  /// `false` — sarlavhasiz (sarlavhani chaqiruvchi o'zi chizadi).
  final bool header;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = this.items ??
        ref.watch(sampleBusinessesProvider).valueOrNull ??
        const <Business>[];
    if (items.isEmpty) return const SizedBox.shrink();
    final l = L.of(context);
    final t = context.tokens;
    return Column(
      key: const ValueKey('sample-businesses'),
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (header) ...[
          Padding(
            padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
            child: Text(title ?? l.sampleBusinessesTitle,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w800)),
          ),
          const SizedBox(height: 4),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
            child: Text(subtitle ?? l.sampleBusinessesHint,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: t.text3)),
          ),
          const SizedBox(height: Gap.md),
        ],
        SizedBox(
          height: 196,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
            itemBuilder: (context, i) => _SampleCard(business: items[i]),
          ),
        ),
      ],
    );
  }
}

class _SampleCard extends StatelessWidget {
  const _SampleCard({required this.business});
  final Business business;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final b = business;
    final sub = b.subcategory.isNotEmpty ? b.subcategory : b.city;
    return PressableScale(
      scale: .97,
      onTap: () => context.push(Routes.storefront(b.companyId)),
      child: Container(
        key: ValueKey('sample-business-${b.companyId}'),
        width: 212,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: t.surfaceSolid,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: t.border1),
          boxShadow: t.shadowSoft,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 118,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (b.coverUrl.isNotEmpty)
                    mediaImage(context, b.coverUrl, fit: BoxFit.cover)
                  else
                    ColoredBox(color: t.surface2),
                  Positioned(
                    left: 10,
                    top: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: .55),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: t.accentB),
                      ),
                      child: Text(l.sampleBadge.toUpperCase(),
                          style: AppType.eyebrow(color: t.accentB)
                              .copyWith(fontSize: 10)),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: Row(
                children: [
                  ClipOval(
                    child: SizedBox(
                      width: 40,
                      height: 40,
                      child: b.logoUrl.isNotEmpty
                          ? mediaImage(context, b.logoUrl, fit: BoxFit.cover)
                          : ColoredBox(color: t.surface2),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(b.displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(fontWeight: FontWeight.w800)),
                        if (sub.isNotEmpty)
                          Text(sub,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(color: t.text3)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Asosiy sahifa uchun (shaxsiy rejim): FAQAT biznesi yo'q odamga (ro'yxat
/// kelib bo'sh chiqqanda). Egasi (2026-09-26): "biznesi yo'qlarga
/// ko'ringani yaxshi" — lekin Stories'dan keyin, pastga surmasdan ko'rinsin.
class HomeSampleBusinesses extends ConsumerWidget {
  const HomeSampleBusinesses({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mine = ref.watch(myBusinessesProvider);
    if (!mine.hasValue || mine.requireValue.isNotEmpty) {
      return const SizedBox.shrink();
    }
    final has =
        ref.watch(sampleBusinessesProvider).valueOrNull?.isNotEmpty ?? false;
    if (!has) return const SizedBox.shrink();
    return const Padding(
      padding: EdgeInsets.only(bottom: Gap.lg),
      child: SampleBusinessesStrip(),
    );
  }
}
