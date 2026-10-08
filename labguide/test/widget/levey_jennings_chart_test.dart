import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/design/theme.dart';
import 'package:labguide/features/qc/levey_jennings_chart.dart';
import 'package:material_ui/material_ui.dart';

Future<void> _pump(
  WidgetTester tester, {
  required double mean,
  required double sd,
  required List<LjPoint> points,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: buildLgTheme(Brightness.light),
      home: Scaffold(
        body: SizedBox(
          width: 320,
          child: LeveyJenningsChart(
            mean: mean,
            sd: sd,
            points: points,
            semanticLabel: 'chart',
          ),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('chart paints edge cases without errors', (tester) async {
    final cases = <(double, double, List<LjPoint>)>[
      (100, 10, const []),
      (100, 10, const [LjPoint(100, LjMark.ok)]),
      // ±4 SD dan tashqarida — chetga strelka, nuqta yo'qolmaydi.
      (
        100,
        10,
        const [LjPoint(160, LjMark.reject), LjPoint(20, LjMark.reject)],
      ),
      // Juda kichik va juda katta SD.
      (5, 1e-12, const [LjPoint(5.1, LjMark.reject), LjPoint(5, LjMark.ok)]),
      (5, 1e12, const [LjPoint(5.1, LjMark.ok), LjPoint(4.9, LjMark.ok)]),
      // Noto'g'ri SD — faqat chegaralar chiziladi.
      (5, 0, const [LjPoint(5.1, LjMark.ok)]),
      (
        0,
        1,
        [
          for (var i = 0; i < 60; i++)
            LjPoint(i.isEven ? 1.5 : -2.5, LjMark.warning),
        ],
      ),
    ];
    for (final (mean, sd, points) in cases) {
      await _pump(tester, mean: mean, sd: sd, points: points);
      expect(
        tester.takeException(),
        isNull,
        reason: '$mean/$sd/${points.length}',
      );
    }
  });

  testWidgets('chart exposes one semantic label, not painted text', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await _pump(
      tester,
      mean: 100,
      sd: 10,
      points: const [LjPoint(105, LjMark.ok)],
    );
    expect(find.bySemanticsLabel('chart'), findsOneWidget);
    handle.dispose();
  });
}
