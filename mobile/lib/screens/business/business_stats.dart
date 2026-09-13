import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/widgets.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';
import '../../design/components/icons.dart';

/// BIZNES STATISTIKASI — ko'rishlar, amallar, buyurtmalar, top mahsulot.
///
/// Grafik uchun kutubxona ISHLATILMAYDI: bu yerda kerak bo'lgani —
/// bitta kunlik ustunli qator. Recharts/fl_chart kabi paket ilova
/// hajmini va ishga tushish vaqtini oshiradi, holbuki chizma 30 qator
/// to'rtburchakdan iborat.
class BusinessStatsScreen extends StatefulWidget {
  const BusinessStatsScreen({super.key, required this.companyId});
  final String companyId;

  @override
  State<BusinessStatsScreen> createState() => _BusinessStatsScreenState();
}

class _BusinessStatsScreenState extends State<BusinessStatsScreen> {
  Map<String, dynamic>? _data;
  Object? _error;
  bool _loading = true;
  int _days = 30;

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
      final d = await AppScope.read(context).repo.companyStats(widget.companyId);
      if (!mounted) return;
      setState(() {
        _data = d;
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
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: C.obsidian,
        body: SafeArea(
          bottom: false,
          child: Column(
            children: [
              TopBar(title: 'Statistika', subtitle: widget.companyId),
              Expanded(
                child: AsyncView<Map<String, dynamic>>(
                  loading: _loading,
                  error: _error,
                  data: _data,
                  onRetry: _load,
                  // SKELETON AYLANADIGAN bo'lishi kerak: kichik ekranda
                  // (yoki katta tizim shrifti bilan) qat'iy `Column`
                  // chetidan chiqib ketadi — test aynan shuni ushladi.
                  // Haqiqiy tarkib ham `ListView`, ya'ni bu holatda
                  // maket o'zgarmaydi.
                  skeleton: ListView(
                    padding: const EdgeInsets.all(S.gutter),
                    children: const [
                      SkeletonCard(aspect: 2.4),
                      SizedBox(height: S.x12),
                      SkeletonCard(aspect: 3),
                    ],
                  ),
                  builder: _build,
                ),
              ),
            ],
          ),
        ),
      );

  Widget _build(Map<String, dynamic> d) {
    final series = (d['series'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => (day: '${e['day']}', views: (e['views'] as num? ?? 0).round()))
        .toList();
    final items = (d['items'] as List? ?? const []).whereType<Map>().toList();
    final actions = (d['actions'] as List? ?? const []).whereType<Map>().toList();
    final views = (d['views'] as num? ?? 0).round();
    final taps = (d['taps'] as num? ?? 0).round();
    final orders = (d['orders'] as num? ?? 0).round();

    return ListView(
      padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
      children: [
        Row(
          children: [
            for (final v in [7, 30, 90]) ...[
              if (v != 7) const SizedBox(width: 6),
              Chip('$v kun', active: _days == v, onTap: () {
                setState(() => _days = v);
                _load();
              }),
            ],
          ],
        ),
        const SizedBox(height: S.x16),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Eyebrow('Profil ko‘rishlari'),
              const SizedBox(height: 6),
              Text(compact(views), style: T.displaySm),
              const SizedBox(height: S.x16),
              SizedBox(height: 86, child: _Bars(series: series)),
              if (series.isNotEmpty) ...[
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(series.first.day, style: T.eyebrow),
                    Text(series.last.day, style: T.eyebrow),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: S.x12),
        Row(
          children: [
            Expanded(child: _Kpi(label: 'Amallar', value: compact(taps))),
            const SizedBox(width: S.x8),
            Expanded(child: _Kpi(label: 'Buyurtma', value: compact(orders))),
          ],
        ),
        if (actions.isNotEmpty) ...[
          const SizedBox(height: S.x24),
          const Eyebrow('Eng ko‘p bosilgan'),
          const SizedBox(height: S.x12),
          for (final a in actions.take(5)) ...[
            _Bar(
              label: '${a['key']}',
              value: (a['hits'] as num? ?? 0).round(),
              max: (actions.first['hits'] as num? ?? 1).round(),
            ),
            const SizedBox(height: S.x8),
          ],
        ],
        if (items.isNotEmpty) ...[
          const SizedBox(height: S.x24),
          const Eyebrow('Top mahsulotlar'),
          const SizedBox(height: S.x12),
          for (final it in items.take(5)) ...[
            _Bar(
              label: '${it['name']}'.isEmpty ? '${it['id']}' : '${it['name']}',
              value: (it['hits'] as num? ?? 0).round(),
              max: (items.first['hits'] as num? ?? 1).round(),
            ),
            const SizedBox(height: S.x8),
          ],
        ],
        if (views == 0 && taps == 0 && orders == 0)
          const EmptyState(
            'Profil ochilishi, tegishlar va buyurtmalar shu yerda '
            'to‘planadi.',
            title: 'Ma‘lumot to‘planmagan',
            icon: Ico.chart,
          ),
      ],
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Surface(
        shadow: E.e1,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Eyebrow(label),
            const SizedBox(height: 6),
            Text(value, style: T.cardTitle.copyWith(fontSize: 20)),
          ],
        ),
      );
}

/// Kunlik ustunlar. Eng baland ustun 100% — nisbat ko'rinadi, aniq
/// raqam esa yuqoridagi KPI da turadi.
class _Bars extends StatelessWidget {
  const _Bars({required this.series});
  final List<({String day, int views})> series;

  @override
  Widget build(BuildContext context) {
    if (series.isEmpty) return const SizedBox.shrink();
    final max = series.map((e) => e.views).fold<int>(1, (a, b) => b > a ? b : a);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (var i = 0; i < series.length; i++) ...[
          if (i > 0) const SizedBox(width: 2),
          Expanded(
            child: FractionallySizedBox(
              heightFactor: (series[i].views / max).clamp(0.02, 1.0),
              alignment: Alignment.bottomCenter,
              child: Container(
                decoration: BoxDecoration(
                  color: series[i].views == 0 ? C.hairline : C.champagne,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.label, required this.value, required this.max});
  final String label;
  final int value;
  final int max;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          SizedBox(
            width: 120,
            child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.caption),
          ),
          Expanded(
            child: Container(
              height: 8,
              decoration: BoxDecoration(
                color: C.graphite,
                borderRadius: BorderRadius.circular(4),
              ),
              child: FractionallySizedBox(
                widthFactor: (value / (max == 0 ? 1 : max)).clamp(0.02, 1.0),
                alignment: Alignment.centerLeft,
                child: Container(
                  decoration: BoxDecoration(
                    color: C.champagne,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: S.x8),
          SizedBox(width: 34, child: Text('$value', textAlign: TextAlign.right, style: T.meta)),
        ],
      );
}
