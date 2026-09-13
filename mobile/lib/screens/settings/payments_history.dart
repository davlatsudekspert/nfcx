import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';

/// TO'LOVLAR TARIXI.
///
/// NIMA UCHUN «BUYURTMALARIM» DAN ALOHIDA: «Buyurtmalarim» —
/// TUGALLANMAGAN ishlar ro'yxati, u yerdan to'lovni davom ettirasiz.
/// Bu esa MOLIYAVIY tarix: nima uchun, qachon va qancha to'langani.
/// Ikkalasini aralashtirsak, tugallangan to'lovlar tugallanmaganlar
/// orasida ko'milib qolardi.
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
  Widget build(BuildContext context) => ColoredBox(
        color: C.obsidian,
        child: SafeArea(
          child: Column(
            children: [
              TopBar(title: tr('To‘lovlar')),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _load,
                  color: C.champagne,
                  backgroundColor: C.slate,
                  child: AsyncView<List<PaymentEntry>>(
                    loading: _loading,
                    error: _error,
                    data: _items,
                    onRetry: _load,
                    isEmpty: (d) => d.isEmpty,
                    emptyMessage: tr('To‘lovlaringiz shu yerda saqlanadi.'),
                    skeleton: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: S.gutter),
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
                          S.gutter, 0, S.gutter, S.x32),
                      itemCount: data.length,
                      separatorBuilder: (_, __) => const SizedBox(height: S.x8),
                      itemBuilder: (_, i) => _Row(
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
      child: Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, 0),
        child: Column(
          children: [
            _Line(tr('Holat'), _statusLabel(e.status), color: _statusColor(e.status)),
            if (e.code.isNotEmpty) _Line(tr('ID kodi'), e.code),
            _Line(tr('Summa'), som(e.price)),
            if (e.createdAt.isNotEmpty) _Line(tr('Sana'), _date(e.createdAt)),
            _Line(tr('Buyurtma raqami'), '#${e.id}'),
          ],
        ),
      ),
    );
  }
}

/// Sana — `YYYY-MM-DD HH:MM` shaklidan `DD.MM.YYYY` ga.
///
/// Server vaqtni turli formatda qaytarishi mumkin, shuning uchun
/// tahlil qilib bo'lmasa XOM HOLDA ko'rsatiladi: bo'sh joy
/// qoldirgandan ko'ra shu ma'qul.
String _date(String raw) {
  final d = DateTime.tryParse(raw.replaceFirst(' ', 'T'));
  if (d == null) return raw;
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(d.day)}.${two(d.month)}.${d.year}';
}

String _kindLabel(String kind) => switch (kind) {
      'physical_card_order' => tr('Jismoniy karta'),
      'premium_upgrade' => tr('Premium obuna'),
      'card_purchase' || 'record_purchase' => tr('NFC ID'),
      'company_purchase' => tr('Company ID'),
      _ => tr('Buyurtma'),
    };

String _statusLabel(String status) => switch (status) {
      'paid' => tr('To‘langan'),
      'pending' => tr('Kutilmoqda'),
      'cancelled' => tr('Bekor qilingan'),
      'failed' => tr('Amalga oshmadi'),
      _ => status,
    };

Color _statusColor(String status) => switch (status) {
      'paid' => C.verdant,
      'pending' => C.champagne,
      'cancelled' || 'failed' => C.signal,
      _ => C.ash,
    };

class _Row extends StatelessWidget {
  const _Row({required this.entry, required this.onTap});
  final PaymentEntry entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onTap,
        child: Surface(
          padding: const EdgeInsets.all(S.x16),
          shadow: E.e1,
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_kindLabel(entry.kind),
                        style: T.cardTitle.copyWith(fontSize: 13.5)),
                    const SizedBox(height: 3),
                    Text(
                      [
                        if (entry.code.isNotEmpty) entry.code,
                        if (entry.createdAt.isNotEmpty) _date(entry.createdAt),
                      ].join(' · '),
                      style: T.caption.copyWith(fontSize: 11.5),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: S.x12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(som(entry.price), style: T.price.copyWith(fontSize: 13)),
                  const SizedBox(height: 4),
                  Text(
                    _statusLabel(entry.status),
                    style: T.statusLabel.copyWith(color: _statusColor(entry.status)),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
}

class _Line extends StatelessWidget {
  const _Line(this.label, this.value, {this.color});
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: S.x12),
        child: Row(
          children: [
            Expanded(child: Text(label, style: T.caption)),
            Text(
              value,
              style: T.cardTitle.copyWith(fontSize: 13, color: color ?? C.offWhite),
            ),
          ],
        ),
      );
}
