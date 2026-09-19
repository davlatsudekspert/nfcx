import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/nfc_orb.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../../data/models/models.dart';
import '../auth/session.dart';
import '../home/home_screen.dart';
import '../home/widgets/identity_card.dart';
import 'nfc_service.dart';
import 'qr_sheet.dart';

/// NFC markazi — ilovaning vizual o'zagi.
///
/// Markazda nafas oluvchi orb, atrofida to'rtta spatial amal. Yuqorida
/// qurilmaning HAQIQIY NFC holati: apparati yo'q bo'lsa yoki o'chirilgan
/// bo'lsa buni yashirmaydi.
class NfcCenterScreen extends ConsumerWidget {
  const NfcCenterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final id = ref.watch(activeIdProvider);
    final ids = ref.watch(myIdsProvider);
    final availability = ref.watch(nfcAvailabilityProvider);
    final width = MediaQuery.sizeOf(context).width;

    // Orbit orb'dan kattaroq: amallar uning atrofida joylashadi.
    final orbit = (width * .92).clamp(300.0, 400.0);
    final orb = orbit * .52;

    return NovaScaffold(
      title: l.nfcCenter,
      actions: [
        NovaIconButton(
          icon: Icons.history_rounded,
          tooltip: l.nfcHistory,
          onPressed: () => context.push(Routes.nfcHistory),
        ),
      ],
      body: NovaScroll(
        children: [
          availability.when(
            loading: () => const SizedBox(height: Gap.sm),
            error: (_, __) => const SizedBox(height: Gap.sm),
            data: (a) => _StatusStrip(availability: a),
          ),
          const SizedBox(height: Gap.sm),
          Center(
            child: SizedBox(
              width: orbit,
              height: orbit,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  OrbitActions(
                    size: orbit,
                    actions: [
                      OrbitAction(
                        icon: Icons.badge_rounded,
                        label: l.nfcMyIds,
                        onTap: () => context.push(Routes.nfcIds),
                      ),
                      OrbitAction(
                        icon: Icons.credit_card_rounded,
                        label: l.nfcCards,
                        onTap: () => context.push(Routes.nfcCards),
                      ),
                      OrbitAction(
                        icon: Icons.card_giftcard_rounded,
                        label: l.nfcGift,
                        onTap: id == null
                            ? null
                            : () => context.push(Routes.nfcGift(id.code)),
                      ),
                      OrbitAction(
                        icon: Icons.shield_outlined,
                        label: l.nfcSecurity,
                        onTap: () => context.push(Routes.nfcSecurity),
                      ),
                    ],
                  ),
                  NfcOrb(
                    size: orb,
                    onTap: () => context.push(Routes.nfcScan),
                    child: BrandLogo(size: orb * .36, style: BrandLogoStyle.mark),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: Gap.sm),
          Center(
            child: Column(
              children: [
                Text(l.nfcTapToScan,
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 3),
                Text(l.nfcHoldCard,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          if (id != null) ...[
            const SizedBox(height: Gap.section),
            FloatingSurface(
              onTap: () => context.push(Routes.nfcId(id.code)),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: t.accentGradient,
                      borderRadius: R.tile,
                    ),
                    child: const Icon(Icons.nfc_rounded, size: 21, color: kOnAccent),
                  ),
                  const SizedBox(width: Gap.lg),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.homeActiveId,
                            style: Theme.of(context).textTheme.labelSmall),
                        const SizedBox(height: 2),
                        Text(
                          id.code,
                          style: AppType.monoStyle(
                              color: t.text1, size: 16, letterSpacing: 1.8),
                        ),
                      ],
                    ),
                  ),
                  NovaIconButton(
                    icon: Icons.qr_code_rounded,
                    tooltip: l.nfcShowQr,
                    onPressed: () => showQrSheet(context, id),
                  ),
                ],
              ),
            ),
          ],
          SectionHeader(
            title: l.nfcMyIds,
            action: ids.length > 3 ? l.actionSeeAll : null,
            onAction: () => context.push(Routes.nfcIds),
          ),
          if (ids.isEmpty)
            FloatingSurface(
              solid: true,
              child: Text(l.homeNoIdHint,
                  style: Theme.of(context).textTheme.bodyMedium),
            )
          else
            for (final e in ids.take(3))
              Padding(
                padding: const EdgeInsets.only(bottom: Gap.md),
                child: FloatingSurface(
                  solid: true,
                  padding: const EdgeInsets.all(Gap.lg),
                  onTap: () => context.push(Routes.nfcId(e.code)),
                  child: Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: (e.kind == NfcIdKind.business ? t.accentB : t.accent1)
                              .withValues(alpha: .22),
                          borderRadius: R.tile,
                        ),
                        child: Icon(
                          e.kind == NfcIdKind.business
                              ? Icons.storefront_rounded
                              : Icons.person_rounded,
                          size: 18,
                          color: t.text1,
                        ),
                      ),
                      const SizedBox(width: Gap.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              e.name.isEmpty ? e.code : e.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                            Text(
                              e.code,
                              style: AppType.monoStyle(color: t.text3, size: 11),
                            ),
                          ],
                        ),
                      ),
                      if (e.primary)
                        Capsule(label: l.nfcPrimary, selected: true, dense: true)
                      else if (!e.active)
                        Capsule(label: l.nfcInactive, dense: true),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }
}

/// Qurilmaning NFC holati — yashirilmaydi.
class _StatusStrip extends StatelessWidget {
  const _StatusStrip({required this.availability});
  final NfcAvailability availability;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    final (icon, text, tone) = switch (availability) {
      NfcAvailability.ready => (Icons.check_circle_rounded, l.nfcActive, t.success),
      NfcAvailability.disabled => (Icons.nfc_rounded, l.nfcDisabled, t.warn),
      NfcAvailability.unsupported =>
        (Icons.do_not_disturb_on_outlined, l.nfcUnsupported, t.text3),
      NfcAvailability.unknown => (Icons.hourglass_empty_rounded, l.stateLoading, t.text3),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: Gap.md),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: .11),
        borderRadius: R.pill,
        border: Border.all(color: tone.withValues(alpha: .3)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: tone),
          const SizedBox(width: Gap.sm),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontFamily: 'Manrope',
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: t.text1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
