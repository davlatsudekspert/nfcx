import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/utils/external_link.dart' show copyToClipboard;
import '../../core/utils/sharing.dart' show shareWithFeedback;
import '../../data/models/models.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../profile/profile_repository.dart';
import '../shop/store_policy.dart' show kShowSiteNotice, showDigitalSiteHints;

/// `GET /api/referrals/summary`.
final referralSummaryProvider =
    FutureProvider.autoDispose<ReferralSummary>((ref) async {
  final res = await ref.watch(profileRepositoryProvider).referralSummary();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Ulashiladigan matn — havola bilan.
String inviteShareText(L l, String link) => l.inviteShareText(link);

/// "DO'STLARNI TAKLIF QILISH" — iPhone va Android.
///
/// Shaxsiy havola (`https://nfcstore.uz/i/<kod>`), nusxa olish va
/// ulashish, natija ("N do'st · +M oy Premium") va qanday ishlashi.
///
/// Chegirma yoki narx HAQIDA HECH NARSA YO'Q — iPhone'da (Apple 3.1.1)
/// ham, Android'da ham (Google Play to'lov qoidasi, 2026-10-08):
/// saytdagi 10% chegirma — ilovadan tashqaridagi xaridga undov. U faqat
/// `showDigitalSiteHints` va `kShowSiteNotice` yoqilganda tilga olinadi.
class InviteScreen extends ConsumerWidget {
  const InviteScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final summary = ref.watch(referralSummaryProvider);

    return NovaScaffold(
      title: l.inviteTitle,
      showBack: true,
      body: summary.when(
        loading: () => const SkeletonList(count: 3, height: 120),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(referralSummaryProvider)),
        data: (s) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(referralSummaryProvider),
          child: _InviteBody(s: s),
        ),
      ),
    );
  }
}

class _InviteBody extends StatelessWidget {
  const _InviteBody({required this.s});
  final ReferralSummary s;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final text = Theme.of(context).textTheme;
    final siteDiscount = showDigitalSiteHints && kShowSiteNotice;

    return NovaScroll(
      children: [
        // HAVOLA KARTASI.
        Container(
          key: const ValueKey('invite-card'),
          padding: const EdgeInsets.all(Gap.xl),
          decoration: BoxDecoration(
            gradient: t.accentGradient,
            borderRadius: R.organic(a: 34, b: 34, c: 34, d: 14),
            boxShadow: t.shadowSoft,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.card_giftcard_rounded, color: t.onAccent, size: 28),
              const SizedBox(height: Gap.md),
              Text(l.inviteHeadline,
                  style: text.titleLarge?.copyWith(color: t.onAccent)),
              const SizedBox(height: Gap.lg),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                    horizontal: Gap.md, vertical: Gap.md),
                decoration: BoxDecoration(
                  color: t.onAccent.withValues(alpha: .12),
                  borderRadius: R.tile,
                ),
                child: SelectableText(
                  s.link,
                  key: const ValueKey('invite-link'),
                  style: AppType.monoStyle(color: t.onAccent, size: 14),
                ),
              ),
              const SizedBox(height: Gap.lg),
              Row(
                children: [
                  Expanded(
                    child: NovaButton(
                      key: const ValueKey('invite-copy'),
                      label: l.inviteCopy,
                      icon: Icons.copy_rounded,
                      tone: ButtonTone.quiet,
                      onPressed: s.link.isEmpty
                          ? null
                          : () async {
                              await copyToClipboard(s.link);
                              if (!context.mounted) return;
                              ScaffoldMessenger.maybeOf(context)
                                ?..hideCurrentSnackBar()
                                ..showSnackBar(
                                    SnackBar(content: Text(l.inviteCopied)));
                            },
                    ),
                  ),
                  const SizedBox(width: Gap.md),
                  Expanded(
                    child: NovaButton(
                      key: const ValueKey('invite-share'),
                      label: l.actionShare,
                      icon: Icons.ios_share_rounded,
                      tone: ButtonTone.quiet,
                      onPressed: s.link.isEmpty
                          ? null
                          : () => shareWithFeedback(
                                context,
                                inviteShareText(l, s.link),
                                subject: l.inviteTitle,
                                copiedMessage: l.inviteCopied,
                              ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: Gap.lg),
        // NATIJA.
        FloatingSurface(
          key: const ValueKey('invite-stats'),
          solid: true,
          child: Row(
            children: [
              Icon(Icons.group_add_rounded, color: t.accent2),
              const SizedBox(width: Gap.md),
              Expanded(
                child: Text(
                  l.inviteStats(s.invited, s.rewardedMonths),
                  style: text.titleSmall,
                ),
              ),
            ],
          ),
        ),
        SectionHeader(color: t.text2, title: l.inviteHowTitle),
        FloatingSurface(
          solid: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Step(n: 1, text: l.inviteStep1),
              _Step(n: 2, text: l.inviteStep2),
              _Step(
                n: 3,
                text: siteDiscount
                    ? '${l.inviteStep3} ${l.inviteSiteDiscount}'
                    : l.inviteStep3,
              ),
              const SizedBox(height: Gap.sm),
              Text(l.inviteTrialNote,
                  key: const ValueKey('invite-trial-note'),
                  style: text.bodySmall?.copyWith(color: t.text2)),
            ],
          ),
        ),
      ],
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.n, required this.text});
  final int n;
  final String text;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.only(bottom: Gap.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: t.accent2.withValues(alpha: .16),
              shape: BoxShape.circle,
            ),
            child: Text('$n',
                style: AppType.monoStyle(color: t.text1, size: 12)),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}
