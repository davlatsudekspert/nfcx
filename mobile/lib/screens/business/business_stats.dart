import 'package:flutter/widgets.dart';

import '../../design/components/backdrop.dart';
import '../../design/components/icons.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';

/// BIZNES STATISTIKASI — ko'rishlar, amallar, buyurtmalar, top mahsulot.
///
/// Grafik uchun kutubxona ISHLATILMAYDI: bu yerda kerak bo'lgani —
/// bitta kunlik ustunli qator. Recharts/fl_chart kabi paket ilova
/// hajmini va ishga tushish vaqtini oshiradi, holbuki chizma yetti
/// to'rtburchakdan iborat.
///
/// HAMMA RAQAM SERVERDAN: ilova hech narsani o'zidan qo'shmaydi.
/// Yagona hisoblanadigan narsa — oxirgi yetti kunning oldingi yetti
/// kunga nisbati (`delta`), u ham o'sha qatordan chiqadi.
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
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.none,
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              const TopBar(),
              ScreenTitle(
                tr('Statistika'),
                eyebrow: widget.companyId,
                subtitle: tr('Kunlik grafik va manbalar.'),
              ),
              Expanded(
                child: AsyncView<Map<String, dynamic>>(
                  loading: _loading,
                  error: _error,
                  data: _data,
                  onRetry: _load,
                  // SKELETON AYLANADIGAN bo'lishi kerak: kichik ekranda
                  // (yoki katta tizim shrifti bilan) qat'iy `Column`
                  // chetidan chiqib ketadi — test aynan shuni ushladi.
                  skeleton: ListView(
                    padding: const EdgeInsets.all(S.gutter),
                    children: const [
                      SkeletonCard(aspect: 4.2),
                      SizedBox(height: S.x12),
                      SkeletonCard(aspect: 2.4),
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

    // OXIRGI YETTI KUN — grafik shuncha ustundan iborat.
    final week = series.length > 7 ? series.sublist(series.length - 7) : series;

    return ListView(
      padding: EdgeInsets.fromLTRB(
        S.gutter,
        0,
        S.gutter,
        MediaQuery.paddingOf(context).bottom + S.x32,
      ),
      children: [
        StatRow(
          tiles: [
            StatTile(
              value: compact(views),
              label: tr('Ko‘rishlar'),
              accent: true,
            ),
            StatTile(value: compact(taps), label: tr('Amallar')),
            StatTile(value: compact(orders), label: tr('Buyurtmalar')),
          ],
        ),
        if (week.isNotEmpty) ...[
          const SizedBox(height: S.x16),
          _Week(week: week, delta: _delta(series)),
        ],
        if (items.isNotEmpty) ...[
          const SizedBox(height: S.x24),
          SectionHeader(tr('Eng ko‘p ko‘rilgan')),
          const SizedBox(height: S.x12),
          RowGroup(
            children: [
              for (final it in items.take(5))
                ListRow(
                  title: '${it['name']}'.isEmpty
                      ? '${it['id']}'
                      : '${it['name']}',
                  chevron: false,
                  trailing: Text(
                    '${(it['hits'] as num? ?? 0).round()}',
                    style: T.amount,
                  ),
                ),
            ],
          ),
        ],
        if (actions.isNotEmpty) ...[
          const SizedBox(height: S.x24),
          SectionHeader(tr('Eng ko‘p bosilgan')),
          const SizedBox(height: S.x12),
          RowGroup(
            children: [
              for (final a in actions.take(5))
                ListRow(
                  title: _actionLabel('${a['key']}'),
                  chevron: false,
                  trailing: Text(
                    '${(a['hits'] as num? ?? 0).round()}',
                    style: T.amount,
                  ),
                ),
            ],
          ),
        ],
        if (views == 0 && taps == 0 && orders == 0)
          EmptyState(
            tr('Profil ochilishi, tegishlar va buyurtmalar shu yerda ') +
                tr('to‘planadi.'),
            title: tr('Ma‘lumot to‘planmagan'),
            icon: Ico.chart,
          ),
      ],
    );
  }

  /// Amal kaliti serverniki (`phone`, `telegram`). Tanish kalitlar
  /// odam tiliga o'giriladi, notanishi o'z holicha qoladi —
  /// o'ylab topilgan nom statistikani yolg'on qilardi.
  static String _actionLabel(String key) => switch (key) {
        'phone' => tr('Telefon'),
        'telegram' => 'Telegram',
        'instagram' => 'Instagram',
        'whatsapp' => 'WhatsApp',
        'website' || 'site' => tr('Veb-sayt'),
        'share' => tr('Ulashish'),
        _ => key,
      };

  /// O'ZGARISH — oxirgi yetti kun oldingi yetti kunga nisbatan.
  ///
  /// `null` — solishtirish uchun ma'lumot yetarli emas yoki oldingi
  /// hafta nol bo'lgan (nolga bo'lish "cheksiz o'sish" bo'lardi).
  static int? _delta(List<({String day, int views})> series) {
    if (series.length < 14) return null;
    var last = 0;
    var prev = 0;
    for (var i = series.length - 7; i < series.length; i++) {
      last += series[i].views;
    }
    for (var i = series.length - 14; i < series.length - 7; i++) {
      prev += series[i].views;
    }
    if (prev == 0) return null;
    return (((last - prev) / prev) * 100).round();
  }
}

/// YETTI KUNLIK USTUNLAR.
///
/// Eng baland ustun to'liq yorug'likda, qolganlari xiraroq — ko'z
/// eng yaxshi kunni darrov topadi. Pastda nozik asos chizig'i va
/// mono kun raqamlari.
class _Week extends StatelessWidget {
  const _Week({required this.week, required this.delta});

  final List<({String day, int views})> week;
  final int? delta;

  /// `2026-09-01` → `01`. Server sanani shu ko'rinishda beradi;
  /// tanib bo'lmasa qiymat o'z holicha qoladi.
  static String _label(String day) {
    final parts = day.split('-');
    return parts.length == 3 ? parts[2] : day;
  }

  @override
  Widget build(BuildContext context) {
    final max = week.map((e) => e.views).fold<int>(1, (a, b) => b > a ? b : a);
    final d = delta;

    return Surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            tr('Profil ko‘rishlari'),
            trailing: d == null
                ? null
                : StatusChip(
                    d >= 0 ? '+$d%' : '$d%',
                    tone: d >= 0 ? StatusTone.ok : StatusTone.fail,
                  ),
          ),
          const SizedBox(height: S.x16),
          SizedBox(
            height: 96,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < week.length; i++) ...[
                  if (i > 0) const SizedBox(width: S.x8),
                  Expanded(
                    child: _Bar(
                      value: week[i].views,
                      max: max,
                      best: week[i].views == max && max > 0,
                    ),
                  ),
                ],
              ],
            ),
          ),
          // ASOS CHIZIG'I — ustunlar "havoda osilib" turmasin.
          const SizedBox(height: 6),
          Container(height: 1, color: C.line),
          const SizedBox(height: 6),
          Row(
            children: [
              for (var i = 0; i < week.length; i++) ...[
                if (i > 0) const SizedBox(width: S.x8),
                Expanded(
                  child: Text(
                    _label(week[i].day),
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.meta,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.value, required this.max, required this.best});

  final int value;
  final int max;
  final bool best;

  @override
  Widget build(BuildContext context) {
    final bar = FractionallySizedBox(
      // Noldagi kun ham ko'rinib tursin: yo'q ustun "ma'lumot yo'q"
      // bilan adashtirardi.
      heightFactor: (value / (max == 0 ? 1 : max)).clamp(0.03, 1.0),
      alignment: Alignment.bottomCenter,
      child: Container(
        decoration: BoxDecoration(
          gradient: C.actionFace,
          borderRadius: BorderRadius.circular(R.status),
        ),
      ),
    );

    return SizedBox.expand(
      child: best ? bar : Opacity(opacity: .45, child: bar),
    );
  }
}
