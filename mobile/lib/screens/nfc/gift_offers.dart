import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/toast.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';

/// SOVG'A TAKLIFLARI — qabul qilish, rad etish, qaytarib olish.
///
/// NIMA UCHUN BU EKRAN SHART: `POST /api/records/:code/gift` ID ni
/// darhol o'tkazmaydi, u KUTILAYOTGAN taklif yaratadi. Ilovada
/// qabul qilish yo'li yo'q edi — ya'ni ilovadan yuborilgan sovg'a
/// ilovadagi odamga hech qachon yetib bormasdi. Sovg'a esa
/// mahsulotning sotuv nuqtalaridan biri.
class GiftOffersScreen extends StatefulWidget {
  const GiftOffersScreen({super.key});

  @override
  State<GiftOffersScreen> createState() => _GiftOffersScreenState();
}

class _GiftOffersScreenState extends State<GiftOffersScreen> {
  List<GiftOffer>? _incoming;
  List<GiftOffer> _outgoing = const [];
  Object? _error;

  /// Hozir qaysi taklif ustida amal ketyapti — faqat o'sha qator
  /// bloklanadi, butun ekran emas.
  int? _busy;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final res = await AppScope.read(context).repo.giftOffers();
      if (!mounted) return;
      setState(() {
        _incoming = res.incoming;
        _outgoing = res.outgoing;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  Future<void> _act(GiftOffer offer, String action) async {
    setState(() => _busy = offer.id);
    final state = AppScope.read(context);
    try {
      await state.repo.giftOfferAction(offer.id, action);
      if (action == 'accept') {
        successHaptic();
        // ID endi menga tegishli — egalik ro'yxati yangilanmasa,
        // yangi ID ilovada umuman ko'rinmaydi.
        await state.refreshIdentities();
        if (mounted) {
          showToast(
            context,
            trf('{kod} endi sizniki', {'kod': offer.code}),
          );
        }
      }
      await _load();
    } on ApiError catch (e) {
      errorHaptic();
      if (mounted) {
        setState(() => _error = e.key == 'OWNERSHIP_CHANGED'
            ? tr('Bu ID allaqachon boshqa egaga o‘tgan.')
            : humanError(e));
      }
    } catch (e) {
      errorHaptic();
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final incoming = _incoming;

    return ScreenBackdrop(
      aura: Aura.spotlight,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const TopBar(),
            Expanded(
              child: incoming == null && _error != null
                  ? ErrorState(humanError(_error!), onRetry: _load)
                  : incoming == null
                      ? ListView(
                          padding: const EdgeInsets.symmetric(
                            horizontal: S.gutter,
                          ),
                          children: [
                            ScreenTitle(tr('Sovg‘a takliflari')),
                            const SkeletonCard(aspect: 2.6),
                            const SizedBox(height: S.x12),
                            const SkeletonCard(aspect: 2.6),
                          ],
                        )
                      : _list(incoming),
            ),
          ],
        ),
      ),
    );
  }

  Widget _list(List<GiftOffer> incoming) => ListView(
        padding: const EdgeInsets.only(bottom: S.x32),
        children: [
          ScreenTitle(
            tr('Sovg‘a takliflari'),
            subtitle: tr('ID faqat qabul qilinganda o‘tadi.'),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) ...[
                  _Banner(_error is String
                      ? _error! as String
                      : humanError(_error!)),
                  const SizedBox(height: S.x16),
                ],

                if (incoming.isEmpty && _outgoing.isEmpty)
                  EmptyState(
                    tr('Kimdir sizga ID sovg‘a qilsa, u shu yerda '
                        'tasdiqlashni kutib turadi.'),
                    title: tr('Sovg‘a taklifi yo‘q'),
                    icon: Ico.gift,
                  ),

                if (incoming.isNotEmpty) ...[
                  SectionHeader(
                    tr('Kelgan'),
                    trailing: Text('${incoming.length}', style: T.statValue),
                  ),
                  const SizedBox(height: S.x12),
                  for (final o in incoming) ...[
                    _OfferCard(
                      offer: o,
                      busy: _busy == o.id,
                      onAccept: () => _act(o, 'accept'),
                      onReject: () => _act(o, 'reject'),
                    ),
                    const SizedBox(height: S.x8),
                  ],
                ],

                if (_outgoing.isNotEmpty) ...[
                  const SizedBox(height: S.x24),
                  SectionHeader(
                    tr('Yuborilgan'),
                    trailing: Text('${_outgoing.length}', style: T.statValue),
                  ),
                  const SizedBox(height: S.x12),
                  for (final o in _outgoing) ...[
                    _OfferCard(
                      offer: o,
                      busy: _busy == o.id,
                      onCancel: () => _act(o, 'cancel'),
                    ),
                    const SizedBox(height: S.x8),
                  ],
                ],
              ],
            ),
          ),
        ],
      );
}

class _Banner extends StatelessWidget {
  const _Banner(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x12),
        border: Border.all(color: C.fail.withValues(alpha: .38)),
        shadow: C.e1,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            NIcon(Ico.warning, size: 15, color: C.fail),
            const SizedBox(width: S.x8),
            Expanded(
              child: Text(text, style: T.caption.copyWith(color: C.fail)),
            ),
          ],
        ),
      );
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({
    required this.offer,
    required this.busy,
    this.onAccept,
    this.onReject,
    this.onCancel,
  });

  final GiftOffer offer;
  final bool busy;
  final VoidCallback? onAccept;
  final VoidCallback? onReject;
  final VoidCallback? onCancel;

  /// TAKLIFDA TARIF MAYDONI YO'Q — `/api/gift-offers` faqat kod va
  /// email qaytaradi. Shuning uchun tarif KOD SHAKLIDAN taxmin
  /// qilinadi; bu `Record.tier` dagi zaxira qoidaning o'zi, ya'ni
  /// ikkinchi joyda takrorlanmaydi.
  Tier get _tier => Record(code: offer.code, name: '').tier;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x16),
        shadow: C.e1,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                TierDot(_tier, size: 16),
                const SizedBox(width: S.x12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(offer.code, style: T.code(16.5)),
                      const SizedBox(height: 3),
                      Text(
                        offer.email.isEmpty
                            ? (offer.incoming ? tr('Sizga') : tr('Yuborilgan'))
                            : (offer.incoming
                                ? '${offer.email} yubordi'
                                : '${offer.email} uchun'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.caption.copyWith(fontSize: 13),
                      ),
                    ],
                  ),
                ),
                if (!offer.incoming)
                  StatusChip(tr('Kutilmoqda'), tone: StatusTone.pending),
              ],
            ),
            const SizedBox(height: S.x16),
            if (offer.incoming)
              Row(
                children: [
                  Expanded(
                    child: PrimaryButton(
                      tr('Qabul qilish'),
                      size: BtnSize.m,
                      sweep: false,
                      loading: busy,
                      onTap: busy ? null : onAccept,
                    ),
                  ),
                  const SizedBox(width: S.x8),
                  Expanded(
                    child: SecondaryButton(
                      tr('Rad etish'),
                      size: BtnSize.m,
                      onTap: busy ? null : onReject,
                    ),
                  ),
                ],
              )
            else
              Row(
                children: [
                  Expanded(
                    child: Text(
                      tr('Tasdiqlash kutilmoqda.'),
                      style: T.caption.copyWith(fontSize: 13),
                    ),
                  ),
                  const SizedBox(width: S.x8),
                  GhostButton(
                    tr('Qaytarib olish'),
                    size: BtnSize.s,
                    onTap: busy ? null : onCancel,
                  ),
                ],
              ),
          ],
        ),
      );
}
