import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';

class BusinessStatsScreen extends StatefulWidget {
  const BusinessStatsScreen({
    super.key,
    required this.companyId,
    required this.companyName,
  });

  final String companyId;
  final String companyName;

  @override
  State<BusinessStatsScreen> createState() => _BusinessStatsScreenState();
}

class _BusinessStatsScreenState extends State<BusinessStatsScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  int _days = 30;
  String? _message;

  int _int(dynamic v) =>
      v is num ? v.round() : int.tryParse(v?.toString() ?? '') ?? 0;

  List<Map<String, dynamic>> _maps(dynamic value) => value is List
      ? value
          .whereType<Map>()
          .map((e) => e.cast<String, dynamic>())
          .toList()
      : const [];

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final r = await SessionScope.read(context)
          .repo
          .companyStats(widget.companyId, days: _days);
      if (!mounted) return;
      setState(() {
        _data = r;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _message = 'Statistika yuklanmadi.';
      });
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final data = _data ?? const <String, dynamic>{};
    final series = _maps(data['series']);
    final actions = _maps(data['actions']);
    final items = _maps(data['items']);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Business analytics',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            Text(
              widget.companyName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: p.ink2,
                fontSize: 9.2,
              ),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        color: p.ink,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 34),
          children: [
            Row(
              children: [
                for (final d in const [7, 30, 90]) ...[
                  _PeriodChip(
                    label: d.toString() + ' kun',
                    selected: _days == d,
                    onTap: () {
                      if (_days == d) return;
                      setState(() => _days = d);
                      _load();
                    },
                  ),
                  if (d != 90) const SizedBox(width: 7),
                ],
              ],
            ),
            const SizedBox(height: 18),
            if (_loading && _data == null)
              const SizedBox(
                height: 260,
                child: Center(
                  child: CircularProgressIndicator(strokeWidth: 1.6),
                ),
              )
            else ...[
              Row(
                children: [
                  Expanded(
                    child: _MetricCard(
                      label: 'Ko‘rish',
                      value: _int(data['views']),
                      icon: Icons.visibility_outlined,
                      dark: true,
                    ),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: _MetricCard(
                      label: 'Harakat',
                      value: _int(data['taps']),
                      icon: Icons.touch_app_outlined,
                    ),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: _MetricCard(
                      label: 'Buyurtma',
                      value: _int(data['orders']),
                      icon: Icons.receipt_long_outlined,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              SurfaceCard(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 13),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Reach',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const Spacer(),
                        Text(
                          _days.toString() + 'D',
                          style: TextStyle(
                            color: p.ink2,
                            fontFamily: 'IBMPlexMono',
                            fontSize: 9,
                            letterSpacing: 1,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 17),
                    SizedBox(
                      height: 170,
                      width: double.infinity,
                      child: CustomPaint(
                        painter: _StatsChartPainter(
                          values: series
                              .map((e) => _int(e['views']).toDouble())
                              .toList(),
                          line: p.ink,
                          grid: p.line,
                          accent: p.accent,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Eng ko‘p bosilgan',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 10),
              if (actions.isEmpty)
                const _AnalyticsEmpty(text: 'Hali action statistikasi yo‘q.')
              else
                for (final item in actions.take(6))
                  _RankRow(
                    title: (item['key'] ?? 'Action').toString(),
                    value: _int(item['hits']),
                  ),
              const SizedBox(height: 24),
              Text(
                'Katalog qiziqishi',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 10),
              if (items.isEmpty)
                const _AnalyticsEmpty(text: 'Hali katalog ko‘rishlari yo‘q.')
              else
                for (final item in items.take(6))
                  _RankRow(
                    title: (item['name'] ?? item['id'] ?? 'Item').toString(),
                    value: _int(item['hits']),
                  ),
            ],
            if (_message != null) ...[
              const SizedBox(height: 14),
              Text(
                _message!,
                style: TextStyle(color: p.ink2, fontSize: 10.5),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PeriodChip extends StatelessWidget {
  const _PeriodChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return InkWell(
      borderRadius: BorderRadius.circular(99),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? p.ink : p.surface,
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: selected ? p.ink : p.line),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? p.background : p.ink2,
            fontSize: 9.3,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    this.dark = false,
  });

  final String label;
  final int value;
  final IconData icon;
  final bool dark;

  String _compact(int n) {
    if (n >= 1000000) return (n / 1000000).toStringAsFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toStringAsFixed(1) + 'K';
    return n.toString();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final fg = dark ? const Color(0xFFF8F6EF) : p.ink;
    final muted = dark ? Colors.white.withValues(alpha: .48) : p.ink2;
    return Container(
      height: 126,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: dark ? const Color(0xFF111110) : p.surface,
        borderRadius: BorderRadius.circular(23),
        border: Border.all(
          color: dark ? p.accent.withValues(alpha: .22) : p.line,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 19, color: dark ? p.heroInk : fg),
          const Spacer(),
          Text(
            _compact(value),
            style: TextStyle(
              color: fg,
              fontFamily: 'IBMPlexMono',
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 3),
          Text(label, style: TextStyle(color: muted, fontSize: 8.8)),
        ],
      ),
    );
  }
}

class _RankRow extends StatelessWidget {
  const _RankRow({required this.title, required this.value});

  final String title;
  final int value;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(19),
        border: Border.all(color: p.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            value.toString(),
            style: TextStyle(
              color: p.ink2,
              fontFamily: 'IBMPlexMono',
              fontSize: 9.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _AnalyticsEmpty extends StatelessWidget {
  const _AnalyticsEmpty({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Container(
      height: 82,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: p.line),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium,
      ),
    );
  }
}

class _StatsChartPainter extends CustomPainter {
  const _StatsChartPainter({
    required this.values,
    required this.line,
    required this.grid,
    required this.accent,
  });

  final List<double> values;
  final Color line;
  final Color grid;
  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = grid.withValues(alpha: .75)
      ..strokeWidth = 1;
    for (var i = 0; i < 4; i++) {
      final y = size.height * i / 3;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    if (values.isEmpty) return;
    final maxV = math.max(1.0, values.reduce(math.max));
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = values.length == 1
          ? 0.0
          : size.width * i / (values.length - 1);
      final y = size.height - (values[i] / maxV) * (size.height - 12) - 6;
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    final paint = Paint()
      ..color = line
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, paint);

    final last = values.length - 1;
    final x = values.length == 1 ? 0.0 : size.width;
    final y = size.height -
        (values[last] / maxV) * (size.height - 12) -
        6;
    canvas.drawCircle(
      Offset(x, y),
      4.3,
      Paint()..color = accent,
    );
  }

  @override
  bool shouldRepaint(covariant _StatsChartPainter oldDelegate) =>
      oldDelegate.values != values ||
      oldDelegate.line != line ||
      oldDelegate.grid != grid ||
      oldDelegate.accent != accent;
}
