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

/// SHAXSIY PROFIL STATISTIKASI — `/api/records/:code/analytics`.
///
/// Biznes statistikasi bilan BIR XIL tilda gapiradi (bir xil
/// kartochkalar, bir xil ustunlar): ikkalasi ham "statistika"
/// ekrani va ular boshqa-boshqa ko'rinsa, ilova ikki xil mahsulotdek
/// his qilinardi.
///
/// JAVOB IKKI SHAKLDA KELADI. Oddiy javobda faqat `totalViews`
/// bo'lishi mumkin; kengaytirilganida `uniqueVisitors`, `byDay`,
/// `byType` va `byRef` ham bo'ladi. Shuning uchun har maydon
/// ALOHIDA tekshiriladi va yo'q bo'lsa o'sha bo'lim chizilmaydi —
/// bitta yo'q maydon butun ekranni yiqitmaydi.
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
  ///
  /// GETTER, `static final` EMAS: tarjima qilingan jadval bir marta
  /// qurilsa, til almashganda muzlab qolardi.
  Map<String, String> get _eventNames => {
        'profile_view': tr('Profil ko‘rildi'),
        'phone': tr('Telefon bosildi'),
        'telegram': tr('Telegram bosildi'),
        'whatsapp': tr('WhatsApp bosildi'),
        'instagram': tr('Instagram bosildi'),
        'website': tr('Sayt bosildi'),
        'vcard': tr('Kontakt saqlandi'),
        'link': tr('Havola bosildi'),
        'share': tr('Ulashildi'),
      };

  @override
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.none,
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              const TopBar(),
              Expanded(
                child: AsyncView<Map<String, dynamic>>(
                  loading: _loading,
                  error: _error,
                  data: _data,
                  onRetry: _load,
                  skeleton: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    children: [
                      ScreenTitle(tr('Statistika')),
                      const SkeletonCard(aspect: 3.4),
                      const SizedBox(height: S.x12),
                      const SkeletonCard(aspect: 2.2),
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

    final actionTotal = actions.fold<int>(0, (a, e) => a + e.n);
    final delta = _delta(byDay);
    final names = _eventNames;

    return ListView(
      padding: const EdgeInsets.only(bottom: S.x32),
      children: [
        ScreenTitle(
          tr('Statistika'),
          subtitle: widget.name.isEmpty ? widget.code : widget.name,
        ),

        Padding(
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── DAVR ──────────────────────────────────────────
              Row(
                children: [
                  for (final v in [7, 30, 90]) ...[
                    if (v != 7) const SizedBox(width: S.x8),
                    FilterChip(
                      trf('{son} kun', {'son': '$v'}),
                      active: _days == v,
                      onTap: () {
                        setState(() => _days = v);
                        _load();
                      },
                    ),
                  ],
                ],
              ),
              const SizedBox(height: S.x20),

              // ── UCHTA RAQAM ───────────────────────────────────
              StatRow(
                tiles: [
                  StatTile(
                    value: compact(total),
                    label: tr('Ko‘rish'),
                    accent: true,
                  ),
                  StatTile(value: compact(uniq), label: tr('Noyob')),
                  StatTile(value: compact(actionTotal), label: tr('Amal')),
                ],
              ),
              const SizedBox(height: S.x12),

              // ── KUNLIK GRAFIK ────────────────────────────────
              if (byDay.isNotEmpty)
                Surface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(child: Eyebrow(tr('Kunlik ko‘rish'))),
                          if (delta != null)
                            StatusChip(delta.label, tone: delta.tone),
                        ],
                      ),
                      const SizedBox(height: S.x16),
                      SizedBox(height: 92, child: _Bars(series: byDay)),
                      // HAIRLINE — ustunlar qayerdan o'sayotgani
                      // ko'rinib tursin.
                      Container(height: 1, color: C.line),
                      const SizedBox(height: 7),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(byDay.first.day, style: T.meta),
                          Text(byDay.last.day, style: T.meta),
                        ],
                      ),
                    ],
                  ),
                ),

              if (byDay.isNotEmpty) const SizedBox(height: S.x12),

              // Farqni ochiq yozamiz: aks holda ikkita raqam
              // bir-biriga zid ko'rinadi.
              Surface(
                padding: const EdgeInsets.symmetric(
                  horizontal: S.x16,
                  vertical: S.x12,
                ),
                shadow: C.e1,
                child: Text(
                  tr('Bir odam bir necha marta kirsa ham bitta hisoblanadi'),
                  style: T.caption.copyWith(fontSize: 12.5, color: C.ink3),
                ),
              ),

              // ── NIMALAR BOSILDI ──────────────────────────────
              if (actions.isNotEmpty) ...[
                const SizedBox(height: S.x32),
                Eyebrow(tr('Nimalar bosildi')),
                const SizedBox(height: S.x12),
                for (final a in actions.take(8)) ...[
                  _Bar(
                    label: names[a.key] ?? a.key,
                    value: a.n,
                    max: actions.first.n,
                  ),
                  const SizedBox(height: S.x12),
                ],
              ],

              // ── MANBALAR ─────────────────────────────────────
              if (byRef.isNotEmpty) ...[
                const SizedBox(height: S.x24),
                Eyebrow(tr('Manbalar')),
                const SizedBox(height: S.x12),
                for (final r in byRef.take(6)) ...[
                  _Bar(
                    label: '${r['ref']}',
                    value: (r['n'] as num? ?? 0).round(),
                    max: (byRef.first['n'] as num? ?? 1).round(),
                  ),
                  const SizedBox(height: S.x12),
                ],
              ],

              if (total == 0 && uniq == 0)
                EmptyState(
                  tr('Profilingiz ochilgani va kartangiz tegizilgani shu '
                      'yerda ko‘rinadi.'),
                  title: tr('Ma‘lumot to‘planmagan'),
                  icon: Ico.chart,
                ),
            ],
          ),
        ),
      ],
    );
  }

  /// OXIRGI 7 KUN AVVALGI 7 KUNGA NISBATAN.
  ///
  /// Ma'lumot yetmasa (`null`) chip umuman chizilmaydi — noto'g'ri
  /// "+0%" ko'rsatgandan ko'ra hech narsa demagan ma'qul.
  ({String label, StatusTone tone})? _delta(
    List<({String day, int n})> series,
  ) {
    final window = series.length ~/ 2 < 7 ? series.length ~/ 2 : 7;
    if (window < 2) return null;

    var recent = 0;
    var prev = 0;
    for (var i = 0; i < window; i++) {
      recent += series[series.length - 1 - i].n;
      prev += series[series.length - 1 - window - i].n;
    }
    if (prev == 0 && recent == 0) return null;

    final pct = prev == 0
        ? 100
        : (((recent - prev) / prev) * 100).round();
    final sign = pct > 0 ? '+' : '';
    return (
      label: '$sign$pct%',
      tone: pct > 0
          ? StatusTone.ok
          : pct < 0
              ? StatusTone.fail
              : StatusTone.neutral,
    );
  }
}

/// Kunlik ustunlar — oltin gradient, past qismida hairline.
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
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: series[i].n == 0 ? null : C.actionFace,
                  color: series[i].n == 0 ? C.line : null,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(2),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Bitta hodisa turi: nomi, ulush chizig'i va MONO sanoq.
class _Bar extends StatelessWidget {
  const _Bar({required this.label, required this.value, required this.max});

  final String label;
  final int value;
  final int max;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.bodyStrong.copyWith(fontSize: 14),
                ),
              ),
              const SizedBox(width: S.x8),
              Text(som(value), style: T.amount),
            ],
          ),
          const SizedBox(height: 6),
          Container(
            height: 6,
            decoration: BoxDecoration(
              color: C.surfaceHigh,
              borderRadius: BorderRadius.circular(3),
            ),
            child: FractionallySizedBox(
              widthFactor: (value / (max == 0 ? 1 : max)).clamp(0.02, 1.0),
              alignment: Alignment.centerLeft,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: C.actionFace,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
          ),
        ],
      );
}
