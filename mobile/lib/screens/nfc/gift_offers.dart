import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';

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
      }
      await _load();
    } on ApiError catch (e) {
      errorHaptic();
      if (mounted) {
        setState(() => _error = e.key == 'OWNERSHIP_CHANGED'
            ? 'Bu ID allaqachon boshqa egaga o‘tgan.'
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

    return SafeArea(
      child: Column(
        children: [
          const TopBar(title: 'Sovg‘a takliflari'),
          Expanded(
            child: incoming == null && _error != null
                ? ErrorState(humanError(_error!), onRetry: _load)
                : incoming == null
                    ? const Center(child: Spinner(size: 22))
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(
                            S.gutter, 0, S.gutter, S.x32),
                        children: [
                          if (_error != null) ...[
                            _Banner(_error is String
                                ? _error! as String
                                : humanError(_error!)),
                            const SizedBox(height: S.x16),
                          ],
                          if (incoming.isEmpty && _outgoing.isEmpty)
                            const EmptyState(
                              'Hozircha sovg‘a taklifi yo‘q.\n'
                              'Kimdir sizga ID sovg‘a qilsa, u shu yerda '
                              'tasdiqlashni kutib turadi.',
                            ),
                          if (incoming.isNotEmpty) ...[
                            const Eyebrow('Sizga sovg‘a qilinyapti'),
                            const SizedBox(height: S.x8),
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
                            const SizedBox(height: S.x16),
                            const Eyebrow('Siz yuborgan'),
                            const SizedBox(height: S.x8),
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
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x12),
        border: C.signal.withValues(alpha: .35),
        child: Text(text, style: T.caption.copyWith(color: C.signal)),
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

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x16),
        shadow: E.e1,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const NIcon(Ico.gift, size: 20, color: C.champagne),
                const SizedBox(width: S.x12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(offer.code, style: T.code.copyWith(fontSize: 15)),
                      const SizedBox(height: 3),
                      Text(
                        offer.email.isEmpty
                            ? (offer.incoming ? 'Sizga' : 'Yuborilgan')
                            : (offer.incoming
                                ? '${offer.email} yubordi'
                                : '${offer.email} uchun'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.caption.copyWith(fontSize: 11.5),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: S.x16),
            if (offer.incoming)
              Row(
                children: [
                  Expanded(
                    child: PrimaryButton('Qabul qilish',
                        loading: busy, onTap: busy ? null : onAccept),
                  ),
                  const SizedBox(width: S.x8),
                  Expanded(
                    child: GhostButton('Rad etish',
                        onTap: busy ? null : onReject),
                  ),
                ],
              )
            else
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Tasdiqlash kutilmoqda.',
                      style: T.caption.copyWith(fontSize: 11.5),
                    ),
                  ),
                  SizedBox(
                    width: 150,
                    child: GhostButton('Qaytarib olish',
                        onTap: busy ? null : onCancel),
                  ),
                ],
              ),
          ],
        ),
      );
}
