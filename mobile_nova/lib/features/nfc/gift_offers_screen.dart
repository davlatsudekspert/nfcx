import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/utils/result.dart';
import '../../data/models/models.dart';
import '../../data/repositories/nfc_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../auth/session.dart';

/// Sovg'a takliflari.
///
/// Backend'da bu oqim TO'LIQ bor edi: `GET /api/gift-offers` va
/// `accept` / `reject` / `cancel`. Ilovada esa faqat YUBORISH ekrani
/// bor edi — ya'ni foydalanuvchi NFC ID sovg'a qila olardi, lekin
/// kelgan sovg'ani ko'ra ham, qabul qila ham olmasdi.
///
/// Repozitoriydagi javob o'quvchisi ham noto'g'ri edi: server
/// `{incoming, outgoing}` qaytaradi, kod esa `offers`/`items`
/// izlardi — ro'yxat har doim bo'sh chiqardi.
final giftOffersProvider = FutureProvider.autoDispose<
    ({List<GiftOffer> incoming, List<GiftOffer> outgoing})>((ref) async {
  final res = await ref.watch(nfcRepositoryProvider).giftOffers();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

class GiftOffersScreen extends ConsumerStatefulWidget {
  const GiftOffersScreen({super.key});

  @override
  ConsumerState<GiftOffersScreen> createState() => _GiftOffersScreenState();
}

class _GiftOffersScreenState extends ConsumerState<GiftOffersScreen> {
  int? _busyId;

  Future<void> _run(
    GiftOffer o,
    Future<Result<void>> Function() call,
  ) async {
    final l = L.of(context);
    setState(() => _busyId = o.id);
    final res = await call();
    if (!mounted) return;
    // Sessiya yangilanguncha shu taklif tugmalari band — ikkinchi
    // bosish ikkinchi so'rov yubormaydi.
    try {
      await res.when(
        ok: (_) async {
          ref.invalidate(giftOffersProvider);
          // Qabul qilinganda yangi ID ro'yxatga qo'shiladi, shuning
          // uchun sessiya qayta o'qiladi.
          await ref.read(sessionProvider.notifier).refresh();
        },
        err: (e) async => ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(describeError(l, e)))),
      );
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final data = ref.watch(giftOffersProvider);

    return NovaScaffold(
      title: l.giftOffers,
      showBack: true,
      body: data.when(
        loading: () => const SkeletonList(count: 3, height: 84),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(giftOffersProvider)),
        data: (d) {
          if (d.incoming.isEmpty && d.outgoing.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(Gap.section),
                child: Text(
                  l.giftNoOffers,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            );
          }
          return NovaScroll(
            children: [
              if (d.incoming.isNotEmpty) ...[
                SectionHeader(title: l.giftIncoming),
                for (final o in d.incoming)
                  _OfferTile(
                    offer: o,
                    busy: _busyId == o.id,
                    primaryLabel: l.giftAccept,
                    secondaryLabel: l.giftReject,
                    onPrimary: () => _run(
                        o, () => ref.read(nfcRepositoryProvider).acceptGift(o.id)),
                    onSecondary: () => _run(
                        o, () => ref.read(nfcRepositoryProvider).rejectGift(o.id)),
                  ),
              ],
              if (d.outgoing.isNotEmpty) ...[
                SectionHeader(title: l.giftOutgoing),
                for (final o in d.outgoing)
                  _OfferTile(
                    offer: o,
                    busy: _busyId == o.id,
                    secondaryLabel: l.giftCancel,
                    onSecondary: () => _run(
                        o, () => ref.read(nfcRepositoryProvider).cancelGift(o.id)),
                  ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _OfferTile extends StatelessWidget {
  const _OfferTile({
    required this.offer,
    required this.busy,
    required this.secondaryLabel,
    required this.onSecondary,
    this.primaryLabel,
    this.onPrimary,
  });

  final GiftOffer offer;
  final bool busy;
  final String? primaryLabel;
  final String secondaryLabel;
  final VoidCallback? onPrimary;
  final VoidCallback onSecondary;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;

    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screenX, 0, Gap.screenX, Gap.md),
      child: FloatingSurface(
        solid: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: t.accent2.withValues(alpha: .18),
                    borderRadius: R.tile,
                  ),
                  child: Icon(Icons.card_giftcard_rounded,
                      size: 20, color: t.accent2),
                ),
                const SizedBox(width: Gap.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        offer.code,
                        style: AppType.monoStyle(
                            color: t.text1, size: 16, letterSpacing: 1.6),
                      ),
                      if (offer.email.isNotEmpty)
                        Text(offer.email,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: Gap.lg),
            Row(
              children: [
                if (primaryLabel != null) ...[
                  Expanded(
                    child: NovaButton(
                      label: primaryLabel!,
                      busy: busy,
                      onPressed: busy ? null : onPrimary,
                    ),
                  ),
                  const SizedBox(width: Gap.sm),
                ],
                Expanded(
                  child: NovaButton(
                    label: secondaryLabel,
                    tone: ButtonTone.quiet,
                    onPressed: busy ? null : onSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
