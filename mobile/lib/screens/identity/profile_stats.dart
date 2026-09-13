import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/widgets.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';

/// SHAXSIY PROFIL STATISTIKASI — `/api/records/:code/analytics`.
///
/// Biznes statistikasi bilan BIR XIL tilda gapiradi (bir xil
/// kartochkalar, bir xil ustunlar): ikkalasi ham "statistika"
/// ekrani va ular boshqa-boshqa ko'rinsa, ilova ikki xil mahsulotdek
/// his qilinardi.
///
/// Bu yerda biznesda yo'q ikkita raqam bor: NOYOB TASHRIFCHI va
/// HODISA TURLARI — chunki `card_events` kim kirganini belgilaydi,
/// `company_stats` esa oldindan yig'ilgan sanoq.
class ProfileStatsScreen extends StatefulWidget {
  const ProfileStatsScreen({super.key, required this.code, this.name = ''});

  final String code;
  final String name;

  @override
  State<ProfileStatsScreen> createState() => _ProfileStatsScreenState();
}

class _ProfileStatsScreenState extends State<ProfileStatsScreen> {
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
      final d = await AppScope.read(context).repo.analytics(widget.code, days: _days);
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

  /// Hodisa turlarini odam tiliga o'girish.
  static const _eventNames = {
    'profile_view': 'Profil ko‘rildi',
    'phone': 'Telefon bosildi',
    'telegram': 'Telegram bosildi',
    'whatsapp': 'WhatsApp bosildi',
    'instagram': 'Instagram bosildi',
    'website': 'Sayt bosildi',
    'vcard': 'Kontakt saqlandi',
    'link': 'Havola bosildi',
    'share': 'Ulashildi',
  };

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: C.obsidian,
        body: SafeArea(
          bottom: false,
          child: Column(
            children: [
              TopBar(
                title: 'Statistika',
                subtitle: widget.name.isEmpty ? widget.code : widget.name,
              ),
              Expanded(
                child: AsyncView<Map<String, dynamic>>(
                  loading: _loading,
                  error: _error,
                  data: _data,
                  onRetry: _load,
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
    final total = (d['totalViews'] as num? ?? 0).round();
    final uniq = (d['uniqueVisitors'] as num? ?? 0).round();
    final byDay = (d['byDay'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => (day: '${e['day']}', n: (e['n'] as num? ?? 0).round()))
        .toList();
    final byType = (d['byType'] as Map? ?? const {});
    final byRef = (d['byRef'] as List? ?? const []).whereType<Map>().toList();

    // Profil ko'rilishi alohida kartochkada — uni ro'yxatda
    // takrorlash ortiqcha.
    final actions = byType.entries
        .where((e) => e.key != 'profile_view' && (e.value as num? ?? 0) > 0)
        .map((e) => (key: '${e.key}', n: (e.value as num).round()))
        .toList()
      ..sort((a, b) => b.n.compareTo(a.n));

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
              Text(compact(total), style: T.displaySm),
              const SizedBox(height: S.x16),
              SizedBox(height: 86, child: _Bars(series: byDay)),
              if (byDay.isNotEmpty) ...[
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(byDay.first.day, style: T.eyebrow),
                    Text(byDay.last.day, style: T.eyebrow),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: S.x12),
        Surface(
          shadow: E.e1,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Eyebrow('Noyob tashrifchi'),
              const SizedBox(height: 6),
              Text(compact(uniq), style: T.cardTitle.copyWith(fontSize: 20)),
              const SizedBox(height: 4),
              // Farqni ochiq yozamiz: aks holda ikkita raqam
              // bir-biriga zid ko'rinadi.
              Text(
                'Bir odam bir necha marta kirsa ham bitta hisoblanadi',
                style: T.caption.copyWith(fontSize: 11, color: C.muted),
              ),
            ],
          ),
        ),
        if (actions.isNotEmpty) ...[
          const SizedBox(height: S.x24),
          const Eyebrow('Nimalar bosildi'),
          const SizedBox(height: S.x12),
          for (final a in actions.take(8)) ...[
            _Bar(
              label: _eventNames[a.key] ?? a.key,
              value: a.n,
              max: actions.first.n,
            ),
            const SizedBox(height: S.x8),
          ],
        ],
        if (byRef.isNotEmpty) ...[
          const SizedBox(height: S.x24),
          const Eyebrow('Manbalar'),
          const SizedBox(height: S.x12),
          for (final r in byRef.take(6)) ...[
            _Bar(
              label: '${r['ref']}',
              value: (r['n'] as num? ?? 0).round(),
              max: (byRef.first['n'] as num? ?? 1).round(),
            ),
            const SizedBox(height: S.x8),
          ],
        ],
        if (total == 0 && uniq == 0)
          const EmptyState('Bu davrda hali ma‘lumot to‘planmagan.'),
      ],
    );
  }
}

/// Kunlik ustunlar — biznes statistikasidagi bilan bir xil ko'rinish.
class _Bars extends StatelessWidget {
  const _Bars({required this.series});
  final List<({String day, int n})> series;

  @override
  Widget build(BuildContext context) {
    if (series.isEmpty) return const SizedBox.shrink();
    final max = series.map((e) => e.n).fold<int>(1, (a, b) => b > a ? b : a);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (var i = 0; i < series.length; i++) ...[
          if (i > 0) const SizedBox(width: 2),
          Expanded(
            child: FractionallySizedBox(
              heightFactor: (series[i].n / max).clamp(0.02, 1.0),
              alignment: Alignment.bottomCenter,
              child: Container(
                decoration: BoxDecoration(
                  color: series[i].n == 0 ? C.hairline : C.champagne,
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
            width: 128,
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
          SizedBox(width: 38, child: Text(compact(value), textAlign: TextAlign.right, style: T.meta)),
        ],
      );
}
