import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/profile_context.dart';
import '../../data/models/models.dart';
import '../../data/repositories/iap_repository.dart';
import '../../design/motion/motion.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../business/business_providers.dart';
import '../profile/profile_screen.dart'
    show companyPostsProvider, profilePostsProvider;
import '../social/media_frame.dart' show mediaImage;
import 'boost_controller.dart';

/// Ko'tarish vaqtini ko'rsatish — mahalliy, `kk.oo.yyyy ss:dd`.
String boostTime(DateTime d) {
  final x = d.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(x.day)}.${two(x.month)}.${x.year} ${two(x.hour)}:${two(x.minute)}';
}

/// "Ko'tarish" varag'ini ochadi (faqat iPhone + `boostEnabled`;
/// chaqiruvchi tekshiradi).
Future<void> showBoostSheet(BuildContext context, WidgetRef ref, Post post) {
  final target = BoostTarget.of(post);
  ref.read(boostControllerProvider.notifier).open(target);
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: context.tokens.surfaceSolid,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (_) => BoostSheet(target: target),
  );
}

class BoostSheet extends ConsumerWidget {
  const BoostSheet({super.key, required this.target});
  final BoostTarget target;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final text = Theme.of(context).textTheme;
    final all = ref.watch(boostControllerProvider);
    // Boshqa post uchun holat — bu varaqqa tegishli emas.
    final s = all.target == target ? all : const BoostState(loading: true);
    final c = ref.read(boostControllerProvider.notifier);
    final result = s.result;

    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
            Gap.screenX, 0, Gap.screenX, Gap.xl),
        child: Column(
          key: const ValueKey('boost-sheet'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                _Thumb(target: target),
                const SizedBox(width: Gap.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l.boostTitle, style: text.titleMedium),
                      const SizedBox(height: Gap.xs),
                      Text(l.boostExplain,
                          style: text.bodySmall?.copyWith(color: t.text2)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: Gap.xl),
            if (result != null)
              _ResultView(result: result)
            else if (s.loading)
              const Center(
                key: ValueKey('boost-loading'),
                child: Padding(
                  padding: EdgeInsets.all(Gap.xl),
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            else ...[
              if (s.block != null) ...[
                Text(
                  boostBlockText(l, s.block!),
                  key: const ValueKey('boost-block'),
                  textAlign: TextAlign.center,
                  style: text.bodyMedium?.copyWith(
                      color: t.text1, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: Gap.lg),
              ],
              for (final o in s.options) ...[
                _Option(
                  option: o,
                  busy: s.buyingDays == o.pkg.days,
                  onTap: s.busy || s.block != null || o.product == null
                      ? null
                      : () => c.buy(o.pkg),
                ),
                const SizedBox(height: Gap.md),
              ],
              if (s.verifying)
                const Padding(
                  padding: EdgeInsets.only(top: Gap.sm),
                  child: Center(
                      child: SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2))),
                ),
              const SizedBox(height: Gap.sm),
              Text(l.boostPaymentNote,
                  textAlign: TextAlign.center,
                  style: text.bodySmall?.copyWith(color: t.text3)),
            ],
            if (s.failure != null) ...[
              const SizedBox(height: Gap.lg),
              Text(
                boostFailureText(l, s.failure!),
                key: const ValueKey('boost-error'),
                textAlign: TextAlign.center,
                style: text.bodyMedium?.copyWith(color: t.error),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Sabab qatori — tugmalar o'chiq.
String boostBlockText(L l, BoostBlock b) => switch (b.kind) {
      BoostBlockKind.soldOut => b.at == null
          ? l.boostSoldOutLater
          : l.boostSoldOut(boostTime(b.at!)),
      BoostBlockKind.notOpen => l.boostNotOpen,
      BoostBlockKind.priorityWindow => b.at == null
          ? l.boostNotOpen
          : l.boostPriority(boostTime(b.at!)),
      BoostBlockKind.alreadyFeatured => b.at == null
          ? l.featuredAlready
          : l.boostAlready(boostTime(b.at!)),
      BoostBlockKind.tooManyActive => l.boostTooMany(b.max ?? 3),
      BoostBlockKind.scheduled => l.boostScheduled,
    };

String boostFailureText(L l, BoostFailure f) => switch (f) {
      BoostFailure.network => l.iapErrNetwork,
      BoostFailure.server => l.iapErrServer,
      BoostFailure.store => l.iapErrStore,
      BoostFailure.disabled => l.iapErrDisabled,
      BoostFailure.rateLimited => l.iapErrRateLimited,
      BoostFailure.forbidden => l.featuredNotYours,
      BoostFailure.notFound => l.boostErrNotFound,
      BoostFailure.alreadyLinked => l.iapErrAlreadyLinked,
      BoostFailure.inProgress => l.boostErrInProgress,
      BoostFailure.intentForbidden => l.boostErrIntentForbidden,
      BoostFailure.rejected => l.iapErrRejected,
      BoostFailure.creditUsed => l.boostErrCreditUsed,
      BoostFailure.creditRevoked => l.boostErrCreditRevoked,
      BoostFailure.creditNotFound => l.boostErrCreditNotFound,
      BoostFailure.unavailable => l.iapUnavailable,
    };

class _ResultView extends StatelessWidget {
  const _ResultView({required this.result});
  final BoostResult result;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final text = Theme.of(context).textTheme;
    final (icon, title, sub) = switch (result.status) {
      BoostStatus.active => (
          Icons.trending_up_rounded,
          l.boostActiveDone(_days(result)),
          result.endsAt == null ? null : l.boostEndsAt(boostTime(result.endsAt!)),
        ),
      BoostStatus.credited => (
          Icons.savings_outlined,
          l.boostCredited,
          null,
        ),
      _ => (Icons.block_rounded, l.boostRevoked, null),
    };
    return Column(
      key: ValueKey('boost-result-${result.status.name}'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(icon, size: 40, color: t.accent2),
        const SizedBox(height: Gap.md),
        Text(title, textAlign: TextAlign.center, style: text.titleMedium),
        if (sub != null) ...[
          const SizedBox(height: Gap.xs),
          Text(sub,
              textAlign: TextAlign.center,
              style: text.bodyMedium?.copyWith(color: t.text2)),
        ],
        if (result.status == BoostStatus.credited) ...[
          const SizedBox(height: Gap.lg),
          NovaButton(
            key: const ValueKey('boost-open-credits'),
            label: l.boostCreditsOpen,
            tone: ButtonTone.quiet,
            onPressed: () {
              Navigator.of(context).pop();
              GoRouter.of(context).push(Routes.boostCredits);
            },
          ),
        ],
      ],
    );
  }

  static int _days(BoostResult r) {
    if (r.days > 0) return r.days;
    final s = r.startsAt, e = r.endsAt;
    if (s == null || e == null) return 1;
    return (e.difference(s).inHours / 24).round().clamp(1, 365);
  }
}

class _Option extends StatelessWidget {
  const _Option({required this.option, required this.busy, this.onTap});
  final BoostOption option;
  final bool busy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final disabled = onTap == null && !busy;
    return Semantics(
      button: true,
      enabled: onTap != null,
      child: PressableScale(
        onTap: onTap,
        child: AnimatedOpacity(
          duration: Motion.fast,
          opacity: disabled ? .45 : 1,
          child: Container(
            key: ValueKey('boost-option-${option.pkg.days}'),
            padding: const EdgeInsets.all(Gap.lg),
            decoration: BoxDecoration(
              color: t.surfaceSolid,
              borderRadius: R.gentle,
              border: Border.all(color: t.border1),
              boxShadow: t.shadowTiny,
            ),
            child: Row(
              children: [
                Icon(Icons.trending_up_rounded, size: 20, color: t.accent2),
                const SizedBox(width: Gap.md),
                Expanded(
                  child: Text(l.boostDays(option.pkg.days),
                      style: Theme.of(context).textTheme.titleMedium),
                ),
                if (busy)
                  const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                else if (option.product != null)
                  // App Store'ning lokallashtirilgan narxi — o'zgarmasdan.
                  Text(option.product!.price,
                      style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: t.text1,
                      )),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.target, this.size = 56});
  final BoostTarget target;
  final double size;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final url = target.mediaUrl;
    return ClipRRect(
      borderRadius: R.tile,
      child: SizedBox(
        width: size,
        height: size,
        child: url.isEmpty || target.isVideo
            ? ColoredBox(
                color: t.surface2,
                child: Icon(
                    target.isVideo
                        ? Icons.play_arrow_rounded
                        : Icons.article_outlined,
                    color: t.text2),
              )
            : mediaImage(context, url, fit: BoxFit.cover),
      ),
    );
  }
}

// ─────────────────────────────────────────── kreditlar ekrani

/// "Ko'tarish kreditlari" — to'langan, lekin joy band bo'lgani uchun
/// saqlangan ko'tarishlar. Faqat iPhone + `boostEnabled`.
class BoostCreditsScreen extends ConsumerWidget {
  const BoostCreditsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final text = Theme.of(context).textTheme;
    final credits = ref.watch(boostCreditsProvider);
    final s = ref.watch(boostControllerProvider);
    return NovaScaffold(
      title: l.boostCredits,
      showBack: true,
      body: credits.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(child: Text(l.iapErrServer)),
        data: (list) => NovaScroll(
          children: [
            if (list.isEmpty)
              Padding(
                padding: const EdgeInsets.all(Gap.xl),
                child: Text(l.boostCreditsEmpty,
                    key: const ValueKey('boost-credits-empty'),
                    textAlign: TextAlign.center,
                    style: text.bodyMedium),
              ),
            for (final c in list) ...[
              FloatingSurface(
                key: ValueKey('boost-credit-${c.creditId}'),
                solid: true,
                child: Row(
                  children: [
                    Icon(Icons.trending_up_rounded, color: t.accent2),
                    const SizedBox(width: Gap.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(l.boostDays(c.days), style: text.titleMedium),
                          if (c.createdAt != null)
                            Text(boostTime(c.createdAt!),
                                style:
                                    text.bodySmall?.copyWith(color: t.text2)),
                        ],
                      ),
                    ),
                    NovaButton(
                      key: ValueKey('boost-use-${c.creditId}'),
                      label: l.boostUse,
                      expand: false,
                      tone: ButtonTone.outline,
                      busy: s.verifying,
                      onPressed:
                          s.verifying ? null : () => _use(context, ref, c),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: Gap.md),
            ],
            if (s.result == null && s.failure != null) ...[
              const SizedBox(height: Gap.md),
              Text(boostFailureText(l, s.failure!),
                  key: const ValueKey('boost-error'),
                  textAlign: TextAlign.center,
                  style: text.bodyMedium?.copyWith(color: t.error)),
            ],
            if (s.result == null && s.block != null) ...[
              const SizedBox(height: Gap.md),
              Text(boostBlockText(l, s.block!),
                  key: const ValueKey('boost-block'),
                  textAlign: TextAlign.center,
                  style: text.bodyMedium),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _use(BuildContext context, WidgetRef ref, BoostCredit c) async {
    final l = L.of(context);
    final post = await pickOwnPost(context);
    if (post == null || !context.mounted) return;
    final r = await ref
        .read(boostControllerProvider.notifier)
        .redeem(c, BoostTarget.of(post));
    if (r == null || !context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
          content: Text(r.endsAt == null
              ? l.boostActiveDone(c.days)
              : '${l.boostActiveDone(c.days)}. ${l.boostEndsAt(boostTime(r.endsAt!))}')));
  }
}

/// O'z postlarimdan birini tanlash (shaxsiy va kompaniya).
Future<Post?> pickOwnPost(BuildContext context) =>
    showModalBottomSheet<Post>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: context.tokens.surfaceSolid,
      builder: (_) => const _OwnPostPicker(),
    );

class _OwnPostPicker extends ConsumerWidget {
  const _OwnPostPicker();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final text = Theme.of(context).textTheme;
    final codes = ref.watch(personalIdsProvider).map((e) => e.code).toList();
    final companies = ref.watch(myBusinessesProvider).valueOrNull ?? const [];
    final posts = <Post>[
      for (final c in codes)
        ...?ref.watch(profilePostsProvider(c)).valueOrNull,
      for (final b in companies)
        ...?ref.watch(companyPostsProvider(b.companyId)).valueOrNull,
    ].where((p) => !p.isStory && p.id > 0).toList();

    return SafeArea(
      top: false,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .6,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: Text(l.boostPickPost, style: text.titleMedium),
            ),
            const SizedBox(height: Gap.md),
            Expanded(
              child: posts.isEmpty
                  ? Center(child: Text(l.boostPickEmpty, style: text.bodyMedium))
                  : GridView.count(
                      crossAxisCount: 3,
                      mainAxisSpacing: Gap.sm,
                      crossAxisSpacing: Gap.sm,
                      padding: const EdgeInsets.symmetric(
                          horizontal: Gap.screenX),
                      children: [
                        for (final p in posts)
                          PressableScale(
                            key: ValueKey(
                                'boost-pick-${p.isCompany ? 'c' : 'p'}-${p.id}'),
                            onTap: () => Navigator.of(context).pop(p),
                            child: _Thumb(
                                target: BoostTarget.of(p), size: double.infinity),
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
