import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/icons.dart';
import '../../design/components/sheet.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/dates.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';

/// TO'LOVLAR TARIXI.
///
/// NIMA UCHUN «BUYURTMALARIM» DAN ALOHIDA: «Buyurtmalarim» —
/// TUGALLANMAGAN ishlar ro'yxati, u yerdan to'lovni davom ettirasiz.
/// Bu esa MOLIYAVIY tarix: nima uchun, qachon va qancha to'langani.
///
/// HOLAT FAQAT SERVERDAN. Provayder ilovasidan qaytishning o'zi
/// hech narsani bildirmaydi va bu ekran hech qachon o'zi
/// "to'landi" deb yozmaydi.
///
/// Qator bosilsa — kvitansiya varag'i: raqam, sana, summa, holat.
class PaymentsHistoryScreen extends StatefulWidget {
  const PaymentsHistoryScreen({super.key});

  @override
  State<PaymentsHistoryScreen> createState() => _PaymentsHistoryScreenState();
}

class _PaymentsHistoryScreenState extends State<PaymentsHistoryScreen> {
  List<PaymentEntry>? _items;
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await AppScope.read(context).repo.payments();
      if (!mounted) return;
      setState(() {
        _items = res.items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.none,
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              const TopBar(),
              ScreenTitle(tr('To‘lovlar tarixi')),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _load,
                  color: C.accent,
                  backgroundColor: C.surface,
                  displacement: 28,
                  child: AsyncView<List<PaymentEntry>>(
                    loading: _loading,
                    error: _error,
                    data: _items,
                    onRetry: _load,
                    isEmpty: (d) => d.isEmpty,
                    emptyIcon: Ico.card,
                    emptyMessage: tr('To‘lovlaringiz shu yerda saqlanadi.'),
                    skeleton: ListView(
                      padding:
                          const EdgeInsets.symmetric(horizontal: S.gutter),
                      children: const [
                        SkeletonCard(aspect: 5),
                        SizedBox(height: S.x8),
                        SkeletonCard(aspect: 5),
                        SizedBox(height: S.x8),
                        SkeletonCard(aspect: 5),
                      ],
                    ),
                    builder: (data) => ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(
                        S.gutter,
                        0,
                        S.gutter,
                        S.x32,
                      ),
                      itemCount: data.length + 1,
                      separatorBuilder: (_, __) => const SizedBox(height: S.x8),
                      itemBuilder: (_, i) => i == data.length
                          ? Padding(
                              padding: const EdgeInsets.only(top: S.x12),
                              child: Text(
                                tr('Holat faqat server javobidan olinadi. '
                                    'Provayder ilovasidan qaytish o‘zi '
                                    'to‘lov tasdig‘i emas.'),
                                style: T.caption.copyWith(color: C.ink3),
                              ),
                            )
                          : _PaymentRow(
                              entry: data[i],
                              onTap: () => _receipt(data[i]),
                            ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );

  /// KVITANSIYA — bir joyda hamma tafsilot.
  ///
  /// Ro'yxatda hammasini ko'rsatib bo'lmaydi (qator juda uzun
  /// bo'lardi), lekin odamga kerak bo'lganda ular shart: bank
  /// bilan gaplashganda buyurtma raqami so'raladi.
  void _receipt(PaymentEntry e) {
    showSheet<void>(
      context,
      title: _kindLabel(e.kind),
      subtitle: '#${e.id}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(tr('Holat'), style: T.caption)),
              StatusChip(_statusLabel(e.status), tone: _statusTone(e.status)),
            ],
          ),
          const SizedBox(height: S.x16),
          if (e.code.isNotEmpty) _Line(tr('ID kodi'), e.code),
          _Line(tr('Summa'), som(e.price)),
          if (e.createdAt.isNotEmpty) _Line(tr('Sana'), _when(e.createdAt)),
          _Line(tr('To‘lov tizimi'), _providerLabel(e)),
          _Line(tr('Buyurtma raqami'), '#${e.id}'),
          const SizedBox(height: S.x8),
          Text(
            tr('Holat faqat server javobidan olinadi. '
                'Provayder ilovasidan qaytish o‘zi '
                'to‘lov tasdig‘i emas.'),
            style: T.caption.copyWith(color: C.ink3),
          ),
        ],
      ),
    );
  }
}

/// Sana — `YYYY-MM-DD HH:MM` shaklidan `DD.MM.YYYY · HH:MM` ga.
///
/// Server vaqtni turli formatda qaytarishi mumkin, shuning uchun
/// tahlil qilib bo'lmasa XOM HOLDA ko'rsatiladi: bo'sh joy
/// qoldirgandan ko'ra shu ma'qul.
String _when(String raw) {
  final d = DateTime.tryParse(raw.replaceFirst(' ', 'T'));
  return d == null ? raw : dateTime(d);
}

String _kindLabel(String kind) => switch (kind) {
      'physical_card_order' => tr('Jismoniy karta'),
      'premium_upgrade' => tr('Premium obuna'),
      'card_purchase' || 'record_purchase' => tr('NFC ID'),
      'company_purchase' => tr('Company ID'),
      _ => tr('Buyurtma'),
    };

String _statusLabel(String status) => switch (status) {
      'paid' => tr('Tasdiqlandi'),
      'pending' => tr('Kutilmoqda'),
      'cancelled' || 'failed' => tr('Bekor qilindi'),
      _ => status,
    };

StatusTone _statusTone(String status) => switch (status) {
      'paid' => StatusTone.ok,
      'pending' => StatusTone.pending,
      'cancelled' || 'failed' => StatusTone.fail,
      _ => StatusTone.neutral,
    };

/// TO'LOV TIZIMI.
///
/// DIQQAT: `GET /api/payments` javobida provayder maydoni YO'Q
/// (`PaymentEntry` da ham). Ilovadan ochiladigan to'lov havolasini
/// server Payme uchun quradi, shuning uchun qator PAYME deb
/// belgilanadi. Server provayderni qaytara boshlasa, shu yagona
/// funksiya o'zgaradi — qolgan kod tegilmaydi.
String _provider(PaymentEntry e) => 'payme';

String _providerLabel(PaymentEntry e) => switch (_provider(e)) {
      'click' => 'CLICK',
      _ => 'PAYME',
    };

/// PROVAYDER BELGISI — brend ranglari MAVZUGA BOG'LIQ EMAS.
class _ProviderBadge extends StatelessWidget {
  const _ProviderBadge(this.provider);
  final String provider;

  Color get _color => provider == 'click' ? C.click : C.payme;
  String get _label => provider == 'click' ? 'CLICK' : 'PAYME';

  @override
  Widget build(BuildContext context) => Container(
        width: 46,
        height: 46,
        decoration: BoxDecoration(
          color: _color.withValues(alpha: .12),
          borderRadius: BorderRadius.circular(R.tile),
          border: Border.all(color: _color.withValues(alpha: .38)),
        ),
        alignment: Alignment.center,
        child: Text(
          _label,
          style: T.meta.copyWith(fontSize: 8.5, color: _color),
        ),
      );
}

class _PaymentRow extends StatelessWidget {
  const _PaymentRow({required this.entry, required this.onTap});
  final PaymentEntry entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Surface(
        onTap: onTap,
        padding: const EdgeInsets.all(S.x12),
        shadow: C.e1,
        child: Row(
          children: [
            _ProviderBadge(_provider(entry)),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _kindLabel(entry.kind),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.cardTitle,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    [
                      if (entry.code.isNotEmpty) entry.code,
                      if (entry.createdAt.isNotEmpty) _when(entry.createdAt),
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.meta,
                  ),
                ],
              ),
            ),
            const SizedBox(width: S.x12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(som(entry.price), style: T.amount),
                const SizedBox(height: 6),
                StatusChip(
                  _statusLabel(entry.status),
                  tone: _statusTone(entry.status),
                ),
              ],
            ),
          ],
        ),
      );
}

/// Kvitansiyadagi bitta satr.
class _Line extends StatelessWidget {
  const _Line(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: S.x12),
        child: Row(
          children: [
            Expanded(child: Text(label, style: T.caption)),
            const SizedBox(width: S.x12),
            Text(value, style: T.amount.copyWith(color: C.ink)),
          ],
        ),
      );
}
