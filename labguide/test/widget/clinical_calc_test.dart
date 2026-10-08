import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/design/widgets/lg_widgets.dart';
import 'package:labguide/features/settings/settings_controller.dart';
import 'package:labguide/features/tools/calc_info.dart';
import 'package:labguide/features/tools/clinical_calc_screens.dart';
import 'package:labguide/features/tools/tool_screens.dart';
import 'package:labguide/l10n/gen/app_localizations_en.dart';
import 'package:labguide/l10n/gen/app_localizations_ru.dart';
import 'package:labguide/l10n/gen/app_localizations_uz.dart';
import 'package:material_ui/material_ui.dart';

import '../helpers/harness.dart';

final en = AppLocalizationsEn();
final ru = AppLocalizationsRu();
final uz = AppLocalizationsUz();

Future<void> _tap(WidgetTester tester, String text) async {
  final f = find.text(text);
  await tester.ensureVisible(f.first);
  await tester.pumpAndSettle();
  await tester.tap(f.hitTestable().first);
  await tester.pumpAndSettle();
}

Future<void> _fill(WidgetTester tester, List<String> values) async {
  final fields = find.byType(TextField);
  for (var i = 0; i < values.length; i++) {
    await tester.enterText(fields.at(i), values[i]);
  }
}

/// Har kalkulyator uchun to'g'ri namunaviy kirish (SI — standart birlik).
const _samples = <ClinicalCalc, List<String>>{
  ClinicalCalc.egfr: ['88', '45'],
  ClinicalCalc.acr: ['30', '10'],
  ClinicalCalc.anionGap: ['140', '104', '24', '4', '24', '40'],
  ClinicalCalc.calcium: ['2.1', '30'],
  ClinicalCalc.ldl: ['5.2', '1.3', '1.7'],
  ClinicalCalc.osmolality: ['140', '5', '5', '300'],
  ClinicalCalc.hba1c: ['7'],
};

void main() {
  setUpAll(loadAppFonts);

  testWidgets('eGFR: SI input, sex required, children refused', (tester) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(390, 3200));
    await goTo(tester, '/lab/calculators/egfr');
    await _fill(tester, ['88.4', '40']);
    await _tap(tester, en.dilCalculate);
    expect(find.text(en.errSexMissing), findsOneWidget);

    await _tap(tester, en.sexMale);
    await _tap(tester, en.dilCalculate);
    // 88.4 µmol/L ≈ 1.0 mg/dL, erkak, 40 yosh → 97.6 → 98.
    expect(find.text('98 mL/min/1.73 m²'), findsOneWidget);
    expect(find.text(en.resGfrCategory('G1')), findsOneWidget);

    await _fill(tester, ['50', '12']);
    await _tap(tester, en.dilCalculate);
    expect(find.text(en.errEgfrAge), findsOneWidget);
    expect(find.text('98 mL/min/1.73 m²'), findsNothing);
  });

  testWidgets('LDL in Russian: mmol/L in, mmol/L out, locale decimals', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.ru);
    await pumpApp(tester, s, size: const Size(390, 3200));
    await goTo(tester, '/lab/calculators/ldl');
    await _fill(tester, ['5,2', '1,3', '1,7']);
    await _tap(tester, ru.dilCalculate);
    String n(double v) => formatResult(v, 'ru', maxDecimals: 2);
    expect(find.text('${n(3.9)} mmol/L'), findsOneWidget);
    expect(find.text('${n(3.21)} mmol/L'), findsOneWidget); // Sampson
    expect(find.text('${n(3.12)} mmol/L'), findsOneWidget); // Friedewald

    // TG 5 mmol/L (> 4.52) — Friedewald berilmaydi, Sampson beriladi.
    await _fill(tester, ['7', '1', '5']);
    await _tap(tester, ru.dilCalculate);
    expect(
      find.text(ru.errFriedewaldTg('${formatResult(4.5, 'ru')} mmol/L')),
      findsOneWidget,
    );
  });

  testWidgets('HbA1c in Uzbek: % → IFCC and ADAG eAG', (tester) async {
    final s = await makeServices(tester, language: AppLanguage.uz);
    await pumpApp(tester, s, size: const Size(390, 3200));
    await goTo(tester, '/lab/calculators/hba1c');
    await _fill(tester, ['7']);
    await _tap(tester, uz.dilCalculate);
    expect(find.text('7 % · 53 mmol/mol'), findsOneWidget);
    expect(
      find.text('154 mg/dL · ${formatResult(8.6, 'uz')} mmol/L'),
      findsOneWidget,
    );
    // Oraliqdan tashqarida: konversiya bor, eAG yo'q.
    await _fill(tester, ['14']);
    await _tap(tester, uz.dilCalculate);
    expect(find.textContaining('eAG ko‘rsatilmadi'), findsOneWidget);
  });

  testWidgets('anion gap: albumin correction asks for lab normal albumin', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(390, 3200));
    await goTo(tester, '/lab/calculators/anion-gap');
    await _fill(tester, ['140', '104', '24', '', '24']);
    await _tap(tester, en.dilCalculate);
    expect(find.text(en.errCalcMissing(en.fieldNormalAlbumin)), findsOneWidget);
    await _fill(tester, ['140', '104', '24', '', '24', '40']);
    await _tap(tester, en.dilCalculate);
    expect(find.text('12 mmol/L'), findsOneWidget);
    // 12 + 2.5 × (4.0 − 2.4) = 16
    expect(find.text('16 mmol/L'), findsOneWidget);
  });

  testWidgets('unit typed in the wrong system is caught with its range', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(390, 3200));
    await goTo(tester, '/lab/calculators/calcium');
    // mg/dL qiymat mmol/L tanlanganda kiritilgan.
    await _fill(tester, ['9.2', '40']);
    await _tap(tester, en.dilCalculate);
    expect(find.textContaining(en.fieldCalcium), findsWidgets);
    expect(find.textContaining('mmol/L)'), findsOneWidget);
    expect(find.byType(LgPanel), findsNothing);
  });

  testWidgets('every calculator shows formula, limitations and sources', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(390, 3200));
    for (final c in ClinicalCalc.values) {
      await goTo(tester, '/lab/calculators/${calcRoute(c)}');
      final info = calcInfo[c]!;
      expect(info.refs, isNotEmpty);
      for (final r in info.refs) {
        expect(find.textContaining(r.source.citation), findsOneWidget);
      }
      for (final x in info.limitations) {
        expect(find.text(x.of('en')), findsOneWidget);
      }
    }
  });

  for (final lang in AppLanguage.values) {
    testWidgets('results lay out at 320 px ×2.0 (${lang.name})', (
      tester,
    ) async {
      final s = await makeServices(tester, language: lang);
      await pumpApp(tester, s, size: const Size(320, 4000), textScale: 2);
      for (final c in ClinicalCalc.values) {
        await goTo(tester, '/lab/calculators/${calcRoute(c)}');
        await _fill(tester, _samples[c]!);
        if (c == ClinicalCalc.egfr) {
          await tester.tap(find.byType(LgChoiceChip).last);
          await tester.pumpAndSettle();
        }
        final calculate = find.byType(LgButton).last;
        await tester.ensureVisible(calculate);
        await tester.pumpAndSettle();
        await tester.tap(calculate);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: c.name);
        expect(find.byType(LgPanel), findsOneWidget, reason: c.name);
      }
    });
  }
}
